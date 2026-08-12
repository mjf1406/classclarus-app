import { z } from "zod";

import {
  equitableGenderBucketsSchema,
  normalizeEquitableGenderBuckets,
  type EquitableGenderBucket,
} from "./equitableGenderBuckets.js";

export const MAX_EQUITABLE_ASSIGNER_NAME_LENGTH = 100;
export const MAX_EQUITABLE_ASSIGNER_ITEMS = 200;
export const MAX_EQUITABLE_ASSIGNER_ITEM_LENGTH = 120;
export const MIN_EQUITABLE_ASSIGNER_ITEMS = 1;

export type EquitableAssignerScope = "class" | "groups";

export type EquitableAssignerMessages = {
  nameRequired: string;
  nameTooLong: string;
  itemsRequired: string;
  tooManyItems: string;
  itemRequired: string;
  itemTooLong: string;
  duplicateItem: string;
  genderBucketsRequired: string;
};

export const EQUITABLE_ASSIGNER_MESSAGES_EN: EquitableAssignerMessages = {
  nameRequired: "Name is required",
  nameTooLong: `Name must be at most ${MAX_EQUITABLE_ASSIGNER_NAME_LENGTH} characters`,
  itemsRequired: "Add at least one item",
  tooManyItems: `At most ${MAX_EQUITABLE_ASSIGNER_ITEMS} items`,
  itemRequired: "Item cannot be empty",
  itemTooLong: `Item must be at most ${MAX_EQUITABLE_ASSIGNER_ITEM_LENGTH} characters`,
  duplicateItem: "Each item must be unique",
  genderBucketsRequired: "Select at least one gender bucket",
};

export function createEquitableAssignerItemSchema(messages: EquitableAssignerMessages) {
  return z
    .string()
    .trim()
    .min(1, messages.itemRequired)
    .max(MAX_EQUITABLE_ASSIGNER_ITEM_LENGTH, messages.itemTooLong);
}

export function createEquitableAssignerItemsSchema(messages: EquitableAssignerMessages) {
  const itemSchema = createEquitableAssignerItemSchema(messages);
  return z
    .array(itemSchema)
    .min(MIN_EQUITABLE_ASSIGNER_ITEMS, messages.itemsRequired)
    .max(MAX_EQUITABLE_ASSIGNER_ITEMS, messages.tooManyItems)
    .superRefine((items, ctx) => {
      const seen = new Set<string>();
      for (const item of items) {
        const key = item.toLocaleLowerCase();
        if (seen.has(key)) {
          ctx.addIssue({ code: "custom", message: messages.duplicateItem });
          return;
        }
        seen.add(key);
      }
    });
}

export function createEquitableAssignerNameSchema(messages: EquitableAssignerMessages) {
  return z
    .string()
    .trim()
    .min(1, messages.nameRequired)
    .max(MAX_EQUITABLE_ASSIGNER_NAME_LENGTH, messages.nameTooLong);
}

export function createEquitableAssignerScopeSchema() {
  return z.union([z.literal("class"), z.literal("groups")]);
}

export function createEquitableAssignerGenderBucketsSchema(messages: EquitableAssignerMessages) {
  return equitableGenderBucketsSchema.refine((buckets) => buckets.length > 0, {
    message: messages.genderBucketsRequired,
  });
}

export function createEquitableAssignerFormSchema(messages: EquitableAssignerMessages) {
  return z.object({
    name: createEquitableAssignerNameSchema(messages),
    items: createEquitableAssignerItemsSchema(messages),
    defaultBalanceGender: z.boolean(),
    defaultScope: createEquitableAssignerScopeSchema(),
    defaultGenderBuckets: createEquitableAssignerGenderBucketsSchema(messages),
  });
}

export const equitableAssignerFormSchemaEn = createEquitableAssignerFormSchema(
  EQUITABLE_ASSIGNER_MESSAGES_EN,
);

export type EquitableAssignerFormValues = z.infer<typeof equitableAssignerFormSchemaEn>;

export function normalizeStoredGenderBuckets(
  buckets: ReadonlyArray<EquitableGenderBucket> | undefined,
): EquitableGenderBucket[] {
  return normalizeEquitableGenderBuckets(buckets);
}
