export const PRINT_STYLESHEET_PATH = "/print.css";

export type PrintDocumentKind =
  | "print-seats"
  | "print-table-compact"
  | "print-table-assigner"
  | "print-groups"
  | "print-guardian-invites";

export function escapePrintHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Same-origin asset URL that respects Vite `BASE_URL`. */
export function resolveAppAssetUrl(path: string, origin?: string): string {
  const base = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  const resolvedOrigin =
    origin ?? (typeof window !== "undefined" ? window.location.origin : "http://localhost");
  return new URL(normalizedPath, `${resolvedOrigin}${base}`).href;
}

export function printStylesheetUrl(): string {
  return resolveAppAssetUrl(PRINT_STYLESHEET_PATH);
}

export function buildPrintDocumentOpen(args: {
  title: string;
  bodyClass: PrintDocumentKind;
  lang?: string;
}): string {
  const stylesheetUrl = printStylesheetUrl();
  const langAttr = args.lang ? ` lang="${escapePrintHtml(args.lang)}"` : "";
  return `<!DOCTYPE html>
<html${langAttr}>
<head>
  <meta charset="utf-8" />
  <title>${escapePrintHtml(args.title)}</title>
  <link rel="stylesheet" href="${escapePrintHtml(stylesheetUrl)}" />
</head>
<body class="${escapePrintHtml(args.bodyClass)}">`;
}

export function buildPrintDocumentClose(): string {
  return `
</body>
</html>`;
}
