# ClassClarus App

Class management

## To-do List

- [ ] Convex
  - [ ] convex auth
  - [ ] convex-tenants
  - [ ] convex-authz
  - [ ] onvex-dev/rate-limiter
- [ ] Shadcn
  - [ ] light/dark theme actual toggle, not dropdown
  - [ ] `bunx --bun shadcn@latest init --preset bbZ0kFM --template vite --pointer`
- [ ] Tanstack
  - [ ] Tanstack Query
    - [ ] @convex-dev/react-query
  - [ ] Tanstack Form
  - [ ] Tanstack Router
- [ ] Zod
- [ ] only have @ import alias, not #
- [ ] i18next
- [ ] Pages
  - [ ] /
    - [ ] grid of classes
    - [ ] grid of schools
  - [ ] /login
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
