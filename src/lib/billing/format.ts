export function formatBillingDate(value: string | null | undefined, locale: string): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function formatBillingMoney(
  amountCents: number | null | undefined,
  currency: string | null | undefined,
  locale: string,
): string {
  if (amountCents === null || amountCents === undefined) {
    return "—";
  }
  const code = (currency ?? "USD").toUpperCase();
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
    }).format(amountCents / 100);
  } catch {
    return `${(amountCents / 100).toFixed(2)} ${code}`;
  }
}
