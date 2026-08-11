import { z } from "zod";

export const MAX_RANDOM_ASSIGNER_NAME_LENGTH = 100;
export const MAX_RANDOM_ASSIGNER_ITEMS = 200;
export const MAX_RANDOM_ASSIGNER_ITEM_LENGTH = 120;
export const MIN_RANDOM_ASSIGNER_ITEMS = 1;

export type RandomAssignerScope = "class" | "groups";

export type RandomAssignerMessages = {
  nameRequired: string;
  nameTooLong: string;
  itemsRequired: string;
  tooManyItems: string;
  itemRequired: string;
  itemTooLong: string;
  duplicateItem: string;
};

export const RANDOM_ASSIGNER_MESSAGES_EN: RandomAssignerMessages = {
  nameRequired: "Name is required",
  nameTooLong: `Name must be at most ${MAX_RANDOM_ASSIGNER_NAME_LENGTH} characters`,
  itemsRequired: "Add at least one item",
  tooManyItems: `At most ${MAX_RANDOM_ASSIGNER_ITEMS} items`,
  itemRequired: "Item cannot be empty",
  itemTooLong: `Item must be at most ${MAX_RANDOM_ASSIGNER_ITEM_LENGTH} characters`,
  duplicateItem: "Each item must be unique",
};

export function createRandomAssignerItemSchema(messages: RandomAssignerMessages) {
  return z
    .string()
    .trim()
    .min(1, messages.itemRequired)
    .max(MAX_RANDOM_ASSIGNER_ITEM_LENGTH, messages.itemTooLong);
}

export function createRandomAssignerItemsSchema(messages: RandomAssignerMessages) {
  const itemSchema = createRandomAssignerItemSchema(messages);
  return z
    .array(itemSchema)
    .min(MIN_RANDOM_ASSIGNER_ITEMS, messages.itemsRequired)
    .max(MAX_RANDOM_ASSIGNER_ITEMS, messages.tooManyItems)
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

export function createRandomAssignerNameSchema(messages: RandomAssignerMessages) {
  return z
    .string()
    .trim()
    .min(1, messages.nameRequired)
    .max(MAX_RANDOM_ASSIGNER_NAME_LENGTH, messages.nameTooLong);
}

export function createRandomAssignerScopeSchema() {
  return z.union([z.literal("class"), z.literal("groups")]);
}

export function createRandomAssignerFormSchema(messages: RandomAssignerMessages) {
  return z.object({
    name: createRandomAssignerNameSchema(messages),
    items: createRandomAssignerItemsSchema(messages),
    defaultReplicates: z.boolean(),
    defaultScope: createRandomAssignerScopeSchema(),
  });
}

export const randomAssignerFormSchemaEn = createRandomAssignerFormSchema(
  RANDOM_ASSIGNER_MESSAGES_EN,
);

export type RandomAssignerFormValues = z.infer<typeof randomAssignerFormSchemaEn>;
