"""
Free AI Gateway — Python usage example
OpenAI-compatible API for Llama 3.1, Qwen, Mistral
"""
import requests

BASE_URL = "https://your-worker.your-subdomain.workers.dev"  # 部署后替换

def chat(messages, model="@cf/meta/llama-3.1-8b-instruct", max_tokens=1024):
    """调用免费 AI 网关"""
    resp = requests.post(
        f"{BASE_URL}/v1/chat/completions",
        json={"model": model, "messages": messages, "max_tokens": max_tokens},
        headers={"Content-Type": "application/json"}
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]


if __name__ == "__main__":
    # 单轮对话
    answer = chat([{"role": "user", "content": "用一句话解释什么是大语言模型"}])
    print("回答:", answer)

    # 多轮对话
    messages = []
    while True:
        user_input = input("你: ")
        if user_input.lower() in ["exit", "quit", "退出"]:
            break
        messages.append({"role": "user", "content": user_input})
        reply = chat(messages)
        print("AI:", reply)
        messages.append({"role": "assistant", "content": reply})
