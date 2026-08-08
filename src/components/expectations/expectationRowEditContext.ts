import { createContext, useContext } from "react";

import type { ExpectationValueDraftFields } from "@/components/expectations/ExpectationInlineValueCell";
import type { Id } from "../../../convex/_generated/dataModel";

export type ExpectationRowEditContextValue = {
  editingUserId: Id<"users"> | null;
  draftByExpectationId: Record<string, ExpectationValueDraftFields>;
  setDraft: (expectationId: Id<"expectations">, next: ExpectationValueDraftFields) => void;
  startEdit: (studentUserId: Id<"users">) => void;
  cancelEdit: () => void;
  saveEdit: (studentUserId: Id<"users">) => void;
};

export const ExpectationRowEditContext = createContext<ExpectationRowEditContextValue | null>(null);

export function useExpectationRowEdit(): ExpectationRowEditContextValue {
  const ctx = useContext(ExpectationRowEditContext);
  if (!ctx) {
    throw new Error("useExpectationRowEdit must be used within ExpectationRowEditProvider");
  }
  return ctx;
}
