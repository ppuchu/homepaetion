// 테스트 페이지용 저장소: claude.ai 페이지 저장소(db)의 내 개인 공간(data/users/<내 id>/)에 둔다.
// 같은 claude.ai 계정이면 컴퓨터·휴대폰 어디서 열어도 같은 기록이 보이고, 다른 사람에게는 보이지 않는다.
// 저장소를 쓸 수 없으면 public/store.js처럼 이 브라우저에만 저장한다.
//
// 문서 구성 (문서 하나는 256KB까지):
//   h-<직원 id>     { messages: [...] }  직원별 대화 기록
//   m-<YYYY-MM-DD>  { messages: [...] }  날짜별 메신저 기록
import { HISTORY_KEY, MESSENGER_KEY, readLocal } from "./store-local.js";

const MAX_DOC_CHARS = 200000;
const FLUSH_MS = 600;

const use = (name) => (window.claude?.use ? window.claude.use(name).catch(() => null) : Promise.resolve(null));
const withTimeout = (promise, ms) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);

function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 문서 하나가 너무 커지지 않게 오래된 것부터 덜어 낸다
function fitHistory(messages) {
  const list = [...messages];
  while (list.length > 2 && JSON.stringify(list).length > MAX_DOC_CHARS) list.splice(0, 2);
  return list;
}
function fitMessages(messages) {
  const list = [...messages];
  while (list.length > 1 && JSON.stringify(list).length > MAX_DOC_CHARS) list.shift();
  return list;
}

export async function openStore() {
  const local = await import("./store-local.js").then((m) => m.openStore());
  const [db, user] = await Promise.all([use("db"), use("user")]);
  const uid = await user?.id?.().catch(() => null);
  if (!db || !uid) return local;

  const col = db.collection(`data/users/${uid}`);
  let snap;
  try {
    snap = await withTimeout(col.get(), 10000);
  } catch {
    return { ...local, label: "기록: 이 브라우저 (공유 저장소 연결 실패)" };
  }

  // 문서 id → 마지막으로 저장소와 맞춰 둔 내용(JSON)
  const known = new Map();
  const state = { histories: {}, messages: [] };
  const readDocs = (docs) => {
    const histories = {};
    let messages = [];
    for (const doc of docs) {
      const body = doc.data();
      const list = Array.isArray(body?.messages) ? body.messages : [];
      if (doc.id.startsWith("h-")) {
        if (list.length) histories[doc.id.slice(2)] = list;
      } else if (doc.id.startsWith("m-")) {
        messages = messages.concat(list);
      }
    }
    messages.sort((a, b) => a.time - b.time);
    return { histories, messages };
  };
  for (const doc of snap.docs) known.set(doc.id, JSON.stringify(doc.data()?.messages || []));
  Object.assign(state, readDocs(snap.docs));

  // ----- 쓰기: 바뀐 문서만, 문서마다 한 번에 하나씩 -----
  const pending = new Map(); // 문서 id → 내용(배열) 또는 null(삭제)
  const chains = new Map();
  let timer = 0;
  let onError = () => {};
  const queue = (id, list) => {
    const json = list === null ? null : JSON.stringify(list);
    if ((json ?? "__deleted__") === (known.get(id) ?? "__deleted__")) {
      pending.delete(id);
      return;
    }
    pending.set(id, list);
    clearTimeout(timer);
    timer = setTimeout(flush, FLUSH_MS);
  };
  function flush() {
    for (const [id, list] of pending) {
      pending.delete(id);
      const ref = col.doc(id);
      const json = list === null ? null : JSON.stringify(list);
      const run = () => {
        // 저장 전에 미리 기록해 둬야 내 쓰기가 실시간 알림으로 돌아와도 '다른 기기 변경'으로 오인하지 않는다
        const before = known.get(id);
        if (json === null) known.delete(id);
        else known.set(id, json);
        return (list === null ? ref.delete() : ref.set({ messages: list, updatedAt: Date.now() }))
          .catch((e) => {
            if (before === undefined) known.delete(id);
            else known.set(id, before);
            console.warn("[store]", id, e);
            onError(e?.code === "quota_exceeded" ? "저장 공간이 가득 찼어요. 오래된 대화를 「새 업무」로 정리해 주세요." : "기록을 저장하지 못했어요. 다음 저장 때 다시 시도해요.");
          });
      };
      chains.set(id, (chains.get(id) || Promise.resolve()).then(run));
    }
  }
  window.addEventListener("pagehide", flush);

  // 이 브라우저에 쌓인 기록이 있고 저장소가 비어 있으면 처음 한 번 옮긴다
  if (snap.empty) {
    const oldHistories = readLocal(HISTORY_KEY, {});
    const oldMessages = readLocal(MESSENGER_KEY, []);
    if (Object.keys(oldHistories).length || oldMessages.length) {
      state.histories = oldHistories;
      state.messages = oldMessages;
    }
  }

  const store = {
    histories: state.histories,
    messages: state.messages,
    label: "기록: 내 claude.ai 계정 (모든 기기)",
    saveHistories(histories) {
      const ids = new Set(Object.keys(histories).filter((id) => histories[id]?.length));
      for (const id of ids) queue(`h-${id}`, fitHistory(histories[id]));
      for (const docId of known.keys()) if (docId.startsWith("h-") && !ids.has(docId.slice(2))) queue(docId, null);
    },
    saveMessages(messages) {
      const days = new Map();
      for (const m of messages) {
        const key = `m-${dayKey(m.time)}`;
        if (!days.has(key)) days.set(key, []);
        days.get(key).push(m);
      }
      for (const [id, list] of days) queue(id, fitMessages(list));
      // 메신저에서 밀려난 날짜 문서는 지운다
      for (const docId of known.keys()) if (docId.startsWith("m-") && !days.has(docId)) queue(docId, null);
    },
    // 다른 기기에서 바뀐 내용이 오면 알려 준다
    onChange(cb, errorCb) {
      if (errorCb) onError = errorCb;
      col.onSnapshot(
        (live) => {
          if (live.metadata.hasPendingWrites || pending.size) return;
          let changed = false;
          for (const doc of live.docs) {
            const json = JSON.stringify(doc.data()?.messages || []);
            if (known.get(doc.id) !== json) {
              known.set(doc.id, json);
              changed = true;
            }
          }
          const ids = new Set(live.docs.map((d) => d.id));
          for (const id of [...known.keys()]) {
            if (!ids.has(id) && !live.metadata.fromCache) {
              known.delete(id);
              changed = true;
            }
          }
          if (changed) cb(readDocs(live.docs));
        },
        (e) => console.warn("[store] 실시간 연결 끊김", e),
      );
    },
  };
  if (snap.empty && (Object.keys(state.histories).length || state.messages.length)) {
    store.saveHistories(state.histories);
    store.saveMessages(state.messages);
  }
  return store;
}
