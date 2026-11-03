// 대화 기록과 메신저 기록을 어디에 둘지 정하는 부분.
// 기본은 이 브라우저(localStorage)에만 저장한다. claude.ai 테스트 페이지는 demo/store.js로 바꿔 끼워
// 같은 계정이면 어느 기기에서나 같은 기록을 보게 한다. 모양은 두 파일이 같다.
export const HISTORY_KEY = "aiOffice.history";
export const MESSENGER_KEY = "aiOffice.messenger";

export function readLocal(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function writeLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

// { histories, messages, label, saveHistories(h), saveMessages(m), onChange(cb) }
export async function openStore() {
  return {
    histories: readLocal(HISTORY_KEY, {}),
    messages: readLocal(MESSENGER_KEY, []),
    label: "기록: 이 브라우저",
    saveHistories: (histories) => writeLocal(HISTORY_KEY, histories),
    saveMessages: (messages) => writeLocal(MESSENGER_KEY, messages),
    onChange() {},
  };
}
