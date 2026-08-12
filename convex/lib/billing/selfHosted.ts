/** True when this Convex deployment was bootstrapped for local Docker self-host. */
export function isSelfHosted(): boolean {
  return process.env.SELF_HOSTED === "true";
}
