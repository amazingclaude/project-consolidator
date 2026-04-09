"""Simple smoke test for Azure AI Foundry / Azure OpenAI connectivity.

Usage:
  python scripts/test_foundry_api.py
  python scripts/test_foundry_api.py --prompt "Say hello in one sentence"
  python scripts/test_foundry_api.py --tool-test
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.ai.foundry import create_foundry_client, get_foundry_settings, validate_foundry_settings


SIMPLE_PROMPT = "Reply with exactly: Azure AI Foundry connection successful."
TOOL_TEST_PROMPT = "Use the ping_test tool once, then summarize the result in one short sentence."
PING_TOOL = {
    "type": "function",
    "name": "ping_test",
    "description": "Returns a static success payload for verifying function calling.",
    "parameters": {
        "type": "object",
        "properties": {
            "message": {
                "type": "string",
                "description": "Any short note to echo back.",
            }
        },
        "required": ["message"],
    },
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Smoke test Azure AI Foundry API access.")
    parser.add_argument("--prompt", default=SIMPLE_PROMPT, help="Prompt to send to the model.")
    parser.add_argument(
        "--tool-test",
        action="store_true",
        help="Also verify function-calling via the Responses API.",
    )
    return parser.parse_args()


def print_settings() -> None:
    settings = get_foundry_settings()
    masked_key = ""
    if settings["api_key"]:
        masked_key = f"{settings['api_key'][:6]}...{settings['api_key'][-4:]}"

    print("Resolved settings:")
    print(f"  base_url:  {settings['base_url']}")
    print(f"  model:     {settings['model']}")
    print(f"  max_tokens:{settings['max_tokens']}")
    print(f"  api_key:   {masked_key or '(missing)'}")


def run_basic_test(prompt: str) -> None:
    settings = get_foundry_settings()
    client = create_foundry_client()

    print("\nRunning basic response test...")
    response = client.responses.create(
        model=settings["model"],
        input=prompt,
        max_output_tokens=min(settings["max_tokens"], 300),
    )

    print("Response ID:", response.id)
    print("Output text:")
    print(response.output_text or "(empty)")


def run_tool_test() -> None:
    settings = get_foundry_settings()
    client = create_foundry_client()

    print("\nRunning function-calling test...")
    response = client.responses.create(
        model=settings["model"],
        input=TOOL_TEST_PROMPT,
        tools=[PING_TOOL],
        max_output_tokens=min(settings["max_tokens"], 300),
    )

    function_calls = [item for item in response.output if item.type == "function_call"]
    if not function_calls:
        print("No function call returned.")
        print("Model output:")
        print(response.output_text or "(empty)")
        return

    tool_outputs = []
    for call in function_calls:
        arguments = json.loads(call.arguments or "{}")
        payload = {
            "ok": True,
            "echo": arguments.get("message", ""),
            "cwd": os.getcwd(),
        }
        print(f"Function call: {call.name}")
        print("Arguments:", arguments)
        tool_outputs.append(
            {
                "type": "function_call_output",
                "call_id": call.call_id,
                "output": json.dumps(payload),
            }
        )

    followup = client.responses.create(
        model=settings["model"],
        previous_response_id=response.id,
        input=tool_outputs,
        tools=[PING_TOOL],
        max_output_tokens=min(settings["max_tokens"], 300),
    )

    print("Tool test final output:")
    print(followup.output_text or "(empty)")


def main() -> int:
    args = parse_args()

    valid, error_message = validate_foundry_settings()
    print_settings()
    if not valid:
        print("\nConfiguration error:")
        print(error_message)
        return 1

    try:
        run_basic_test(args.prompt)
        if args.tool_test:
            run_tool_test()
    except Exception as exc:
        print("\nRequest failed:")
        print(type(exc).__name__, str(exc))
        return 2

    print("\nSmoke test completed successfully.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
