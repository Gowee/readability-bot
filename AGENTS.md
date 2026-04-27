# AGENTS.md

## Purpose

This repository is a Vercel project with three responsibilities:

- a small Svelte web entrance
- an article extraction API at `api/readability.js`
- a Telegram webhook at `api/webhook.js`

The current architecture is intentionally simple:

- `src/` contains the Vite/Svelte frontend
- `api/` contains thin Vercel serverless handlers
- `lib/server/` contains shared backend logic
- `public/` contains only static assets that should be copied through the build

## Stack

- Package manager: `pnpm`
- Frontend: `Vite` + `Svelte`
- Runtime target: `Node 22.x`
- Deployment target: `Vercel`

Important files:

- `package.json`
- `vercel.json`
- `vite.config.mjs`
- `pnpm-lock.yaml`

## Commands

Install dependencies:

```bash
pnpm install
```

Run frontend locally:

```bash
pnpm dev
```

Build for production:

```bash
pnpm build
```

Deploy production:

```bash
npx vercel deploy --prod
```

## Maintenance Rules

1. Keep `api/` handlers thin.
   Move reusable logic into `lib/server/` instead of duplicating it across endpoints.

2. Do not reintroduce the old Rollup/Yarn setup.
   This repo is standardized on `pnpm`, `Vite`, and `pnpm-lock.yaml`.

3. Do not commit generated legacy assets.
   In particular, `public/build/` should not come back.

4. Preserve the separation of concerns:
   - request handling in `api/`
   - extraction/config/Telegram logic in `lib/server/`
   - UI in `src/`

5. Keep Vercel config aligned with pnpm.
   `vercel.json` currently enables Corepack because Vercel needs that for pinned `pnpm@10`.

6. Be careful with Telegram formatting.
   Messages sent through the webhook use HTML parse mode, so links and text must stay escaped correctly.

7. Be careful with extracted HTML.
   Readability output is sanitized before rendering. Do not remove sanitization unless you replace it with something equivalent.

## Environment Variables

Expected variables in Vercel:

- `BOT_TOKEN`
- `IV_RHASH`
- `APP_URL` optional
- `READABILITY_API_URL` optional

`APP_URL` and `READABILITY_API_URL` can be inferred automatically, so avoid hardcoding them unless required.

## Deployment Notes

- Vercel production is currently expected to build with `pnpm build`.
- The project uses `packageManager` in `package.json` and `ENABLE_EXPERIMENTAL_COREPACK` in `vercel.json` so the remote build uses the pinned pnpm version.
- If deployment starts failing on package-manager resolution, check `package.json` and `vercel.json` first.

## Testing Guidance

There is no formal automated test suite yet.

Before shipping changes, at minimum:

1. Run `pnpm build`.
2. Ensure both server modules still load:

```bash
node -e "require('./api/readability.js'); require('./api/webhook.js'); console.log('ok')"
```

3. If backend logic changed, manually verify:
   - `/api/readability?url=...`
   - `/api/readability?url=...&format=json`
   - Telegram webhook behavior if relevant

## Commit Guidance

When making substantial changes:

- prefer one coherent commit per migration or feature
- keep the user as the primary author when requested
- add `Co-authored-by: Codex <codex@openai.com>` when Codex contributed materially
