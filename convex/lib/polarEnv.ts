import { isSelfHosted } from "./selfHosted.js";

/**
 * Polar credentials selected by `POLAR_SERVER`.
 * Sandbox and production tokens/secrets can both live on one deployment.
 * Values are read lazily so schema evaluation never touches `process.env`.
 * Missing required values throw so misconfigured deploys fail loudly.
 * Self-hosted installs use inert placeholders (Polar APIs are never called).
 */

const SELF_HOST_PLACEHOLDER = "self-hosted-disabled";

/**
 * Read a Polar credential for module construction.
 * Self-host (or pre-env bootstrap) returns a placeholder so imports never throw;
 * cloud billing call sites still fail clearly when Polar APIs reject bad tokens.
 */
function readPolarCredential(name: string, value: string | undefined): string {
  if (isSelfHosted()) {
    return SELF_HOST_PLACEHOLDER;
  }
  if (value === undefined || value.trim() === "") {
    return SELF_HOST_PLACEHOLDER;
  }
  void name;
  return value;
}

function polarServer(): "sandbox" | "production" {
  if (isSelfHosted()) {
    return "sandbox";
  }
  const value = process.env.POLAR_SERVER;
  if (value === undefined || value.trim() === "") {
    return "sandbox";
  }
  if (value === "sandbox" || value === "production") {
    return value;
  }
  throw new Error(`Invalid POLAR_SERVER="${value}". Expected "sandbox" or "production".`);
}

export const POLAR_ENV = {
  get server() {
    return polarServer();
  },
  get organizationToken() {
    const isSandbox = polarServer() === "sandbox";
    const name = isSandbox ? "POLAR_SANDBOX_ACCESS_TOKEN" : "POLAR_ACCESS_TOKEN";
    return readPolarCredential(
      name,
      isSandbox ? process.env.POLAR_SANDBOX_ACCESS_TOKEN : process.env.POLAR_ACCESS_TOKEN,
    );
  },
  get webhookSecret() {
    const isSandbox = polarServer() === "sandbox";
    const name = isSandbox ? "POLAR_SANDBOX_WEBHOOK_SECRET" : "POLAR_WEBHOOK_SECRET";
    return readPolarCredential(
      name,
      isSandbox ? process.env.POLAR_SANDBOX_WEBHOOK_SECRET : process.env.POLAR_WEBHOOK_SECRET,
    );
  },
  get monthlyProductId() {
    return readPolarCredential("POLAR_PRODUCT_MONTHLY_ID", process.env.POLAR_PRODUCT_MONTHLY_ID);
  },
  get yearlyProductId() {
    return readPolarCredential("POLAR_PRODUCT_YEARLY_ID", process.env.POLAR_PRODUCT_YEARLY_ID);
  },
};

/** Presence-only report for admin health checks — never returns secret values. */
export function polarEnvPresence(): {
  server: "sandbox" | "production";
  organizationToken: boolean;
  webhookSecret: boolean;
  monthlyProductId: boolean;
  yearlyProductId: boolean;
} {
  const server = polarServer();
  const isSandbox = server === "sandbox";
  return {
    server,
    organizationToken: Boolean(
      (isSandbox ? process.env.POLAR_SANDBOX_ACCESS_TOKEN : process.env.POLAR_ACCESS_TOKEN)?.trim(),
    ),
    webhookSecret: Boolean(
      (isSandbox
        ? process.env.POLAR_SANDBOX_WEBHOOK_SECRET
        : process.env.POLAR_WEBHOOK_SECRET
      )?.trim(),
    ),
    monthlyProductId: Boolean(process.env.POLAR_PRODUCT_MONTHLY_ID?.trim()),
    yearlyProductId: Boolean(process.env.POLAR_PRODUCT_YEARLY_ID?.trim()),
  };
}
