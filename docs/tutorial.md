# 用 Cloudflare Workers AI + Groq 搭建免费 AI API 网关，一键对外提供 ChatGPT‑like 接口  

在 OpenAI、Claude 等大模型收费日益升高的背景下，很多开发者想要一个 **零成本、低延迟** 的 AI 接口来快速原型或内部工具。本文将手把手教你使用 **Cloudflare Workers AI**（内置 LLM 支持）结合 **Groq**（免费高速推理平台），在几分钟内完成一个公开的 AI API 网关，并且所有请求均走 **Cloudflare Edge**，几乎没有网络抖动。

> 关键点  
> 1️⃣ Workers 免费套餐每天 100,000 次请求足够小团队使用。  
> 2️⃣ Groq 提供的 `llama3‑8b‑instruct`、`mixtral‑8x7b` 等模型免费额度，每月 100 万 token。  
> 3️⃣ 只需要一段 JavaScript 代码，无需部署服务器。

---

## 一、准备工作

| 项目 | 操作 | 备注 |
|------|------|------|
| Cloudflare 账户 | 注册并进入 **Workers** 控制台 | 免费套餐已包含 100k 请求 |
| Groq API Key | 在 https://console.groq.com/ 申请 | 生成 `GROQ_API_KEY` |
| 域名（可选） | Workers 中绑定自定义子域或使用 `*.workers.dev` | 直接访问 `https://<your‑script>.workers.dev` |

---

## 二、创建 Workers 项目

1. **打开 Cloudflare Dashboard → Workers → Create a Service**，取名 `ai-gateway`。  
2. 进入编辑器，选择 **“Quick edit”**，把默认代码全部替换为下面的实现（后文会解释每一步）。

---

## 三、核心代码（完整示例）

```javascript
// ai-gateway/index.js

export default {
  async fetch(request, env, ctx) {
    // 只接受 POST，且 Content-Type 必须是 application/json
    if (request.method !== "POST" ||
        !request.headers.get("content-type")?.includes("application/json")) {
      return new Response(JSON.stringify({ error: "Method Not Allowed or Invalid Content-Type" }),
        { status: 405, headers: { "Content-Type": "application/json" } });
    }

    // 解析前端传来的 prompt
    let { prompt, model = "mixtral-8x7b-32768" } = await request.json();

    if (!prompt) {
      return new Response(JSON.stringify({ error: "Missing 'prompt' field" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 调用 Groq 推理接口
    const groqResp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.GROQ_API_KEY}`, // 从 Workers Secrets 注入
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1024,
        temperature: 0.7,
      }),
    });

    // 直接转发 Groq 返回的 JSON，保持结构一致
    const result = await groqResp.json();

    // 若需要自行包装，可在此处做统一字段映射
    return new Response(JSON.stringify(result), {
      status: groqResp.status,
      headers: { "Content-Type": "application/json" },
    });
  },
};
```

### 代码说明

| 代码块 | 作用 |
|--------|------|
| `if (request.method !== "POST"...` | 限制只接受 POST，防止误用 GET 触发计费 |
| `let { prompt, model } = await request.json();` | 前端只需传 `prompt`（必选）和可选的 `model` 参数 |
| `env.GROQ_API_KEY` | 通过 Workers **Secrets** 注入的安全凭证，代码里不直接写明钥匙 |
| `fetch("https://api.groq.com/openai/v1/chat/completions"...` | 与 Groq 兼容的 OpenAI 接口，直接复用已有的 SDK 思路 |
| `max_tokens`、`temperature` | 常用参数，可根据业务自行调优 |
| `return new Response(JSON.stringify(result)...)` | 把 Groq 原始响应原样返回，兼容 OpenAI 客户端（如 `openai` npm 包） |

---

## 四、部署前的必备配置

1. **绑定 Secret**：在 Workers 控制台左侧 “Settings → Variables → Secrets”，点击 **Add secret**，键名填 `GROQ_API_KEY`，值填你的 Groq token。  
2. **（可选）自定义域名**：在 “Triggers → Custom Domains” 添加你自己的子域，指向该 Worker。

完成后点击 **“Save and Deploy”**，系统会自动编译并在 Edge 上发布。

---

## 五、测试调用

使用 `curl` 或者任意 HTTP 客户端发送请求：

```bash
curl -X POST https://ai-gateway.<your-subdomain>.workers.dev \
  -H "Content-Type: application/json" \
  -d '{"prompt":"请用三句话解释区块链的基本原理"}'
```

返回示例（取决于模型）：

```json
{
  "id": "chatcmpl-12345",
  "object": "chat.completion",
  "created": 1730985600,
  "model": "mixtral-8x7b-32768",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "区块链是一种去中心化的账本技术，所有交易记录都以块的形式链接在一起。每个块通过哈希函数与前一个块相连，形成不可篡改的链。网络中的节点共同验证和存储这些块，从而保证数据的安全与透明。"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": { "prompt_tokens": 19, "completion_tokens": 56, "total_tokens": 75 }
}
```

此时，你已经拥有了一个 **免费、全球加速、兼容 OpenAI 接口** 的 AI API 网关。

---

## 六、进阶技巧

| 场景 | 推荐实现 |
|------|----------|
| **限流 / 计费** | 在 Workers 中使用 `request.cf.cloudflarebot` 判断来源，或配合 KV 存储记录 IP 调用次数。 |
| **多模型切换** | 前端传 `model` 参数，后端可在 `allowedModels` 列表中校验后再转发。 |
| **缓存热点回答** | 使用 Workers KV 或 `Cache API` 缓存 `prompt → answer`，降低 token 消耗。 |
| **日志监控** | 将 `request`、`response` 信息推送到 Cloudflare Logpush 或外部 Slack webhook。 |

---

## 七、常见问题 & 排查

1. **返回 401** → 检查 `GROQ_API_KEY` 是否正确、是否已经过期。  
2. **请求超时** → Workers 与 Groq 之间的网络一般在 150ms 左右，若出现 >2s，可尝试在 `fetch` 中添加 `timeout` 参数或联系 Groq 支持。  
3. **费用异常** → 免费套餐的 100k 次请求是 **计数请求次数**，而不是 token。若实际使用远超预期，请在 Workers Dashboard 开启 “Rate limiting”。  

---

## 八、总结

- **成本**：Cloudflare Workers 免费套餐 + Groq 免费 token，基本零费用。  
- **性能**：Edge 节点直连 Groq，平均延迟 < 300ms，适合交互式聊天。  
- **易用性**：只需几行 JavaScript，即可把 OpenAI 兼容的 API 暴露给前端、移动端或内部系统。  

有了这套「Workers + Groq」的组合，你可以快速迭代 AI 产品原型、为团队内部工具提供智能化能力，甚至在社区中发布公开的免费 AI 接口，帮助更多开发者降低实验成本。祝你玩得开心，代码跑得快！ 🚀
