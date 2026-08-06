---
name: djpanda-convex-authz
description: A Zanzibar-inspired authorization component that supports role-based, attribute-based, and relationship-based access control with O(1) indexed permission lookups. Define permissions, roles, and polic Use this skill whenever working with convex-authz or related Convex component functionality.
version: 2.4.1
---

> Agents: read this skill fully before writing code that uses convex-authz. Follow the installation and configuration steps exactly.

# convex-authz

## Instructions

A comprehensive authorization component that implements RBAC, ABAC, and ReBAC (relationship-based access control) with O(1) indexed permission lookups. Inspired by Google Zanzibar, it provides role assignments, attribute-based policies, and relationship graph traversal for complex permission scenarios. Pre-computes permissions into indexed tables for instant checks while supporting scoped permissions, expiring grants, and real-time updates through Convex reactivity.

### Installation

```bash
npm install @djpanda/convex-authz
```

Current npm version: `@djpanda/convex-authz@2.4.1`

## Use cases

- Building multi-tenant SaaS applications where users need different roles (admin, editor, viewer) across different organizations or teams
- Implementing document or project-based permissions where access depends on relationships like team membership or resource ownership
- Creating complex authorization rules that combine user attributes, resource properties, and organizational hierarchies
- Supporting temporary access grants with automatic expiration for contractors or time-limited collaborations
- Scaling permission checks in high-traffic applications where authorization latency must remain constant regardless of system size

## How it works

You define permissions and roles in a configuration file using `definePermissions()` and `defineRoles()`, then create an `Authz` client that connects to the component. The component supports role inheritance and composition through `inherits` and `includes` properties.

The system pre-computes all effective permissions into indexed tables (`effectivePermissions`, `effectiveRoles`, `effectiveRelationships`) enabling O(1) lookups via `authz.can()` and `authz.require()`. You assign roles with `assignRole()` and create relationships with `createTuple()` for ReBAC scenarios.

React integration works through an `AuthzProvider` that wraps your Convex queries, providing hooks like `useCanUser()` and components like `PermissionGate`. Permission checks support wildcard patterns (`documents:*`, `*:read`) and scoped contexts where roles apply to specific resources rather than globally.

The component maintains audit logs and supports expiring grants by accepting expiration timestamps. All changes trigger Convex's reactive updates, automatically refreshing UI components when permissions change.

## When NOT to use

- When a simpler built-in solution exists for your specific use case
- If you are not using Convex as your backend
- When the functionality provided by convex-authz is not needed

## Resources

- [npm package](https://www.npmjs.com/package/%40djpanda%2Fconvex-authz)
- [GitHub repository](https://github.com/dbjpanda/convex-authz)
- [Live demo](https://github.com/dbjpanda/convex-authz/tree/main/example)
- [Convex Components Directory](https://www.convex.dev/components/djpanda/convex-authz)
- [Convex documentation](https://docs.convex.dev)
