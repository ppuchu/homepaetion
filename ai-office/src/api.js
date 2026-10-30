import Anthropic from "@anthropic-ai/sdk";
import { DELEGATE_SCHEMA, DELEGATE_SYSTEM, findAgent, publicAgents } from "./agents.js";

const DEFAULT_MODEL = "claude-opus-5-5";
const MAX_MESSAGES = 40;
const MAX_CHARS = 20000;

const modelOf = (env) => env.CLAUDE_MODEL || DEFAULT_MODEL;

function json(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return "messages가 비어 있습니다.";
  if (messages.length > MAX_MESSAGES) return `대화가 너무 깁니다. (최대 ${MAX_MESSAGES}개)`;
  for (const [i, m] of messages.entries()) {
    const expected = i % 2 === 0 ? "user" : "assistant";
    if (m?.role !== expected) return "user/assistant 순서가 올바르지 않습니다.";
    if (typeof m.content !== "string" || !m.content.trim()) return "빈 메시지가 있습니다.";
    if (m.content.length > MAX_CHARS) return `메시지가 너무 깁니다. (최대 ${MAX_CHARS}자)`;
  }
  if (messages.at(-1).role !== "user") return "마지막 메시지는 user여야 합니다.";
  return null;
}

// 공통 검사를 통과하면 { body }를, 아니면 { error: Response }를 돌려준다.
async function readValidRequest(request, env) {
  if (request.method !== "POST") return { error: json(405, { error: "POST만 지원합니다." }) };
  // OFFICE_PASSWORD가 설정돼 있으면 비밀번호를 아는 사람만 API를 쓸 수 있다.
  if (env.OFFICE_PASSWORD && request.headers.get("x-office-password") !== env.OFFICE_PASSWORD) {
    return { error: json(401, { error: "오피스 비밀번호가 올바르지 않습니다." }) };
  }
  if (!env.ANTHROPIC_API_KEY) {
    return { error: json(500, { error: "서버에 ANTHROPIC_API_KEY가 설정되지 않았습니다." }) };
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return { error: json(400, { error: "요청 형식이 올바르지 않습니다." }) };
  }
  const invalid = validateMessages(body?.messages);
  if (invalid) return { error: json(400, { error: invalid }) };
  return { body };
}

const clientFor = (env) => new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, baseURL: env.ANTHROPIC_BASE_URL });
const toApi = (messages) => messages.map(({ role, content }) => ({ role, content }));

function errorMessage(err) {
  if (err instanceof Anthropic.AuthenticationError) return "API 키가 올바르지 않습니다.";
  if (err instanceof Anthropic.RateLimitError) return "요청이 많아요. 잠시 후 다시 시도해 주세요.";
  if (err instanceof Anthropic.APIError && err.status >= 500) return "Claude 서버가 일시적으로 불안정해요. 잠시 후 다시 시도해 주세요.";
  if (err instanceof Anthropic.APIConnectionError) return "Claude 서버에 연결하지 못했어요.";
  return "AI 응답 중 오류가 발생했어요.";
}

export function handleAgents(request, env) {
  return json(200, {
    agents: publicAgents(),
    model: modelOf(env),
    ready: Boolean(env.ANTHROPIC_API_KEY),
    passwordRequired: Boolean(env.OFFICE_PASSWORD),
  });
}

// 비서실장 코토가 업무를 어느 직원에게 맡길지 정한다 (JSON 응답).
export async function handleDelegate(request, env) {
  const { body, error } = await readValidRequest(request, env);
  if (error) return error;

  try {
    const response = await clientFor(env).beta.messages.create({
      model: modelOf(env),
      max_tokens: 16000,
      output_config: { effort: "medium", format: { type: "json_schema", schema: DELEGATE_SCHEMA } },
      system: DELEGATE_SYSTEM,
      messages: toApi(body.messages),
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
    if (response.stop_reason === "refusal") {
      return json(422, { error: "이 요청은 처리할 수 없어요. 질문을 바꿔서 다시 맡겨 주세요." });
    }
    const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    const plan = JSON.parse(text);
    // 같은 직원이 여러 번 나오거나 너무 많으면 정리한다
    const seen = new Set();
    plan.assignments = plan.assignments.filter((a) => findAgent(a.agentId) && !seen.has(a.agentId) && seen.add(a.agentId)).slice(0, 4);
    return json(200, plan);
  } catch (err) {
    console.error("[delegate]", err);
    return json(502, { error: err instanceof SyntaxError ? "업무 배분 결과를 읽지 못했어요. 다시 시도해 주세요." : errorMessage(err) });
  }
}

// 직원 답변을 SSE(data: {...})로 실시간 전송한다.
export async function handleChat(request, env) {
  const { body, error } = await readValidRequest(request, env);
  if (error) return error;
  const agent = findAgent(body.agentId);
  if (!agent) return json(400, { error: "존재하지 않는 직원입니다." });

  const stream = clientFor(env).beta.messages.stream({
    model: modelOf(env),
    max_tokens: 64000,
    output_config: { effort: "medium" },
    system: [{ type: "text", text: agent.system, cache_control: { type: "ephemeral" } }],
    messages: toApi(body.messages),
    // 안전 분류기가 거절하면 서버에서 권장 모델로 자동 재시도한다.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      const send = (data) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            send({ type: "text", text: event.delta.text });
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") {
          send({ type: "error", message: "이 요청은 처리할 수 없어요. 질문을 바꿔서 다시 맡겨 주세요." });
        } else {
          send({ type: "done", stopReason: final.stop_reason, usage: final.usage });
        }
      } catch (err) {
        if (err instanceof Anthropic.APIUserAbortError) return;
        console.error("[chat]", err);
        send({ type: "error", message: errorMessage(err) });
      }
      controller.close();
    },
    // 사용자가 창을 닫으면 Claude 요청도 멈춘다
    cancel() {
      stream.abort();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
