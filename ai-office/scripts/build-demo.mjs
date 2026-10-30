// claude.ai 테스트 페이지를 dist-demo/ 에 만든다.
//   node scripts/build-demo.mjs
// 화면(public/)은 그대로 쓰고, api.js만 demo/api.js(claude.ai의 Claude 사용)로 바꾼다.
// 직원 명부와 부서 지침(src/)은 agents-data.js 하나로 묶는다.
import { build } from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "dist-demo");
await fs.rm(out, { recursive: true, force: true });
await fs.mkdir(path.join(out, "fonts"), { recursive: true });

// 1) src/agents.js(지침 .md 포함)를 묶어서 읽고, 화면에서 쓸 데이터 파일로 쓴다
const bundled = path.join(out, ".agents.mjs");
await build({ entryPoints: [path.join(root, "src/agents.js")], bundle: true, format: "esm", loader: { ".md": "text" }, outfile: bundled, logLevel: "error" });
const { AGENTS, STAFF, DELEGATE_SYSTEM } = await import(pathToFileURL(bundled).href);
await fs.rm(bundled);
const agents = AGENTS.map(({ guide, ...rest }) => rest);
await fs.writeFile(
  path.join(out, "agents-data.js"),
  `// scripts/build-demo.mjs가 src/agents.js와 src/guidelines/에서 만든 파일입니다. 직접 고치지 마세요.\n` +
    `export const AGENTS = ${JSON.stringify(agents, null, 1)};\n` +
    `export const STAFF_IDS = ${JSON.stringify(STAFF.map((a) => a.id))};\n` +
    `export const DELEGATE_SYSTEM = ${JSON.stringify(DELEGATE_SYSTEM)};\n`,
);

// 2) 화면 파일 복사, api.js만 테스트용으로
for (const file of ["app.js", "office.js", "messenger.js", "markdown.js", "style.css"]) {
  await fs.copyFile(path.join(root, "public", file), path.join(out, file));
}
await fs.copyFile(path.join(root, "demo/api.js"), path.join(out, "api.js"));
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
  body.replace('<p class="sub">직원을 클릭해 업무를 맡겨 보세요</p>', '<p class="sub">테스트 페이지 · 직원은 내 Claude 계정으로 답해요</p>') +
  "\n";
await fs.writeFile(path.join(out, "index.html"), page);
console.log(`테스트 페이지를 만들었어요: ${path.relative(process.cwd(), out)}/ (직원 ${agents.length}명)`);
