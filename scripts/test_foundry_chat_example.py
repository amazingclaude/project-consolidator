"""Minimal Azure OpenAI chat-completions smoke test.

Matches the Azure AI Foundry example style as closely as possible.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from openai import DefaultHttpxClient, OpenAI

from src.ai.foundry import (
    build_ssl_context,
    get_foundry_settings,
    is_local_proxy_available,
    should_bypass_env_proxy,
)


def main() -> int:
    settings = get_foundry_settings()
    ssl_cert_file = os.environ.get("SSL_CERT_FILE", "").strip()

    client_kwargs = {
        "base_url": settings["base_url"],
        "api_key": settings["api_key"],
    }

    if ssl_cert_file or should_bypass_env_proxy():
        http_client_kwargs = {"trust_env": not should_bypass_env_proxy()}
        if ssl_cert_file:
            http_client_kwargs["verify"] = build_ssl_context(ssl_cert_file)
        if should_bypass_env_proxy() and is_local_proxy_available():
            http_client_kwargs["proxy"] = "http://127.0.0.1:9000"
            http_client_kwargs["trust_env"] = False
        client_kwargs["http_client"] = DefaultHttpxClient(**http_client_kwargs)

    print("Base URL:", settings["base_url"])
    print("Model:", settings["model"])
    print("Using custom proxy handling:", "http_client" in client_kwargs)
    print("SSL cert file:", ssl_cert_file or "(not set)")

    client = OpenAI(**client_kwargs)

    completion = client.chat.completions.create(
        model=settings["model"],
        messages=[
            {
                "role": "user",
                "content": "What is the capital of France? Reply in five words or fewer.",
            }
        ],
        max_tokens=50,
    )

    print("Success:")
    print(completion.choices[0].message)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
