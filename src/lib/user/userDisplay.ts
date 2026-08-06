export type UserDisplayFields = {
  _id: string;
  name?: string | null;
  email?: string | null;
};

/**
 * Prefer name, then email, then a localized unnamed fallback when provided,
 * otherwise a short id suffix.
 */
export function getDisplayName(user: UserDisplayFields, unnamedFallback?: string): string {
  if (user.name?.trim()) {
    return user.name.trim();
  }
  if (user.email?.trim()) {
    return user.email.trim();
  }
  if (unnamedFallback?.trim()) {
    return unnamedFallback.trim();
  }
  return `User ${user._id.slice(-4)}`;
}

export function getInitials(user: UserDisplayFields): string {
  const name = user.name?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const first = parts[0]?.[0] ?? "";
      const last = parts[parts.length - 1]?.[0] ?? "";
      return `${first}${last}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  const email = user.email?.trim();
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  return "?";
}
