# Kinetable Local Bridge

The optional Node/TypeScript bridge lets the hosted or local web UI use compute already available on **your** machine. From the repository, run `pnpm install` once and `pnpm bridge`. It listens on `127.0.0.1:46837`, prints a random token, and accepts only the built-in local development origins plus `KINETABLE_BRIDGE_ORIGIN` when set to the exact preview origin. Paste the token into `/settings/providers`; the token remains in browser memory for that tab. Restart/reconnect as needed. Chrome may request **Local Network Access** permission before a hosted HTTPS page can reach loopback; grant it only for the Kinetable origin you trust. The page cannot start the bridge itself.

For a preview, set `KINETABLE_BRIDGE_ORIGIN` to its `https://…vercel.app` origin before starting the bridge. Keep the bridge token private. The server binds `127.0.0.1`, checks `Origin` and token on actions, answers a version/capability handshake, limits body size, and has no arbitrary `/shell` or generic command endpoint. CORS permits only configured origins. Local models are contacted only at `127.0.0.1` with a validated port. The bridge has no access to provider API keys or Kinetable cloud credentials.

## Local HTTP runtimes

| Runtime | Setup and model discovery | Start/stop permission |
| --- | --- | --- |
| [Ollama](https://docs.ollama.com/cli) | Install Ollama, run `ollama serve`, then `ollama list` or **Find models** (`/api/tags`). Pull a chosen model explicitly with `ollama pull <model>`; Kinetable never downloads it for you. Local generation uses `/api/chat` with a JSON schema. | **Allow Kinetable to start and stop this provider** defaults off. If on, the bridge may launch only installed `ollama serve` and stop only its own child. |
| [LM Studio](https://lmstudio.ai/docs/developer/core/server) | Load a model in LM Studio, open Developer → Start server, or use `lms server start`. Discover loaded models through `/v1/models`. Installed app alone does not mean a model is loaded. | Explicit toggle permits only `lms server start`/`lms server stop`; bridge stop applies only to a server it started. On Windows a script-only `lms.cmd` may need manual startup because the bridge will not invoke it through a shell. |
| [vLLM](https://docs.vllm.ai/en/latest/serving/online_serving/openai_compatible_server/) | On a supported Linux/WSL/server setup, run `vllm serve <model> --host 127.0.0.1 --port 8000`, then select the served model from `/v1/models`. | Startup remains manual: model names and runtime flags need host-specific review. Do not expose the server to LAN automatically. |

Only `http://127.0.0.1:<port>/` is accepted in UI local URLs. Local HTTP models must return a planner object that passes the same strict schema and hardware checks. The installed Ollama `qwen3.5:9b` was reachable and returned real JSON but its complete hardware commands failed validation during QA; it is not advertised as a passing assembly model.

## CLI adapters

CLIs own their own authentication; the bridge does not read or copy login files. Every planner call uses a new empty temporary working directory, a known executable, argument arrays with `spawn()` and no shell, a two-minute timeout, a 64 KiB stdout/stderr cap, and schema validation. Only `prompt → final answer → exit` is used. Installed versions and authentication determine availability.

| CLI | Headless/output/restriction strategy | Verification |
| --- | --- | --- |
| [Codex](https://learn.chatgpt.com/docs/non-interactive-mode) | `codex exec --ephemeral --ignore-user-config -s read-only -C <temp> --skip-git-repo-check --output-schema <schema> -o <output> -m <model> <prompt>` | Version 0.144.6 installed/authenticated; `gpt-6-luna` produced five real validated/unsupported intents, a bridge fallback success and a browser assembly. This is the tested version, not a claimed minimum. |
| [Antigravity](https://antigravity.google/docs/cli/headless/) | `agy -p <prompt> --output-format json --json-schema <schema> --mode plan --sandbox` | Version 1.2.10 installed/authenticated; its tested plan attempted a denied tool and returned no usable result. No unrestricted permission flag is used. |
| [Claude Code](https://code.claude.com/docs/en/headless) | `claude -p <prompt> --output-format json --json-schema <schema> --permission-mode plan --disallowedTools …` | Version 2.1.175 installed but not authenticated on this machine; maps to `CLI_AUTH_REQUIRED`. |
| [Kimi Code](https://moonshotai.github.io/kimi-code/en/customization/agents) | `kimi -p <prompt> --agent-file <temporary no-tools agent> --output-format stream-json`; final assistant text is parsed. | Adapter implemented; binary absent locally, so not real-model verified. |
| [OpenCode](https://dev.opencode.ai/docs/cli/) | `opencode run --format json <prompt>` with request-scoped `OPENCODE_CONFIG_CONTENT` denying every tool. | Adapter implemented; Windows installation is a `.cmd` shim only, which the bridge intentionally will not launch through a shell. Unverified locally. |
| [Continue](https://docs.continue.dev/cli/quickstart) | `cn -p <prompt> --readonly` and strict final JSON parsing. | Adapter implemented; binary absent locally, unverified. |

The bridge probes `--version` and a tiny structured response via **Test connection**. A CLI that does not satisfy the planner schema is incompatible for assembly. Cursor's documented print mode retains tool access, Gemini CLI's current project policy tier is documented as nonfunctional, and Aider's scripting path is edit-oriented; these are withheld until a dependable no-tools/read-only invocation is verified. Goose and Warp likewise are not enabled without a documented safe headless path. No interactive TUI scraping or unrestricted permission bypass is used. On Windows, CLI adapters require a native executable; shell-only `.cmd` shims are reported unavailable. Tested minimum versions should be established in a future cross-platform compatibility pass rather than guessed here.
