import { z } from "zod";

import type { Id } from "../../../convex/_generated/dataModel";

export { isOptimisticId } from "@/lib/optimistic";

export const groupFormSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
  icon: z.string().trim().max(64).optional(),
});

export type GroupFormSchemaValues = z.infer<typeof groupFormSchema> & {
  /** Pending image for create mode (edit uses set/clear mutations immediately). */
  imageFileId?: Id<"files">;
  /** Team create only — also create this team in these other groups. */
  alsoCreateInGroupIds?: Array<Id<"groups">>;
};

export type AlsoCreateInGroupOption = {
  value: Id<"groups">;
  label: string;
};
