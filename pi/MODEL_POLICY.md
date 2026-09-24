# Pi model policy

Direct Pi sessions are unrestricted and can use any available OpenRouter model.
The private overlay defaults interactive Pi to the subscription-backed
`openai-codex/gpt-5.6-terra` route, but that default is a preference, not a
policy boundary.

The low-cost policy applies only when Claude, Codex, Cursor, Gary, or another
harness invokes Pi as a worker. Approved launchers set
`OTHER_NINETY_PI_LEAF=1` and explicitly load `extensions/model-policy.ts`.

An OpenRouter route must pass both controls:

1. Its exact model ID must appear in the public allowlist.
2. Pi's current catalog price must not exceed $0.15/M input or $0.30/M output.

Moving aliases such as `*-latest` are not allowed for delegated workers. A
price increase also blocks an allowlisted worker model at runtime. Pi then
selects the Terra fallback before it sends a provider request. None of these
checks run in a direct Pi session.

## Approved OpenRouter routes

| Route | Intended use |
|---|---|
| `deepseek/deepseek-v4-flash` | Long-context coding and reasoning |
| `openai/gpt-oss-120b` | General reasoning and tool work |
| `openai/gpt-oss-20b` | Fast, small general-purpose work |
| `poolside/laguna-s-2.1` | Coding workers |
| `poolside/laguna-xs-2.1` | Fast coding and mechanical work |
| `qwen/qwen3-coder-30b-a3b-instruct` | Repository coding and structured tool use |
| `qwen/qwen3.7-flash` | Long-context, multimodal, and general agent work |

Qwen3.8 is intentionally absent from the worker allowlist. The OpenRouter
routes available during the August 2026 review exceeded the cheap-tier price
ceiling. A person using Pi directly can still select Qwen3.8.

## Subagent-extension children are exempt

Child Pi processes spawned by the local `subagent/` extension are part of a
direct Pi session, not external-harness invocations. Each child runs with an
explicitly pinned model chosen by the operator in the agent definition
frontmatter. The low-cost policy does not apply to these children: they
inherit the direct-session posture of unrestricted model choice, and the
operator's per-agent model pin is itself the cost decision. Only launches
from an external harness (Claude, Codex, Cursor, Gary, or similar) that set
`OTHER_NINETY_PI_LEAF=1` are subject to the allowlist and price-cap controls.
