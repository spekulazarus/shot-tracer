# 0010. Hosting: Cloudflare Workers static assets

- **Status:** Accepted (deployment is set up in milestone M0)
- **Date:** 2026-09-12

## Context

The app is a static bundle ([ADR 0001](0001-client-side-only.md)). Needs:

- HTTPS everywhere, since WebCodecs, OPFS and service workers require a secure context;
- **preview URLs per branch**, because the only way to test on a real iPhone is over HTTPS;
- control over response headers: CSP now; COOP/COEP later if threaded WASM arrives;
- no cost.

Verified on 2026-09-12: Cloudflare recommends Workers static assets for new projects
(Pages is still supported but no longer the default recommendation). Both support a
`_headers` file. GitHub Pages cannot set custom headers — cross-origin isolation there
needs the `coi-serviceworker` workaround, which reloads the page on first visit.

## Options considered

1. **Cloudflare Workers static assets** — free static requests, global CDN, per-branch
   preview URLs, `_headers`, deploy with `wrangler` from GitHub Actions.
2. **Cloudflare Pages** — the same capabilities for us, but the older product line.
3. **GitHub Pages** — no extra account, but no headers, no previews, and only one site per
   repo.
4. **Netlify / Vercel** — capable, but free tiers come with bandwidth caps that a 10 MB CV
   runtime would eat into.

## Decision

Option 1, deployed from GitHub Actions: `main` → production, other branches → preview
URLs. `_headers` sets a strict CSP (`script-src 'self' 'wasm-unsafe-eval'`) and baseline
security headers.

## Consequences

- The project owner needs a Cloudflare account and must add `CLOUDFLARE_API_TOKEN` and
  `CLOUDFLARE_ACCOUNT_ID` as repository secrets (an M0 issue).
- Until then, `cloudflared tunnel --url http://localhost:5173` gives an HTTPS URL to the
  local dev server with no account.
- Nothing in the app depends on Cloudflare. If the owner prefers GitHub Pages, only the
  deploy workflow changes; `coi-serviceworker` becomes necessary only once threaded WASM
  arrives.
