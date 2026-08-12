import { describe, expect, it } from "vite-plus/test";

import { internal } from "./_generated/api";
import { createConvexTest } from "./test.setup";

describe("seatLayoutGenderParityBackfill", () => {
  it("copies class settings onto layouts missing genderParity", async () => {
    const test = createConvexTest();

    const { offLayoutId, oddLayoutId, defaultLayoutId, alreadySetId } = await test.run(
      async (ctx) => {
        const ownerId = await ctx.db.insert("users", {
          name: "Teacher",
          email: "teacher-parity@example.com",
        });
        const classOff = await ctx.db.insert("classes", {
          ownerId,
          name: "Parity Off Class",
          year: 2026,
          studentLanguage: "en",
          updatedAt: 1,
        });
        const classOdd = await ctx.db.insert("classes", {
          ownerId,
          name: "Parity Odd Class",
          year: 2026,
          studentLanguage: "en",
          updatedAt: 1,
        });
        const classNone = await ctx.db.insert("classes", {
          ownerId,
          name: "No Settings Class",
          year: 2026,
          studentLanguage: "en",
          updatedAt: 1,
        });

        await ctx.db.insert("seatAlgorithmSettings", {
          classId: classOff,
          weights: {
            seat: 40,
            zone: 40,
            team: 60,
            neighbor: 50,
            gender: 30,
            combination: 35,
          },
          genderParity: { mode: "off" },
          updatedAt: 1,
          updatedBy: ownerId,
        });
        await ctx.db.insert("seatAlgorithmSettings", {
          classId: classOdd,
          weights: {
            seat: 40,
            zone: 40,
            team: 60,
            neighbor: 50,
            gender: 30,
            combination: 35,
          },
          genderParity: { mode: "oddEven" },
          updatedAt: 1,
          updatedBy: ownerId,
        });

        const offLayoutId = await ctx.db.insert("seatLayouts", {
          classId: classOff,
          name: "Off layout",
          canvasWidth: 500,
          canvasHeight: 500,
          nextDeskNumber: 1,
          items: [],
          updatedAt: 1,
          createdBy: ownerId,
        });
        const oddLayoutId = await ctx.db.insert("seatLayouts", {
          classId: classOdd,
          name: "Odd layout",
          canvasWidth: 500,
          canvasHeight: 500,
          nextDeskNumber: 1,
          items: [],
          updatedAt: 1,
          createdBy: ownerId,
        });
        const defaultLayoutId = await ctx.db.insert("seatLayouts", {
          classId: classNone,
          name: "Default layout",
          canvasWidth: 500,
          canvasHeight: 500,
          nextDeskNumber: 1,
          items: [],
          updatedAt: 1,
          createdBy: ownerId,
        });
        const alreadySetId = await ctx.db.insert("seatLayouts", {
          classId: classNone,
          name: "Already set",
          canvasWidth: 500,
          canvasHeight: 500,
          nextDeskNumber: 1,
          items: [],
          genderParity: { mode: "off" },
          updatedAt: 1,
          createdBy: ownerId,
        });

        return { offLayoutId, oddLayoutId, defaultLayoutId, alreadySetId };
      },
    );

    let cursor: string | null = null;
    let isDone = false;
    let patched = 0;
    while (!isDone) {
      const page = await test.mutation(
        internal.seatLayoutGenderParityBackfill.backfillGenderParity,
        {
          cursor: cursor ?? undefined,
        },
      );
      patched += page.patched;
      cursor = page.continueCursor;
      isDone = page.isDone;
    }

    expect(patched).toBe(3);

    await test.run(async (ctx) => {
      expect((await ctx.db.get("seatLayouts", offLayoutId))?.genderParity).toEqual({ mode: "off" });
      expect((await ctx.db.get("seatLayouts", oddLayoutId))?.genderParity).toEqual({
        mode: "oddEven",
      });
      expect((await ctx.db.get("seatLayouts", defaultLayoutId))?.genderParity).toEqual({
        mode: "oddEven",
      });
      expect((await ctx.db.get("seatLayouts", alreadySetId))?.genderParity).toEqual({
        mode: "off",
      });
    });

    let purgeDone = false;
    let purgeCursor: string | null = null;
    let deleted = 0;
    while (!purgeDone) {
      const page = await test.mutation(
        internal.seatLayoutGenderParityBackfill.purgeLegacySettings,
        {
          cursor: purgeCursor ?? undefined,
        },
      );
      deleted += page.deleted;
      purgeCursor = page.continueCursor;
      purgeDone = page.isDone;
    }
    expect(deleted).toBe(2);
  });
});
