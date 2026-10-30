// Cloudflare Worker 진입점. 화면(public/)은 Workers Assets가 바로 내보내고,
// 파일이 없는 /api/* 요청만 여기로 들어온다.
import { handleAgents, handleChat, handleDelegate } from "./api.js";

const ROUTES = {
  "/api/agents": handleAgents,
  "/api/chat": handleChat,
  "/api/delegate": handleDelegate,
};

export default {
  async fetch(request, env) {
    const route = ROUTES[new URL(request.url).pathname];
    if (route) return route(request, env);
    return env.ASSETS.fetch(request);
  },
};
