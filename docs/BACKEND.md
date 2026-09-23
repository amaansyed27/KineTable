# Kinetable backend

## Local-first application

Guest onboarding and `/table` use Zustand and the IndexedDB profile repository. They do not require an account. A single auth boundary owns session resolution, persisted Supabase sessions, token refresh and auth events. UI components use auth actions and repositories rather than issuing database queries.

Hosted Supabase: **Kinetable**, reference `eajyviksoaveunehuhpl`, Mumbai (`ap-south-1`), in `amaansyed27's Org`. The Supabase integration provisioned this project and applied the committed `cloud_profiles` migration.

## Configuration

Copy `.env.example` to `apps/web/.env.local`. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to the project's URL and `sb_publishable_…` key. The Vite configuration explicitly allowlists validated public values. Missing/invalid configuration keeps the application in local-only mode. Never put a secret, service-role key, database password or OAuth secret in a VITE variable.

`cloudConfigured` indicates valid client configuration, not network health or successful authentication. Preview and Production need the same public variables in Vercel, followed by a rebuild.

## Authentication

Slice 03 uses **email and password**, per the updated product request. Enable Email and signup and disable Confirm email in the hosted Auth configuration. No SMTP, magic-link request or password-reset UI is implemented. Email addresses are unverified; do not treat email as proof of mailbox ownership. Passwords go directly to Supabase Auth and are never stored by Kinetable.

Google and GitHub are optional, disabled by default. To activate either, create the external OAuth application, use `https://eajyviksoaveunehuhpl.supabase.co/auth/v1/callback` as its authorized callback, enter its credentials in Supabase, configure allowed application redirects and then enable the corresponding `VITE_AUTH_GOOGLE_ENABLED` / `VITE_AUTH_GITHUB_ENABLED` flag. OAuth credentials remain in Supabase. `/auth/callback` exchanges PKCE codes and handles invalid links. Redirect destinations are limited to `/table` and `/start`.

## Cloud data and access

Only `public.profiles` is created. Its `id` defaults to `auth.uid()` and references `auth.users`. An internal auth-user trigger creates the profile; an update trigger sets the server timestamp. Clients cannot assign identity or timestamps: INSERT/UPDATE grants cover only editable profile columns. RLS limits every operation to the authenticated owner's ID. DELETE has a policy but no grant or product flow yet. Both trigger functions are in a non-exposed private schema, with fixed search paths and public execution revoked.

## Reconciliation

On initial sign-in, prefer an existing cloud board, otherwise the meaningful local board. Setup is completed if either valid source is completed and a valid board exists. After a successful write, persist the server timestamp and cloud owner locally. A profile associated with another account is not silently uploaded to a new identity.

Later deliberate local edits are saved first and synced to the active account. Pending same-account changes survive refresh using local dirty metadata. Requests capture the session token so changing accounts cannot retarget an in-flight write. Local revisions prevent a late cloud response from overwriting a newer local choice. Sync retries on browser `online` or the account menu's Retry action; there is no project sync engine. Sign-out preserves the local table.

Cloud errors leave local state intact and display a restrained status in the account menu. Requests have a bounded timeout. Another authenticated browser with empty IndexedDB restores the cloud board before the table's setup redirect.

## Local database development

`supabase/config.toml` enables local PostgreSQL 17, API, Auth and Studio. Docker is required for `supabase start`. Storage, Realtime, Edge Runtime and analytics are not part of this slice. Migrations under `supabase/migrations/` are the schema source of truth; the checked-in migration version matches hosted history. See [Slice 03](SLICE-03.md) for current verification and limitations.
