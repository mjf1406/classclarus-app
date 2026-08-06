# vctr

[![AI Level 3](https://ai-level.dev/badge/standard/3.svg)](https://ai-level.dev/level-3)

Vite+ / React / Convex app **template**. Package manager is **bun** only.

**ClassClarus** (classroom CRUD, members, join codes, teacher/student roles) is a **worked example**, not the product. Keep the platform patterns; replace the nouns when cloning for another domain.

| Keep (platform)                                      | Example domain (replace)                                     |
| ---------------------------------------------------- | ------------------------------------------------------------ |
| Auth, theme, toasts, forms, empty/error/pending      | `classes`, members, join codes, class sidebar                |
| i18n plumbing + `common` / `auth` namespaces         | Classroom copy (`footerTagline`, invite/member strings)      |
| Optimistic hooks, rate limiter, authz wiring         | `convex/lib/authzModel.ts` resources/roles                   |
| `convex/appConfig.ts` + `public/brand/`              | Schema tables tied to classes; feature routes under `_class` |
| UI kit under `src/components/ui/` + `/ui` playground | Role badges / people pages for classroom roles               |

> **Convention for agents:** anything named `class` / classroom roles is sample product code. Keep the _patterns_ (scoped authz, optimistic hooks, invite codes); replace the _nouns_.

**Fork intent:** a ClassClarus-style product can keep most of the classroom domain. Other products should smoke-test auth on the example UI first, then reshape or remove that domain — see [`CLONE_CHECKLIST.md`](./CLONE_CHECKLIST.md).

Toolchain notes also live in [`AGENTS.md`](./AGENTS.md) (`vp install`, `vp check`, `vp test`).

**Self-host (local Docker, no cloud):** [`docs/SELF_HOSTING.md`](./docs/SELF_HOSTING.md) — retargeted by `bun run post-clone`.

**Electron (downloadable classroom host):** [`docs/electron.md`](./docs/electron.md) — same self-host mode, bundled Convex, LAN join for students. Releases from tags `v*` via `.github/workflows/electron-release.yml`.

---

## Prerequisites

- [Bun](https://bun.sh) — this repo pins Bun via `package.json` → `devEngines.packageManager` (currently `1.3.14`; `onFail: "download"` will fetch a matching Bun when the engine check runs).
- [Vite+](https://viteplus.dev/guide/) CLI (`vp`) — install globally if `vp` is missing (`bun install -g vite-plus` or follow the Vite+ docs). `prepare` runs `vp config` after install.
- Convex account ([dashboard](https://dashboard.convex.dev))
- Google Cloud project (if keeping Google sign-in)
- Polar account ([polar.sh](https://polar.sh)) if keeping billing (sandbox for local/dev)

---

## Getting started

1. Clone or fork into a **new** git remote. Do **not** reuse the template’s Convex deployment or copy `.env` / `.env.local` secrets.
2. Run the identity wizard:

   ```bash
   bun run post-clone
   ```

   This rewrites brand fields (`convex/appConfig.ts`, package metadata, compose/self-host examples, footer tagline), writes [`.env.example`](./.env.example), optionally runs `vp install`, and checks off what it did in [`CLONE_CHECKLIST.md`](./CLONE_CHECKLIST.md).

3. Open [`CLONE_CHECKLIST.md`](./CLONE_CHECKLIST.md) and finish the remaining boxes (Convex, Auth, Google, Polar, brand assets, verify).

Dry run (no writes): `bun scripts/post-clone.mjs --dry-run`.

Non-interactive: `bun scripts/post-clone.mjs --name MyApp --slug my-app --github https://github.com/org/repo --no-install` (optional `--tagline`, `--yes`, `--keep-classroom`, `--dry-run`).

---

## Day-to-day commands

| Command                      | Purpose                                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| `bun run post-clone`         | First-time identity setup after cloning                                                       |
| `vp install`                 | Install deps after pull                                                                       |
| `vp dev`                     | Vite+ web dev server                                                                          |
| `bunx convex dev`            | Convex codegen + push (keep running while developing)                                         |
| `vp run ds`                  | Web + Convex together ([`vite.config.ts`](./vite.config.ts))                                  |
| `vp check`                   | Format / Oxlint (this repo also runs ESLint via `bun run lint:fix` in `package.json` `check`) |
| `vp test`                    | Tests                                                                                         |
| `vp run check`               | Runs `vp check` and `bun run lint`                                                            |
| `bun run typecheck`          | `tsc --noEmit`                                                                                |
| `bunx --bun shadcn@latest …` | Theme / UI components                                                                         |

---

## Env

Client vars: see [`.env.example`](./.env.example). After `bunx convex dev`, real values are in `.env.local`.

Auth, Google, and Polar secrets belong on the **Convex deployment** (`bunx convex env set`), not in Vite. Full setup order and env tables live in [`CLONE_CHECKLIST.md`](./CLONE_CHECKLIST.md).

---

## Stack pointers

- React 19 + Vite+ ([`vite.config.ts`](./vite.config.ts), React Compiler)
- TanStack Router / Query / Form / Table
- Convex + `@convex-dev/auth` + `@djpanda/convex-authz` + `@convex-dev/rate-limiter` + `@convex-dev/polar` + `@convex-dev/aggregate`
- shadcn (Base UI) + Tailwind v4
- i18n: `react-i18next` ([`src/i18n/`](./src/i18n/))

---

## License

This template is released under the [MIT License](./LICENSE.md). If you clone it and want a different license for your project, update [`LICENSE.md`](./LICENSE.md).
