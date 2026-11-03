import { createOffice } from "./office.js";
import { escapeHtml, renderMarkdown } from "./markdown.js";
import { createMessenger } from "./messenger.js";
import { chat, delegate, ensureAccess, loadConfig } from "./api.js";
import { openStore } from "./store.js";

const $ = (sel) => document.querySelector(sel);

let agents = [];
let office = null; // 픽셀아트 사무실
let messenger = null; // 사내 메신저
let current = null; // 대화 중인 직원
const busy = new Set(); // 지금 일하고 있는 직원 id

// ---------- 저장소 (store.js가 정한 곳에 보관) ----------
let store = null;
const histories = {}; // 직원 id → 대화 기록
const saveHistories = () => store?.saveHistories(histories);

// 다른 기기에서 바뀐 기록을 반영한다. 지금 일하고 있는 직원의 기록은 이 화면 것을 그대로 둔다.
function applyRemote(data) {
  for (const id of Object.keys(histories)) if (!busy.has(id) && !(id in data.histories)) delete histories[id];
  for (const [id, list] of Object.entries(data.histories)) if (!busy.has(id)) histories[id] = list;
  messenger.replaceAll(data.messages);
  if (current && !busy.has(current.id)) renderMessages();
}

// ---------- API ----------
const toApi = (history) => history.map(({ role, content }) => ({ role, content }));
const clip = (text, max) => (text.length > max ? `${text.slice(0, max)}\n…(이하 생략)` : text);
const streamChat = (agentId, messages, onText) => chat(agentId, toApi(messages), onText);
const ensurePassword = ensureAccess;

// ---------- 직원 목록 (사무실 아래) ----------
const STATE_LABEL = { idle: "대기 중", working: "작업 중…", done: "작업 완료" };

const working = new Set(); // 사무실에서 일하고 있는 직원 (층 탭 표시용)
const MAX_ATTENDEES = 8;

function renderFloorTabs() {
  const tabs = $("#floorTabs");
  tabs.innerHTML = "";
  for (const floor of office.floors) {
    const btn = document.createElement("button");
    btn.className = "floor-tab";
    btn.type = "button";
    btn.setAttribute("role", "tab");
    btn.dataset.floor = floor.id;
    btn.innerHTML = `${floor.icon} ${escapeHtml(floor.name)} <span class="badge" hidden></span>`;
    btn.addEventListener("click", () => office.setFloor(floor.id));
    tabs.append(btn);
  }
}

function updateFloorTabs(active) {
  for (const btn of document.querySelectorAll(".floor-tab")) {
    if (active) btn.setAttribute("aria-selected", String(btn.dataset.floor === active));
    const count = [...working].filter((id) => office.floorOf(id) === btn.dataset.floor).length;
    const badge = btn.querySelector(".badge");
    badge.hidden = !count;
    badge.textContent = `${count}명 작업 중`;
  }
}

function renderRoster() {
  const roster = $("#roster");
  roster.innerHTML = "";
  for (const floor of office.floors) {
    const group = document.createElement("div");
    group.className = "roster-group";
    group.innerHTML = `<h3>${floor.icon} ${escapeHtml(floor.name)}</h3><div class="roster-grid"></div>`;
    for (const agent of agents.filter((a) => office.floorOf(a.id) === floor.id)) {
      const btn = document.createElement("button");
      btn.className = `staff${agent.chief || agent.lead ? " chief" : ""}`;
      btn.dataset.id = agent.id;
      btn.style.setProperty("--agent-color", agent.color);
      btn.innerHTML = `
        <img src="${office.avatar(agent.id)}" alt="" />
        <span class="info">
          <span class="name">${escapeHtml(agent.name)}<small>${escapeHtml(agent.title)}</small></span>
          <span class="state">${STATE_LABEL.idle}</span>
        </span>`;
      btn.title = agent.intro;
      btn.addEventListener("click", () => openDrawer(agent));
      group.querySelector(".roster-grid").append(btn);
    }
    roster.append(group);
  }
}

function setDeskState(agentId, state, label) {
  office?.setWorking(agentId, state === "working");
  if (state === "working") working.add(agentId);
  else working.delete(agentId);
  updateFloorTabs();
  if (state === "done") office?.flash(agentId);
  const staff = document.querySelector(`.staff[data-id="${agentId}"]`);
  if (!staff) return;
  staff.classList.remove("working", "done");
  if (state !== "idle") staff.classList.add(state);
  staff.querySelector(".state").textContent = label || STATE_LABEL[state];
}

// ---------- 메신저용 보고·질문 줄 ----------
// 직원 답변 끝의 "보고: …", "질문: …" 줄은 메신저로 옮기고 결과물에서는 뺀다.
const META_LINE = /^[ \t>*-]*\**\s*(보고|질문)\s*\**\s*[:：]\s*(.+?)\s*$/gm;
function parseReply(raw) {
  const reports = [];
  const questions = [];
  const text = raw
    .replace(META_LINE, (_, kind, body) => {
      const clean = body.replace(/\*\*/g, "").trim();
      if (kind === "보고") reports.push(clean);
      else if (!/^(없음|없습니다)\.?$/.test(clean)) questions.push(clean);
      return "";
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text, report: reports.join(" "), questions };
}
const display = (raw) => parseReply(raw).text;
const agentById = (id) => agents.find((a) => a.id === id);
const chiefAgent = () => agents.find((a) => a.chief);

// ---------- 메시지 말풍선 (1:1 대화창) ----------
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
  closeMeeting();
  office.setFloor(office.floorOf(agent.id));
  current = agent;
  const drawer = $("#drawer");
  drawer.style.setProperty("--agent-color", agent.color);
  $("#dAvatar").src = office.avatar(agent.id, 4);
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
  if (!current) return;
  const box = $("#messages");
  box.innerHTML = "";
  const history = histories[current.id] || [];
  if (!history.length) {
    box.innerHTML = `<div class="empty-chat"><img class="big-avatar" src="${office.avatar(current.id, 5)}" alt="" />안녕하세요, ${escapeHtml(current.title)} ${escapeHtml(current.name)}입니다.<br>${escapeHtml(current.intro)}<br>위의 업무 버튼을 누르거나 직접 적어 주세요.</div>`;
    return;
  }
  for (const m of history) {
    for (const part of m.parts || []) bubble(box, "assistant", part.text, part.speaker);
    const text = m.role === "assistant" ? display(m.content) : m.content;
    bubble(box, m.role, text, m.parts ? `${current.emoji} ${current.title} ${current.name} · 보고` : undefined);
  }
}

function updateComposer() {
  const isBusy = current && busy.has(current.id);
  $("#sendBtn").disabled = isBusy;
  $("#sendBtn").textContent = isBusy ? "작업 중…" : "맡기기";
}

function closeDrawer() {
  $("#drawer").classList.remove("open");
  $("#drawer").setAttribute("aria-hidden", "true");
  current = null;
}

// ---------- 직원에게 일 시키기 ----------
// 같은 직원의 일은 차례대로 처리한다(대화 기록 순서가 섞이지 않게).
// 대화창이 열려 있으면 답변을 실시간으로 보여 준다.
const queues = new Map();
function work(agent, text, { label, onPartial } = {}) {
  const run = async () => {
    const history = (histories[agent.id] ||= []);
    history.push({ role: "user", content: text });
    // 너무 길어지면 오래된 대화부터 잘라낸다 (user로 시작하도록 2개씩)
    while (history.length > 30) history.splice(0, 2);
    saveHistories();
    busy.add(agent.id);
    setDeskState(agent.id, "working", label);
    updateComposer();

    let el = null;
    const showLive = (partial) => {
      if (current !== agent) return;
      if (!el?.isConnected) {
        renderMessages();
        el = bubble($("#messages"), "assistant", "");
        el.classList.add("typing");
      }
      setBubbleText(el, display(partial));
      $("#messages").scrollTop = $("#messages").scrollHeight;
    };
    showLive("");
    try {
      const reply = await streamChat(agent.id, history, (partial) => {
        showLive(partial);
        onPartial?.(partial);
      });
      history.push({ role: "assistant", content: reply });
      saveHistories();
      setDeskState(agent.id, "done");
      return parseReply(reply);
    } catch (err) {
      history.pop();
      saveHistories();
      setDeskState(agent.id, "idle");
      if (current === agent) renderMessages();
      throw err;
    } finally {
      el?.classList.remove("typing");
      busy.delete(agent.id);
      updateComposer();
    }
  };
  const next = (queues.get(agent.id) || Promise.resolve()).catch(() => {}).then(run);
  queues.set(agent.id, next);
  return next;
}

// 직원의 결과를 메신저에 올린다: 완료 보고, 그리고 확인이 필요한 질문
function postResult(agent, { text, report, questions }, ch = "work") {
  if (report) {
    messenger.post({ ch, from: agent.id, kind: "report", text: report, link: agent.id });
  } else {
    const short = text.length > 500;
    messenger.post({ ch, from: agent.id, text: short ? `${text.slice(0, 500)}…` : text, link: short ? agent.id : undefined });
  }
  for (const q of questions) messenger.post({ ch, from: agent.id, kind: "question", text: q, agentId: agent.id });
  if (questions.length && !agent.chief) {
    messenger.post({ ch, from: chiefAgent().id, text: `대표님, ${agent.name}님이 확인을 요청했어요. 질문 아래 '답장하기'로 답해 주시면 바로 전달할게요.` });
  }
}

function postError(agent, err, ch = "work") {
  messenger.post({ ch, from: agent.id, text: `⚠️ 작업 중 문제가 생겼어요: ${err.message}` });
}

const ACKS = ["네, 바로 착수할게요!", "확인했습니다. 시작할게요.", "받았습니다! 금방 드릴게요.", "넵, 진행하겠습니다 🙌"];
const pickAck = () => ACKS[Math.floor(Math.random() * ACKS.length)];

// 1:1 대화창에서 보내기
async function sendTask(text) {
  const agent = current;
  if (!agent || busy.has(agent.id) || !text.trim() || !ensurePassword()) return;
  if (agent.chief) return delegateTask(text, { fromDrawer: true });

  messenger.post({ from: "ceo", text: `@${agent.name} ${clip(text, 300)}`, quiet: true });
  try {
    postResult(agent, await work(agent, text));
  } catch (err) {
    if (current === agent) {
      bubble($("#messages"), "error", `⚠️ ${err.message}`);
      $("#input").value ||= text;
    }
    postError(agent, err);
  }
}

// 메신저에서 보내기: 코토에게 보내면 업무 배분, 직원에게 보내면 그 직원이 답한다
async function sendFromMessenger(agentId, text, channel) {
  const agent = agentById(agentId);
  const ch = channel === "log" ? "work" : channel;
  messenger.post({ ch, from: "ceo", text: `@${agent.name} ${text}` });
  if (!ensurePassword()) return;
  if (agent.chief) return delegateTask(text);
  try {
    postResult(agent, await work(agent, `[사내 메신저 #${ch === "lounge" ? "라운지" : ch === "meeting" ? "회의" : "업무"}] 대표님: ${text}`), ch);
  } catch (err) {
    postError(agent, err, ch);
  }
}

// 직원의 질문에 대표님이 답하면, 그 답을 반영해 이어서 작업한다
async function answerQuestion(agentId, question, answer) {
  const agent = agentById(agentId);
  messenger.post({ from: "ceo", kind: "answer", text: `@${agent.name} ${answer}` });
  if (!ensurePassword()) return;
  messenger.post({ from: agent.id, kind: "ack", text: "답변 감사합니다! 반영해서 이어서 할게요.", quiet: true });
  try {
    postResult(agent, await work(agent, `[대표님 답변]\n질문: ${question}\n답변: ${answer}\n\n이 답을 반영해서 이어서 진행해 주세요.`, { label: "답변 반영 중…" }));
  } catch (err) {
    postError(agent, err);
  }
}

// ---------- 비서실장 코토의 업무 배분 ----------
async function delegateTask(text, { fromDrawer } = {}) {
  const chief = chiefAgent();
  if (busy.has(chief.id)) {
    messenger.post({ from: chief.id, text: "지금 다른 업무를 배분하고 있어요. 끝나면 다시 말씀해 주세요!" });
    return;
  }
  if (fromDrawer) messenger.post({ from: "ceo", text: `@${chief.name} ${clip(text, 300)}`, quiet: true });

  const history = (histories[chief.id] ||= []);
  history.push({ role: "user", content: text });
  while (history.length > 30) history.splice(0, 2);
  saveHistories();

  if (current === chief) renderMessages();
  busy.add(chief.id);
  setDeskState(chief.id, "working", "업무 배분 중…");
  updateComposer();

  const box = () => $("#messages");
  const show = (role, text, speaker) => (current === chief ? bubble(box(), role, text, speaker) : null);
  const chiefName = `${chief.emoji} ${chief.title} ${chief.name}`;
  const parts = [];

  try {
    const el = show("assistant", "업무를 검토하고 있어요…", chiefName);
    el?.classList.add("typing");
    const plan = await delegate(toApi(history));
    el?.remove();

    // 부서가 필요 없는 일은 코토가 바로 답한다
    if (!plan.assignments.length) {
      const reply = plan.direct_reply || plan.plan;
      show("assistant", reply);
      messenger.post({ from: chief.id, text: reply });
      history.push({ role: "assistant", content: reply });
      saveHistories();
      setDeskState(chief.id, "done");
      return;
    }

    const planText =
      `**📋 업무 배분**\n\n${plan.plan}\n\n` +
      plan.assignments
        .map((a, i) => {
          const staff = agentById(a.agentId);
          return `${i + 1}. **${staff.emoji} ${staff.name}** (${staff.title}): ${a.task}`;
        })
        .join("\n");
    parts.push({ speaker: chiefName, text: planText });
    show("assistant", planText, chiefName);
    messenger.post({ from: chief.id, text: `📋 ${plan.plan}` });
    for (const a of plan.assignments) {
      const staff = agentById(a.agentId);
      messenger.post({ from: chief.id, kind: "assign", text: `@${staff.name} ${a.task}`, agentId: staff.id });
    }
    // 코토가 담당자 자리로 걸어가 업무를 전달한다 (응답을 기다리지 않고 함께 진행)
    office.deliver(chief.id, plan.assignments.map((a) => a.agentId));
    setDeskState(chief.id, "working", "직원들 작업 관리 중…");

    const results = [];
    for (const a of plan.assignments) {
      const staff = agentById(a.agentId);
      const speaker = `${staff.emoji} ${staff.title} ${staff.name}`;
      const prev = results.at(-1);
      messenger.post({ from: staff.id, kind: "ack", text: prev ? `${pickAck()} @${prev.name}님 결과 받아서 이어갈게요.` : pickAck() });
      const prompt =
        `[비서실장 코토 전달 업무]\n${a.task}\n\n` +
        `대표님 원래 지시: ${clip(text, 2000)}` +
        (results.length ? `\n\n참고할 동료 결과물:\n${results.map((r) => `### ${r.speaker}\n${clip(r.text, 3000)}`).join("\n\n")}` : "");

      let staffEl = show("assistant", "", speaker);
      staffEl?.classList.add("typing");
      try {
        const result = await work(staff, prompt, {
          label: "코토 지시로 작업 중…",
          onPartial: (partial) => {
            if (current !== chief) return;
            if (!staffEl?.isConnected) staffEl = bubble(box(), "assistant", "", speaker);
            setBubbleText(staffEl, display(partial));
            box().scrollTop = box().scrollHeight;
          },
        });
        results.push({ speaker, name: staff.name, text: result.text });
        parts.push({ speaker, text: result.text });
        postResult(staff, result);
      } catch (err) {
        const failed = `⚠️ ${err.message}`;
        if (staffEl) setBubbleText(staffEl, failed);
        parts.push({ speaker, text: failed });
        postError(staff, err);
      }
      staffEl?.classList.remove("typing");
    }

    if (!results.length) throw new Error("모든 직원의 작업이 실패했어요. 잠시 후 다시 시도해 주세요.");

    setDeskState(chief.id, "working", "보고서 작성 중…");
    let reportEl = show("assistant", "", `${chiefName} · 보고`);
    reportEl?.classList.add("typing");
    const reportPrompt =
      `대표님 지시: ${clip(text, 2000)}\n\n직원 결과물:\n` +
      results.map((r) => `### ${r.speaker}\n${clip(r.text, 4000)}`).join("\n\n") +
      `\n\n위 결과물을 바탕으로 대표님께 보고해 주세요. 결과물 전문은 대표님이 위에서 볼 수 있으니 반복하지 말고 요약과 결정할 일 위주로 써 주세요.`;
    const report = await streamChat(chief.id, [{ role: "user", content: reportPrompt }], (partial) => {
      if (current !== chief) return;
      if (!reportEl?.isConnected) reportEl = bubble(box(), "assistant", "", `${chiefName} · 보고`);
      setBubbleText(reportEl, display(partial));
      box().scrollTop = box().scrollHeight;
    });
    reportEl?.classList.remove("typing");

    const parsed = parseReply(report);
    history.push({ role: "assistant", content: report, parts });
    saveHistories();
    messenger.post({ from: chief.id, kind: "report", text: `대표님, 보고드립니다. ${parsed.report || clip(parsed.text.replace(/\s+/g, " "), 200)}`, link: chief.id });
    for (const q of parsed.questions) messenger.post({ from: chief.id, kind: "question", text: q, agentId: chief.id });
    setDeskState(chief.id, "done", "보고 완료");
  } catch (err) {
    if (parts.length) {
      // 직원 결과물은 남기고, 보고 단계 실패만 알린다
      history.push({ role: "assistant", content: `⚠️ 보고서 작성 실패: ${err.message}`, parts });
    } else {
      history.pop();
      if (current === chief) $("#input").value ||= text;
    }
    saveHistories();
    setDeskState(chief.id, "idle");
    postError(chief, err);
    if (current === chief) {
      renderMessages();
      if (!parts.length) bubble(box(), "error", `⚠️ ${err.message}`);
    }
  } finally {
    busy.delete(chief.id);
    updateComposer();
  }
}

// ---------- 업무일지 ----------
// 오늘 메신저 기록(#업무, #회의)을 코토가 업무일지로 정리해 #업무일지에 올린다
async function writeDailyLog() {
  const chief = chiefAgent();
  if (busy.has(chief.id)) {
    messenger.post({ ch: "log", from: chief.id, text: "지금 다른 일을 하고 있어요. 끝나면 다시 눌러 주세요!" });
    return;
  }
  const items = messenger.today().filter((m) => m.kind !== "log");
  if (!items.length) {
    messenger.post({ ch: "log", from: chief.id, text: "오늘은 아직 기록된 업무가 없어요." });
    return;
  }
  if (!ensurePassword()) return;
  const date = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" });
  const lines = items
    .map((m) => `[${new Date(m.time).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}] #${m.ch === "meeting" ? "회의" : "업무"} ${m.who}${m.kind && m.kind !== "talk" ? ` (${m.kind})` : ""}: ${m.text.replace(/\s+/g, " ")}`)
    .join("\n");
  const prompt =
    `아래는 오늘(${date}) 사내 메신저 기록입니다. 대표님께 드릴 오늘의 업무일지를 써 주세요.\n` +
    `형식: # ${date} 업무일지 → ## 한눈에 보기(3줄) → ## 부서별 완료한 일 → ## 진행 중·대기 → ## 대표님 확인 필요(답하지 않은 질문 포함) → ## 내일 할 일\n` +
    `기록에 없는 일은 지어내지 마세요.\n\n${lines}`;

  const id = messenger.post({ ch: "log", from: chief.id, kind: "log", text: "업무일지를 쓰고 있어요…", quiet: true });
  busy.add(chief.id);
  setDeskState(chief.id, "working", "업무일지 작성 중…");
  updateComposer();
  try {
    const raw = await streamChat(chief.id, [{ role: "user", content: clip(prompt, 18000) }], (partial) => messenger.update(id, { text: display(partial) }));
    messenger.update(id, { text: display(raw) });
    setDeskState(chief.id, "done", "업무일지 작성 완료");
  } catch (err) {
    messenger.update(id, { text: `⚠️ 업무일지 작성 실패: ${err.message}` });
    setDeskState(chief.id, "idle");
  } finally {
    busy.delete(chief.id);
    updateComposer();
  }
}

// ---------- 휴게실 잡담 (미리 써 둔 대사, API를 쓰지 않음) ----------
const SMALL_TALK = [
  ["커피 한 잔 하실래요? ☕", "좋아요! 저는 라떼로요"],
  ["오늘 일 많네요 😮‍💨", "그러게요, 힘내요 우리 💪"],
  ["점심 뭐 드셨어요?", "김밥이요 ㅎㅎ 금방 먹고 왔어요"],
  ["아까 올린 결과물 좋던데요!", "앗 고마워요 😊"],
  ["잠깐 바람 쐬러 왔어요", "저도요~ 머리 좀 식히려고요"],
  ["대표님 오늘 기분 좋아 보이시던데요", "그럼 보고 잘 드려야겠네요 ㅎㅎ"],
  ["이번 주 마감 몇 개 남으셨어요?", "두 개요! 거의 다 왔어요"],
  ["간식 새로 들어왔대요 🍪", "오 진짜요? 이따 가볼게요"],
];
let lastChat = 0;
function loungeChat(id, mates) {
  if (!mates.length || Date.now() - lastChat < 45000) return;
  lastChat = Date.now();
  const [a, b] = SMALL_TALK[Math.floor(Math.random() * SMALL_TALK.length)];
  const mate = mates[Math.floor(Math.random() * mates.length)];
  messenger.post({ ch: "lounge", from: id, text: a, quiet: true });
  setTimeout(() => messenger.post({ ch: "lounge", from: mate, text: b, quiet: true }), 2500);
}

// ---------- 회의실 ----------
function closeMeeting() {
  $("#meeting").classList.remove("open");
  $("#meeting").setAttribute("aria-hidden", "true");
}

function openMeeting() {
  closeDrawer();
  const box = $("#attendees");
  box.innerHTML = "";
  for (const floor of office.floors) {
    const row = document.createElement("div");
    row.className = "attendee-row";
    row.innerHTML = `<span class="attendee-floor">${floor.icon} ${escapeHtml(floor.name)}</span>`;
    for (const agent of agents.filter((a) => !a.chief && office.floorOf(a.id) === floor.id)) {
      const label = document.createElement("label");
      label.className = "attendee";
      label.innerHTML = `<input type="checkbox" value="${agent.id}"> ${agent.emoji} ${escapeHtml(agent.name)}<small>${escapeHtml(agent.title)}</small>`;
      row.append(label);
    }
    box.append(row);
  }
  // 고른 순서를 기억해 그 순서대로 발언하게 하고, 8명이 차면 나머지는 막는다
  box.onchange = (e) => {
    if (e.target.checked) e.target.dataset.order = String(Date.now());
    const checked = box.querySelectorAll("input:checked").length;
    for (const input of box.querySelectorAll("input")) input.disabled = !input.checked && checked >= MAX_ATTENDEES;
  };
  $("#meeting").classList.add("open");
  $("#meeting").setAttribute("aria-hidden", "false");
  $("#minutes").scrollTop = 0;
  $("#meetingTopic").focus();
}

async function runMeeting(topic) {
  const ids = [...document.querySelectorAll("#attendees input:checked")]
    .sort((a, b) => Number(a.dataset.order) - Number(b.dataset.order))
    .map((i) => i.value);
  const attendees = ids.map((id) => agentById(id));
  const hint = $("#meetingHint");
  hint.textContent = !topic.trim() ? "회의 안건을 적어 주세요." : !attendees.length ? "참석할 직원을 골라 주세요." : "";
  if (hint.textContent) return;
  if (!ensurePassword()) return;

  const minutes = $("#minutes");
  minutes.innerHTML = "";
  bubble(minutes, "user", `안건: ${topic}`);
  $("#meetingStart").disabled = true;
  messenger.post({ ch: "meeting", from: "ceo", text: `회의 소집: **${topic}**\n참석: ${attendees.map((a) => a.name).join(", ")}` });

  office.setFloor(office.gather(attendees.map((a) => a.id)));
  const said = [];
  for (const agent of attendees) {
    const prompt =
      `[팀 회의] 대표님이 낸 안건:\n${topic}\n\n` +
      (said.length ? `앞서 나온 동료 의견:\n${said.map((s) => `- ${s.who}: ${s.text}`).join("\n\n")}\n\n` : "") +
      `당신(${agent.title} ${agent.name})의 전문 분야 관점에서 핵심 의견과 바로 할 일을 짧게(10줄 안팎) 말해 주세요. 앞사람과 겹치는 내용은 반복하지 마세요.`;

    setDeskState(agent.id, "working", "회의 중…");
    const el = bubble(minutes, "assistant", "", `${agent.emoji} ${agent.title} ${agent.name}`);
    el.classList.add("typing");
    try {
      const reply = display(
        await streamChat(agent.id, [{ role: "user", content: prompt }], (partial) => {
          setBubbleText(el, display(partial));
          minutes.scrollTop = minutes.scrollHeight;
        }),
      );
      setBubbleText(el, reply);
      said.push({ who: `${agent.title} ${agent.name}`, text: reply });
      messenger.post({ ch: "meeting", from: agent.id, text: reply.length > 400 ? `${reply.slice(0, 400)}…` : reply, quiet: true });
      setDeskState(agent.id, "done");
    } catch (err) {
      setBubbleText(el, `⚠️ ${err.message}`);
      setDeskState(agent.id, "idle");
    }
    el.classList.remove("typing");
  }
  office.disperse(attendees.map((a) => a.id));
  messenger.post({ ch: "meeting", from: chiefAgent().id, text: `회의를 마쳤어요. 발언 ${said.length}건이 기록됐어요.` });
  $("#meetingStart").disabled = false;
}

// ---------- 시작 ----------
async function init() {
  try {
    const config = await loadConfig();
    agents = config.agents;
    const status = $("#status");
    status.textContent = config.status;
    status.className = `status ${config.ready ? "ok" : "bad"}`;
    store = await openStore();
    Object.assign(histories, store.histories);
    status.textContent += ` · ${store.label}`;
  } catch {
    $("#status").textContent = "서버 연결 실패";
    $("#status").className = "status bad";
    return;
  }
  office = createOffice({
    canvas: $("#office"),
    overlay: $("#overlay"),
    agents,
    onSelect: (id) => openDrawer(agentById(id)),
    onMeeting: openMeeting,
    onFloorChange: (id) => updateFloorTabs(id),
    onLounge: loungeChat,
  });
  messenger = createMessenger({
    root: $("#messenger"),
    agents,
    avatar: (id) => office.avatar(id, 2),
    onOpenAgent: (id) => openDrawer(agentById(id)),
    onSend: sendFromMessenger,
    onAnswer: answerQuestion,
    onWriteLog: writeDailyLog,
    initial: store.messages,
    persist: (messages) => store.saveMessages(messages),
  });
  store.onChange(applyRemote, (text) => messenger.post({ from: chiefAgent().id, text: `⚠️ ${text}`, quiet: true }));
  renderFloorTabs();
  updateFloorTabs("hq");
  renderRoster();

  document.addEventListener("messenger:unread", (e) => {
    const badge = $("#msgBadge");
    badge.hidden = !e.detail;
    badge.textContent = e.detail;
  });
  $("#messengerBtn").addEventListener("click", () => messenger.focus());

  $("#closeBtn").addEventListener("click", closeDrawer);
  // 실수로 지우지 않게 두 번 눌러야 지워진다
  let clearArmed = 0;
  $("#clearBtn").addEventListener("click", () => {
    if (!current || busy.has(current.id)) return;
    const btn = $("#clearBtn");
    if (Date.now() - clearArmed > 3000) {
      clearArmed = Date.now();
      btn.textContent = "한 번 더 누르면 지워져요";
      setTimeout(() => (btn.textContent = "🧹 새 업무"), 3000);
      return;
    }
    clearArmed = 0;
    btn.textContent = "🧹 새 업무";
    delete histories[current.id];
    saveHistories();
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
  $("#meetingClose").addEventListener("click", closeMeeting);
  $("#meetingForm").addEventListener("submit", (e) => {
    e.preventDefault();
    runMeeting($("#meetingTopic").value);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    closeMeeting();
    closeDrawer();
  });
}

init();
