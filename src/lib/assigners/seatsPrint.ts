import { APP_CONFIG } from "@/config/app";
import {
  SEAT_CANVAS_GRID_SIZE,
  SEAT_ORIENTATION_DEGREES,
  type SeatLayoutItem,
  type SeatOrientation,
} from "@/lib/assigners/seatLayouts";
import {
  buildPrintDocumentClose,
  buildPrintDocumentOpen,
  escapePrintHtml,
  resolveAppAssetUrl,
} from "@/lib/print/printDocument";
import { printHtmlDocument } from "@/lib/print/printFrame";

export const SEATS_PRINT_LOGO_PATH = "/brand/logo/icon-and-text-horizontal.webp";

/** Approx printable stage area (A4, 12mm margins, after brand/header). */
const PRINT_STAGE_MAX_WIDTH = 700;
const PRINT_STAGE_MAX_HEIGHT = 860;
const PRINT_TILE_GAP = 16;
const PRINT_TILE_CAPTION_HEIGHT = 22;

export type SeatsPrintPerPage = 1 | 2 | 4;

export type SeatsPrintLabels = {
  documentTitle: string;
  heading: string;
  subtitle: string;
  logoAlt: string;
  orientationLabels: Record<SeatOrientation, string>;
};

export type SeatsPrintItem = SeatLayoutItem & {
  teamLabel?: string;
  zoneLabel?: string;
  studentLabel?: string;
};

export type SeatsPrintCrop = {
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
};

export type SeatsPrintOptions = {
  canvasWidth: number;
  canvasHeight: number;
  orientations: Array<SeatOrientation>;
  perPage: SeatsPrintPerPage;
  items: Array<SeatsPrintItem>;
};

type SeatsPrintBoundsItem = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Crop box around content with one grid cell of padding, clamped to the canvas.
 * Empty layouts keep the full canvas.
 */
export function computeSeatsPrintCrop(
  items: Array<SeatsPrintBoundsItem>,
  canvasWidth: number,
  canvasHeight: number,
  padding: number = SEAT_CANVAS_GRID_SIZE,
): SeatsPrintCrop {
  if (items.length === 0 || canvasWidth <= 0 || canvasHeight <= 0) {
    return {
      offsetX: 0,
      offsetY: 0,
      width: Math.max(1, canvasWidth),
      height: Math.max(1, canvasHeight),
    };
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const item of items) {
    minX = Math.min(minX, item.x);
    minY = Math.min(minY, item.y);
    maxX = Math.max(maxX, item.x + item.width);
    maxY = Math.max(maxY, item.y + item.height);
  }

  const offsetX = Math.max(0, Math.min(canvasWidth, minX - padding));
  const offsetY = Math.max(0, Math.min(canvasHeight, minY - padding));
  const right = Math.max(offsetX, Math.min(canvasWidth, maxX + padding));
  const bottom = Math.max(offsetY, Math.min(canvasHeight, maxY + padding));

  return {
    offsetX,
    offsetY,
    width: Math.max(1, right - offsetX),
    height: Math.max(1, bottom - offsetY),
  };
}

export function stageMaxForPerPage(perPage: SeatsPrintPerPage): {
  maxWidth: number;
  maxHeight: number;
} {
  if (perPage === 1) {
    return { maxWidth: PRINT_STAGE_MAX_WIDTH, maxHeight: PRINT_STAGE_MAX_HEIGHT };
  }
  if (perPage === 2) {
    return {
      maxWidth: PRINT_STAGE_MAX_WIDTH,
      maxHeight: Math.floor(
        (PRINT_STAGE_MAX_HEIGHT - PRINT_TILE_GAP - PRINT_TILE_CAPTION_HEIGHT * 2) / 2,
      ),
    };
  }
  return {
    maxWidth: Math.floor((PRINT_STAGE_MAX_WIDTH - PRINT_TILE_GAP) / 2),
    maxHeight: Math.floor(
      (PRINT_STAGE_MAX_HEIGHT - PRINT_TILE_GAP - PRINT_TILE_CAPTION_HEIGHT * 2) / 2,
    ),
  };
}

/**
 * Crop to content (+ one grid pad) and scale up to fill the printable stage area.
 */
export function prepareSeatsForPrint(args: {
  canvasWidth: number;
  canvasHeight: number;
  orientation: SeatOrientation;
  items: Array<SeatsPrintItem>;
  padding?: number;
  maxWidth?: number;
  maxHeight?: number;
}): {
  canvasWidth: number;
  canvasHeight: number;
  items: Array<SeatsPrintItem>;
  scale: number;
} {
  const crop = computeSeatsPrintCrop(
    args.items,
    args.canvasWidth,
    args.canvasHeight,
    args.padding ?? SEAT_CANVAS_GRID_SIZE,
  );

  const maxWidth = args.maxWidth ?? PRINT_STAGE_MAX_WIDTH;
  const maxHeight = args.maxHeight ?? PRINT_STAGE_MAX_HEIGHT;
  const degrees = SEAT_ORIENTATION_DEGREES[args.orientation];
  const isSideView = degrees === 90 || degrees === 270;
  const layoutWidth = isSideView ? crop.height : crop.width;
  const layoutHeight = isSideView ? crop.width : crop.height;
  const rawScale = Math.min(maxWidth / layoutWidth, maxHeight / layoutHeight);
  const scale = Number.isFinite(rawScale) && rawScale > 0 ? rawScale : 1;

  return {
    canvasWidth: crop.width * scale,
    canvasHeight: crop.height * scale,
    scale,
    items: args.items.map((item) => ({
      ...item,
      x: (item.x - crop.offsetX) * scale,
      y: (item.y - crop.offsetY) * scale,
      width: item.width * scale,
      height: item.height * scale,
    })),
  };
}

export function chunkOrientations(
  orientations: Array<SeatOrientation>,
  perPage: SeatsPrintPerPage,
): Array<Array<SeatOrientation>> {
  if (orientations.length === 0) return [];
  const pages: Array<Array<SeatOrientation>> = [];
  for (let i = 0; i < orientations.length; i += perPage) {
    pages.push(orientations.slice(i, i + perPage));
  }
  return pages;
}

function itemHtml(item: SeatsPrintItem, scale: number, degrees: number): string {
  const kindClass =
    item.kind === "desk"
      ? "desk"
      : item.kind === "teacherDesk"
        ? "teacher"
        : item.kind === "board"
          ? "board"
          : "rect";
  const fontPx = Math.max(7, Math.round(8 * scale));
  const deskNumPx = Math.max(7, Math.round(8 * scale));
  const teamPx = Math.max(6, Math.round(7 * scale));
  const zonePx = Math.max(6, Math.round(7 * scale));
  const labelPadTop = Math.max(8, Math.round(10 * scale));
  const labelPadX = Math.max(2, Math.round(4 * scale));
  const displayLabel = item.studentLabel?.trim() || item.label.trim();
  return `<div class="item ${kindClass}" style="left:${item.x}px;top:${item.y}px;width:${item.width}px;height:${item.height}px;font-size:${fontPx}px">
    ${item.kind === "desk" && item.deskNumber !== undefined ? `<span class="desk-num" style="font-size:${deskNumPx}px;transform:rotate(${-degrees}deg)">${item.deskNumber}</span>` : ""}
    <span class="item-label" style="padding:${labelPadTop}px ${labelPadX}px 4px;transform:rotate(${-degrees}deg)">${escapePrintHtml(displayLabel)}</span>
    ${item.teamLabel ? `<span class="team" style="font-size:${teamPx}px;transform:rotate(${-degrees}deg)">${escapePrintHtml(item.teamLabel)}</span>` : ""}
    ${item.zoneLabel ? `<span class="zone" style="font-size:${zonePx}px;transform:rotate(${-degrees}deg)">${escapePrintHtml(item.zoneLabel)}</span>` : ""}
  </div>`;
}

function tileHtml(
  args: {
    canvasWidth: number;
    canvasHeight: number;
    orientation: SeatOrientation;
    items: Array<SeatsPrintItem>;
    maxWidth: number;
    maxHeight: number;
  },
  orientationLabel: string,
): string {
  const prepared = prepareSeatsForPrint(args);
  const degrees = SEAT_ORIENTATION_DEGREES[args.orientation];
  const items = prepared.items.map((item) => itemHtml(item, prepared.scale, degrees)).join("\n");
  return `<div class="tile">
  <p class="tile-caption">${escapePrintHtml(orientationLabel)}</p>
  <div class="stage-wrap">
    <div class="stage" style="width:${prepared.canvasWidth}px;height:${prepared.canvasHeight}px;transform:rotate(${degrees}deg)">${items}</div>
  </div>
</div>`;
}

export function buildSeatsPrintHtml(
  args: SeatsPrintOptions,
  labels: SeatsPrintLabels,
  logoUrl: string,
): string {
  const orientations =
    args.orientations.length > 0 ? args.orientations : (["front"] as Array<SeatOrientation>);
  const pages = chunkOrientations(orientations, args.perPage);
  const { maxWidth, maxHeight } = stageMaxForPerPage(args.perPage);
  const gridClass = args.perPage === 1 ? "grid-1" : args.perPage === 2 ? "grid-2" : "grid-4";

  const pagesHtml = pages
    .map((pageOrientations, pageIndex) => {
      const tiles = pageOrientations
        .map((orientation) =>
          tileHtml(
            {
              canvasWidth: args.canvasWidth,
              canvasHeight: args.canvasHeight,
              orientation,
              items: args.items,
              maxWidth,
              maxHeight,
            },
            labels.orientationLabels[orientation],
          ),
        )
        .join("\n");
      const isLast = pageIndex === pages.length - 1;
      return `<section class="page${isLast ? " page-last" : ""}">
  <div class="brand">
    <img src="${escapePrintHtml(logoUrl)}" alt="${escapePrintHtml(labels.logoAlt)}" width="169" height="53" />
  </div>
  <h1>${escapePrintHtml(labels.heading)}</h1>
  <p class="meta">${escapePrintHtml(labels.subtitle)}</p>
  <div class="tiles ${gridClass}">${tiles}</div>
</section>`;
    })
    .join("\n");

  return `${buildPrintDocumentOpen({ title: labels.documentTitle, bodyClass: "print-seats" })}
${pagesHtml}${buildPrintDocumentClose()}`;
}

export async function printSeatLayout(
  args: SeatsPrintOptions,
  labels: SeatsPrintLabels,
): Promise<void> {
  const logoUrl = resolveAppAssetUrl(SEATS_PRINT_LOGO_PATH);
  const html = buildSeatsPrintHtml(args, labels, logoUrl);
  await printHtmlDocument({ documentTitle: labels.documentTitle, html });
}

export function seatsPrintLogoAlt(): string {
  return `${APP_CONFIG.name} Logo`;
}
