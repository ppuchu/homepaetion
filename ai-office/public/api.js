// 서버(Cloudflare Worker)와 이야기하는 부분.
// 화면 코드(app.js)는 이 파일의 함수만 쓰므로, 다른 연결 방식으로 바꿀 때는 이 파일만 바꾸면 된다.
const PASSWORD_KEY = "aiOffice.password";
let passwordRequired = false;

function getPassword() {
  try {
    return JSON.parse(localStorage.getItem(PASSWORD_KEY)) || "";
  } catch {
    return "";
  }
}
function setPassword(value) {
  try {
    localStorage.setItem(PASSWORD_KEY, JSON.stringify(value));
  } catch {}
}

async function post(url, payload) {
  const headers = { "Content-Type": "application/json" };
  const password = getPassword();
  if (password) headers["x-office-password"] = password;

  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) setPassword("");
    throw new Error(data.error || `요청 실패 (${res.status})`);
  }
  return res;
}

// 직원 명부와 연결 상태
export async function loadConfig() {
  const res = await fetch("/api/agents");
  const data = await res.json();
  passwordRequired = data.passwordRequired;
  return { agents: data.agents, ready: data.ready, status: data.ready ? `AI 연결됨 · ${data.model}` : "API 키 미설정" };
}

// 오피스 비밀번호가 필요하면 먼저 받는다
export function ensureAccess() {
  if (!passwordRequired || getPassword()) return true;
  const value = prompt("오피스 비밀번호를 입력하세요.");
  if (!value) return false;
  setPassword(value);
  return true;
}

// 직원 답변을 실시간으로 받는다. onText에는 지금까지의 전체 답변이 온다.
export async function chat(agentId, messages, onText) {
  const res = await post("/api/chat", { agentId, messages });
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop();
    for (const raw of events) {
      if (!raw.startsWith("data: ")) continue;
      const event = JSON.parse(raw.slice(6));
      if (event.type === "text") {
        text += event.text;
        onText(text);
      } else if (event.type === "error") {
        throw new Error(event.message);
      }
    }
  }
  return text;
}

// 코토의 업무 배분 계획 { plan, direct_reply, assignments: [{ agentId, task }] }
export async function delegate(messages) {
  return (await post("/api/delegate", { messages })).json();
}
