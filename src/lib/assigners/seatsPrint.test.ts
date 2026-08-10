import { describe, expect, test } from "vite-plus/test";

import { SEAT_CANVAS_GRID_SIZE } from "@/lib/assigners/seatLayouts";

import {
  buildSeatsPrintHtml,
  chunkOrientations,
  computeSeatsPrintCrop,
  prepareSeatsForPrint,
  stageMaxForPerPage,
} from "./seatsPrint";

const orientationLabels = {
  front: "Perspective: Front",
  back: "Perspective: Back",
  left: "Perspective: Left",
  right: "Perspective: Right",
} as const;

describe("computeSeatsPrintCrop", () => {
  test("pads content by one grid cell and clamps to canvas", () => {
    const crop = computeSeatsPrintCrop([{ x: 100, y: 80, width: 80, height: 60 }], 1200, 800);
    expect(crop).toEqual({
      offsetX: 100 - SEAT_CANVAS_GRID_SIZE,
      offsetY: 80 - SEAT_CANVAS_GRID_SIZE,
      width: 80 + SEAT_CANVAS_GRID_SIZE * 2,
      height: 60 + SEAT_CANVAS_GRID_SIZE * 2,
    });
  });

  test("clamps padding at canvas edges", () => {
    const crop = computeSeatsPrintCrop([{ x: 0, y: 0, width: 40, height: 40 }], 200, 200);
    expect(crop).toEqual({
      offsetX: 0,
      offsetY: 0,
      width: 40 + SEAT_CANVAS_GRID_SIZE,
      height: 40 + SEAT_CANVAS_GRID_SIZE,
    });
  });

  test("falls back to full canvas when empty", () => {
    expect(computeSeatsPrintCrop([], 400, 300)).toEqual({
      offsetX: 0,
      offsetY: 0,
      width: 400,
      height: 300,
    });
  });
});

describe("prepareSeatsForPrint", () => {
  test("crops, offsets, and scales items up", () => {
    const prepared = prepareSeatsForPrint({
      canvasWidth: 1200,
      canvasHeight: 800,
      orientation: "front",
      items: [
        {
          id: "d1",
          kind: "desk",
          label: "A",
          deskNumber: 1,
          x: 100,
          y: 80,
          width: 80,
          height: 60,
        },
      ],
    });

    expect(prepared.scale).toBeGreaterThan(1);
    expect(prepared.canvasWidth).toBeCloseTo((80 + SEAT_CANVAS_GRID_SIZE * 2) * prepared.scale);
    expect(prepared.canvasHeight).toBeCloseTo((60 + SEAT_CANVAS_GRID_SIZE * 2) * prepared.scale);
    expect(prepared.items[0]?.x).toBeCloseTo(SEAT_CANVAS_GRID_SIZE * prepared.scale);
    expect(prepared.items[0]?.y).toBeCloseTo(SEAT_CANVAS_GRID_SIZE * prepared.scale);
  });

  test("shrinks scale when stage max is reduced", () => {
    const full = prepareSeatsForPrint({
      canvasWidth: 1200,
      canvasHeight: 800,
      orientation: "front",
      items: [
        {
          id: "d1",
          kind: "desk",
          label: "A",
          deskNumber: 1,
          x: 100,
          y: 80,
          width: 80,
          height: 60,
        },
      ],
    });
    const tiled = prepareSeatsForPrint({
      canvasWidth: 1200,
      canvasHeight: 800,
      orientation: "front",
      maxWidth: stageMaxForPerPage(4).maxWidth,
      maxHeight: stageMaxForPerPage(4).maxHeight,
      items: [
        {
          id: "d1",
          kind: "desk",
          label: "A",
          deskNumber: 1,
          x: 100,
          y: 80,
          width: 80,
          height: 60,
        },
      ],
    });
    expect(tiled.scale).toBeLessThan(full.scale);
  });
});

describe("chunkOrientations", () => {
  test("chunks by perPage", () => {
    expect(chunkOrientations(["front", "back", "left", "right"], 2)).toEqual([
      ["front", "back"],
      ["left", "right"],
    ]);
    expect(chunkOrientations(["front", "back", "left"], 4)).toEqual([["front", "back", "left"]]);
  });
});

describe("buildSeatsPrintHtml", () => {
  test("includes branding, orientation transform, and desk number", () => {
    const html = buildSeatsPrintHtml(
      {
        canvasWidth: 400,
        canvasHeight: 300,
        orientations: ["back"],
        perPage: 1,
        items: [
          {
            id: "d1",
            kind: "desk",
            label: "",
            deskNumber: 3,
            teamLabel: "Red",
            x: 10,
            y: 20,
            width: 80,
            height: 60,
          },
        ],
      },
      {
        documentTitle: "Seats",
        heading: "Room A",
        subtitle: "Class 1",
        logoAlt: "Logo",
        orientationLabels,
      },
      "https://example.com/logo.webp",
    );
    expect(html).toContain("https://example.com/logo.webp");
    expect(html).toContain("transform:rotate(180deg)");
    expect(html).toContain("transform:rotate(-180deg)");
    expect(html).toContain("desk-num");
    expect(html).toContain(">3<");
    expect(html).toContain("Red");
    expect(html).toContain("Room A");
    expect(html).toContain("Perspective: Back");
    expect(html).toContain("grid-1");
  });

  test("renders multiple pages and tiles for selected perspectives", () => {
    const html = buildSeatsPrintHtml(
      {
        canvasWidth: 400,
        canvasHeight: 300,
        orientations: ["front", "back", "left", "right"],
        perPage: 2,
        items: [
          {
            id: "d1",
            kind: "desk",
            label: "A",
            deskNumber: 1,
            x: 10,
            y: 20,
            width: 80,
            height: 60,
          },
        ],
      },
      {
        documentTitle: "Seats",
        heading: "Room A",
        subtitle: "Class 1",
        logoAlt: "Logo",
        orientationLabels,
      },
      "https://example.com/logo.webp",
    );
    expect(html.match(/class="page/g)?.length).toBe(2);
    expect(html.match(/class="tile"/g)?.length).toBe(4);
    expect(html).toContain("grid-2");
    expect(html).toContain("Perspective: Front");
    expect(html).toContain("Perspective: Right");
    expect(html).toContain("page-break-after: always");
  });

  test("uses 2x2 grid for four per page", () => {
    const html = buildSeatsPrintHtml(
      {
        canvasWidth: 400,
        canvasHeight: 300,
        orientations: ["front", "back", "left", "right"],
        perPage: 4,
        items: [],
      },
      {
        documentTitle: "Seats",
        heading: "Room A",
        subtitle: "Class 1",
        logoAlt: "Logo",
        orientationLabels,
      },
      "https://example.com/logo.webp",
    );
    expect(html.match(/class="page/g)?.length).toBe(1);
    expect(html.match(/class="tile"/g)?.length).toBe(4);
    expect(html).toContain("grid-4");
  });
});
