// 픽셀아트 사무실.
// 캔버스에 층별 사무실·가구·직원을 픽셀 단위로 그리고, 걷기/앉기/타이핑/말풍선/엘리베이터 이동을 담당한다.
// 모든 그림은 fillRect로 그리며, 내부 해상도는 정수 배율로 그려 픽셀이 뭉개지지 않게 한다.

const T = 16; // 타일 크기(px)
const SPEED = 60; // 걷는 속도(px/초)
const INK = "#1b1b26";

// 층 구성. 방은 가로 9, 세로 6 타일이고 벽 두께는 1 타일. 각 층의 가운데 방이 그 층의 중심.
export const FLOORS = [
  {
    id: "hq",
    name: "본사",
    icon: "🏢",
    cols: 5,
    rows: 3,
    rooms: [
      ["strategy", "전략기획실"], ["youtube", "유튜브편집국"], ["design", "디자인실"], ["marketing", "마케팅실"], ["insight", "인사이트 캡쳐"],
      ["comms", "커뮤니케이션실"], ["ceo", "대표실"], ["chief", "★ 비서실"], ["meeting", "회의실"], ["dictionary", "사전편찬실"],
      ["security", "정보보안실"], ["archive", "코토자료실"], ["lounge", "휴게실"], ["elevator", "엘리베이터 ▲팔자서재"], ["finance", "재무관리부"],
    ],
  },
  {
    id: "palja",
    name: "팔자서재 별관",
    icon: "🌙",
    cols: 3,
    rows: 3,
    rooms: [
      ["palja-dev", "개발실"], ["palja-shelf", "서가 편집실"], ["palja-channel", "채널실"],
      ["palja-product", "상품기획실"], ["palja", "★ 팔자서재 본부"], ["palja-dictionary", "사전편찬실(팔자서재)"],
      ["palja-meeting", "서재 회의실"], ["palja-lounge", "서재 라운지"], ["elevator", "엘리베이터 ▼본사"],
    ],
  },
];

// 방 종류별 바닥·벽 색
const THEMES = {
  strategy: { kind: "carpet", a: "#c9d3e6", b: "#bfcadf", wall: "#e8eef8" },
  youtube: { kind: "tile", a: "#4b4f63", b: "#45495c", wall: "#f3dede" },
  design: { kind: "wood", a: "#e3c08f", b: "#d4ad78", wall: "#fdf1e4" },
  marketing: { kind: "carpet", a: "#cfe9dc", b: "#c3e0d1", wall: "#e8f6ee" },
  insight: { kind: "carpet", a: "#f3e6b3", b: "#ead9a0", wall: "#fffaf0" },
  comms: { kind: "carpet", a: "#d6e4f0", b: "#cbdcea", wall: "#f0f6fb" },
  ceo: { kind: "carpet", a: "#b65f5f", b: "#ab5656", wall: "#f3e3e3" },
  chief: { kind: "wood", a: "#d9a86c", b: "#c9965a", wall: "#fff3dc" },
  meeting: { kind: "carpet", a: "#8695cb", b: "#7d8cc4", wall: "#e3e7f6" },
  dictionary: { kind: "wood", a: "#c9a27a", b: "#b98f66", wall: "#f5ecdc" },
  security: { kind: "tile", a: "#5c6378", b: "#545a6e", wall: "#d8dbe6" },
  archive: { kind: "tile", a: "#e9e4d8", b: "#ddd6c6", wall: "#f4f1ea" },
  lounge: { kind: "checker", a: "#f1ede4", b: "#d9cfbf", wall: "#fff8ec" },
  elevator: { kind: "tile", a: "#d9d6e3", b: "#cfcbdb", wall: "#ecebf3" },
  finance: { kind: "tile", a: "#efe3c8", b: "#e3d5b4", wall: "#f6f1e6" },
  "palja-dev": { kind: "tile", a: "#5a5872", b: "#535068", wall: "#e6e0f3" },
  "palja-shelf": { kind: "wood", a: "#d8b994", b: "#caa983", wall: "#fbf3e6" },
  "palja-channel": { kind: "carpet", a: "#f6d9e4", b: "#efcddb", wall: "#fff3f7" },
  "palja-product": { kind: "carpet", a: "#fbe7b8", b: "#f4dca6", wall: "#fffaf0" },
  palja: { kind: "carpet", a: "#cfc4ec", b: "#c4b8e6", wall: "#f3effc" },
  "palja-dictionary": { kind: "wood", a: "#c9a27a", b: "#b98f66", wall: "#f5ecdc" },
  "palja-meeting": { kind: "carpet", a: "#b8c7ec", b: "#adbde6", wall: "#eef2fc" },
  "palja-lounge": { kind: "checker", a: "#fdf3e1", b: "#e9dcf3", wall: "#fffaf3" },
};

// 직원별 생김새. 목록에 없는 직원은 차례대로 기본 생김새를 쓴다.
const LOOKS = {
  coto: { skin: "#f5c9a0", hair: "#2b2d42", style: "neat", shirt: "#f2a33a", pants: "#2b2d42", acc: ["glasses", "bowtie"], accent: "#c0392b" },
  strategy: { skin: "#f1c27d", hair: "#6b3e26", style: "long", shirt: "#6c8cff", pants: "#3a3f5c", acc: [], accent: "#fff" },
  youtube: { skin: "#e8b48a", hair: "#1e1e28", style: "cap", cap: "#d64545", shirt: "#2b2d42", pants: "#3a3a4a", acc: ["headphones"], accent: "#fff" },
  design: { skin: "#f5c9a0", hair: "#7b3fa0", style: "bun", shirt: "#ff7eb6", pants: "#4a3b5c", acc: [], accent: "#fff" },
  comms: { skin: "#f5c9a0", hair: "#8a5a3b", style: "bun", shirt: "#7fb2e5", pants: "#3b4a5c", acc: [], accent: "#fff" },
  marketing: { skin: "#f1c27d", hair: "#2b2b2b", style: "cap", cap: "#2e9e6b", shirt: "#3ecf8e", pants: "#30485a", acc: [], accent: "#fff" },
  insight: { skin: "#e8b48a", hair: "#c9962a", style: "spiky", shirt: "#ffd166", pants: "#5a4632", acc: ["glasses"], accent: "#fff" },
  dictionary: { skin: "#e8b48a", hair: "#3b2a20", style: "spiky", shirt: "#ffb84d", pants: "#5a4632", acc: ["tie"], accent: "#c0392b" },
  finance: { skin: "#f5c9a0", hair: "#1e1e28", style: "long", shirt: "#2ec5d3", pants: "#3b4a5c", acc: ["glasses"], accent: "#fff" },
  security: { skin: "#d9a066", hair: "#1e1e28", style: "short", shirt: "#4a4e69", pants: "#22222e", acc: ["tie"], accent: "#d64545" },
  palja: { skin: "#f5c9a0", hair: "#3d2e5c", style: "long", shirt: "#9b87d6", pants: "#3d2e5c", acc: [], accent: "#ffd166" },
  "palja-dev": { skin: "#d9a066", hair: "#1e1e28", style: "short", shirt: "#a78bfa", pants: "#2f2f3f", acc: ["headphones"], accent: "#fff" },
  "palja-shelf": { skin: "#f5c9a0", hair: "#5c3d22", style: "bun", shirt: "#f4a261", pants: "#4a3b2c", acc: ["glasses"], accent: "#fff" },
  "palja-channel": { skin: "#f1c27d", hair: "#e07a9f", style: "long", shirt: "#ffb3c7", pants: "#5c4a6b", acc: [], accent: "#fff" },
  "palja-product": { skin: "#e8b48a", hair: "#2b2b2b", style: "neat", shirt: "#ffd166", pants: "#4a4e69", acc: ["tie"], accent: "#2e9e6b" },
  "palja-dictionary": { skin: "#f5c9a0", hair: "#6b3e26", style: "short", shirt: "#8ecae6", pants: "#3a3f5c", acc: ["glasses"], accent: "#fff" },
};
const FALLBACK_LOOKS = Object.values(LOOKS);

// 책상 위 소품
const DESK_PROPS = {
  coto: "phone",
  strategy: "calendar",
  youtube: "dual",
  design: "tablet",
  comms: "phone",
  marketing: "chart",
  insight: "notebook",
  dictionary: "notebook",
  finance: "papers",
  security: "dual",
  palja: "calendar",
  "palja-dev": "dual",
  "palja-shelf": "notebook",
  "palja-channel": "tablet",
  "palja-product": "chart",
  "palja-dictionary": "notebook",
};

// 한 방에 여러 명이 들어오면 이 순서로 책상을 놓는다 (방 안 좌표)
const DESK_SLOTS = [[4, 2], [2, 4], [6, 4]];

// ---------- 색 도우미 ----------
function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + 255 * amount)));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, "0")).join("")}`;
}

// ---------- 캐릭터 스프라이트 ----------
// 12x19 격자에 사람을 찍고, 바깥에 1px 외곽선을 둘러 캔버스로 만든다.
function personGrid(look, dir, frame, pose) {
  const w = 12;
  const h = 19;
  const g = Array.from({ length: h }, () => Array(w).fill(null));
  const set = (x, y, c) => {
    if (x >= 0 && x < w && y >= 0 && y < h) g[y][x] = c;
  };
  const rect = (x0, y0, x1, y1, c) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, c);
  };
  const hair = look.hair;
  const hairHi = shade(look.hair, 0.12);
  const skin = look.skin;
  const shirt = look.shirt;
  const shirtDark = shade(look.shirt, -0.14);
  const pants = look.pants;
  const shoe = "#2a2a35";
  const side = dir === "left" || dir === "right";

  // 머리
  if (!side) {
    rect(4, 2, 7, 2, hair);
    rect(3, 3, 8, 3, hair);
    rect(2, 4, 9, 4, hair);
    if (dir === "down") {
      rect(3, 5, 8, 8, skin);
      rect(4, 9, 7, 9, skin);
      set(2, 5, hair), set(9, 5, hair), set(2, 6, hair), set(9, 6, hair);
      set(3, 5, hair), set(8, 5, hair);
      set(2, 7, skin), set(9, 7, skin);
      set(4, 7, INK), set(4, 8, INK), set(7, 7, INK), set(7, 8, INK);
      set(3, 9, "#f4a6a6"), set(8, 9, "#f4a6a6");
      rect(4, 3, 5, 3, hairHi);
    } else {
      rect(2, 5, 9, 7, hair);
      rect(3, 8, 8, 8, hair);
      rect(4, 9, 7, 9, skin);
      rect(5, 3, 7, 3, hairHi);
    }
  } else {
    rect(4, 2, 7, 2, hair);
    rect(3, 3, 8, 3, hair);
    rect(3, 4, 9, 4, hair);
    rect(6, 5, 9, 8, skin);
    rect(3, 5, 5, 6, hair);
    rect(3, 7, 4, 8, hair);
    rect(5, 7, 5, 8, skin);
    rect(5, 9, 8, 9, skin);
    set(8, 7, INK), set(8, 8, INK);
    rect(5, 3, 6, 3, hairHi);
  }

  // 머리 모양
  if (look.style === "long") {
    if (dir === "down") rect(2, 5, 2, 11, hair), rect(9, 5, 9, 11, hair);
    else if (dir === "up") rect(3, 8, 8, 11, hair);
    else rect(3, 5, 4, 11, hair);
  } else if (look.style === "bun") {
    rect(5, 0, 6, 0, hair);
    rect(4, 1, 7, 1, hair);
  } else if (look.style === "spiky") {
    set(3, 1, hair), set(5, 1, hair), set(7, 1, hair), set(9, 2, hair);
    rect(3, 2, 8, 2, hair);
  } else if (look.style === "cap") {
    const cap = look.cap;
    rect(4, 2, 7, 2, cap);
    rect(3, 3, 8, 4, cap);
    rect(4, 3, 5, 3, shade(cap, 0.15));
    if (dir === "down") rect(2, 5, 9, 5, shade(cap, -0.15));
    if (side) rect(7, 5, 10, 5, shade(cap, -0.15));
  } else if (look.style === "neat") {
    if (dir === "down") set(6, 4, hairHi), set(5, 4, hairHi);
  }

  // 몸통
  const bodyTop = 10;
  if (!side) {
    rect(3, bodyTop, 8, 14, shirt);
    rect(8, bodyTop + 1, 8, 14, shirtDark);
    // 팔: 걸을 때는 앞뒤로 흔든다
    const leftLift = pose === "stand" && frame === 1 ? 1 : 0;
    const rightLift = pose === "stand" && frame === 2 ? 1 : 0;
    rect(2, bodyTop, 2, 13 - leftLift, shirtDark);
    rect(9, bodyTop, 9, 13 - rightLift, shirtDark);
    if (dir === "down" || pose === "stand") set(2, 14 - leftLift, skin), set(9, 14 - rightLift, skin);
    // 타이핑: 팔꿈치가 번갈아 바깥으로 들린다 (의자 등받이 위로 보이게)
    if (pose === "sit-up" && frame === 1) set(1, 11, shirtDark), set(1, 10, shirtDark);
    if (pose === "sit-up" && frame === 2) set(10, 11, shirtDark), set(10, 10, shirtDark);
    if (dir === "down") {
      if (look.acc.includes("tie")) rect(5, bodyTop, 6, 13, look.accent), set(5, 14, look.accent);
      if (look.acc.includes("bowtie")) set(4, bodyTop, look.accent), set(7, bodyTop, look.accent), rect(5, bodyTop, 6, bodyTop, shade(look.accent, -0.2));
      if (!look.acc.includes("tie") && !look.acc.includes("bowtie")) rect(5, bodyTop, 6, bodyTop, shade(shirt, 0.2));
    }
  } else {
    rect(4, bodyTop, 7, 14, shirt);
    rect(4, bodyTop + 1, 4, 14, shirtDark);
    const swing = pose === "stand" ? [0, 1, -1][frame] : 0;
    rect(5 + swing, bodyTop + 1, 6 + swing, 13, shirtDark);
    rect(5 + swing, 14, 6 + swing, 14, skin);
  }

  // 다리
  if (pose === "stand") {
    if (!side) {
      const leftUp = frame === 1 ? 1 : 0;
      const rightUp = frame === 2 ? 1 : 0;
      rect(4, 15, 5, 17 - leftUp, pants);
      rect(6, 15, 7, 17 - rightUp, pants);
      rect(4, 18 - leftUp, 5, 18 - leftUp, shoe);
      rect(6, 18 - rightUp, 7, 18 - rightUp, shoe);
    } else if (frame === 0) {
      rect(5, 15, 6, 17, pants);
      rect(5, 18, 7, 18, shoe);
    } else {
      rect(4, 15, 4, 17, shade(pants, -0.1));
      rect(7, 15, 7, 17, pants);
      rect(3, 18, 4, 18, shoe);
      rect(7, 18, 8, 18, shoe);
    }
  } else if (pose === "sit-down") {
    rect(4, 15, 7, 15, pants);
    rect(4, 16, 5, 16, shoe);
    rect(6, 16, 7, 16, shoe);
  }

  // 소품
  if (look.acc.includes("glasses")) {
    if (dir === "down") {
      rect(3, 6, 5, 6, INK), rect(6, 6, 8, 6, INK);
      set(3, 7, INK), set(5, 7, INK), set(6, 7, INK), set(8, 7, INK);
      set(4, 7, "#cfe8ff"), set(7, 7, "#cfe8ff");
    } else if (side) {
      rect(7, 6, 9, 6, INK), set(7, 7, INK), set(9, 7, INK), set(8, 7, "#cfe8ff");
    }
  }
  if (look.acc.includes("headphones")) {
    const band = "#3d405b";
    rect(3, 1, 8, 1, band);
    set(2, 2, band), set(9, 2, band);
    if (!side) rect(1, 4, 2, 7, "#e76f51"), rect(9, 4, 10, 7, "#e76f51");
    else rect(4, 4, 5, 7, "#e76f51");
  }
  return g;
}

const spriteCache = new Map();
function sprite(look, dir, frame, pose) {
  const key = `${look.key}|${dir}|${frame}|${pose}`;
  if (spriteCache.has(key)) return spriteCache.get(key);
  const flip = dir === "left";
  const g = personGrid(look, flip ? "right" : dir, frame, pose);
  const h = g.length;
  const w = g[0].length;
  const canvas = document.createElement("canvas");
  canvas.width = w + 2;
  canvas.height = h + 2;
  const c = canvas.getContext("2d");
  const filled = (x, y) => x >= 0 && y >= 0 && x < w && y < h && g[y][x];
  for (let y = -1; y <= h; y++) {
    for (let x = -1; x <= w; x++) {
      const sx = flip ? w - 1 - x : x;
      if (filled(x, y)) {
        c.fillStyle = g[y][x];
        c.fillRect(sx + 1, y + 1, 1, 1);
      } else if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) {
        c.fillStyle = INK;
        c.fillRect(sx + 1, y + 1, 1, 1);
      }
    }
  }
  spriteCache.set(key, canvas);
  return canvas;
}

// ---------- 사무실 ----------
export function createOffice({ canvas, overlay, agents, onSelect, onMeeting, onFloorChange, onLounge }) {
  const ctx = canvas.getContext("2d");
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const key = (x, y) => `${x},${y}`;
  const people = new Map();
  let time = 0;
  let hovered = null;
  let scale = 1;
  let view = null; // 지금 보고 있는 층

  // 층마다 지도·가구·쉬는 자리를 따로 가진다
  const floors = new Map(
    FLOORS.map((def) => {
      const rooms = def.rooms.map(([id, name], i) => ({ id, name, c: i % def.cols, r: Math.floor(i / def.cols) }));
      return [
        def.id,
        {
          ...def,
          rooms,
          tilesW: def.cols * 10 + 1,
          tilesH: def.rows * 7 + 1,
          blocked: new Set(),
          items: [],
          decor: [],
          spots: [],
          meetingSeats: [],
          elevator: null,
          layer: null,
          labels: [],
        },
      ];
    }),
  );
  const roomOf = (floor, x, y) => floor.rooms.find((room) => room.c === Math.floor(x / 10) && room.r === Math.floor(y / 7));
  const findRoom = (roomId) => {
    for (const floor of floors.values()) {
      const room = floor.rooms.find((r) => r.id === roomId);
      if (room) return { floor, room };
    }
    return null;
  };
  const isWall = (x, y) => x % 10 === 0 || y % 7 === 0;
  const isDoor = (floor, x, y) =>
    (x % 10 === 0 && x > 0 && x < floor.tilesW - 1 && y % 7 !== 0 && (y % 7 === 3 || y % 7 === 4)) ||
    (y % 7 === 0 && y > 0 && y < floor.tilesH - 1 && x % 10 !== 0 && x % 10 >= 4 && x % 10 <= 6);
  const solid = (floor, x, y) =>
    x < 0 || y < 0 || x >= floor.tilesW || y >= floor.tilesH || (isWall(x, y) && !isDoor(floor, x, y)) || floor.blocked.has(key(x, y));
  const r = (x, y, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };

  // 지금 꾸미고 있는 층 (아래 가구 함수들이 여기에 추가한다)
  let F = null;
  function addItem(tx, ty, w, h, sortY, draw, block = true) {
    if (block) for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) F.blocked.add(key(x, y));
    F.items.push({ sortY, draw });
  }

  // ----- 가구 그리기 -----
  function drawMonitor(mx, my, owner) {
    r(mx - 1, my - 1, 14, 12, INK);
    r(mx, my, 12, 10, "#2b2d42");
    const working = owner && owner.working && owner.task === "seated";
    if (working) {
      r(mx + 1, my + 1, 10, 7, "#1e2a44");
      const colors = ["#7fd1ff", "#ffb84d", "#3ecf8e"];
      for (let i = 0; i < 3; i++) {
        const len = ((Math.floor(time * 6) + i * 3) % 7) + 2;
        r(mx + 2, my + 2 + i * 2, len, 1, colors[i]);
      }
    } else {
      r(mx + 1, my + 1, 10, 7, "#3d5a80");
      r(mx + 2, my + 2, 3, 1, "#5d7aa0");
      if (Math.floor(time * 2) % 2) r(mx + 2, my + 6, 2, 1, "#9fc2e8");
    }
    r(mx + 5, my + 10, 2, 2, "#2b2d42");
    r(mx + 3, my + 11, 6, 1, "#2b2d42");
  }

  function drawDeskProp(X, Y, prop, owner) {
    switch (prop) {
      case "calendar":
        r(X + 2, Y + 4, 7, 6, "#fffdf5"), r(X + 2, Y + 4, 7, 2, "#d64545"), r(X + 3, Y + 7, 5, 1, "#b8b8c8");
        break;
      case "tablet":
        r(X + 2, Y + 4, 8, 6, "#2b2d42"), r(X + 3, Y + 5, 6, 4, "#ffb3d1"), r(X + 4, Y + 6, 2, 2, "#7b3fa0");
        break;
      case "notebook":
        r(X + 1, Y + 4, 9, 6, "#fffdf5"), r(X + 5, Y + 4, 1, 6, "#d8d0c0"), r(X + 2, Y + 6, 2, 1, "#9aa"), r(X + 7, Y + 6, 2, 1, "#9aa");
        r(X + 24, Y + 5, 6, 1, "#ffb84d"), r(X + 30, Y + 5, 1, 1, "#333");
        break;
      case "chart":
        r(X + 2, Y + 3, 8, 7, "#fffdf5"), r(X + 3, Y + 7, 1, 2, "#3ecf8e"), r(X + 5, Y + 5, 1, 4, "#3ecf8e"), r(X + 7, Y + 4, 1, 5, "#6c8cff");
        break;
      case "phone":
        r(X + 2, Y + 5, 7, 4, "#2b2d42"), r(X + 2, Y + 4, 7, 1, "#4a4e69"), r(X + 7, Y + 6, 1, 1, Math.floor(time * 2) % 2 ? "#ff5a5a" : "#7a2a2a");
        r(X + 22, Y + 8, 8, 2, "#f2c14e");
        break;
      case "papers":
        r(X + 2, Y + 3, 7, 7, "#fffdf5"), r(X + 3, Y + 2, 7, 7, "#f4efe2"), r(X + 4, Y + 4, 4, 1, "#b8b8c8"), r(X + 4, Y + 6, 4, 1, "#b8b8c8");
        r(X + 23, Y + 4, 5, 5, "#7a7a8c"), r(X + 24, Y + 5, 3, 1, "#bde0b0");
        break;
    }
    if (prop !== "notebook" && prop !== "papers" && prop !== "phone") {
      r(X + 25, Y + 5, 3, 3, "#ffffff"), r(X + 28, Y + 6, 1, 1, "#ffffff"), r(X + 26, Y + 5, 1, 1, owner?.look.shirt || "#aaa");
    }
  }

  function addDesk(tx, ty, owner, prop) {
    const X = tx * T;
    const Y = ty * T;
    addItem(tx, ty, 2, 1, Y + 15, () => {
      r(X - 1, Y + 1, 34, 16, INK);
      r(X, Y + 2, 32, 9, "#c8955c");
      r(X, Y + 2, 32, 1, "#e0b07a");
      r(X, Y + 11, 32, 4, "#9a6a3c");
      r(X, Y + 15, 32, 1, "#6e4a28");
      r(X + 11, Y + 7, 10, 2, "#e4e4ec");
      r(X + 11, Y + 9, 10, 1, "#a9a9b8");
      if (prop === "dual") {
        drawMonitor(X + 3, Y - 6, owner);
        drawMonitor(X + 17, Y - 6, owner);
      } else {
        drawMonitor(X + 10, Y - 6, owner);
        drawDeskProp(X, Y, prop, owner);
      }
    });
  }

  function addChair(cx, feetY, facing, color = "#3d405b") {
    if (facing === "up") {
      F.items.push({
        sortY: feetY + 1,
        draw: () => {
          r(cx - 7, feetY - 7, 14, 7, INK);
          r(cx - 6, feetY - 6, 12, 5, color);
          r(cx - 5, feetY - 5, 10, 1, shade(color, 0.15));
          r(cx - 1, feetY - 1, 2, 1, "#2b2d42");
          r(cx - 4, feetY, 8, 1, "#2b2d42");
        },
      });
    } else {
      F.items.push({
        sortY: feetY - 12,
        draw: () => {
          r(cx - 7, feetY - 17, 14, 9, INK);
          r(cx - 6, feetY - 16, 12, 7, color);
          r(cx - 5, feetY - 15, 10, 1, shade(color, 0.15));
          r(cx - 6, feetY - 7, 12, 3, shade(color, -0.1));
        },
      });
    }
  }

  function addPlant(tx, ty) {
    const X = tx * T;
    const Y = ty * T;
    addItem(tx, ty, 1, 1, Y + 15, () => {
      r(X + 3, Y + 8, 10, 8, INK);
      r(X + 4, Y + 9, 8, 6, "#b5651d");
      r(X + 3, Y + 8, 10, 2, "#c97a35");
      r(X + 4, Y - 2, 8, 11, INK);
      r(X + 1, Y + 1, 14, 6, INK);
      r(X + 5, Y - 1, 6, 9, "#3a8f4b");
      r(X + 2, Y + 2, 5, 4, "#4caf50");
      r(X + 9, Y + 2, 5, 4, "#4caf50");
      r(X + 6, Y - 1, 3, 2, "#6fd17c");
      r(X + 3, Y + 2, 2, 1, "#6fd17c");
    });
  }

  // 한 타일짜리 키 큰 가구
  const addTall = (tx, ty, draw) => addItem(tx, ty, 1, 1, ty * T + 15, () => draw(tx * T, ty * T));

  const bookshelf = (X, Y) => {
    r(X - 1, Y - 11, 18, 28, INK);
    r(X, Y - 10, 16, 26, "#7a5230");
    r(X + 1, Y - 9, 14, 24, "#5c3d22");
    const books = ["#e76f51", "#6c8cff", "#f2c14e", "#3ecf8e", "#a78bfa", "#ff7eb6"];
    for (let s = 0; s < 3; s++) {
      r(X + 1, Y - 9 + s * 8 + 7, 14, 1, "#7a5230");
      for (let b = 0; b < 5; b++) r(X + 2 + b * 3, Y - 9 + s * 8 + 1 + (b % 2), 2, 6 - (b % 2), books[(b + s * 2 + X) % books.length]);
    }
  };
  const serverRack = (X, Y) => {
    r(X, Y - 11, 16, 28, INK);
    r(X + 1, Y - 10, 14, 26, "#2b2d42");
    for (let i = 0; i < 5; i++) {
      r(X + 2, Y - 8 + i * 5, 12, 3, "#3d405b");
      const on = (Math.floor(time * 3) + i * 7 + X) % 5 !== 0;
      r(X + 3, Y - 7 + i * 5, 2, 1, on ? "#3ecf8e" : "#1f4d34");
      r(X + 6, Y - 7 + i * 5, 1, 1, (Math.floor(time * 5) + i) % 9 === 0 ? "#ff5a5a" : "#5a2a2a");
    }
  };
  const cabinet = (X, Y) => {
    r(X, Y - 7, 16, 24, INK);
    r(X + 1, Y - 6, 14, 22, "#9aa0ad");
    for (let k = 0; k < 3; k++) r(X + 1, Y - 6 + k * 7 + 6, 14, 1, "#7c8290"), r(X + 6, Y - 3 + k * 7, 4, 1, "#5a606d");
  };
  const printer = (X, Y) => {
    r(X, Y + 1, 16, 12, INK);
    r(X + 1, Y + 2, 14, 10, "#d8d8e0");
    r(X + 1, Y + 2, 14, 2, "#f0f0f5");
    r(X + 4, Y - 1, 8, 4, "#ffffff");
    r(X + 3, Y + 8, 10, 1, "#555b6e");
    r(X + 12, Y + 5, 1, 1, "#3ecf8e");
  };
  const safe = (X, Y) => {
    r(X + 1, Y - 2, 14, 18, INK);
    r(X + 2, Y - 1, 12, 16, "#5a606d");
    r(X + 3, Y, 10, 14, "#6d7480");
    r(X + 6, Y + 5, 4, 4, "#c9cbd3"), r(X + 7, Y + 6, 2, 2, "#3d405b");
  };
  const boxes = (X, Y) => {
    r(X + 1, Y - 3, 14, 19, INK);
    r(X + 2, Y + 6, 12, 9, "#c98d4b"), r(X + 2, Y + 6, 12, 1, "#e0a868"), r(X + 7, Y + 6, 2, 9, "#e8c98a");
    r(X + 3, Y - 2, 10, 8, "#d9a066"), r(X + 3, Y - 2, 10, 1, "#ecbb85"), r(X + 7, Y - 2, 2, 8, "#f0d9a8");
  };
  const camera = (X, Y) => {
    r(X + 3, Y - 6, 10, 8, INK);
    r(X + 4, Y - 5, 8, 6, "#2b2d42"), r(X + 9, Y - 4, 2, 2, "#7fd1ff"), r(X + 5, Y - 4, 1, 1, Math.floor(time * 2) % 2 ? "#ff5a5a" : "#5a2a2a");
    r(X + 7, Y + 2, 2, 10, INK), r(X + 3, Y + 12, 10, 2, INK), r(X + 4, Y + 13, 1, 2, INK), r(X + 11, Y + 13, 1, 2, INK);
  };
  const ringLight = (X, Y) => {
    r(X + 2, Y - 10, 12, 12, INK);
    r(X + 3, Y - 9, 10, 10, "#fff6c8"), r(X + 5, Y - 7, 6, 6, INK), r(X + 6, Y - 6, 4, 4, "#fffbe8");
    r(X + 7, Y + 2, 2, 10, INK), r(X + 4, Y + 12, 8, 2, INK);
  };
  const easel = (X, Y) => {
    r(X + 3, Y - 8, 10, 10, INK), r(X + 4, Y - 7, 8, 8, "#fffdf5"), r(X + 5, Y - 5, 3, 3, "#ff7eb6"), r(X + 8, Y - 4, 3, 2, "#7fd1ff");
    r(X + 5, Y + 2, 1, 12, "#7a5230"), r(X + 10, Y + 2, 1, 12, "#7a5230"), r(X + 7, Y + 2, 2, 10, "#5c3d22");
  };
  const coffeeMachine = (X, Y, active) => {
    r(X + 1, Y - 9, 14, 23, INK);
    r(X + 2, Y - 8, 12, 21, "#2b2d42");
    r(X + 4, Y - 6, 8, 4, "#555b6e");
    r(X + 11, Y - 5, 1, 1, "#ff5a5a");
    r(X + 6, Y + 1, 4, 2, "#555b6e");
    r(X + 6, Y + 6, 4, 4, "#ffffff");
    if (active) for (let i = 0; i < 3; i++) r(X + 6 + ((Math.floor(time * 4) + i) % 3), Y + 3 - i * 2, 1, 1, "#ffffff");
  };
  const waterCooler = (X, Y) => {
    r(X + 3, Y - 11, 10, 27, INK);
    r(X + 4, Y - 10, 8, 8, "#7fd1ff");
    r(X + 5, Y - 9, 2, 3, "#c8ecff");
    r(X + 4, Y - 2, 8, 17, "#e4e4ec");
    r(X + 7, Y + 3, 2, 2, "#4a90d9");
  };
  const vending = (X, Y) => {
    r(X, Y - 13, 16, 30, INK);
    r(X + 1, Y - 12, 14, 28, "#d64545");
    r(X + 3, Y - 10, 8, 17, "#bfe6ff");
    const cans = ["#f2c14e", "#3ecf8e", "#6c8cff", "#ff7eb6"];
    for (let row = 0; row < 4; row++) for (let col = 0; col < 3; col++) r(X + 4 + col * 3, Y - 9 + row * 4, 1, 3, cans[(row + col) % 4]);
    r(X + 12, Y - 8, 2, 6, "#ffd166");
    r(X + 3, Y + 10, 8, 3, "#2b2d42");
  };
  const trophyCase = (X, Y) => {
    r(X, Y - 11, 16, 28, INK);
    r(X + 1, Y - 10, 14, 26, "#7a5230");
    r(X + 2, Y - 9, 12, 22, "#cfe8ff");
    r(X + 4, Y - 7, 4, 3, "#f2c14e"), r(X + 5, Y - 4, 2, 2, "#c9962a");
    r(X + 8, Y + 1, 4, 3, "#c0c0c8"), r(X + 9, Y + 4, 2, 2, "#8a8a96");
    r(X + 2, Y, 12, 1, "#7a5230");
  };

  // ----- 벽 장식과 러그 (정적 레이어) -----
  const wallY = (ty) => ty * T + 5;
  const rug = (tx, ty, w, h, color, border) =>
    F.decor.push((R) => {
      R(tx * T + 2, ty * T + 2, w * T - 4, h * T - 4, border);
      R(tx * T + 4, ty * T + 4, w * T - 8, h * T - 8, color);
      for (let i = 0; i < w * 2 - 2; i++) R(tx * T + 8 + i * 8, ty * T + 4, 2, 2, border), R(tx * T + 8 + i * 8, (ty + h) * T - 6, 2, 2, border);
    });
  const windowAt = (tx, ty) => {
    const night = F.id === "palja";
    F.decor.push((R) => {
      const X = tx * T;
      const Y = wallY(ty);
      R(X + 1, Y - 1, 30, 11, "#6e5a3c");
      R(X + 2, Y, 28, 9, night ? "#3d3a6b" : "#9fd8ff");
      if (night) R(X + 22, Y + 2, 3, 3, "#ffe9a8"), R(X + 6, Y + 3, 1, 1, "#ffffff"), R(X + 12, Y + 6, 1, 1, "#ffffff");
      else R(X + 4, Y + 1, 6, 1, "#ffffff");
      R(X + 16, Y, 1, 9, "#6e5a3c");
    });
  };
  const board = (tx, ty, w, lines) =>
    F.decor.push((R) => {
      const X = tx * T;
      const Y = wallY(ty);
      R(X, Y - 1, w * T, 11, "#8a8fa3");
      R(X + 1, Y, w * T - 2, 9, "#fbfbff");
      lines.forEach((c, i) => R(X + 3 + i * 3, Y + 2 + (i % 3) * 2, 6 + ((i * 5) % 9), 1, c));
    });
  const cork = (tx, ty, w) =>
    F.decor.push((R) => {
      const X = tx * T;
      const Y = wallY(ty);
      R(X, Y - 1, w * T, 11, "#7a5230");
      R(X + 1, Y, w * T - 2, 9, "#c99a64");
      const notes = ["#fff3a8", "#ffd0e0", "#c8ecff", "#d4f5d0"];
      for (let i = 0; i < w * 3; i++) R(X + 3 + i * 5, Y + 1 + (i % 2) * 3, 4, 4, notes[i % notes.length]), R(X + 4 + i * 5, Y + 1 + (i % 2) * 3, 1, 1, "#d64545");
    });
  const frame = (tx, ty, inner) =>
    F.decor.push((R) => {
      const X = tx * T + 3;
      const Y = wallY(ty);
      R(X, Y - 1, 11, 11, "#c9962a");
      R(X + 1, Y, 9, 9, inner);
      R(X + 2, Y + 5, 7, 3, shade(inner, -0.2));
    });
  const moon = (tx, ty) =>
    F.decor.push((R) => {
      const X = tx * T + 3;
      const Y = wallY(ty);
      R(X, Y - 1, 11, 11, "#c9962a");
      R(X + 1, Y, 9, 9, "#2b2d55");
      R(X + 3, Y + 2, 5, 5, "#ffe9a8"), R(X + 5, Y + 2, 3, 3, "#2b2d55");
    });
  const playSign = (tx, ty) =>
    F.decor.push((R) => {
      const X = tx * T + 2;
      const Y = wallY(ty);
      R(X, Y, 13, 9, "#d64545");
      R(X + 5, Y + 2, 1, 5, "#ffffff"), R(X + 6, Y + 3, 1, 3, "#ffffff"), R(X + 7, Y + 4, 1, 1, "#ffffff");
    });
  const clock = (tx, ty) =>
    F.decor.push((R) => {
      const X = tx * T + 4;
      const Y = wallY(ty);
      R(X + 1, Y - 1, 7, 10, INK);
      R(X, Y, 9, 8, INK);
      R(X + 1, Y, 7, 8, "#ffffff");
      R(X + 4, Y + 1, 1, 4, INK), R(X + 4, Y + 4, 3, 1, INK);
    });

  // ----- 방 꾸미기 -----
  function deskRoomBasics(ox, oy) {
    addPlant(ox + 1, oy + 1);
    addPlant(ox + 9, oy + 6);
  }

  function addMeetingRoom(ox, oy, chairColor) {
    board(ox + 2, oy, 6, ["#7fd1ff", "#6c8cff", "#3ecf8e", "#ffb84d", "#ff7eb6", "#6c8cff", "#3ecf8e"]);
    const tableX = (ox + 3) * T;
    const tableY = (oy + 2) * T;
    addItem(ox + 3, oy + 2, 4, 2, tableY + 28, () => {
      r(tableX - 1, tableY + 1, 66, 30, INK);
      r(tableX, tableY + 2, 64, 22, "#c8955c");
      r(tableX, tableY + 2, 64, 1, "#e0b07a");
      r(tableX, tableY + 24, 64, 6, "#9a6a3c");
      r(tableX + 8, tableY + 8, 8, 6, "#fffdf5"), r(tableX + 40, tableY + 10, 10, 6, "#2b2d42"), r(tableX + 41, tableY + 11, 8, 4, "#7fd1ff");
      r(tableX + 26, tableY + 12, 4, 4, "#ffffff");
    });
    for (let i = 0; i < 4; i++) {
      const top = { tx: ox + 3 + i, ty: oy + 1, pose: "sit-down", dir: "down" };
      const bottom = { tx: ox + 3 + i, ty: oy + 4, pose: "sit-up", dir: "up" };
      F.meetingSeats.push(bottom, top);
      addChair(top.tx * T + 8, top.ty * T + 12, "down", chairColor);
      addChair(bottom.tx * T + 8, bottom.ty * T + 12, "up", chairColor);
    }
    // 자리가 모자라면 테이블 옆에 서서 참석한다
    F.meetingSeats.push(
      { tx: ox + 2, ty: oy + 2, pose: "stand", dir: "right" },
      { tx: ox + 7, ty: oy + 2, pose: "stand", dir: "left" },
      { tx: ox + 2, ty: oy + 3, pose: "stand", dir: "right" },
      { tx: ox + 7, ty: oy + 3, pose: "stand", dir: "left" },
    );
    addPlant(ox + 1, oy + 1), addPlant(ox + 9, oy + 1), addPlant(ox + 9, oy + 6);
  }

  function addLounge(ox, oy) {
    rug(ox + 2, oy + 3, 5, 3, "#a8dadc", "#5fa8b5");
    addTall(ox + 1, oy + 1, vending);
    addTall(ox + 7, oy + 1, waterCooler);
    const coffee = { tx: ox + 8, ty: oy + 2, pose: "stand", dir: "up", bubble: "coffee" };
    addItem(ox + 8, oy + 1, 1, 1, (oy + 1) * T + 15, () => coffeeMachine((ox + 8) * T, (oy + 1) * T, coffee.taken));
    const sx = (ox + 3) * T;
    const sy = (oy + 4) * T;
    addItem(ox + 3, oy + 4, 3, 1, sy + 2, () => {
      r(sx - 3, sy - 5, 54, 18, INK);
      r(sx, sy - 4, 48, 8, "#e07a5f");
      r(sx, sy + 4, 48, 7, "#f19a7e");
      r(sx - 2, sy - 2, 4, 13, "#c96a50"), r(sx + 46, sy - 2, 4, 13, "#c96a50");
      r(sx + 16, sy - 4, 1, 8, "#c96a50"), r(sx + 32, sy - 4, 1, 8, "#c96a50");
    });
    const tX = (ox + 3) * T;
    const tY = (oy + 5) * T;
    addItem(ox + 3, oy + 5, 3, 1, tY + 12, () => {
      r(tX + 7, tY + 3, 34, 10, INK);
      r(tX + 8, tY + 4, 32, 7, "#8d6748");
      r(tX + 8, tY + 4, 32, 1, "#a8805c");
      r(tX + 14, tY + 5, 3, 3, "#ffffff"), r(tX + 30, tY + 5, 3, 3, "#ffffff");
    });
    addPlant(ox + 9, oy + 6), addPlant(ox + 1, oy + 6);
    F.spots.push(
      coffee,
      { tx: ox + 7, ty: oy + 2, pose: "stand", dir: "up", bubble: "note" },
      { tx: ox + 1, ty: oy + 2, pose: "stand", dir: "up", bubble: "note" },
      { tx: ox + 3, ty: oy + 4, pose: "sit-down", dir: "down", bubble: "talk" },
      { tx: ox + 4, ty: oy + 4, pose: "sit-down", dir: "down", bubble: "coffee" },
      { tx: ox + 5, ty: oy + 4, pose: "sit-down", dir: "down", bubble: "talk" },
    );
  }

  function addElevator(ox, oy) {
    // 위쪽 문과 겹치지 않게 오른쪽 벽면에 둔다
    const ex = ox + 7;
    const X = ex * T;
    const Y = (oy + 1) * T;
    const goingUp = F.id === "hq";
    addItem(ex, oy + 1, 2, 1, Y + 15, () => {
      r(X - 1, Y - 12, 34, 28, INK);
      r(X, Y - 11, 32, 26, "#9aa0ad");
      r(X + 2, Y - 6, 13, 21, "#c9cbd3"), r(X + 17, Y - 6, 13, 21, "#c9cbd3");
      r(X + 15, Y - 6, 2, 21, "#7c8290");
      r(X + 12, Y - 10, 8, 3, INK);
      const lit = Math.floor(time * 2) % 2 ? "#ffd166" : "#c9962a";
      if (goingUp) r(X + 15, Y - 9, 2, 1, lit), r(X + 14, Y - 8, 4, 1, lit);
      else r(X + 14, Y - 9, 4, 1, lit), r(X + 15, Y - 8, 2, 1, lit);
    });
    F.elevator = { tx: ex, ty: oy + 2, px: X + 16, py: (oy + 2) * T + 12, pose: "stand", dir: "up" };
    rug(ox + 6, oy + 2, 4, 2, "#e3dccb", "#b8ad94");
    addPlant(ox + 1, oy + 1), addPlant(ox + 1, oy + 6), addPlant(ox + 9, oy + 6);
  }

  function decorate(room) {
    const ox = room.c * 10;
    const oy = room.r * 7;
    switch (room.id) {
      case "strategy":
        windowAt(ox + 1, oy), board(ox + 4, oy, 3, ["#6c8cff", "#d64545", "#6c8cff", "#3ecf8e"]);
        addTall(ox + 8, oy + 1, bookshelf), addTall(ox + 9, oy + 1, bookshelf), deskRoomBasics(ox, oy);
        break;
      case "youtube":
      case "palja-channel":
        playSign(ox + 1, oy), windowAt(ox + 7, oy), board(ox + 3, oy, 3, ["#d64545", "#2b2d42", "#ffb84d"]);
        addTall(ox + 7, oy + 4, camera), addTall(ox + 8, oy + 5, ringLight), addPlant(ox + 1, oy + 1), addPlant(ox + 1, oy + 6);
        break;
      case "design":
        windowAt(ox + 1, oy), frame(ox + 4, oy, "#ff7eb6"), frame(ox + 5, oy, "#ffb84d"), frame(ox + 6, oy, "#7fd1ff");
        rug(ox + 6, oy + 4, 3, 2, "#ffe1ec", "#ff9ec4"), addTall(ox + 2, oy + 5, easel), deskRoomBasics(ox, oy);
        break;
      case "marketing":
        windowAt(ox + 1, oy), board(ox + 4, oy, 4, ["#3ecf8e", "#3ecf8e", "#6c8cff", "#ffb84d", "#3ecf8e"]);
        addTall(ox + 9, oy + 1, cabinet), deskRoomBasics(ox, oy);
        break;
      case "insight":
        windowAt(ox + 7, oy), cork(ox + 1, oy, 4);
        addTall(ox + 9, oy + 1, bookshelf), deskRoomBasics(ox, oy);
        break;
      case "comms":
        clock(ox + 2, oy), board(ox + 4, oy, 3, ["#7fb2e5", "#b8b8c8", "#7fb2e5"]), frame(ox + 8, oy, "#d6e4f0");
        addTall(ox + 9, oy + 1, cabinet), addTall(ox + 8, oy + 1, printer), deskRoomBasics(ox, oy);
        break;
      case "dictionary":
      case "palja-dictionary":
        frame(ox + 4, oy, "#fffdf5"), clock(ox + 6, oy);
        addTall(ox + 1, oy + 1, bookshelf), addTall(ox + 2, oy + 1, bookshelf), addTall(ox + 8, oy + 1, bookshelf), addTall(ox + 9, oy + 1, bookshelf);
        addPlant(ox + 9, oy + 6), addPlant(ox + 1, oy + 6);
        break;
      case "finance":
        frame(ox + 2, oy, "#e3d5b4"), board(ox + 4, oy, 3, ["#2ec5d3", "#b8b8c8", "#b8b8c8", "#d64545"]), clock(ox + 8, oy);
        addTall(ox + 1, oy + 1, cabinet), addTall(ox + 2, oy + 1, cabinet), addTall(ox + 8, oy + 1, printer), addTall(ox + 9, oy + 1, safe);
        addPlant(ox + 9, oy + 6);
        break;
      case "security":
      case "palja-dev":
        board(ox + 1, oy, 3, ["#3ecf8e", "#a78bfa", "#7fd1ff", "#a78bfa", "#3ecf8e"]), clock(ox + 6, oy);
        addTall(ox + 8, oy + 1, serverRack), addTall(ox + 9, oy + 1, serverRack), addPlant(ox + 1, oy + 6);
        if (room.id === "security") addTall(ox + 1, oy + 1, safe);
        else addPlant(ox + 1, oy + 1);
        break;
      case "archive":
        frame(ox + 2, oy, "#f2a33a"), clock(ox + 6, oy);
        addTall(ox + 1, oy + 1, cabinet), addTall(ox + 2, oy + 1, cabinet), addTall(ox + 3, oy + 1, cabinet);
        addTall(ox + 8, oy + 1, boxes), addTall(ox + 9, oy + 1, boxes), addTall(ox + 9, oy + 5, boxes), addPlant(ox + 1, oy + 6);
        break;
      case "palja-shelf":
        moon(ox + 4, oy), windowAt(ox + 6, oy);
        addTall(ox + 1, oy + 1, bookshelf), addTall(ox + 2, oy + 1, bookshelf), addTall(ox + 9, oy + 1, bookshelf), addPlant(ox + 9, oy + 6);
        break;
      case "palja-product":
        windowAt(ox + 1, oy), board(ox + 4, oy, 3, ["#ffd166", "#9b87d6", "#ffd166"]);
        addTall(ox + 8, oy + 1, boxes), addTall(ox + 9, oy + 1, boxes), addTall(ox + 9, oy + 5, boxes), addPlant(ox + 1, oy + 6);
        break;
      case "chief":
      case "palja":
        clock(ox + 2, oy), board(ox + 4, oy, 3, ["#f2a33a", "#6c8cff", "#ff7eb6", "#3ecf8e", "#a78bfa", "#2ec5d3"]);
        if (room.id === "palja") moon(ox + 8, oy), rug(ox + 2, oy + 1, 6, 5, "#e3dbfa", "#9b87d6");
        else frame(ox + 8, oy, "#9fd8ff"), rug(ox + 2, oy + 1, 6, 5, "#f7d488", "#d9a441");
        addPlant(ox + 1, oy + 1), addPlant(ox + 9, oy + 1), addTall(ox + 9, oy + 5, cabinet);
        break;
      case "ceo": {
        windowAt(ox + 1, oy), frame(ox + 4, oy, "#3ecf8e"), clock(ox + 6, oy);
        rug(ox + 2, oy + 3, 6, 3, "#e9c46a", "#b5832a");
        const dX = (ox + 3) * T;
        const dY = (oy + 2) * T;
        addItem(ox + 3, oy + 2, 3, 1, dY + 15, () => {
          r(dX - 1, dY + 1, 50, 16, INK);
          r(dX, dY + 2, 48, 9, "#8a5532");
          r(dX, dY + 2, 48, 1, "#a8714a");
          r(dX, dY + 11, 48, 5, "#6b3e22");
          r(dX + 18, dY + 4, 12, 6, "#c0c0c8"), r(dX + 19, dY + 5, 10, 4, "#7fd1ff");
          r(dX + 34, dY + 7, 10, 2, "#f2c14e");
          r(dX + 4, dY + 4, 6, 5, "#fffdf5");
        });
        addChair(dX + 24, (oy + 3) * T + 12, "up", "#7a2e2e");
        addTall(ox + 1, oy + 1, bookshelf), addTall(ox + 9, oy + 1, trophyCase), addPlant(ox + 9, oy + 6), addPlant(ox + 1, oy + 6);
        break;
      }
      case "meeting":
        addMeetingRoom(ox, oy, "#4a5a8a");
        break;
      case "palja-meeting":
        addMeetingRoom(ox, oy, "#7a68b8");
        break;
      case "lounge":
      case "palja-lounge":
        frame(ox + 2, oy, "#ffd166"), board(ox + 4, oy, 2, ["#e07a5f", "#3ecf8e", "#6c8cff"]);
        addLounge(ox, oy);
        break;
      case "elevator":
        addElevator(ox, oy);
        break;
    }
  }

  // ----- 정적 레이어 (바닥, 벽, 러그, 벽 장식) -----
  function paintStatic(floor) {
    const layer = document.createElement("canvas");
    layer.width = floor.tilesW * T;
    layer.height = floor.tilesH * T;
    const s = layer.getContext("2d");
    const R = (x, y, w, h, c) => {
      s.fillStyle = c;
      s.fillRect(x, y, w, h);
    };
    const themeAt = (x, y) => THEMES[roomOf(floor, x, y)?.id] || THEMES.archive;
    for (let ty = 0; ty < floor.tilesH; ty++) {
      for (let tx = 0; tx < floor.tilesW; tx++) {
        const X = tx * T;
        const Y = ty * T;
        const wall = isWall(tx, ty);
        const door = isDoor(floor, tx, ty);
        if (!wall || door) {
          // 문은 아래쪽(가로 벽) 또는 오른쪽(세로 벽) 방의 바닥을 쓴다
          const f = themeAt(tx + (tx % 10 === 0 ? 1 : 0), ty + (ty % 7 === 0 ? 1 : 0));
          const alt = (tx + ty) % 2 === 0;
          if (f.kind === "wood") {
            R(X, Y, T, T, f.a);
            for (let i = 0; i < 4; i++) R(X, Y + i * 4 + 3, T, 1, f.b);
            R(X + ((ty * 7 + tx * 5) % 12) + 2, Y, 1, T, f.b);
          } else if (f.kind === "tile") {
            R(X, Y, T, T, alt ? f.a : f.b);
            R(X, Y, T, 1, shade(f.b, -0.05));
            R(X, Y, 1, T, shade(f.b, -0.05));
          } else if (f.kind === "checker") {
            R(X, Y, T, T, alt ? f.a : f.b);
          } else {
            R(X, Y, T, T, f.a);
            R(X + ((tx * 3 + ty * 5) % 13), Y + ((tx * 7 + ty * 3) % 13), 1, 1, f.b);
            R(X + ((tx * 11 + ty * 2) % 13) + 1, Y + ((tx * 5 + ty * 11) % 13) + 1, 1, 1, f.b);
          }
          if (door && ty % 7 === 0) R(X, Y, T, 2, shade(f.a, -0.12));
          continue;
        }
        if (ty % 7 === 0 && ty < floor.tilesH - 1 && tx % 10 !== 0) {
          // 가로 벽: 위는 벽 윗면, 아래는 아래 방에서 보이는 벽면
          R(X, Y, T, 5, "#4a4e69");
          R(X, Y, T, 1, "#6b6f8e");
          R(X, Y + 5, T, 9, themeAt(tx, ty + 1).wall);
          R(X, Y + 14, T, 2, "#b8ad94");
          if (isDoor(floor, tx - 1, ty)) R(X, Y + 5, 2, 11, "#8a7a5c");
          if (isDoor(floor, tx + 1, ty)) R(X + 14, Y + 5, 2, 11, "#8a7a5c");
        } else {
          R(X, Y, T, T, "#4a4e69");
          R(X, Y, T, 1, "#6b6f8e");
          if (tx % 10 === 0 && tx > 0) R(X, Y, 1, T, "#3b3e56");
          if (tx % 10 === 0 && tx < floor.tilesW - 1) R(X + T - 1, Y, 1, T, "#3b3e56");
        }
      }
    }
    for (const d of floor.decor) d(R);
    floor.layer = layer;
  }

  // ----- 직원 배치 -----
  function buildPeople() {
    const used = new Map();
    agents.forEach((agent, i) => {
      const { floor, room } = findRoom(agent.room) || findRoom("archive");
      const n = used.get(room.id) || 0;
      used.set(room.id, n + 1);
      const [dx, dy] = DESK_SLOTS[Math.min(n, DESK_SLOTS.length - 1)];
      const deskX = room.c * 10 + dx;
      const deskY = room.r * 7 + dy;
      const base = LOOKS[agent.id] || FALLBACK_LOOKS[i % FALLBACK_LOOKS.length];
      const person = {
        id: agent.id,
        agent,
        floor: floor.id,
        look: { ...base, key: agent.id },
        seat: { floor: floor.id, tx: deskX, ty: deskY + 1, px: (deskX + 1) * T, py: (deskY + 1) * T + 12, pose: "sit-up", dir: "up" },
        desk: { x: deskX * T, y: deskY * T - 6, w: 32, h: 22 },
        x: 0,
        y: 0,
        dir: "up",
        pose: "sit-up",
        task: "seated",
        path: [],
        working: false,
        riding: false,
        idleTimer: 4 + Math.random() * 16,
        walkT: 0,
        doneUntil: 0,
        tempBubble: null,
        tempUntil: 0,
        spot: null,
        moveToken: 0,
        errandToken: 0,
        tag: null,
      };
      person.x = person.seat.px;
      person.y = person.seat.py;
      people.set(agent.id, person);
      F = floor;
      addDesk(deskX, deskY, person, DESK_PROPS[agent.id]);
      addChair(person.seat.px, person.seat.py, "up");

      const tag = document.createElement("div");
      tag.className = `name-tag${agent.chief || agent.lead ? " chief" : ""}`;
      tag.textContent = agent.name;
      tag.style.setProperty("--agent-color", agent.color);
      overlay.append(tag);
      person.tag = tag;
    });
  }

  // ----- 길찾기 (타일 BFS) -----
  function findPath(floor, from, to) {
    const start = key(from.x, from.y);
    const goal = key(to.x, to.y);
    const prev = new Map([[start, null]]);
    const queue = [[from.x, from.y]];
    for (let head = 0; head < queue.length; head++) {
      const [x, y] = queue[head];
      if (key(x, y) === goal) break;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        const k = key(nx, ny);
        if (prev.has(k)) continue;
        if (solid(floor, nx, ny) && k !== goal) continue;
        prev.set(k, [x, y]);
        queue.push([nx, ny]);
      }
    }
    if (!prev.has(goal)) return null;
    const path = [];
    for (let cur = [to.x, to.y]; cur; cur = prev.get(key(cur[0], cur[1]))) path.unshift(cur);
    return path.slice(1);
  }

  // 같은 층 안에서 걷기
  function walkTo(person, place) {
    return new Promise((resolve) => {
      const floor = floors.get(person.floor);
      const here = { x: Math.floor(person.x / T), y: Math.floor((person.y - 4) / T) };
      const tiles = findPath(floor, here, { x: place.tx, y: place.ty }) || [];
      const finalX = place.px ?? place.tx * T + 8;
      const finalY = place.py ?? place.ty * T + 12;
      person.pose = "stand";
      person.path = tiles.map(([x, y]) => ({ x: x * T + 8, y: y * T + 12 }));
      person.path.push({ x: finalX, y: finalY });
      person.onArrive = () => {
        person.pose = place.pose || "stand";
        person.dir = place.dir || person.dir;
        resolve();
      };
    });
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // 다른 층이면 엘리베이터를 타고 이동한 뒤 목적지까지 걷는다
  async function travel(person, place) {
    const token = ++person.moveToken;
    person.riding = false;
    const target = place.floor || person.floor;
    if (target !== person.floor) {
      await walkTo(person, floors.get(person.floor).elevator);
      if (person.moveToken !== token) return false;
      person.riding = true;
      person.dir = "up";
      await sleep(1100);
      if (person.moveToken !== token) return false;
      const arrival = floors.get(target).elevator;
      person.floor = target;
      person.x = arrival.px;
      person.y = arrival.py;
      person.dir = "down";
      person.riding = false;
    }
    await walkTo(person, place);
    return person.moveToken === token;
  }

  function releaseSpot(person) {
    if (person.spot) person.spot.taken = null;
    person.spot = null;
  }

  function goHome(person) {
    releaseSpot(person);
    person.task = "walking-home";
    travel(person, person.seat).then((arrived) => {
      if (arrived && person.task === "walking-home") {
        person.task = "seated";
        person.idleTimer = 8 + Math.random() * 20;
      }
    });
  }

  function goWander(person) {
    const free = floors.get(person.floor).spots.filter((s) => !s.taken);
    if (!free.length) return;
    const spot = free[Math.floor(Math.random() * free.length)];
    spot.taken = person.id;
    person.spot = spot;
    person.task = "wandering";
    person.stayLeft = 5 + Math.random() * 7;
    travel(person, spot).then((arrived) => {
      if (!arrived || person.task !== "wandering") return;
      // 휴게실에서 다른 직원과 마주치면 알린다 (사내 메신저 잡담용)
      const mates = [...people.values()].filter((p) => p !== person && p.floor === person.floor && p.task === "wandering" && p.spot && !p.path.length);
      onLounge?.(person.id, mates.map((p) => p.id));
    });
  }

  function update(person, dt) {
    if (person.path.length) {
      const target = person.path[0];
      const dx = target.x - person.x;
      const dy = target.y - person.y;
      const dist = Math.hypot(dx, dy);
      const step = SPEED * dt;
      if (Math.abs(dx) > Math.abs(dy)) person.dir = dx > 0 ? "right" : "left";
      else if (dy !== 0) person.dir = dy > 0 ? "down" : "up";
      if (dist <= step) {
        person.x = target.x;
        person.y = target.y;
        person.path.shift();
        if (!person.path.length) person.onArrive?.();
      } else {
        person.x += (dx / dist) * step;
        person.y += (dy / dist) * step;
      }
      person.walkT += dt;
      return;
    }
    if (person.riding || person.task === "errand" || person.task === "meeting") return;
    if (person.task === "wandering") {
      person.stayLeft -= dt;
      if (person.stayLeft <= 0 || person.working) goHome(person);
      return;
    }
    if (person.task === "seated" && !person.working && !reducedMotion) {
      person.idleTimer -= dt;
      if (person.idleTimer <= 0) {
        if (Math.random() < 0.4) goWander(person);
        else person.idleTimer = 6 + Math.random() * 14;
      }
    }
  }

  // ----- 말풍선 -----
  function drawBubble(cx, top, kind) {
    const w = 15;
    const h = 11;
    const x = Math.round(cx - w / 2);
    const y = Math.round(top - h - 3);
    r(x + 1, y, w - 2, h, INK);
    r(x, y + 1, w, h - 2, INK);
    r(x + 1, y + 1, w - 2, h - 2, "#ffffff");
    r(x + 6, y + h, 3, 1, INK), r(x + 7, y + h + 1, 1, 1, INK), r(x + 7, y + h - 1, 1, 1, "#ffffff");
    const px = (dx, dy, c, ww = 1, hh = 1) => r(x + dx, y + dy, ww, hh, c);
    switch (kind) {
      case "typing": {
        const active = Math.floor(time * 4) % 3;
        for (let i = 0; i < 3; i++) px(3 + i * 4, 5, i === active ? INK : "#b8b8c8", 2, 2);
        break;
      }
      case "done":
        px(4, 5, "#2fa86c", 2, 1), px(5, 6, "#2fa86c", 2, 1), px(6, 7, "#2fa86c", 2, 1), px(8, 5, "#2fa86c", 2, 1), px(9, 4, "#2fa86c", 2, 1), px(10, 3, "#2fa86c", 2, 1);
        break;
      case "alert":
        px(7, 2, "#e76f51", 1, 5), px(7, 8, "#e76f51");
        break;
      case "talk":
        px(3, 3, "#8a8fa3", 9, 1), px(3, 5, "#8a8fa3", 7, 1), px(3, 7, "#8a8fa3", Math.floor(time * 3) % 2 ? 5 : 8, 1);
        break;
      case "coffee":
        px(4, 5, "#8d5a3b", 6, 4), px(10, 6, "#8d5a3b", 1, 2), px(5, 5, "#c48b5e", 4, 1);
        if (Math.floor(time * 3) % 2) px(6, 2, "#b8b8c8"), px(7, 3, "#b8b8c8");
        else px(7, 2, "#b8b8c8"), px(6, 3, "#b8b8c8");
        break;
      case "note":
        px(8, 2, INK, 1, 6), px(9, 2, INK, 2, 1), px(6, 7, INK, 3, 2);
        break;
    }
  }

  function bubbleFor(person) {
    if (person.tempBubble && person.tempUntil > time) return person.tempBubble;
    if (person.working && person.task === "meeting" && !person.path.length) return "talk";
    if (person.working && person.task === "seated") return "typing";
    if (person.doneUntil > time) return "done";
    if (person.task === "wandering" && !person.path.length && person.spot) return person.spot.bubble;
    return null;
  }

  // ----- 그리기 -----
  function drawPerson(person) {
    const moving = person.path.length > 0;
    let frame = 0;
    if (moving) frame = [1, 0, 2, 0][Math.floor(person.walkT * 8) % 4];
    else if (person.pose === "sit-up" && person.working && person.task === "seated") frame = [1, 2][Math.floor(time * 6) % 2];
    const img = sprite(person.look, person.dir, frame, person.pose);
    const sitDrop = person.pose === "stand" ? 0 : 1;
    const x = Math.round(person.x - img.width / 2);
    const y = Math.round(person.y - img.height + 1 + sitDrop);
    ctx.drawImage(img, x, y);
    if (hovered === person) {
      const ay = y - 4 + (Math.floor(time * 3) % 2);
      r(Math.round(person.x) - 2, ay - 2, 5, 1, "#ffd166"), r(Math.round(person.x) - 1, ay - 1, 3, 1, "#ffd166"), r(Math.round(person.x), ay, 1, 1, "#ffd166");
    }
    person.headY = y;
  }

  const visible = (person) => person.floor === view.id && !person.riding;

  function render() {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(view.layer, 0, 0);
    const here = [...people.values()].filter(visible);
    const list = [...view.items.map((it) => ({ y: it.sortY, draw: it.draw })), ...here.map((p) => ({ y: p.y, draw: () => drawPerson(p) }))];
    list.sort((a, b) => a.y - b.y);
    for (const it of list) it.draw();
    const W = view.tilesW * T;
    const H = view.tilesH * T;
    for (const person of people.values()) {
      const show = visible(person);
      person.tag.hidden = !show;
      if (!show) continue;
      const kind = bubbleFor(person);
      if (kind) drawBubble(person.x, person.headY ?? person.y - 20, kind);
      person.tag.style.left = `${(person.x / W) * 100}%`;
      person.tag.style.top = `${((person.y + 2) / H) * 100}%`;
      person.tag.classList.toggle("working", person.working);
    }
  }

  // ----- 크기 조절 -----
  // 화면 폭(과 높이)에 맞춰 늘리되, 내부 해상도는 정수 배율로 그려 픽셀이 뭉개지지 않게 한다.
  // 폭이 좁은 휴대폰에서는 원래 크기로 두고 가로 스크롤한다.
  const stage = canvas.parentElement;
  const scroller = stage.parentElement;
  function resize() {
    const W = view.tilesW * T;
    const H = view.tilesH * T;
    const dpr = window.devicePixelRatio || 1;
    const maxByHeight = (window.innerHeight * 0.72 * W) / H;
    const cssW = Math.max(W, Math.min(scroller.clientWidth, maxByHeight));
    scale = Math.max(1, Math.ceil((cssW * dpr) / W));
    canvas.width = W * scale;
    canvas.height = H * scale;
    stage.style.width = `${cssW}px`;
    stage.style.height = `${(cssW * H) / W}px`;
    stage.style.setProperty("--s", String(cssW / W));
  }

  function setFloor(id) {
    if (!floors.has(id) || view?.id === id) return;
    view = floors.get(id);
    for (const floor of floors.values()) for (const label of floor.labels) label.hidden = floor !== view;
    hovered = null;
    resize();
    scroller.scrollLeft = (scroller.scrollWidth - scroller.clientWidth) / 2;
    onFloorChange?.(id);
  }

  // ----- 클릭과 마우스 -----
  function pick(event) {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * view.tilesW * T;
    const y = ((event.clientY - rect.top) / rect.height) * view.tilesH * T;
    let best = null;
    for (const p of people.values()) {
      if (!visible(p)) continue;
      if (x >= p.x - 7 && x <= p.x + 7 && y >= p.y - 22 && y <= p.y + 2 && (!best || p.y > best.y)) best = p;
    }
    if (best) return { person: best };
    for (const p of people.values()) {
      const d = p.desk;
      if (p.seat.floor === view.id && x >= d.x && x <= d.x + d.w && y >= d.y && y <= d.y + d.h) return { person: p };
    }
    const room = roomOf(view, Math.floor(x / T), Math.floor(y / T));
    if (room?.id === "meeting" || room?.id === "palja-meeting") return { meeting: true };
    if (room?.id === "elevator") return { elevator: true };
    return {};
  }
  canvas.addEventListener("click", (e) => {
    const hit = pick(e);
    if (hit.person) onSelect(hit.person.id);
    else if (hit.meeting) onMeeting();
    else if (hit.elevator) setFloor(view.id === "hq" ? "palja" : "hq");
  });
  canvas.addEventListener("mousemove", (e) => {
    const hit = pick(e);
    hovered = hit.person || null;
    canvas.style.cursor = hit.person || hit.meeting || hit.elevator ? "pointer" : "default";
  });
  canvas.addEventListener("mouseleave", () => (hovered = null));

  // ----- 시작 -----
  for (const floor of floors.values()) {
    F = floor;
    for (const room of floor.rooms) decorate(room);
  }
  buildPeople();
  for (const floor of floors.values()) {
    paintStatic(floor);
    const W = floor.tilesW * T;
    const H = floor.tilesH * T;
    for (const room of floor.rooms) {
      const label = document.createElement("div");
      label.className = `room-label${room.id === "chief" || room.id === "palja" ? " chief" : ""}`;
      label.textContent = room.name;
      label.style.left = `${(((room.c * 10 + 1) * T) / W) * 100}%`;
      label.style.top = `${(((room.r * 7 + 1) * T) / H) * 100}%`;
      overlay.append(label);
      floor.labels.push(label);
    }
  }
  setFloor("hq");
  new ResizeObserver(resize).observe(scroller);
  window.addEventListener("resize", resize);

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    time += dt;
    for (const person of people.values()) update(person, dt);
    render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  return {
    floors: FLOORS.map(({ id, name, icon }) => ({ id, name, icon })),
    setFloor,
    floorOf: (id) => people.get(id)?.seat.floor,
    // 일 시작/끝: 일하는 동안 자리로 돌아가 타이핑한다
    setWorking(id, working) {
      const person = people.get(id);
      if (!person) return;
      person.working = working;
      if (working && !["seated", "walking-home", "errand", "meeting"].includes(person.task)) goHome(person);
    },
    flash(id) {
      const person = people.get(id);
      if (person) person.doneUntil = time + 5;
    },
    // 코토가 담당자 자리로 걸어가 업무를 전달한다 (다른 층이면 엘리베이터를 탄다)
    async deliver(fromId, toIds) {
      const runner = people.get(fromId);
      if (!runner) return;
      const token = ++runner.errandToken;
      releaseSpot(runner);
      runner.task = "errand";
      for (const id of toIds) {
        const staff = people.get(id);
        if (!staff || runner.errandToken !== token) continue;
        const floor = floors.get(staff.seat.floor);
        const { tx, ty } = staff.seat;
        const visit = [[tx + 2, ty], [tx - 1, ty], [tx, ty + 1], [tx + 1, ty + 1]].find(([x, y]) => !solid(floor, x, y)) || [tx, ty + 1];
        const arrived = await travel(runner, { floor: floor.id, tx: visit[0], ty: visit[1], dir: visit[0] > tx ? "left" : visit[0] < tx ? "right" : "up" });
        if (!arrived || runner.errandToken !== token) return;
        runner.tempBubble = "alert";
        runner.tempUntil = time + 1.4;
        staff.tempBubble = "talk";
        staff.tempUntil = time + 1.6;
        await sleep(1400);
      }
      if (runner.errandToken === token) goHome(runner);
    },
    // 회의 참석자를 회의실로 모으고, 끝나면 자리로 돌려보낸다.
    // 모두 팔자서재 별관 사람이면 별관 회의실, 아니면 본사 회의실을 쓴다.
    gather(ids) {
      const group = ids.map((id) => people.get(id)).filter(Boolean);
      const floor = floors.get(group.length && group.every((p) => p.seat.floor === "palja") ? "palja" : "hq");
      group.forEach((person, i) => {
        const seat = floor.meetingSeats[i % floor.meetingSeats.length];
        releaseSpot(person);
        person.errandToken++;
        person.task = "meeting";
        travel(person, { ...seat, floor: floor.id, py: seat.ty * T + 12 });
      });
      return floor.id;
    },
    disperse(ids) {
      for (const id of ids) {
        const person = people.get(id);
        if (person?.task === "meeting") goHome(person);
      }
    },
    // 직원 목록·대화창에 쓸 픽셀 얼굴 이미지
    avatar(id, size = 3) {
      const person = people.get(id);
      if (!person) return "";
      const img = sprite(person.look, "down", 0, "stand");
      const c = document.createElement("canvas");
      c.width = img.width * size;
      c.height = img.height * size;
      const g = c.getContext("2d");
      g.imageSmoothingEnabled = false;
      g.drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL();
    },
  };
}
