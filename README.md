# ClassClarus

[![AI Level 3](https://ai-level.dev/badge/standard/3.svg)](https://ai-level.dev/level-3)

Vite+ / React / Convex classroom app. Package manager is **bun** only.

Classes, members, join codes, and teacher/student roles are the product domain — not a disposable sample.

Brand config lives in [`convex/appConfig.ts`](./convex/appConfig.ts) and assets under [`public/brand/`](./public/brand/). Toolchain notes also live in [`AGENTS.md`](./AGENTS.md) (`vp install`, `vp check`, `vp test`).

**Self-host (local Docker, no cloud):** [`docs/SELF_HOSTING.md`](./docs/SELF_HOSTING.md).

**Electron (downloadable classroom host):** [`docs/electron.md`](./docs/electron.md) — same self-host mode, bundled Convex, LAN join for students. Releases from tags `v*` via `.github/workflows/electron-release.yml`.

Remaining setup after identity (Convex, Auth, Google, Polar): [`CLONE_CHECKLIST.md`](./CLONE_CHECKLIST.md).

---

## Prerequisites

- [Bun](https://bun.sh) — this repo pins Bun via `package.json` → `devEngines.packageManager` (currently `1.3.14`; `onFail: "download"` will fetch a matching Bun when the engine check runs).
- [Vite+](https://viteplus.dev/guide/) CLI (`vp`) — install globally if `vp` is missing (`bun install -g vite-plus` or follow the Vite+ docs). `prepare` runs `vp config` after install.
- Convex account ([dashboard](https://dashboard.convex.dev))
- Google Cloud project (for Google sign-in)
- Polar account ([polar.sh](https://polar.sh)) for billing (sandbox for local/dev)

---

## Getting started

1. Do **not** reuse another machine’s Convex deployment or copy `.env` / `.env.local` secrets.
2. Identity was applied with `bun run post-clone` (`--keep-classroom`). Re-run only if you need to change brand fields.
3. Finish remaining boxes in [`CLONE_CHECKLIST.md`](./CLONE_CHECKLIST.md) (Convex, Auth, Google, Polar, verify).

---

## Day-to-day commands

| Command                      | Purpose                                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
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

Released under the [MIT License](./LICENSE.md).
