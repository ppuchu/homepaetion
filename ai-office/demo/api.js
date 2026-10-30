// 테스트 페이지용 연결: 서버 대신 claude.ai의 Claude를 직접 부른다(보는 사람의 Claude 계정 사용).
// app.js가 쓰는 함수 모양은 public/api.js와 같다.
import { AGENTS, DELEGATE_SYSTEM, STAFF_IDS } from "./agents-data.js";

const byId = Object.fromEntries(AGENTS.map((a) => [a.id, a]));
const samplePromise = window.claude?.use ? window.claude.use("sample").catch(() => null) : Promise.resolve(null);

const ERRORS = {
  not_granted: "Claude 사용을 허용해야 직원이 일할 수 있어요. 페이지를 새로 열고 허용을 눌러 주세요.",
  sampling_disabled: "이 계정에서는 Claude를 쓸 수 없어요.",
  rate_limited: "요청이 많아요. 잠시 후 다시 시도해 주세요.",
  refused: "이 요청은 처리할 수 없어요. 질문을 바꿔서 다시 맡겨 주세요.",
  prompt_too_large: "대화가 너무 길어요. 대화창의 「새 업무」로 기록을 지우고 다시 해 주세요.",
  session_expired: "claude.ai에 다시 로그인해 주세요.",
  invalid_json: "업무 배분 결과를 읽지 못했어요. 다시 시도해 주세요.",
};
// 코토는 Opus, 부서 직원은 Sonnet. 쓸 수 없는 모델이면 claude.ai가 같은 급의 모델로 대신 답한다.
const CHIEF = { model: "claude-opus-5-5", modelTier: "complex" };
const STAFF = { model: "claude-sonnet-5-5", modelTier: "default" };

const toError = (e) => new Error(ERRORS[e?.code] || "Claude 응답 중 오류가 생겼어요. 잠시 후 다시 시도해 주세요.");

async function getSample() {
  const sample = await samplePromise;
  if (!sample) throw new Error("이 화면에서는 Claude를 부를 수 없어요. claude.ai에서 이 페이지를 열어 주세요.");
  return sample;
}

export async function loadConfig() {
  return {
    agents: AGENTS.map(({ system, ...rest }) => rest),
    ready: true,
    status: "테스트 · 코토 Opus · 직원 Sonnet",
  };
}

export const ensureAccess = () => true;

// 부서 지침을 첫 번째 user 턴에 넣고 대화를 이어 붙인다 (sample에는 system 칸이 없다)
export async function chat(agentId, messages, onText) {
  const sample = await getSample();
  const agent = byId[agentId];
  try {
    const { text } = await sample([{ role: "user", content: `${agent.system}\n\n---\n위 지침대로 일해 주세요. 아래부터 대표님과의 대화입니다.` }, ...messages], {
      ...(agent.chief ? CHIEF : STAFF),
      cache: false,
      onText: ({ text }) => onText(text),
    });
    return text;
  } catch (e) {
    throw toError(e);
  }
}

export async function delegate(messages) {
  const sample = await getSample();
  const conversation = messages.map((m) => `${m.role === "user" ? "대표님" : "코토"}: ${m.content}`).join("\n\n");
  const prompt =
    `${DELEGATE_SYSTEM}\n\n# 지금까지의 대화\n${conversation}\n\n` +
    `JSON 객체 하나로만 답하세요: {"plan": string, "direct_reply": string, "assignments": [{"agentId": string, "task": string}]}\n` +
    `agentId는 다음 중 하나여야 합니다: ${STAFF_IDS.join(", ")}`;
  let plan;
  try {
    plan = await sample.json(prompt, { ...CHIEF, cache: false });
  } catch (e) {
    throw toError(e);
  }
  // 서버와 똑같이 정리한다: 없는 부서·중복 제거, 최대 4곳
  const seen = new Set();
  const assignments = (Array.isArray(plan?.assignments) ? plan.assignments : [])
    .filter((a) => STAFF_IDS.includes(a?.agentId) && typeof a.task === "string" && !seen.has(a.agentId) && seen.add(a.agentId))
    .slice(0, 4);
  return { plan: String(plan?.plan || ""), direct_reply: String(plan?.direct_reply || ""), assignments };
}
