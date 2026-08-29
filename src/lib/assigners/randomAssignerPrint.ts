import { APP_CONFIG } from "@/config/app";
import type { RosterNameFormat } from "@/lib/roster/roster";
import { formatRosterNameParts } from "@/lib/roster/roster";
import {
  buildPrintDocumentClose,
  buildPrintDocumentOpen,
  escapePrintHtml,
  resolveAppAssetUrl,
} from "@/lib/print/printDocument";
import { printHtmlDocument } from "@/lib/print/printFrame";

export const RANDOM_ASSIGNER_PRINT_LOGO_PATH = "/brand/logo/icon-and-text-horizontal.webp";

/** Shared shape for random/equitable assigner print (IDs and flags differ by assigner type). */
export type AssignerPrintRunInput = {
  itemsSnapshot: string[];
  assignments: Array<{
    studentUserId: string;
    studentDisplayName?: string;
    item: string;
    rosterNumber?: number;
    firstName?: string;
    lastName?: string;
    groupId?: string;
    groupName?: string;
  }>;
};

export type RandomAssignerPrintLabels = {
  documentTitle: string;
  heading: string;
  subtitle: string;
  itemColumn: string;
  classColumn: string;
  ungroupedColumn: string;
  logoAlt: string;
};

export type RandomAssignerPrintMatrix = {
  groupNames: string[];
  rows: Array<{
    item: string;
    /** Student labels per group column (`#n - NAME`). */
    cells: Array<Array<string>>;
  }>;
};

export function randomAssignerPrintLogoAlt(): string {
  return `${APP_CONFIG.name} Logo`;
}

export function formatRandomAssignerPrintStudent(
  assignment: {
    studentDisplayName?: string;
    rosterNumber?: number;
    firstName?: string;
    lastName?: string;
  },
  nameFormat: RosterNameFormat,
): string {
  const name =
    formatRosterNameParts(assignment.firstName, assignment.lastName, nameFormat) ??
    assignment.studentDisplayName?.trim() ??
    "";
  if (assignment.rosterNumber === undefined) return name || "—";
  return name ? `#${assignment.rosterNumber} - ${name}` : `#${assignment.rosterNumber}`;
}

function assignmentSortLabel(assignment: {
  studentDisplayName?: string;
  rosterNumber?: number;
  firstName?: string;
  lastName?: string;
}): string {
  return (
    formatRosterNameParts(assignment.firstName, assignment.lastName) ??
    assignment.studentDisplayName?.trim() ??
    ""
  );
}

function comparePrintStudents(
  a: {
    studentDisplayName?: string;
    rosterNumber?: number;
    firstName?: string;
    lastName?: string;
  },
  b: {
    studentDisplayName?: string;
    rosterNumber?: number;
    firstName?: string;
    lastName?: string;
  },
): number {
  const aNumber = a.rosterNumber ?? Number.POSITIVE_INFINITY;
  const bNumber = b.rosterNumber ?? Number.POSITIVE_INFINITY;
  if (aNumber !== bNumber) return aNumber - bNumber;
  return assignmentSortLabel(a).localeCompare(assignmentSortLabel(b));
}

/**
 * Rows = items (snapshot order). Columns = group names (or a single class column).
 * Cells list `#rosterNumber - name` for students who received that item in that group.
 */
export function buildRandomAssignerPrintMatrix(
  run: AssignerPrintRunInput,
  options: {
    classColumn: string;
    ungroupedColumn: string;
    nameFormat: RosterNameFormat;
  },
): RandomAssignerPrintMatrix {
  const namedGroups = new Map<string, string>();
  let hasUngrouped = false;

  for (const assignment of run.assignments) {
    if (assignment.groupId && assignment.groupName) {
      namedGroups.set(assignment.groupId, assignment.groupName);
    } else if (assignment.groupName) {
      namedGroups.set(assignment.groupName, assignment.groupName);
    } else {
      hasUngrouped = true;
    }
  }

  const namedGroupEntries = [...namedGroups.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const useClassColumn = namedGroupEntries.length === 0;
  const groupNames = useClassColumn
    ? [options.classColumn]
    : [
        ...namedGroupEntries.map(([, name]) => name),
        ...(hasUngrouped ? [options.ungroupedColumn] : []),
      ];

  const columnIndexByKey = new Map<string, number>();
  if (useClassColumn) {
    columnIndexByKey.set("class", 0);
  } else {
    namedGroupEntries.forEach(([groupId], index) => {
      columnIndexByKey.set(groupId, index);
    });
    if (hasUngrouped) {
      columnIndexByKey.set("ungrouped", namedGroupEntries.length);
    }
  }

  const itemOrder =
    run.itemsSnapshot.length > 0
      ? run.itemsSnapshot
      : [...new Set(run.assignments.map((row) => row.item))];

  const rows = itemOrder.map((item) => {
    const buckets: Array<
      Array<{
        studentDisplayName?: string;
        rosterNumber?: number;
        firstName?: string;
        lastName?: string;
        label: string;
      }>
    > = groupNames.map(() => []);

    for (const assignment of run.assignments) {
      if (assignment.item !== item) continue;
      const key = useClassColumn
        ? "class"
        : assignment.groupId && assignment.groupName
          ? assignment.groupId
          : assignment.groupName
            ? assignment.groupName
            : "ungrouped";
      const columnIndex = columnIndexByKey.get(key);
      if (columnIndex === undefined) continue;
      buckets[columnIndex]?.push({
        studentDisplayName: assignment.studentDisplayName,
        rosterNumber: assignment.rosterNumber,
        firstName: assignment.firstName,
        lastName: assignment.lastName,
        label: formatRandomAssignerPrintStudent(assignment, options.nameFormat),
      });
    }

    return {
      item,
      cells: buckets.map((bucket) =>
        [...bucket].sort(comparePrintStudents).map((student) => student.label),
      ),
    };
  });

  return { groupNames, rows };
}

export function buildRandomAssignerPrintHtml(
  run: AssignerPrintRunInput,
  labels: RandomAssignerPrintLabels,
  logoUrl: string,
  nameFormat: RosterNameFormat,
): string {
  const matrix = buildRandomAssignerPrintMatrix(run, {
    classColumn: labels.classColumn,
    ungroupedColumn: labels.ungroupedColumn,
    nameFormat,
  });

  const headerCells = [
    `<th>${escapePrintHtml(labels.itemColumn)}</th>`,
    ...matrix.groupNames.map((name) => `<th>${escapePrintHtml(name)}</th>`),
  ].join("");

  const bodyRows = matrix.rows
    .map((row) => {
      const cells = row.cells
        .map(
          (students) =>
            `<td>${students.map((student) => escapePrintHtml(student)).join("<br />")}</td>`,
        )
        .join("");
      return `<tr><td>${escapePrintHtml(row.item)}</td>${cells}</tr>`;
    })
    .join("");

  return `${buildPrintDocumentOpen({
    title: labels.documentTitle,
    bodyClass: "print-table-assigner",
    lang: "en",
  })}
  <div class="brand">
    <img src="${escapePrintHtml(logoUrl)}" alt="${escapePrintHtml(labels.logoAlt)}" width="169" height="53" />
  </div>
  <h1>${escapePrintHtml(labels.heading)}</h1>
  <p class="meta">${escapePrintHtml(labels.subtitle)}</p>
  <table>
    <thead>
      <tr>${headerCells}</tr>
    </thead>
    <tbody>${bodyRows}</tbody>
  </table>${buildPrintDocumentClose()}`;
}

export async function printRandomAssignerRun(
  run: AssignerPrintRunInput,
  labels: RandomAssignerPrintLabels,
  nameFormat: RosterNameFormat,
): Promise<void> {
  const logoUrl = resolveAppAssetUrl(RANDOM_ASSIGNER_PRINT_LOGO_PATH);
  const html = buildRandomAssignerPrintHtml(run, labels, logoUrl, nameFormat);
  await printHtmlDocument({ documentTitle: labels.documentTitle, html });
}
