// 사내 메신저.
// 직원들이 업무를 주고받고(배분·착수·질문·완료 보고), 회의 내용과 잡담, 업무일지를 채널별로 남긴다.
// 기록은 이 브라우저에만 저장된다.
import { escapeHtml, renderMarkdown } from "./markdown.js";

const MAX_MESSAGES = 400;

export const CHANNELS = [
  { id: "work", name: "업무", hint: "업무 배분·착수·질문·완료 보고" },
  { id: "meeting", name: "회의", hint: "회의 발언 기록" },
  { id: "lounge", name: "라운지", hint: "휴게실 잡담" },
  { id: "log", name: "업무일지", hint: "코토가 정리한 하루 업무일지" },
];

const KIND_TAG = {
  assign: "📂 업무 전달",
  ack: "",
  report: "✅ 완료 보고",
  question: "❓ 질문",
  answer: "↩ 답변",
  log: "📒 업무일지",
};

export function createMessenger({ root, agents, avatar, onOpenAgent, onSend, onAnswer, onWriteLog, initial = [], persist }) {
  const byId = Object.fromEntries(agents.map((a) => [a.id, a]));
  let messages = initial.slice(-MAX_MESSAGES);
  let active = "work";
  let replyTo = null; // 답장 중인 질문 { agentId, question }
  const unread = Object.fromEntries(CHANNELS.map((c) => [c.id, 0]));
  let visible = false;

  root.innerHTML = `
    <div class="ms-side">
      <div class="ms-title">💬 사내 메신저</div>
      <nav class="ms-channels"></nav>
      <button class="btn small ms-log-btn" type="button">📒 오늘 업무일지 쓰기</button>
    </div>
    <div class="ms-main">
      <div class="ms-head"><strong class="ms-ch-name"></strong><span class="ms-ch-hint"></span></div>
      <div class="ms-list" aria-live="polite"></div>
      <form class="ms-composer">
        <div class="ms-reply" hidden><span></span><button type="button" class="icon-btn" aria-label="답장 취소">✕</button></div>
        <div class="ms-row">
          <select class="ms-to" aria-label="받는 사람"></select>
          <textarea rows="2" placeholder="메시지 입력 (Enter 전송, Shift+Enter 줄바꿈)"></textarea>
          <button class="btn primary" type="submit">보내기</button>
        </div>
      </form>
    </div>`;
  const $ = (sel) => root.querySelector(sel);
  const list = $(".ms-list");
  const to = $(".ms-to");
  const input = $(".ms-composer textarea");

  // 받는 사람: 코토에게 보내면 업무 배분, 직원에게 보내면 그 직원이 답한다
  for (const agent of agents) {
    const opt = document.createElement("option");
    opt.value = agent.id;
    opt.textContent = agent.chief ? `@${agent.name} (업무 맡기기)` : `@${agent.name} · ${agent.title}`;
    to.append(opt);
  }

  const toast = document.createElement("div");
  toast.className = "ms-toast";
  toast.hidden = true;
  document.body.append(toast);
  let toastTimer = 0;
  let saveTimer = 0;

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) {
      unread[active] = 0;
      renderChannels();
    }
  }).observe(root);

  function save() {
    clearTimeout(saveTimer);
    persist?.(messages.slice(-MAX_MESSAGES));
  }

  function sender(from) {
    if (from === "ceo") return { name: "대표님", title: "", img: null, emoji: "👔" };
    const agent = byId[from];
    return agent ? { name: agent.name, title: agent.title, img: avatar(agent.id), emoji: agent.emoji } : { name: "알림", title: "", img: null, emoji: "🔔" };
  }

  function renderChannels() {
    const nav = $(".ms-channels");
    nav.innerHTML = "";
    for (const ch of CHANNELS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `ms-ch${ch.id === active ? " active" : ""}`;
      btn.innerHTML = `# ${ch.name}${unread[ch.id] ? `<span class="ms-unread">${unread[ch.id]}</span>` : ""}`;
      btn.addEventListener("click", () => setChannel(ch.id));
      nav.append(btn);
    }
    const total = Object.values(unread).reduce((a, b) => a + b, 0);
    document.dispatchEvent(new CustomEvent("messenger:unread", { detail: total }));
  }

  function setChannel(id) {
    active = id;
    unread[id] = 0;
    const ch = CHANNELS.find((c) => c.id === id);
    $(".ms-ch-name").textContent = `# ${ch.name}`;
    $(".ms-ch-hint").textContent = ch.hint;
    renderChannels();
    renderList();
  }

  function dayLabel(ts) {
    const d = new Date(ts);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return "오늘";
    return d.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
  }

  function messageEl(m) {
    const s = sender(m.from);
    const el = document.createElement("div");
    el.className = `ms-msg kind-${m.kind || "talk"}${m.from === "ceo" ? " me" : ""}`;
    el.dataset.id = m.id;
    const time = new Date(m.time).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
    const face = s.img ? `<img class="ms-face" src="${s.img}" alt="" />` : `<span class="ms-face emoji">${s.emoji}</span>`;
    const tag = KIND_TAG[m.kind] ? `<span class="ms-tag">${KIND_TAG[m.kind]}</span>` : "";
    el.innerHTML = `
      ${face}
      <div class="ms-body">
        <div class="ms-meta"><b>${escapeHtml(s.name)}</b>${s.title ? `<small>${escapeHtml(s.title)}</small>` : ""}<time>${time}</time>${tag}</div>
        <div class="ms-text md">${renderMarkdown(m.text || "")}</div>
        <div class="ms-actions"></div>
      </div>`;
    const actions = el.querySelector(".ms-actions");
    if (m.kind === "question" && m.agentId) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip";
      btn.textContent = m.answered ? "✔ 답장함" : "↩ 답장하기";
      btn.disabled = Boolean(m.answered);
      btn.addEventListener("click", () => startReply(m));
      actions.append(btn);
    }
    if (m.link) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip";
      btn.textContent = "결과 보기";
      btn.addEventListener("click", () => onOpenAgent(m.link));
      actions.append(btn);
    }
    if (m.kind === "log") {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip";
      btn.textContent = "복사";
      btn.addEventListener("click", () => {
        navigator.clipboard?.writeText(m.text || "");
        btn.textContent = "복사됨";
      });
      actions.append(btn);
    }
    return el;
  }

  function renderList() {
    list.innerHTML = "";
    const items = messages.filter((m) => m.ch === active);
    if (!items.length) {
      list.innerHTML = `<div class="ms-empty">아직 메시지가 없어요.</div>`;
      return;
    }
    let lastDay = "";
    for (const m of items) {
      const day = dayLabel(m.time);
      if (day !== lastDay) {
        list.insertAdjacentHTML("beforeend", `<div class="ms-day"><span>${day}</span></div>`);
        lastDay = day;
      }
      list.append(messageEl(m));
    }
    list.scrollTop = list.scrollHeight;
  }

  function showToast(m) {
    const s = sender(m.from);
    const ch = CHANNELS.find((c) => c.id === m.ch);
    const face = s.img ? `<img src="${s.img}" alt="" />` : `<span>${s.emoji}</span>`;
    toast.innerHTML = `${face}<div><b>${escapeHtml(s.name)}</b> <small>#${ch.name}</small><p>${escapeHtml((m.text || "").replace(/\s+/g, " ").slice(0, 70))}</p></div>`;
    toast.hidden = false;
    toast.onclick = () => {
      setChannel(m.ch);
      root.scrollIntoView({ behavior: "smooth", block: "center" });
      toast.hidden = true;
    };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast.hidden = true), 4500);
  }

  // 메시지 올리기. 돌려받은 id로 나중에 내용을 고칠 수 있다(작성 중 → 완성).
  function post({ ch = "work", from, text, kind = "talk", link, agentId, quiet }) {
    const m = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ch, from, text, kind, link, agentId, time: Date.now() };
    messages.push(m);
    if (messages.length > MAX_MESSAGES) messages = messages.slice(-MAX_MESSAGES);
    save();
    if (ch === active) {
      list.querySelector(".ms-empty")?.remove();
      const day = dayLabel(m.time);
      const prev = messages.filter((x) => x.ch === ch).at(-2);
      if (!prev || dayLabel(prev.time) !== day) list.insertAdjacentHTML("beforeend", `<div class="ms-day"><span>${day}</span></div>`);
      list.append(messageEl(m));
      list.scrollTop = list.scrollHeight;
    }
    if (!(visible && ch === active)) unread[ch]++;
    renderChannels();
    if (!visible && !quiet && from !== "ceo") showToast(m);
    return m.id;
  }

  function update(id, patch) {
    const m = messages.find((x) => x.id === id);
    if (!m) return;
    Object.assign(m, patch);
    // 작성 중에는 자주 바뀌므로 저장은 잠깐 모아서 한다
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 400);
    const el = list.querySelector(`[data-id="${id}"]`);
    if (el) {
      el.replaceWith(messageEl(m));
      list.scrollTop = list.scrollHeight;
    }
  }

  function startReply(m) {
    replyTo = m;
    to.value = m.agentId;
    const bar = $(".ms-reply");
    bar.hidden = false;
    bar.querySelector("span").textContent = `↩ ${sender(m.agentId).name}의 질문에 답장: ${m.text.slice(0, 60)}`;
    input.focus();
  }
  function cancelReply() {
    replyTo = null;
    $(".ms-reply").hidden = true;
  }
  $(".ms-reply button").addEventListener("click", cancelReply);

  $(".ms-composer").addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    if (replyTo) {
      const question = replyTo;
      cancelReply();
      update(question.id, { answered: true });
      onAnswer(question.agentId, question.text, text);
    } else {
      onSend(to.value, text, active);
    }
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      $(".ms-composer").requestSubmit();
    }
  });
  $(".ms-log-btn").addEventListener("click", () => {
    setChannel("log");
    onWriteLog();
  });

  setChannel("work");

  return {
    post,
    update,
    // 다른 기기에서 바뀐 기록으로 통째로 바꾼다 (저장은 하지 않는다)
    replaceAll(next) {
      const before = new Set(messages.map((m) => m.id));
      messages = next.slice(-MAX_MESSAGES);
      for (const m of messages) if (!before.has(m.id) && !(visible && m.ch === active)) unread[m.ch] = (unread[m.ch] || 0) + 1;
      renderChannels();
      renderList();
    },
    setChannel,
    focus() {
      root.scrollIntoView({ behavior: "smooth", block: "center" });
    },
    // 업무일지에 쓸 오늘 기록
    today(channels = ["work", "meeting"]) {
      const today = new Date().toDateString();
      return messages
        .filter((m) => channels.includes(m.ch) && new Date(m.time).toDateString() === today)
        .map((m) => ({ ...m, who: sender(m.from).name }));
    },
  };
}
