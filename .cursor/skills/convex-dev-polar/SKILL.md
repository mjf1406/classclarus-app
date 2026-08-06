---
name: convex-dev-polar
description: Add subscriptions and billing to your Convex app with Polar. Use this skill whenever working with Polar or related Convex component functionality.
version: 0.9.2
---

> Agents: read this skill fully before writing code that uses Polar. Follow the installation and configuration steps exactly.

# Polar

## Instructions

Integrates Polar subscriptions and billing into Convex applications with automatic webhook synchronization and React UI components. Provides type-safe subscription management, product syncing, and customer portal integration. Handles all Polar price types including fixed, custom pay-what-you-want, seat-based, and metered pricing models.

### Installation

```bash
npm install @convex-dev/polar
```

Current npm version: `@convex-dev/polar@0.9.2`

## Use cases

- **Add subscription billing to SaaS apps** - Configure products with keys like `premiumMonthly` and `premiumYearly`, then use `CheckoutLink` components for user upgrades
- **Implement tiered pricing with trials** - Support free trials, multiple subscription tiers, and seat-based pricing for team plans
- **Build customer self-service portals** - Let users manage subscriptions, update payment methods, and view billing history with `CustomerPortalLink`
- **Handle subscription lifecycle events** - Process webhook events like `subscription.updated` and `product.created` with type-safe handlers
- **Migrate from other billing providers** - Replace existing subscription logic while keeping product data synced between Polar and Convex

## How it works

The component creates a `Polar` client in your Convex backend that syncs product and subscription data via webhooks. You configure it with a `getUserInfo` function that maps your user system to Polar customers, and optionally define product keys for easy reference. The webhook handler at `/polar/events` keeps subscription data current by processing events like `subscription.created` and `product.updated`.

React components like `CheckoutLink` and `CustomerPortalLink` generate Polar URLs on-demand through Convex actions. The `CheckoutLink` supports embedded checkout or redirect modes, while `CustomerPortalLink` provides subscription management. Functions like `getCurrentSubscription` and `changeCurrentSubscription` handle subscription queries and modifications.

Product configuration supports static mapping (`products: { premiumMonthly: 'product_id' }`) or dynamic listing with `listAllProducts`. The component handles all Polar price types automatically, exposing different fields based on `amountType` - from simple `priceAmount` for fixed pricing to complex `seatTiers` for seat-based models.

## When NOT to use

- When a simpler built-in solution exists for your specific use case
- If you are not using Convex as your backend
- When the functionality provided by Polar is not needed

## Resources

- [npm package](https://www.npmjs.com/package/%40convex-dev%2Fpolar)
- [GitHub repository](https://github.com/erquhart/convex-polar)
- [Live demo](https://github.com/get-convex/polar/tree/main/example)
- [Convex Components Directory](https://www.convex.dev/components/polar)
- [Convex documentation](https://docs.convex.dev)
