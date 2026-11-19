# Free AI Gateway

> 🤖 **OpenAI 兼容的免费 AI API 网关** — 无需注册、无需信用卡、无需 API Key

一键部署到 Cloudflare Workers（免费层），即刻拥有你自己的 AI API 网关。

## ✨ 特性

- **OpenAI 兼容** — 使用 `/v1/chat/completions` 标准接口
- **零成本** — 依托 Cloudflare Workers AI 免费层（每天 10,000 Neurons）
- **无需 Key** — 匿名可用，每 IP 每天 30 次免费调用
- **多模型** — Llama 3.1 8B/70B、Qwen 1.5 14B 等
- **边缘部署** — 全球 300+ 节点，延迟极低
- **隐私优先** — 无日志存储

## 🚀 一键部署

1. Fork 本仓库
2. 在 [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens) 创建一个 **编辑 Cloudflare Workers** 权限的 API Token
3. 配置 `wrangler.toml` 中的 `account_id`
4. 运行:

```bash
npx wrangler deploy
```

## 📖 使用

部署后直接调用：

```bash
curl -X POST https://your-worker.your-subdomain.workers.dev/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "@cf/meta/llama-3.1-8b-instruct",
    "messages": [{"role": "user", "content": "你好"}]
  }'
```

**Python (OpenAI SDK 兼容):**

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://your-worker.your-subdomain.workers.dev/v1",
    api_key="not-needed"
)

resp = client.chat.completions.create(
    model="@cf/meta/llama-3.1-8b-instruct",
    messages=[{"role": "user", "content": "写一首诗"}]
)
print(resp.choices[0].message.content)
```

## 🔧 支持的模型

| 模型 ID | 说明 |
|---|---|
| `@cf/meta/llama-3.1-8b-instruct` | Llama 3.1 8B（默认）|
| `@cf/meta/llama-3.1-70b-instruct` | Llama 3.1 70B |
| `@cf/qwen/qwen1.5-14b-chat-awq` | Qwen 1.5 14B |
| `@cf/mistral/mistral-7b-instruct-v0.1` | Mistral 7B |

## 💰 付费层（可选）

免费层每 IP 每天 30 次。需要更高额度？带 `Authorization: Bearer sk-paid-<key>` 头即可解锁。

## 🛠 技术栈

- Cloudflare Workers (Serverless 边缘计算)
- Cloudflare Workers AI (推理引擎)
- 零依赖，单文件部署

## 📄 License

MIT — 自由使用、修改、分发。

---

⭐ 如果有用请 Star 支持！
Add README.md
