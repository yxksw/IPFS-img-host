// Cloudflare Worker 代理脚本
// 用于解决 IPFS 上传的 CORS 问题

export default {
  async fetch(request, env, ctx) {
    // 设置允许的域名列表，可以添加你的域名
    const allowedOrigins = [
      'https://p.261770.xyz',
      'http://localhost:3000',
      'http://127.0.0.1:5500',
      // 添加更多允许的域名
    ];

    const origin = request.headers.get('Origin');
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Max-Age': '86400',
    };

    // 处理预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // 只处理 POST 请求
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      // 转发请求到 IPFS 上传服务
      const response = await fetch('https://ipfs-relay.crossbell.io/upload', {
        method: 'POST',
        body: request.body,
        headers: {
          // 保留原始请求的必要头信息
          'Content-Type': request.headers.get('Content-Type'),
        },
      });

      // 读取响应内容
      const responseBody = await response.text();

      // 返回带有 CORS 头的响应
      return new Response(responseBody, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }
  },
};
