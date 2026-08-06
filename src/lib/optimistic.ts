/**
 * UUID v4 via `getRandomValues` — works on non-secure origins where
 * `crypto.randomUUID` is missing (e.g. http://LAN-IP Electron / self-host).
 */
function uuidV4FromGetRandomValues(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Install `crypto.randomUUID` when absent so third-party code
 * (e.g. `@convex-dev/presence`) works over LAN HTTP.
 */
export function polyfillCryptoRandomUUID(): void {
  if (typeof crypto === "undefined" || typeof crypto.randomUUID === "function") {
    return;
  }
  Object.defineProperty(crypto, "randomUUID", {
    value: () => uuidV4FromGetRandomValues() as ReturnType<Crypto["randomUUID"]>,
    configurable: true,
    writable: true,
  });
}

/** Client-side id for optimistic cache rows. */
export function randomClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return uuidV4FromGetRandomValues();
}

export function patchDoc<TDoc>(oldDoc: TDoc | null, patch: (doc: TDoc) => TDoc): TDoc | null {
  if (!oldDoc) {
    return oldDoc;
  }
  return patch(oldDoc);
}

export function upsertById<TDoc extends { _id: unknown }>(
  list: readonly TDoc[] | null | undefined,
  doc: TDoc,
): TDoc[] {
  const current = list ?? [];
  const idx = current.findIndex((item) => item._id === doc._id);
  if (idx === -1) {
    return [...current, doc];
  }
  return [...current.slice(0, idx), doc, ...current.slice(idx + 1)];
}

export function removeById<TDoc extends { _id: unknown }>(
  list: readonly TDoc[] | null | undefined,
  id: TDoc["_id"],
): TDoc[] {
  const current = list ?? [];
  return current.filter((item) => item._id !== id);
}
