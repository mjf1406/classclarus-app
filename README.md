# ClassClarus App

Class management

## To-do List

- [x] Convex
  - [ ] [convex auth](https://labs.convex.dev/auth)
  - [x] [convex-tenants](https://www.convex.dev/components/djpanda/convex-tenants)
  - [x] [convex-authz](https://www.convex.dev/components/djpanda/convex-authz)
  - [x] [convex-dev/rate-limiter](https://www.convex.dev/components/rate-limiter)
- [x] Shadcn
  - [x] light/dark theme actual toggle, not dropdown
  - [x] `bunx --bun shadcn@latest init --preset bbZ0kFM --template vite --pointer`
- [x] Tailwind
- [x] Tanstack
  - [x] Tanstack Query
    - [x] @convex-dev/react-query
  - [x] Tanstack Form
  - [x] Tanstack Router
- [x] Zod
- [x] only have @ import alias, not #
- [ ] i18next
  - this requires a provider and many other things
- [ ] Pages
  - [ ] /
    - [ ] grid of classes
    - [ ] grid of schools
  - [ ] _public
    - [ ] /login
      - currently borked because we don't have i18next set up
    - [ ] /join
    - [x] /unauthorized
    - [x] $
  - [ ] /c/CLASS_ID
    - [ ] sidebar layout
    - [ ] member management
  - [ ] /s/SCHOOL_ID
    - [ ] sidebar layout
    - [ ] member management

1. Convex (`bun add convex` → `bunx convex dev`)
2. `@` path alias (tsconfig + vite) — before Shadcn
3. Shadcn init (your `bbZ0kFM` command)
4. TanStack Router → Query → Form
5. Zod + i18next
6. Convex Auth → tenants → authz → rate-limiter
7. Wire providers in `main` (Convex + Query + Router)
8. Then pages

## Change Log
