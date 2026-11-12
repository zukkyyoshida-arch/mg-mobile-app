import { handleApi } from './api.js';

// /api/* は同期API、それ以外は静的アセット（dist）へ渡す
export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api' || pathname.startsWith('/api/')) return handleApi(request, env);
    return env.ASSETS.fetch(request);
  }
};
