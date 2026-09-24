# AI providers and routing

Kinetable does not sell or supply model tokens in Slice 06. Configure a local runtime, locally authenticated CLI, or your own API credential at `/settings/providers`. The selected provider proposes a strict planner response; [hardware-core](SLICE-06.md) alone accepts or rejects the commands. Remote requests pass through the Vercel BYOK API so keys are never bundled in client JavaScript. Keys are used for that request only and are not saved server-side. The full preset IDs, endpoint templates and source links live in [`remoteCatalog.ts`](../apps/web/src/ai/remoteCatalog.ts); that file is the source of truth for the live catalog.

## Remote catalog

The 34 documented presets are OpenAI, Anthropic, Google Gemini, xAI, Groq, Cerebras, Together AI, Fireworks AI, Mistral AI, DeepSeek, OpenRouter, Cohere, DeepInfra, NVIDIA NIM, Hugging Face Inference, Alibaba Cloud/Qwen, Moonshot AI/Kimi, Z.AI/GLM, MiniMax, BytePlus ModelArk, Tencent Cloud TokenHub, SambaNova, Nebius Token Factory, Baseten, Modal, DigitalOcean Gradient, FriendliAI, Novita AI, GMICloud, Inference.net, Azure OpenAI, Amazon Bedrock API key, Cloudflare Workers AI and Google Vertex AI access token. The first 30 have a fixed documented base origin. Azure, Bedrock, Cloudflare and Vertex need an account-specific public HTTPS endpoint. Most use an official OpenAI-compatible chat API; Anthropic uses its native Messages tool schema. This is a catalog of transport-compatible APIs, not a claim that every model accepts strict JSON Schema.

Every preset links to its current provider documentation from the settings catalog source. Before relying on a model, enter its current model ID and use **Test connection**, which runs a tiny structured probe. When a documented model-list API is available, **Find models / status** offers discovery with a short cache; otherwise enter the model ID manually. Suggested model names are deliberately not hardcoded as permanent truth. Replicate and Perplexity are omitted from the enabled presets because a compatible strict structured planner path was not verified for the currently documented API. Do not substitute another provider silently.

## Multiple keys and ordered fallback

Add more than one key to a provider, label each, and reorder them. A key is identified by a random ID; the display shows only its label and final four characters. Credentials may be disabled or removed independently. Routes themselves can be reordered and disabled. The router first tries keys for the highest-priority route, then the next route. Local routes have no key. Timeout, network, rate/quota, rejected credentials, unavailable models and malformed structured output may advance. A refusal, unsupported hardware request, invalid Kinetable request, stale project or hardware validation error stops the chain. Diagnostics list only masked labels and codes.

## Custom compatible endpoints

Custom endpoints take a name in the route list, public HTTPS base URL, model ID, optional key and one of Bearer, `x-api-key`, or no-auth modes. They are intended for LiteLLM, self-hosted public gateways and enterprise services that implement `/chat/completions`; optional `/models` discovery is attempted. A remote URL is resolved and pinned to a public address for each request. Literal IPs, RFC1918/reserved/link-local ranges, localhost, internal names, userinfo, redirects and ports other than 443/8443 are rejected. A private/local endpoint belongs on the Local Bridge, never on the hosted proxy.

## Secret handling and capability boundary

Session/device-local BYOK is the default. “Remember on this device” stores AES-GCM ciphertext plus a non-exportable CryptoKey in IndexedDB. `localStorage` contains routing metadata and a masked suffix only. Keys are never in Kinetable projects or Supabase. Same-origin malicious JavaScript could still access a live vault, so CSP, dependency review and avoiding HTML injection remain important. No managed inference is exposed. A future paid Kinetable-managed option would need separate billing, policy, rate limiting and server-side vault work.
