// 로컬 실행용 서버: public/ 정적 파일과 /api/* 를 함께 제공한다.
// Vercel에 배포할 때는 api/ 폴더의 함수가 같은 핸들러를 사용한다.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleAgents, handleChat } from "./lib/chat.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(here, "public");
const PORT = Number(process.env.PORT) || 3000;

// .env 파일이 있으면 읽는다 (Node 20.12+)
try {
  process.loadEnvFile(path.join(here, ".env"));
} catch {}

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

async function serveStatic(req, res) {
  const { pathname } = new URL(req.url, "http://localhost");
  const filePath = path.normalize(path.join(publicDir, pathname === "/" ? "index.html" : decodeURIComponent(pathname)));
  if (!filePath.startsWith(publicDir)) {
    res.statusCode = 403;
    return res.end("Forbidden");
  }
  try {
    const data = await fs.readFile(filePath);
    res.setHeader("Content-Type", TYPES[path.extname(filePath)] || "application/octet-stream");
    res.end(data);
  } catch {
    res.statusCode = 404;
    res.end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, "http://localhost");
  try {
    if (pathname === "/api/agents") return await handleAgents(req, res);
    if (pathname === "/api/chat") return await handleChat(req, res);
    return await serveStatic(req, res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.statusCode = 500;
    res.end();
  }
});

server.listen(PORT, () => {
  console.log(`🏢 홈페이션 AI 오피스: http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) console.warn("⚠️  ANTHROPIC_API_KEY가 없습니다. .env 파일에 넣어 주세요.");
});
