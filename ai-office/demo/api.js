// 테스트 페이지용 연결: 서버 대신 claude.ai의 Claude를 직접 부른다(보는 사람의 Claude 계정 사용).
// app.js가 쓰는 함수 모양은 public/api.js와 같다.
import { AGENTS, DELEGATE_SYSTEM, STAFF_IDS } from "./agents-data.js";

const byId = Object.fromEntries(AGENTS.map((a) => [a.id, a]));
const use = (name) => (window.claude?.use ? window.claude.use(name).catch(() => null) : Promise.resolve(null));
const samplePromise = use("sample");
const mcpPromise = use("mcp");

// ---------- 노션 읽기 (대표님 claude.ai의 노션 연결을 그대로 씀, 쓰기는 하지 않음) ----------
const NOTION = "Notion";
const NOTION_ERRORS = {
  needs_reauth: "노션 연결이 만료됐어요. claude.ai 설정 → 커넥터에서 노션을 다시 연결해 주세요.",
  server_not_connected: "claude.ai에 노션이 연결돼 있지 않아요. 설정 → 커넥터에서 노션을 추가해 주세요.",
  not_in_manifest: "이 페이지에서 노션 사용이 허용되지 않았어요.",
  approval_required: "노션 사용 허용이 필요해요.",
  server_unavailable: "노션이 잠시 응답하지 않아요.",
  tool_error: "노션이 요청을 처리하지 못했어요.",
};
const clipText = (value, max) => {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > max ? `${text.slice(0, max)}\n…(이하 생략)` : text;
};

// 직원이 노션을 보는 동안 직원 목록·활동 피드에 표시한다
function showActivity(agent, text) {
  const state = document.querySelector(`.staff[data-id="${agent.id}"] .state`);
  if (state) state.textContent = text;
  const list = document.querySelector("#feedList");
  if (list) {
    list.querySelector(".feed-empty")?.remove();
    const li = document.createElement("li");
    const time = document.createElement("time");
    time.textContent = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
    li.append(time, document.createTextNode(`${agent.emoji} ${agent.name} · ${text}`));
    list.prepend(li);
  }
}

async function notionTools(agent) {
  const [mcp, sample] = await Promise.all([mcpPromise, samplePromise]);
  if (!mcp || !sample) return null;
  const limits = await sample.limits().catch(() => null);
  if (!limits?.tools) return null;
  const call = async (tool, input, label, max, signal) => {
    showActivity(agent, label);
    try {
      const result = await mcp.callTool(NOTION, tool, input, { signal });
      return clipText(result.payload ?? result.content, max);
    } catch (e) {
      throw new Error(NOTION_ERRORS[e?.code] || "노션을 읽지 못했어요.");
    }
  };
  return [
    {
      name: "notion_search",
      description: "대표님 노션에서 페이지·데이터베이스를 키워드로 찾는다. 제목·주소·짧은 내용 일부를 돌려준다. 업무에 노션 자료(캘린더, 장부, 보관함, 채팅 기록 등)가 필요할 때 먼저 쓴다.",
      inputSchema: { type: "object", properties: { query: { type: "string", description: "짧고 구체적인 검색어" } }, required: ["query"] },
      execute: (input, { signal }) => call("notion-search", { query: String(input.query || ""), page_size: 6, max_highlight_length: 160 }, `노션 검색: ${String(input.query || "").slice(0, 20)}`, 8000, signal),
    },
    {
      name: "notion_fetch",
      description: "노션 페이지나 데이터베이스 하나를 주소(URL) 또는 id로 열어 내용을 읽는다. notion_search로 찾은 주소를 넣는다. 읽기만 하고 고치지 않는다.",
      inputSchema: { type: "object", properties: { id: { type: "string", description: "노션 페이지 URL 또는 id" } }, required: ["id"] },
      execute: (input, { signal }) => call("notion-fetch", { id: String(input.id || "") }, "노션 페이지 읽는 중", 24000, signal),
    },
  ];
}

const NOTION_NOTE = `\n\n# 노션 읽기
이 사무실에서는 노션을 읽을 수 있습니다(notion_search로 찾고 notion_fetch로 읽기). 업무에 대표님 노션 자료가 필요하면 찾아 읽고, 읽은 페이지 제목을 결과물에 밝혀 주세요. 필요 없으면 쓰지 않습니다.
노션에 쓰기·수정은 할 수 없습니다. 노션에 남겨야 할 내용은 초안으로 만들고 어디에 넣을지 적어 주세요.`;

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
  const tools = await notionTools(agent);
  try {
    const intro = `${agent.system}${tools ? NOTION_NOTE : ""}\n\n---\n위 지침대로 일해 주세요. 아래부터 대표님과의 대화입니다.`;
    const { text } = await sample([{ role: "user", content: intro }, ...messages], {
      ...(agent.chief ? CHIEF : STAFF),
      cache: false,
      ...(tools ? { tools } : {}),
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
