export type ActivityCsvRow = {
  createdAt: number;
  actorEmail: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  summary: string;
  summaryKey?: string;
  metadata?: Record<string, string>;
};

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

/** Build a CSV string for class activity export (UTF-8, header row). */
export function buildActivityCsv(rows: readonly ActivityCsvRow[]): string {
  const header = ["timestamp", "email", "role", "action", "resourceType", "resourceId", "summary"];
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      [
        new Date(row.createdAt).toISOString(),
        row.actorEmail,
        row.actorRole,
        row.action,
        row.resourceType,
        row.resourceId ?? "",
        row.summary,
      ]
        .map(escapeCsvField)
        .join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

export function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
