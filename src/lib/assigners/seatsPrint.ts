import { APP_CONFIG } from "@/config/app";
import {
  SEAT_CANVAS_GRID_SIZE,
  SEAT_ORIENTATION_DEGREES,
  type SeatLayoutItem,
  type SeatOrientation,
} from "@/lib/assigners/seatLayouts";

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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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
    <span class="item-label" style="padding:${labelPadTop}px ${labelPadX}px 4px;transform:rotate(${-degrees}deg)">${escapeHtml(displayLabel)}</span>
    ${item.teamLabel ? `<span class="team" style="font-size:${teamPx}px;transform:rotate(${-degrees}deg)">${escapeHtml(item.teamLabel)}</span>` : ""}
    ${item.zoneLabel ? `<span class="zone" style="font-size:${zonePx}px;transform:rotate(${-degrees}deg)">${escapeHtml(item.zoneLabel)}</span>` : ""}
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
  <p class="tile-caption">${escapeHtml(orientationLabel)}</p>
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
    <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(labels.logoAlt)}" width="169" height="53" />
  </div>
  <h1>${escapeHtml(labels.heading)}</h1>
  <p class="meta">${escapeHtml(labels.subtitle)}</p>
  <div class="tiles ${gridClass}">${tiles}</div>
</section>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(labels.documentTitle)}</title>
  <style>
    @page { margin: 12mm; }
    body {
      margin: 0;
      font-family: system-ui, -apple-system, Segoe UI, sans-serif;
      color: #18181b;
    }
    .page {
      break-after: page;
      page-break-after: always;
    }
    .page-last {
      break-after: auto;
      page-break-after: auto;
    }
    .brand { margin-bottom: 10px; }
    h1 { font-size: 16px; margin: 0 0 4px; }
    .meta { margin: 0 0 10px; color: #52525b; font-size: 11px; }
    .tiles {
      display: grid;
      gap: ${PRINT_TILE_GAP}px;
      width: 100%;
    }
    .tiles.grid-1 { grid-template-columns: 1fr; }
    .tiles.grid-2 { grid-template-columns: 1fr; }
    .tiles.grid-4 { grid-template-columns: 1fr 1fr; }
    .tile { min-width: 0; }
    .tile-caption {
      margin: 0 0 4px;
      color: #52525b;
      font-size: 10px;
      font-weight: 600;
    }
    .stage-wrap {
      display: flex;
      justify-content: center;
      align-items: center;
      overflow: hidden;
    }
    .stage {
      position: relative;
      border: 1px solid #d4d4d8;
      background: #fafafa;
      transform-origin: center center;
    }
    .item {
      position: absolute;
      box-sizing: border-box;
      border: 1px solid #71717a;
      background: #fff;
    }
    .item.desk { background: #eff6ff; }
    .item.teacher { background: #fef3c7; }
    .item.board { background: #ecfccb; }
    .desk-num {
      position: absolute;
      top: 2px;
      left: 4px;
      font-weight: 700;
      transform-origin: center center;
    }
    .item-label {
      display: block;
      text-align: center;
      word-break: break-word;
      line-height: 1.15;
      transform-origin: center center;
    }
    .team,
    .zone {
      display: block;
      text-align: center;
      color: #3f3f46;
      line-height: 1.15;
      padding: 0 3px 3px;
      transform-origin: center center;
    }
  </style>
</head>
<body>
${pagesHtml}
</body>
</html>`;
}

function waitForImages(doc: Document): Promise<void> {
  const images = [...doc.images];
  if (images.length === 0) return Promise.resolve();
  return Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          if (image.complete) {
            resolve();
            return;
          }
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        }),
    ),
  ).then(() => undefined);
}

export async function printSeatLayout(
  args: SeatsPrintOptions,
  labels: SeatsPrintLabels,
): Promise<void> {
  const logoUrl = new URL(SEATS_PRINT_LOGO_PATH, window.location.origin).href;
  const html = buildSeatsPrintHtml(args, labels, logoUrl);

  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", labels.documentTitle);
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "0",
    height: "0",
    border: "0",
    opacity: "0",
    pointerEvents: "none",
  });
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDocument = iframe.contentDocument;
  if (!frameWindow || !frameDocument) {
    iframe.remove();
    throw new Error("Could not open print frame");
  }

  frameDocument.open();
  frameDocument.write(html);
  frameDocument.close();

  try {
    await waitForImages(frameDocument);
    const cleanup = () => {
      iframe.remove();
    };
    frameWindow.addEventListener("afterprint", cleanup, { once: true });
    window.setTimeout(cleanup, 60_000);
    frameWindow.focus();
    frameWindow.print();
  } catch (error) {
    iframe.remove();
    throw error;
  }
}

export function seatsPrintLogoAlt(): string {
  return `${APP_CONFIG.name} Logo`;
}
