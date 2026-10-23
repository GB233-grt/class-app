/**
 * /api/* 统一中间件：CORS 预检、异常兜底
 */
import { CORS_HEADERS, HttpError, errorResponse } from '../lib/http';

export const onRequest: PagesFunction = async (context) => {
  // 处理 CORS 预检请求
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const response = await context.next();
    // 复制响应并附加 CORS 头（原响应头不可变，需新建）
    const patched = new Response(response.body, response);
    for (const [key, value] of Object.entries(CORS_HEADERS)) {
      patched.headers.set(key, value);
    }
    return patched;
  } catch (error) {
    if (error instanceof HttpError) {
      return errorResponse(error.message, error.status);
    }
    console.error('[API] 未捕获异常:', error);
    return errorResponse('服务器内部错误，请稍后重试', 500);
  }
};
