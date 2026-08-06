---
name: convex-dev-migrations
description: Framework for long running data migrations of live data. Use this skill whenever working with Migrations or related Convex component functionality.
version: 0.3.5
---

> Agents: read this skill fully before writing code that uses Migrations. Follow the installation and configuration steps exactly.

# Migrations

## Instructions

A framework for running long-running data migrations on live Convex databases without downtime. It processes documents in batches asynchronously, tracks migration state to handle failures and resumption, and provides real-time progress monitoring through queries. Migrations can target entire tables or specific document subsets using indexes.

### Installation

```bash
npm install @convex-dev/migrations
```

Current npm version: `@convex-dev/migrations@0.3.5`

## Use cases

- **Schema evolution**: Update existing documents when adding new required fields or changing field types while maintaining backward compatibility
- **Data cleanup**: Remove deprecated fields, normalize inconsistent data formats, or fix data quality issues across large tables
- **Backfill operations**: Populate new computed fields or derived values based on existing document data
- **Index-based targeted updates**: Migrate only documents matching specific criteria using existing indexes to avoid processing entire tables
- **Production deployments**: Run migrations as part of your deployment pipeline to ensure data consistency across schema changes

## How it works

The component creates a `Migrations` instance that defines migration functions with `migrations.define()`. Each migration specifies a target table and a `migrateOne` function that processes individual documents, either by explicitly calling database operations or returning an object for automatic patching. The framework handles batching (default 100 documents), progress tracking, and failure recovery.

Migrations run through `migrations.runner()` for single operations or `migrations.runSerially()` for dependent sequences. The component stores migration state in Convex tables, enabling resumption from the last successful batch if interrupted. You can target document subsets using `customRange` with existing indexes, and monitor progress with `migrations.getStatus()` queries.

The system integrates with custom `internalMutation` implementations for validation or triggers, supports dry-run testing, and provides CLI/dashboard interfaces. Migrations can be triggered programmatically from other functions or as part of deployment scripts using `npx convex run` commands.

## When NOT to use

- When a simpler built-in solution exists for your specific use case
- If you are not using Convex as your backend
- When the functionality provided by Migrations is not needed

## Resources

- [npm package](https://www.npmjs.com/package/%40convex-dev%2Fmigrations)
- [GitHub repository](https://github.com/get-convex/migrations)
- [Convex Components Directory](https://www.convex.dev/components/migrations)
- [Convex documentation](https://docs.convex.dev)
