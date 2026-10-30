import Anthropic from "@anthropic-ai/sdk";
import { findAgent, publicAgents } from "./agents.js";

const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";
const MAX_MESSAGES = 40;
const MAX_CHARS = 20000;

let client;
function getClient() {
  // ANTHROPIC_API_KEY 환경변수에서 키를 읽는다.
  client ??= new Anthropic();
  return client;
}

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

// OFFICE_PASSWORD가 설정돼 있으면 비밀번호를 아는 사람만 API를 쓸 수 있다.
function isAuthorized(req) {
  const password = process.env.OFFICE_PASSWORD;
  return !password || req.headers["x-office-password"] === password;
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body; // Vercel이 미리 파싱한 경우
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > MAX_MESSAGES * MAX_CHARS) throw new Error("요청이 너무 큽니다.");
  }
  return raw ? JSON.parse(raw) : {};
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

export async function handleAgents(req, res) {
  sendJson(res, 200, {
    agents: publicAgents(),
    model: MODEL,
    ready: Boolean(process.env.ANTHROPIC_API_KEY),
    passwordRequired: Boolean(process.env.OFFICE_PASSWORD),
  });
}

export async function handleChat(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "POST만 지원합니다." });
  if (!isAuthorized(req)) return sendJson(res, 401, { error: "오피스 비밀번호가 올바르지 않습니다." });
  if (!process.env.ANTHROPIC_API_KEY) {
    return sendJson(res, 500, { error: "서버에 ANTHROPIC_API_KEY가 설정되지 않았습니다." });
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    return sendJson(res, 400, { error: "요청 형식이 올바르지 않습니다." });
  }

  const agent = findAgent(body.agentId);
  if (!agent) return sendJson(res, 400, { error: "존재하지 않는 직원입니다." });
  const invalid = validateMessages(body.messages);
  if (invalid) return sendJson(res, 400, { error: invalid });

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  const stream = getClient().beta.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    output_config: { effort: "medium" },
    system: [{ type: "text", text: agent.system, cache_control: { type: "ephemeral" } }],
    messages: body.messages.map(({ role, content }) => ({ role, content })),
    // 안전 분류기가 거절하면 서버에서 권장 모델로 자동 재시도한다.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  });
  req.on("close", () => {
    if (!res.writableEnded) stream.abort();
  });

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
    let message = "AI 응답 중 오류가 발생했어요.";
    if (err instanceof Anthropic.AuthenticationError) message = "API 키가 올바르지 않습니다.";
    else if (err instanceof Anthropic.RateLimitError) message = "요청이 많아요. 잠시 후 다시 시도해 주세요.";
    else if (err instanceof Anthropic.APIError && err.status >= 500) message = "Claude 서버가 일시적으로 불안정해요. 잠시 후 다시 시도해 주세요.";
    else if (err instanceof Anthropic.APIConnectionError) message = "Claude 서버에 연결하지 못했어요.";
    send({ type: "error", message });
  }
  res.end();
}
