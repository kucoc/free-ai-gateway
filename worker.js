export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    if (url.pathname === '/' || url.pathname === '') {
      return new Response(LANDING_HTML, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    if (url.pathname === '/v1/chat/completions' && request.method === 'POST') {
      return handleChat(request, env);
    }

    if (url.pathname === '/v1/models') {
      return Response.json({
        object: 'list',
        data: [
          { id: '@cf/meta/llama-3.1-8b-instruct', object: 'model', owned_by: 'cloudflare' },
          { id: '@cf/meta/llama-3.1-70b-instruct', object: 'model', owned_by: 'cloudflare' },
          { id: '@cf/qwen/qwen1.5-14b-chat-awq', object: 'model', owned_by: 'cloudflare' },
          { id: '@cf/mistral/mistral-7b-instruct-v0.1', object: 'model', owned_by: 'cloudflare' }
        ]
      }, { headers: corsHeaders() });
    }

    if (url.pathname === '/status') {
      return Response.json({
        status: 'ok',
        service: 'free-ai-gateway',
        version: '1.0.0',
        rate_limit: '30 req/day per IP'
      }, { headers: corsHeaders() });
    }

    return new Response('Not Found', { status: 404 });
  }
};

const rateMap = new Map();

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

async function handleChat(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const auth = request.headers.get('Authorization') || '';
  const today = new Date().toISOString().slice(0, 10);
  const key = `${ip}:${today}`;
  const count = rateMap.get(key) || 0;
  const hasPaid = auth.startsWith('Bearer sk-paid-');

  if (!hasPaid && count >= 30) {
    return Response.json({
      error: {
        message: 'Free quota exceeded (30 requests/day per IP). Deploy your own instance for unlimited: https://github.com/kucoc/free-ai-gateway',
        type: 'rate_limit_error'
      }
    }, { status: 429, headers: corsHeaders() });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return Response.json({ error: { message: 'Invalid JSON body', type: 'invalid_request_error' } }, { status: 400, headers: corsHeaders() });
  }

  const model = body.model || '@cf/meta/llama-3.1-8b-instruct';
  const messages = body.messages || [];
  if (!messages.length) {
    return Response.json({ error: { message: 'messages array is required', type: 'invalid_request_error' } }, { status: 400, headers: corsHeaders() });
  }

  const cfResp = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/ai/run/${model}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.CF_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages,
        max_tokens: body.max_tokens || 1024,
        temperature: body.temperature !== undefined ? body.temperature : 0.7
      })
    }
  );

  const cfData = await cfResp.json();

  if (!cfData.success) {
    return Response.json({
      error: { message: 'Upstream inference error', detail: cfData.errors, type: 'api_error' }
    }, { status: 502, headers: corsHeaders() });
  }

  const result = cfData.result;
  const content = result.response || (result.choices && result.choices[0]?.message?.content) || '';

  if (!hasPaid) rateMap.set(key, count + 1);

  return Response.json({
    id: 'chatcmpl-' + crypto.randomUUID().replace(/-/g, '').slice(0, 24),
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: model,
    choices: [{
      index: 0,
      message: { role: 'assistant', content: content },
      finish_reason: 'stop'
    }],
    usage: {
      prompt_tokens: (result.usage && result.usage.prompt_tokens) || 0,
      completion_tokens: (result.usage && result.usage.completion_tokens) || 0,
      total_tokens: (result.usage && result.usage.total_tokens) || 0
    }
  }, { headers: corsHeaders() });
}

const LANDING_HTML = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<title>Free AI Gateway — OpenAI Compatible</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box}
body{font-family:-apple-system,system-ui,'Segoe UI',sans-serif;background:#0d1117;color:#c9d1d9;margin:0;padding:0;line-height:1.6}
.wrap{max-width:800px;margin:0 auto;padding:40px 24px}
h1{color:#58a6ff;font-size:2.2em;margin-bottom:8px}
h2{color:#79c0ff;border-bottom:1px solid #21262d;padding-bottom:6px;margin-top:36px}
.badge{display:inline-block;background:#238636;color:#fff;padding:3px 10px;border-radius:12px;font-size:13px;margin-right:6px;margin-bottom:8px}
.badge.blue{background:#1f6feb}
code{background:#161b22;padding:2px 6px;border-radius:4px;color:#79c0ff;font-size:.9em}
pre{background:#161b22;padding:16px;border-radius:8px;overflow-x:auto;border:1px solid #21262d}
pre code{background:none;padding:0}
a{color:#58a6ff;text-decoration:none}
a:hover{text-decoration:underline}
.footer{margin-top:48px;padding-top:20px;border-top:1px solid #21262d;color:#8b949e;font-size:14px}
</style>
</head>
<body>
<div class="wrap">
<h1>🤖 Free AI Gateway</h1>
<p>
<span class="badge">FREE</span>
<span class="badge">NO CARD</span>
<span class="badge blue">OPENAI COMPATIBLE</span>
<span class="badge blue">EDGE DEPLOYED</span>
</p>
<p>开箱即用的免费 AI API 网关。无需注册、无需 API Key、无需信用卡。</p>

<h2>⚡ 快速开始</h2>
<pre><code>curl -X POST ${'{'}BASE_URL{'}'}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "@cf/meta/llama-3.1-8b-instruct",
    "messages": [{"role": "user", "content": "你好，介绍一下你自己"}]
  }'</code></pre>

<h2>🐍 Python (OpenAI SDK)</h2>
<pre><code>from openai import OpenAI
client = OpenAI(base_url="${'{'}BASE_URL{'}'}/v1", api_key="free")
resp = client.chat.completions.create(
    model="@cf/meta/llama-3.1-8b-instruct",
    messages=[{"role": "user", "content": "写一首关于秋天的诗"}]
)
print(resp.choices[0].message.content)</code></pre>

<h2>📊 限制</h2>
<p>免费层：每 IP 每天 <b>30 次</b>调用。需要更多？自己部署一个（1 分钟）：<a href="https://github.com/kucoc/free-ai-gateway">GitHub 仓库 →</a></p>

<h2>🧠 可用模型</h2>
<p><code>@cf/meta/llama-3.1-8b-instruct</code> · <code>llama-3.1-70b</code> · <code>qwen1.5-14b</code> · <code>mistral-7b</code></p>

<h2>🔐 隐私</h2>
<p>无日志、无存储、无追踪。请求直达 Cloudflare 边缘推理。</p>

<div class="footer">
<p>Status: <a href="/status">/status</a> · Models: <a href="/v1/models">/v1/models</a></p>
<p>Powered by <a href="https://developers.cloudflare.com/workers-ai/">Cloudflare Workers AI</a> · <a href="https://github.com/kucoc/free-ai-gateway">Source on GitHub</a></p>
</div>
</div>
</body>
</html>`;
