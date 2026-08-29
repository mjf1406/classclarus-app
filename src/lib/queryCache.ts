/** Shared TanStack Query cache lifetimes (ms) for Convex subscriptions. */

export const GC_TIME = {
  /** Default: hot class data. Subscription drops 10s after unmount (Convex docs guidance). */
  realtime: 10_000,
  /** Tiny read sets that rarely change; cheap to keep subscribed, instant revisits. */
  stable: 60 * 60 * 1000,
  /** Config-like data (Polar products). */
  static: 24 * 60 * 60 * 1000,
  /** Immutable content (file bytes). */
  immutable: Infinity,
} as const;
