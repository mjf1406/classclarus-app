import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

const cache = new Map<string, IconDefinition | null>();
const inflight = new Map<string, Promise<IconDefinition | null>>();

/** Normalize icon id: "fas seedling" -> "fas:seedling" for catalog lookup */
function normalizeIconId(id: string): string {
  const trimmed = id.trim();
  if (trimmed.includes(" ") && !trimmed.includes(":")) {
    return trimmed.replace(/\s+/, ":");
  }
  return trimmed;
}

/** kebab-case icon name → FA export/module name, e.g. address-book → faAddressBook */
function toFaExportName(iconName: string): string {
  return (
    "fa" +
    iconName
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("")
  );
}

/** faSeedling → "s", fa0 → "0" */
function bucketKey(exportName: string): string {
  const rest = exportName.slice(2);
  const letter = rest.charAt(0).toLowerCase();
  return /[a-z0-9]/.test(letter) ? letter : "_";
}

function isIconDefinition(value: unknown): value is IconDefinition {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.prefix === "string" && typeof v.iconName === "string" && Array.isArray(v.icon);
}

async function importSolidBucket(key: string): Promise<Record<string, unknown>> {
  return import(`./fa-packs/solid/${key}.ts`);
}

async function importRegularBucket(key: string): Promise<Record<string, unknown>> {
  return import(`./fa-packs/regular/${key}.ts`);
}

async function loadIconModule(prefix: string, exportName: string): Promise<IconDefinition | null> {
  const key = bucketKey(exportName);
  try {
    const mod =
      prefix === "fas"
        ? await importSolidBucket(key)
        : prefix === "far"
          ? await importRegularBucket(key)
          : null;
    if (!mod) return null;
    const icon = mod[exportName];
    return isIconDefinition(icon) ? icon : null;
  } catch {
    return null;
  }
}

export async function resolveIconId(id: string): Promise<IconDefinition | null> {
  const normalized = normalizeIconId(id);
  if (cache.has(normalized)) {
    return cache.get(normalized) ?? null;
  }

  const pending = inflight.get(normalized);
  if (pending) return pending;

  const promise = (async (): Promise<IconDefinition | null> => {
    const [prefix, iconName] = normalized.split(":");
    if (!prefix || !iconName) {
      cache.set(normalized, null);
      return null;
    }

    if (prefix !== "fas" && prefix !== "far") {
      cache.set(normalized, null);
      return null;
    }

    const exportName = toFaExportName(iconName);
    const icon = await loadIconModule(prefix, exportName);
    cache.set(normalized, icon);
    return icon;
  })();

  inflight.set(normalized, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(normalized);
  }
}

export function iconDefinitionToId(icon: IconDefinition): string {
  return `${icon.prefix}:${icon.iconName}`;
}
