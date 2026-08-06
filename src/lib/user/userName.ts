/** Combine first/last into the single `users.name` field. */
export function fullNameFromParts(firstName: string, lastName: string): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
}

/** Split a stored full name into first word / remainder for edit forms. */
export function splitFullName(name: string | null | undefined): {
  firstName: string;
  lastName: string;
} {
  const trimmed = name?.trim() ?? "";
  if (!trimmed) {
    return { firstName: "", lastName: "" };
  }
  const space = trimmed.indexOf(" ");
  if (space === -1) {
    return { firstName: trimmed, lastName: "" };
  }
  return {
    firstName: trimmed.slice(0, space),
    lastName: trimmed.slice(space + 1).trim(),
  };
}
