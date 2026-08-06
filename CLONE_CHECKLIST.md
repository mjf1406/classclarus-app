# Clone checklist

Follow this after cloning the template into a **new** git remote. Paths are relative to the repo root.

**Automated start:** run `bun run post-clone` to rewrite brand identity, write `.env.example`, optionally install deps, and check off the items it completed. Then finish the remaining boxes here.

Do **not** reuse the template’s Convex deployment or copy `.env` / `.env.local` secrets from another machine.

---

## 1. Identity

<!-- clone:identity-remote -->

- [ ] New git remote; do not copy secrets from another machine

<!-- clone:identity-license -->

- [ ] License reviewed (`LICENSE.md` is MIT — change only if you want a different license)

<!-- clone:identity-package -->

- [ ] `package.json` name / description / author / repository updated

<!-- clone:identity-app-config -->

- [ ] `convex/appConfig.ts` fields set for the new product (`name`, `slug`, URLs, `authzTenantId`, …)

<!-- clone:identity-title -->

- [ ] `index.html` title updated

<!-- clone:identity-footer-tagline -->

- [ ] `common.footerTagline` updated in all locales under `src/i18n/resources/`

<!-- clone:identity-self-host-docs -->

- [ ] `docs/SELF_HOSTING.md` Portainer/repo examples retargeted (not `mjf1406/vctr` / `classclarus-*`)

<!-- clone:identity-compose -->

- [ ] `docker-compose.yml` / `example.env` instance names updated

<!-- clone:env-example -->

- [ ] `.env.example` present with Vite-side vars documented

`bun run post-clone` marks the identity items it edits. Product brand: `public/brand/` (+ `Logo.tsx`). Template favicon: `public/vctr/vctr-favicon.webp` (`index.html`) — replace file or update the `href` when rebranding.

<!-- clone:brand-assets -->

- [ ] Brand assets + favicon replaced (or intentionally kept)

Electron `productName` / `appId` / storage keys derive from `APP_CONFIG.name` / `slug` — no separate config files.

---

## 2. Install

```bash
vp install
# or: bun install
```

<!-- clone:install-deps -->

- [ ] `vp install` / `bun install` completed with no errors

---

## 3. Convex (new project)

This template already has functions under `convex/`. You still need a **fresh** deployment.

```bash
bunx convex dev
```

<!-- clone:convex-new-project -->

- [ ] Logged into Convex; chose **create a new project** (not the template’s deployment)

<!-- clone:convex-env-local -->

- [ ] `.env.local` has `CONVEX_DEPLOYMENT`, `VITE_CONVEX_URL`, `VITE_CONVEX_SITE_URL`

<!-- clone:convex-dev-running -->

- [ ] Left `bunx convex dev` running (or use `vp run ds` for web + Convex)

Already wired: `convex/schema.ts`, `convex/convex.config.ts`, `convex/http.ts` (auth + `/polar/events`), `src/main.tsx`.

---

## 4. Convex Auth

Auth source files exist (`convex/auth.ts`, `convex/auth.config.ts`). The new deployment still needs keys + `SITE_URL`.

```bash
bunx @convex-dev/auth
```

<!-- clone:auth-site-url -->

- [ ] Set `SITE_URL` to the SPA origin (usually `http://localhost:5173`) — not the Convex `.cloud` / `.site` URL

<!-- clone:auth-jwt -->

- [ ] Allowed generation of `JWT_PRIVATE_KEY` and `JWKS` on this deployment

<!-- clone:auth-keep-sources -->

- [ ] Skipped regenerating auth source files if the CLI offered (keep this template’s versions)

Verify with `bunx convex env list` or the Convex dashboard → Settings → Environment Variables.

Production later: `bunx @convex-dev/auth --prod`.

---

## 5. Google OAuth

Provider is registered in `convex/auth.ts`. Secrets are **`AUTH_GOOGLE_ID`** / **`AUTH_GOOGLE_SECRET`** on the Convex deployment (not Vite).

1. Google Cloud Console → OAuth consent screen (match new brand).
2. Credentials → OAuth client ID (Web application).
3. Authorized JavaScript origins: `http://localhost:5173` and production SPA origin (`APP_CONFIG.appUrl`).
4. Authorized redirect URI (exact):

   ```text
   {CONVEX_SITE_URL}/api/auth/callback/google
   ```

   Use `VITE_CONVEX_SITE_URL` from `.env.local` (same host as Convex `CONVEX_SITE_URL`).

```bash
bunx convex env set AUTH_GOOGLE_ID "<client-id>.apps.googleusercontent.com"
bunx convex env set AUTH_GOOGLE_SECRET "<client-secret>"
```

<!-- clone:google-credentials -->

- [ ] `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` set on this deployment

<!-- clone:google-redirect -->

- [ ] Redirect URI matches `{CONVEX_SITE_URL}/api/auth/callback/google`

Optional password UI (cloud/dev): set `VITE_AUTH_PASSWORD_ENABLED=true` in `.env.local`. Self-host enables password auth automatically.

---

## 6. Billing (Polar)

Subscriptions use `@convex-dev/polar`. Trial length is app-managed via `APP_CONFIG.trial` (not a Polar-native trial). Empty Polar credentials throw — set sandbox env for local/dev.

1. Create a [Polar](https://polar.sh) org (**sandbox** while developing).
2. Create two subscription products (example UI copy: **USD 3**/mo, **USD 30**/yr). If prices differ, update `billing.monthlyPrice` / `billing.yearlyPrice` in **every** locale under `src/i18n/resources/`.
3. Org access token with products/subscriptions/customers/checkouts/portal scopes.
4. Webhook at `{CONVEX_SITE_URL}/polar/events` for `product.created`, `product.updated`, `subscription.created`, `subscription.updated`.

```bash
bunx convex env set POLAR_SERVER sandbox
bunx convex env set POLAR_SANDBOX_ACCESS_TOKEN "<sandbox-org-token>"
bunx convex env set POLAR_SANDBOX_WEBHOOK_SECRET "<sandbox-webhook-secret>"
bunx convex env set POLAR_PRODUCT_MONTHLY_ID "<polar-monthly-product-id>"
bunx convex env set POLAR_PRODUCT_YEARLY_ID "<polar-yearly-product-id>"
```

Grant yourself `app_admin` after first sign-in (`users._id` from the dashboard):

```powershell
# PowerShell
bunx convex run lib/admin:grantAppAdmin '{\"userId\":\"<convex-user-id>\"}'
```

```bash
# bash / zsh
bunx convex run lib/admin:grantAppAdmin '{"userId":"<convex-user-id>"}'
```

```bash
bunx convex run polar:syncProducts
bunx convex run polar:billingHealth
```

<!-- clone:polar-products -->

- [ ] Sandbox products + webhook created; i18n prices match if not $3/$30

<!-- clone:polar-env -->

- [ ] Convex Polar env vars set (`POLAR_SERVER`, sandbox token/secret, both product IDs)

<!-- clone:polar-admin -->

- [ ] Granted `app_admin` and ran `polar:syncProducts` / verified `polar:billingHealth`

Checkout return URLs are built server-side from `SITE_URL` + `/billing`.

---

## 7. Theme (shadcn)

```bash
bunx --bun shadcn@latest preset resolve
bunx --bun shadcn@latest apply <preset-code> --only theme,font
```

<!-- clone:theme -->

- [ ] New theme/font applied (or confirmed keeping current tokens)

<!-- clone:theme-background -->

- [ ] `src/style.css` light/dark `--background` still matches `APP_CONFIG.themeColors` / `backgroundColors`

---

## 8. Reshape the example domain

Do this **after** auth + branding smoke-test. ClassClarus-style clones can keep most of this and only retarget brand/URLs/prices.

See `convex/lib/authzModel.ts`, `convex/schema.ts`, routes under `src/routes/_authenticated/_class/`, and feature folders under `src/components/classes|members|invitations`.

<!-- clone:domain-authz -->

- [ ] Redefined permissions/roles in `authzModel.ts` for the new domain (or kept ClassClarus)

<!-- clone:domain-surface -->

- [ ] Replaced or removed example tables/functions/routes/components (if not keeping classroom)

<!-- clone:domain-i18n -->

- [ ] Trimmed or rewrote feature i18n keys in all locales + tests

---

## 9. Run and verify

Prefer verifying login/brand/theme on the example app **before** a large domain rewrite.

```bash
vp run ds
# or: bunx convex dev  +  vp dev
```

<!-- clone:verify-load -->

- [ ] App loads against the **new** `VITE_CONVEX_URL`

<!-- clone:verify-auth -->

- [ ] Google sign-in completes (consent → redirect → authenticated shell)

<!-- clone:verify-brand -->

- [ ] Brand name/logo/favicon/tagline look correct

<!-- clone:verify-theme -->

- [ ] Theme looks correct in light and dark

<!-- clone:verify-billing -->

- [ ] Billing page loads products after `polar:syncProducts`

<!-- clone:verify-check -->

- [ ] `vp check` and `vp test` pass after your edits

---

## 10. Production (when ready)

<!-- clone:prod-convex -->

- [ ] Deploy Convex prod (`bunx convex deploy`) + `bunx @convex-dev/auth --prod`

<!-- clone:prod-google -->

- [ ] Prod Google OAuth origins + secrets + redirect URI

<!-- clone:prod-polar -->

- [ ] `POLAR_SERVER=production` + prod Polar token/secret/product IDs + webhook

<!-- clone:prod-trial -->

- [ ] After first deploy with trial jobs: `bunx convex run trialBackfill:scheduleExpiryJobs`

<!-- clone:prod-urls -->

- [ ] `APP_CONFIG` production URLs set; SPA built with prod `VITE_CONVEX_*`

<!-- clone:prod-host -->

- [ ] Host serves `public/_headers` (CSP); build uses prod Convex Vite env

Build (Cloudflare Pages example): command `bun run build`, output `dist`, env `VITE_CONVEX_URL` + `VITE_CONVEX_SITE_URL` for the **prod** deployment.

---

## Env quick reference

Vite / `.env.local` (from `convex dev`): `CONVEX_DEPLOYMENT`, `VITE_CONVEX_URL`, `VITE_CONVEX_SITE_URL`, optional `VITE_AUTH_PASSWORD_ENABLED`.

Convex deployment (`bunx convex env set`): `SITE_URL`, `JWT_PRIVATE_KEY`, `JWKS`, `AUTH_GOOGLE_*`, Polar vars, optional usage-tracking vars. See [`.env.example`](./.env.example).

Polar secrets belong on the **Convex deployment**, not in Vite.
