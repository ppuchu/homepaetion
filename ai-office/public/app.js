const ROOMS = [
  { id: "planning", name: "기획실", deco: "📋🗓️" },
  { id: "studio", name: "디자인 스튜디오", deco: "🖌️🪴" },
  { id: "marketing", name: "마케팅룸", deco: "📊📣" },
  { id: "dev", name: "개발실", deco: "🖥️☕" },
  { id: "admin", name: "경영지원실", deco: "🗄️🧾" },
];

const HISTORY_KEY = "aiOffice.history";
const LOG_KEY = "aiOffice.log";
const PASSWORD_KEY = "aiOffice.password";

const $ = (sel) => document.querySelector(sel);

let agents = [];
let current = null; // 대화 중인 직원
let passwordRequired = false;
const busy = new Set(); // 지금 일하고 있는 직원 id

// ---------- 저장소 (브라우저마다 따로 보관) ----------
function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
const histories = load(HISTORY_KEY, {});
const today = new Date().toLocaleDateString("ko-KR");
let workLog = load(LOG_KEY, []).filter((entry) => entry.date === today);

// ---------- 간단한 마크다운 렌더러 (HTML은 모두 이스케이프) ----------
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
function inline(s) {
  return escapeHtml(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
}
function renderMarkdown(src) {
  const lines = src.replace(/\r/g, "").split("\n");
  const out = [];
  let i = 0;
  const isTableRow = (l) => /^\s*\|.*\|\s*$/.test(l);
  const cells = (l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push(`<pre><code>${escapeHtml(buf.join("\n"))}</code></pre>`);
    } else if (/^#{1,4}\s/.test(line)) {
      const level = line.match(/^#+/)[0].length;
      out.push(`<h${level}>${inline(line.replace(/^#+\s/, ""))}</h${level}>`);
      i++;
    } else if (/^\s*(---|\*\*\*)\s*$/.test(line)) {
      out.push("<hr>");
      i++;
    } else if (isTableRow(line) && isTableRow(lines[i + 1] || "") && /^[\s|:-]+$/.test(lines[i + 1])) {
      const head = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && isTableRow(lines[i])) rows.push(cells(lines[i++]));
      out.push(
        `<table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>` +
          rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("") +
          "</tbody></table>",
      );
    } else if (/^\s*([-*]|\d+\.)\s/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^\s*([-*]|\d+\.)\s/, ""))}</li>`);
        i++;
      }
      out.push(ordered ? `<ol>${items.join("")}</ol>` : `<ul>${items.join("")}</ul>`);
    } else if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(inline(lines[i++].replace(/^>\s?/, "")));
      out.push(`<blockquote>${buf.join("<br>")}</blockquote>`);
    } else if (!line.trim()) {
      i++;
    } else {
      const buf = [];
      while (i < lines.length && lines[i].trim() && !/^(```|#{1,4}\s|>|\s*([-*]|\d+\.)\s)/.test(lines[i]) && !isTableRow(lines[i])) {
        buf.push(inline(lines[i++]));
      }
      out.push(`<p>${buf.join("<br>")}</p>`);
    }
  }
  return out.join("");
}

// ---------- API ----------
async function streamChat(agentId, messages, onText) {
  const headers = { "Content-Type": "application/json" };
  const password = load(PASSWORD_KEY, "");
  if (password) headers["x-office-password"] = password;

  const res = await fetch("/api/chat", { method: "POST", headers, body: JSON.stringify({ agentId, messages }) });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) save(PASSWORD_KEY, "");
    throw new Error(data.error || `요청 실패 (${res.status})`);
  }

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

function ensurePassword() {
  if (!passwordRequired || load(PASSWORD_KEY, "")) return true;
  const value = prompt("오피스 비밀번호를 입력하세요.");
  if (!value) return false;
  save(PASSWORD_KEY, value);
  return true;
}

// ---------- 사무실 배치도 ----------
function renderFloor() {
  const floor = $("#floor");
  floor.innerHTML = "";
  for (const room of ROOMS) {
    const el = document.createElement("div");
    el.className = "room";
    el.innerHTML = `<div class="room-name"><span>${room.name}</span><span class="room-deco">${room.deco}</span></div>`;
    for (const agent of agents.filter((a) => a.room === room.id)) {
      const desk = document.createElement("button");
      desk.className = "desk";
      desk.dataset.id = agent.id;
      desk.style.setProperty("--agent-color", agent.color);
      desk.innerHTML = `
        <span class="avatar">${agent.emoji}</span>
        <span class="info">
          <span class="name">${escapeHtml(agent.name)}</span><span class="title">${escapeHtml(agent.title)}</span>
          <p class="intro">${escapeHtml(agent.intro)}</p>
          <div class="state">대기 중</div>
        </span>`;
      desk.addEventListener("click", () => openDrawer(agent));
      el.append(desk);
    }
    floor.append(el);
  }
  const lounge = document.createElement("div");
  lounge.className = "room lounge";
  lounge.innerHTML = `<div class="big">☕🛋️🪴</div><div>휴게실<br>책상을 클릭해 업무를 맡기세요</div>`;
  floor.append(lounge);
}

function setDeskState(agentId, state) {
  const desk = document.querySelector(`.desk[data-id="${agentId}"]`);
  if (!desk) return;
  desk.classList.remove("working", "done");
  if (state !== "idle") desk.classList.add(state);
  desk.querySelector(".state").textContent = { idle: "대기 중", working: "작업 중…", done: "작업 완료" }[state];
}

// ---------- 업무 일지 ----------
function addLog(agent, task) {
  workLog.unshift({
    date: today,
    time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
    agentId: agent.id,
    text: `${agent.emoji} ${agent.name} · ${task.slice(0, 40)}${task.length > 40 ? "…" : ""}`,
  });
  workLog = workLog.slice(0, 50);
  save(LOG_KEY, workLog);
  renderLog();
}
function renderLog() {
  const list = $("#logList");
  list.innerHTML = "";
  if (!workLog.length) {
    list.innerHTML = `<li class="empty">아직 맡긴 업무가 없어요.</li>`;
    return;
  }
  for (const entry of workLog) {
    const li = document.createElement("li");
    li.innerHTML = `<span class="time">${entry.time}</span>${escapeHtml(entry.text)}`;
    li.addEventListener("click", () => {
      const agent = agents.find((a) => a.id === entry.agentId);
      if (agent) openDrawer(agent);
    });
    list.append(li);
  }
}

// ---------- 메시지 말풍선 ----------
function bubble(container, role, text, speaker) {
  const el = document.createElement("div");
  el.className = `msg ${role}`;
  if (role === "assistant") {
    el.innerHTML = `${speaker ? `<div class="speaker">${escapeHtml(speaker)}</div>` : ""}<div class="md"></div><button class="copy" type="button">복사</button>`;
    el.querySelector(".copy").addEventListener("click", (e) => {
      navigator.clipboard?.writeText(el.dataset.raw || "");
      e.target.textContent = "복사됨";
      setTimeout(() => (e.target.textContent = "복사"), 1200);
    });
    setBubbleText(el, text);
  } else {
    el.textContent = text;
  }
  container.append(el);
  container.scrollTop = container.scrollHeight;
  return el;
}
function setBubbleText(el, text) {
  el.dataset.raw = text;
  el.querySelector(".md").innerHTML = renderMarkdown(text);
}

// ---------- 1:1 대화 ----------
function openDrawer(agent) {
  current = agent;
  const drawer = $("#drawer");
  drawer.style.setProperty("--agent-color", agent.color);
  $("#dAvatar").textContent = agent.emoji;
  $("#dName").textContent = agent.name;
  $("#dTitle").textContent = agent.title;

  const chips = $("#chips");
  chips.innerHTML = "";
  for (const skill of agent.skills) {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.type = "button";
    chip.textContent = skill;
    chip.addEventListener("click", () => {
      $("#input").value = `${skill} 부탁해요.\n- 고객/업종: \n- 요청 사항: `;
      $("#input").focus();
    });
    chips.append(chip);
  }

  renderMessages();
  updateComposer();
  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
  $("#input").focus();
}

function renderMessages() {
  const box = $("#messages");
  box.innerHTML = "";
  const history = histories[current.id] || [];
  if (!history.length) {
    box.innerHTML = `<div class="empty-chat"><div class="big">${current.emoji}</div>안녕하세요, ${escapeHtml(current.title)} ${escapeHtml(current.name)}입니다.<br>${escapeHtml(current.intro)}<br>위의 업무 버튼을 누르거나 직접 적어 주세요.</div>`;
    return;
  }
  for (const m of history) bubble(box, m.role, m.content);
}

function updateComposer() {
  const working = current && busy.has(current.id);
  $("#sendBtn").disabled = working;
  $("#sendBtn").textContent = working ? "작업 중…" : "맡기기";
}

function closeDrawer() {
  $("#drawer").classList.remove("open");
  $("#drawer").setAttribute("aria-hidden", "true");
  current = null;
}

async function sendTask(text) {
  const agent = current;
  if (!agent || busy.has(agent.id) || !text.trim() || !ensurePassword()) return;

  const history = (histories[agent.id] ||= []);
  history.push({ role: "user", content: text });
  // 너무 길어지면 오래된 대화부터 잘라낸다 (user로 시작하도록 2개씩)
  while (history.length > 30) history.splice(0, 2);
  save(HISTORY_KEY, histories);

  if (current === agent) renderMessages();
  busy.add(agent.id);
  setDeskState(agent.id, "working");
  updateComposer();
  addLog(agent, text);

  const box = $("#messages");
  let el = current === agent ? bubble(box, "assistant", "") : null;
  el?.classList.add("typing");

  try {
    const reply = await streamChat(agent.id, history, (partial) => {
      if (current !== agent) return;
      if (!el || !el.isConnected) {
        el = bubble($("#messages"), "assistant", "");
        el.classList.add("typing");
      }
      setBubbleText(el, partial);
      box.scrollTop = box.scrollHeight;
    });
    history.push({ role: "assistant", content: reply });
    save(HISTORY_KEY, histories);
    setDeskState(agent.id, "done");
  } catch (err) {
    history.pop(); // 실패한 요청은 기록에서 뺀다
    save(HISTORY_KEY, histories);
    setDeskState(agent.id, "idle");
    if (current === agent) {
      el?.remove();
      bubble($("#messages"), "error", `⚠️ ${err.message}`);
      $("#input").value ||= text;
    } else {
      alert(`${agent.name}: ${err.message}`);
    }
  } finally {
    el?.classList.remove("typing");
    busy.delete(agent.id);
    updateComposer();
  }
}

// ---------- 회의실 ----------
function openMeeting() {
  const box = $("#attendees");
  box.innerHTML = "";
  for (const agent of agents) {
    const label = document.createElement("label");
    label.className = "attendee";
    label.innerHTML = `<input type="checkbox" value="${agent.id}" checked> ${agent.emoji} ${escapeHtml(agent.name)}`;
    box.append(label);
  }
  $("#meeting").classList.add("open");
  $("#meeting").setAttribute("aria-hidden", "false");
  $("#meetingTopic").focus();
}

async function runMeeting(topic) {
  const ids = [...document.querySelectorAll("#attendees input:checked")].map((i) => i.value);
  const attendees = agents.filter((a) => ids.includes(a.id));
  if (!topic.trim() || !attendees.length || !ensurePassword()) return;

  const minutes = $("#minutes");
  minutes.innerHTML = "";
  bubble(minutes, "user", `안건: ${topic}`);
  $("#meetingStart").disabled = true;

  const said = [];
  for (const agent of attendees) {
    const prompt =
      `[팀 회의] 대표가 낸 안건:\n${topic}\n\n` +
      (said.length ? `앞서 나온 동료 의견:\n${said.map((s) => `- ${s.who}: ${s.text}`).join("\n\n")}\n\n` : "") +
      `당신(${agent.title} ${agent.name})의 전문 분야 관점에서 핵심 의견과 바로 할 일을 짧게(10줄 안팎) 말해 주세요. 앞사람과 겹치는 내용은 반복하지 마세요.`;

    setDeskState(agent.id, "working");
    const el = bubble(minutes, "assistant", "", `${agent.emoji} ${agent.title} ${agent.name}`);
    el.classList.add("typing");
    try {
      const reply = await streamChat(agent.id, [{ role: "user", content: prompt }], (partial) => {
        setBubbleText(el, partial);
        minutes.scrollTop = minutes.scrollHeight;
      });
      said.push({ who: `${agent.title} ${agent.name}`, text: reply });
      setDeskState(agent.id, "done");
    } catch (err) {
      setBubbleText(el, `⚠️ ${err.message}`);
      setDeskState(agent.id, "idle");
    }
    el.classList.remove("typing");
  }
  addLog({ id: attendees[0].id, emoji: "👥", name: "회의" }, topic);
  $("#meetingStart").disabled = false;
}

// ---------- 시작 ----------
async function init() {
  try {
    const res = await fetch("/api/agents");
    const data = await res.json();
    agents = data.agents;
    passwordRequired = data.passwordRequired;
    const status = $("#status");
    status.textContent = data.ready ? `AI 연결됨 · ${data.model}` : "API 키 미설정";
    status.className = `status ${data.ready ? "ok" : "bad"}`;
  } catch {
    $("#status").textContent = "서버 연결 실패";
    $("#status").className = "status bad";
    return;
  }
  renderFloor();
  renderLog();

  $("#closeBtn").addEventListener("click", closeDrawer);
  $("#clearBtn").addEventListener("click", () => {
    if (!current || busy.has(current.id)) return;
    if (!confirm(`${current.name}와(과)의 대화 기록을 지우고 새 업무를 시작할까요?`)) return;
    delete histories[current.id];
    save(HISTORY_KEY, histories);
    setDeskState(current.id, "idle");
    renderMessages();
  });
  $("#composer").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("#input");
    const text = input.value;
    input.value = "";
    sendTask(text);
  });
  $("#input").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      $("#composer").requestSubmit();
    }
  });

  $("#meetingBtn").addEventListener("click", openMeeting);
  $("#meetingClose").addEventListener("click", () => {
    $("#meeting").classList.remove("open");
    $("#meeting").setAttribute("aria-hidden", "true");
  });
  $("#meetingForm").addEventListener("submit", (e) => {
    e.preventDefault();
    runMeeting($("#meetingTopic").value);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if ($("#meeting").classList.contains("open")) $("#meetingClose").click();
    else closeDrawer();
  });
}

init();
