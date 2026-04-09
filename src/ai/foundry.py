import os
import socket
import ssl
from typing import Any
from urllib.parse import urlparse

import certifi
import yaml
from openai import DefaultHttpxClient, OpenAI


DEFAULT_MAX_TOKENS = 4096
DEFAULT_MODEL = "gpt-4.1-mini"
PROXY_ENV_VARS = ("HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy")
DEFAULT_LOCAL_PROXY_URL = "http://127.0.0.1:9000"


def load_dotenv_file() -> None:
    env_path = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
    if not os.path.exists(env_path):
        return

    with open(env_path, encoding="utf-8") as f:
        for raw_line in f:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue

            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


def load_foundry_config() -> dict[str, Any]:
    config_path = os.path.join(os.path.dirname(__file__), "..", "..", "config.yaml")
    if not os.path.exists(config_path):
        return {}

    with open(config_path, encoding="utf-8") as f:
        config = yaml.safe_load(f) or {}
        return config.get("azure_ai_foundry", {})


def get_foundry_settings() -> dict[str, Any]:
    load_dotenv_file()
    config = load_foundry_config()
    return {
        "api_key": os.environ.get("AZURE_OPENAI_API_KEY", "") or config.get("api_key", ""),
        "base_url": os.environ.get("AZURE_OPENAI_BASE_URL", "") or config.get("base_url", ""),
        "model": os.environ.get("AZURE_OPENAI_MODEL", "") or config.get("model", DEFAULT_MODEL),
        "max_tokens": config.get("max_tokens") or DEFAULT_MAX_TOKENS,
    }


def env_flag(name: str, default: bool = False) -> bool:
    value = os.environ.get(name, "").strip().lower()
    if not value:
        return default
    return value in {"1", "true", "yes", "on"}


def should_bypass_env_proxy() -> bool:
    if not env_flag("AZURE_OPENAI_ENABLE_LOCAL_NETWORK_WORKAROUNDS", default=False):
        return False

    for key in PROXY_ENV_VARS:
        value = os.environ.get(key, "").strip().lower()
        if value in {"http://127.0.0.1:9", "https://127.0.0.1:9"}:
            return True
    return False


def get_local_proxy_url() -> str:
    return os.environ.get("AZURE_OPENAI_LOCAL_PROXY_URL", DEFAULT_LOCAL_PROXY_URL).strip() or DEFAULT_LOCAL_PROXY_URL


def is_local_proxy_available(proxy_url: str) -> bool:
    parsed = urlparse(proxy_url)
    host = parsed.hostname or "127.0.0.1"
    port = parsed.port or 80
    try:
        with socket.create_connection((host, port), timeout=1):
            return True
    except OSError:
        return False


def build_ssl_context(extra_cert_file: str | None = None) -> ssl.SSLContext:
    context = ssl.create_default_context(cafile=certifi.where())
    if extra_cert_file:
        context.load_verify_locations(cafile=extra_cert_file)
    return context


def create_foundry_client() -> OpenAI:
    settings = get_foundry_settings()
    client_kwargs: dict[str, Any] = {
        "api_key": settings["api_key"],
        "base_url": settings["base_url"],
    }
    ssl_cert_file = (
        os.environ.get("AZURE_OPENAI_CA_BUNDLE", "").strip()
        or os.environ.get("SSL_CERT_FILE", "").strip()
    )
    bypass_env_proxy = should_bypass_env_proxy()
    needs_custom_http_client = bool(ssl_cert_file) or bypass_env_proxy

    if needs_custom_http_client:
        http_client_kwargs: dict[str, Any] = {"trust_env": not bypass_env_proxy}
        if ssl_cert_file:
            http_client_kwargs["verify"] = build_ssl_context(ssl_cert_file)
        if bypass_env_proxy:
            proxy_url = get_local_proxy_url()
            if is_local_proxy_available(proxy_url):
                http_client_kwargs["proxy"] = proxy_url
                http_client_kwargs["trust_env"] = False
        
        if bypass_env_proxy and "proxy" in http_client_kwargs:
            http_client_kwargs["trust_env"] = False

        client_kwargs["http_client"] = DefaultHttpxClient(**http_client_kwargs)

    return OpenAI(**client_kwargs)


def validate_foundry_settings() -> tuple[bool, str | None]:
    settings = get_foundry_settings()
    missing = []
    if not settings["api_key"]:
        missing.append("AZURE_OPENAI_API_KEY")
    if not settings["base_url"]:
        missing.append("AZURE_OPENAI_BASE_URL")
    if not settings["model"]:
        missing.append("AZURE_OPENAI_MODEL")

    if missing:
        return (
            False,
            "Azure AI Foundry is not configured. Set "
            + ", ".join(missing)
            + " or add them under azure_ai_foundry in config.yaml.",
        )

    parsed = urlparse(settings["base_url"])
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return (
            False,
            "AZURE_OPENAI_BASE_URL is invalid. Use the full Azure OpenAI v1 endpoint, "
            "for example https://YOUR-RESOURCE.openai.azure.com/openai/v1/.",
        )

    if "undefined" in parsed.netloc:
        return (
            False,
            "AZURE_OPENAI_BASE_URL looks incorrect because the hostname contains 'undefined'. "
            "Use your actual Azure OpenAI resource host, for example "
            "https://YOUR-RESOURCE.openai.azure.com/openai/v1/.",
        )

    return True, None
