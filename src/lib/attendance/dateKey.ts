const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Local calendar day as `YYYY-MM-DD` (user timezone via Date getters). */
export function localDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isValidDateKey(value: string): boolean {
  return DATE_KEY_RE.test(value);
}
