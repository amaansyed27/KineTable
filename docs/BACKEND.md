# Kinetable backend foundation

## Slice 02 boundary

Onboarding is local-first and requires no account or cloud connection. Supabase is the chosen cloud provider; Vercel hosts the web application. This slice configures the integration boundary, not a cloud data product.

- Supabase PostgreSQL: schema/migration infrastructure now, user-owned data later.
- Supabase Auth: Slice 03. No sign-in, tokens, sessions or callbacks are implemented now.
- Supabase Storage: later. No buckets created.
- Vercel: static Vite deployment and SPA routing now; API/server functions later.

## Browser environment

Copy `.env.example` to `apps/web/.env.local` to configure local Vite development:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Both variables are optional. `backendConfig.ts` validates the URL and publishable-key format. `supabaseClient.ts` exports `cloudConfigured`, `backendConfig` and a lazy, singleton `getSupabaseClient()` which returns `null` in local-only mode. Configuration validity is not proof of network availability or successful authentication. No cloud operation is triggered by onboarding.

`vite.config.ts` disables automatic VITE variable exposure and explicitly includes only validated public configuration. Missing or malformed values produce local-only mode; invalid keys are removed before bundling. Secret and legacy JWT keys are rejected. Never place a service-role/secret key in a VITE variable, even with this guard. There is no server secret in this slice.

The client disables session persistence, token refresh and URL auth callbacks until Slice 03 introduces them deliberately. UI components must use a domain repository rather than import the Supabase SDK directly.

## Local database development

`supabase/config.toml` was initialized with CLI 2.116.0 and reduced to this slice's needs. PostgreSQL 17 and local API/Studio are configured. Auth, Storage, Realtime, Edge Runtime and analytics are disabled. New public tables are not automatically exposed. `supabase/migrations/` is intentionally empty: there is no cloud-owned data to model yet.

When database work starts, install Docker, then from the repository root:

```sh
supabase start
supabase status
```

Use `supabase --help` for the installed CLI's commands. Create future migrations with `supabase migration new <name>`; review generated SQL before applying it. Enable RLS and explicit ownership policies and grants before exposing any user-owned table. Test those policies with separate user identities. Never push schema changes merely to make this foundation look populated.

## Hosted Supabase

No Kinetable hosted project is connected by Slice 02. When cloud functionality is needed, create/select a dedicated Kinetable project, obtain its URL and publishable key, and configure those two public values in Vercel's intended environment. Link the Supabase CLI to that project before applying reviewed migrations. Do not reuse an unrelated project.

The installed Supabase connector returned an unavailable-tool error during this slice; authenticated CLI inspection worked. No remote schemas were changed. The local config was parsed by the CLI, but Docker was not running, so no local PostgreSQL runtime or migration execution is claimed.

## Vercel

Import `amaansyed27/KineTable`, with the repository root as Root Directory. `vercel.json` configures:

- install: `corepack pnpm install --frozen-lockfile`
- build: `corepack pnpm --filter @kinetable/web build`
- output: `apps/web/dist`
- SPA fallback: `/(.*)` → `/index.html`

The filtered build avoids invoking a different global pnpm version inside the root script. Corepack uses the repository's pinned package-manager version. `.vercelignore` excludes local environment files, browser captures, build output and dependencies from deployment uploads.

Set public Supabase variables in Vercel only when a real project is connected; leave them absent otherwise. Variables are bundled at build time, so changing them requires a new deployment. Future API routes must be ordered before the SPA fallback when those routes actually exist.

Preview deployments can be made with `vercel deploy --target=preview`. Repository linking enables Vercel Git deployments; no custom CI deployment workflow is needed. See [Slice 02](SLICE-02.md) for the actual preview and verification result.

## Official references

- [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [Supabase local development](https://supabase.com/docs/guides/local-development)
- [Vercel Vite SPA routing](https://vercel.com/docs/frameworks/frontend/vite)
