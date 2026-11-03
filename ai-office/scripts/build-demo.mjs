// claude.ai 테스트 페이지를 dist-demo/ 에 만든다.
//   node scripts/build-demo.mjs
// 화면(public/)은 그대로 쓰고, api.js와 store.js만 demo/ 버전(claude.ai의 Claude·저장소 사용)으로 바꾼다.
// 직원 명부와 부서 지침(src/)은 agents-data.js 하나로 묶는다.
import { build } from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import os from "node:os";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "dist-demo");
await fs.rm(out, { recursive: true, force: true });
await fs.mkdir(path.join(out, "fonts"), { recursive: true });

// 1) src/agents.js(지침 .md 포함)를 묶어서 읽고, 화면에서 쓸 데이터 파일로 쓴다
const bundled = path.join(out, ".agents.mjs");
await build({ entryPoints: [path.join(root, "src/agents.js")], bundle: true, format: "esm", loader: { ".md": "text" }, outfile: bundled, logLevel: "error" });
const agentsModule = await import(pathToFileURL(bundled).href);
await fs.rm(bundled);

// 맥에 원본 부서 지침(~/.claude/지침)이 있으면 그것으로 바꾼다.
// 원본은 공개 저장소(git)에 올리지 않고, 대표님만 여는 테스트 페이지(dist-demo, git 제외)에만 들어간다.
// 그래도 사업자번호·계좌·전화번호·이메일은 가린다.
const GUIDE_DIR = process.env.GUIDE_DIR || path.join(os.homedir(), ".claude/지침");
const GUIDE_FILES = {
  strategy: "전략기획실.md",
  youtube: "유튜브편집국.md",
  design: "디자인실.md",
  comms: "커뮤니케이션실.md",
  marketing: "마케팅실.md",
  insight: "인사이트캡쳐.md",
  dictionary: "사전편찬실.md",
  finance: "재무관리부.md",
  security: "정보보안실.md",
  reference: "레퍼런스모음집.md",
  template: "템플릿기록실.md",
  palja: "팔자서재/팔자서재.md",
  "palja-dev": "팔자서재/개발실.md",
  "palja-shelf": "팔자서재/서가편집실.md",
  "palja-channel": "팔자서재/채널실.md",
  "palja-product": "팔자서재/상품기획실.md",
  "palja-dictionary": "팔자서재/사전편찬실.md",
};
const redact = (text) =>
  text
    .split("\n")
    .map((line) =>
      /사업자등록번호\s*\|\s*\d|입금 계좌\s*\||전화번호\s*\|\s*0/.test(line)
        ? line.replace(/\|([^|]*)\|\s*$/, "| (민감정보 생략) |")
        : line,
    )
    .join("\n")
    .replace(/\b\d{3}-\d{2}-\d{5}\b/g, "(민감정보 생략)")
    .replace(/\b\d{4}-\d{2}-\d{6,8}\b/g, "(민감정보 생략)")
    .replace(/\b01[016789]-?\d{3,4}-?\d{4}\b/g, "(민감정보 생략)")
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "(이메일 생략)");
const guides = {};
let source = "초안(src/guidelines)";
try {
  for (const [id, file] of Object.entries(GUIDE_FILES)) guides[id] = redact(await fs.readFile(path.join(GUIDE_DIR, file), "utf8"));
  // 코토는 CLAUDE.md의 정체성·말투·부서 라우팅 부분을 지침으로 쓴다
  const claudeMd = await fs.readFile(path.join(GUIDE_DIR, "..", "CLAUDE.md"), "utf8").catch(() => "");
  const start = claudeMd.indexOf("# 정체성");
  const end = claudeMd.indexOf("# oh-my-claudecode");
  if (start >= 0) guides.coto = redact(claudeMd.slice(start, end > start ? end : undefined).replace(/\n---\s*$/, "").trim());
  source = `원본(${GUIDE_DIR})`;
} catch (e) {
  for (const key of Object.keys(guides)) delete guides[key];
  console.log(`원본 지침을 읽지 못해 초안을 씁니다: ${e.message}`);
}
agentsModule.applyGuides(guides);
const { AGENTS, STAFF, DELEGATE_SYSTEM } = agentsModule;
const agents = AGENTS.map(({ guide, ...rest }) => rest);
await fs.writeFile(
  path.join(out, "agents-data.js"),
  `// scripts/build-demo.mjs가 src/agents.js와 src/guidelines/에서 만든 파일입니다. 직접 고치지 마세요.\n` +
    `export const AGENTS = ${JSON.stringify(agents, null, 1)};\n` +
    `export const STAFF_IDS = ${JSON.stringify(STAFF.map((a) => a.id))};\n` +
    `export const DELEGATE_SYSTEM = ${JSON.stringify(DELEGATE_SYSTEM)};\n`,
);

// 2) 화면 파일 복사, api.js만 테스트용으로
for (const file of ["app.js", "office.js", "messenger.js", "markdown.js", "style.css", "theme-pink.css"]) {
  await fs.copyFile(path.join(root, "public", file), path.join(out, file));
}
await fs.copyFile(path.join(root, "demo/api.js"), path.join(out, "api.js"));
// 저장소: 기본(브라우저) 버전은 store-local.js로 두고, 테스트용(claude.ai 저장소)을 store.js로 쓴다
await fs.copyFile(path.join(root, "public/store.js"), path.join(out, "store-local.js"));
await fs.copyFile(path.join(root, "demo/store.js"), path.join(out, "store.js"));
for (const file of ["Galmuri11.woff2", "Galmuri11-Bold.woff2", "Galmuri-OFL.md"]) {
  await fs.copyFile(path.join(root, "public/fonts", file), path.join(out, "fonts", file));
}

// 3) index.html: claude.ai 페이지는 <head>/<body> 틀을 자동으로 씌우므로 내용만 남긴다.
//    외부 스타일시트(Pretendard)는 claude.ai에서 막히므로 뺀다.
const html = await fs.readFile(path.join(root, "public/index.html"), "utf8");
const body = html.slice(html.indexOf("<body>") + 6, html.indexOf("</body>")).trim();
const page =
  `<title>홈페이션 AI 오피스</title>\n` +
  `<meta name="claude:viewport-fit-sides" content="cover">\n` +
  `<link rel="stylesheet" href="style.css" />\n` +
  `<link rel="stylesheet" href="theme-pink.css" />\n` +
  body.replace('<p class="sub">직원을 클릭해 업무를 맡겨 보세요</p>', '<p class="sub">테스트 페이지 · 직원은 내 Claude 계정으로 답해요</p>') +
  "\n";
await fs.writeFile(path.join(out, "index.html"), page);
console.log(`테스트 페이지를 만들었어요: ${path.relative(process.cwd(), out)}/ (직원 ${agents.length}명, 지침: ${source})`);
