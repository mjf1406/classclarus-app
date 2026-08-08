import { useTranslation } from "react-i18next";

import { useExpectationRowEdit } from "@/components/expectations/expectationRowEditContext";
import { NumberInput } from "@/components/ui/number-input";
import {
  formatExpectationValue,
  type ExpectationListItem,
  type ExpectationValue,
} from "@/lib/expectations/expectations";
import type { Id } from "../../../convex/_generated/dataModel";

export type ExpectationValueDraftFields = {
  numberValue: number;
  rangeMin: number;
  rangeMax: number;
};

type ExpectationInlineValueCellProps = {
  expectation: ExpectationListItem;
  studentUserId: Id<"users">;
  value: ExpectationValue | undefined;
};

export function ExpectationInlineValueCell({
  expectation,
  studentUserId,
  value,
}: ExpectationInlineValueCellProps) {
  const { t } = useTranslation("expectations");
  const { editingUserId, draftByExpectationId, setDraft } = useExpectationRowEdit();
  const isEditing = editingUserId === studentUserId;
  const draft = draftByExpectationId[expectation._id];

  if (!isEditing || !draft) {
    return (
      <span className="tabular-nums">
        {formatExpectationValue(expectation, value, t("rosterUnset"))}
      </span>
    );
  }

  if (expectation.inputType === "number") {
    return (
      <NumberInput
        id={`expectation-${expectation._id}-${studentUserId}`}
        aria-label={`${expectation.name} (${expectation.unit})`}
        value={draft.numberValue}
        className="max-w-full"
        onValueChange={(numberValue) => setDraft(expectation._id, { ...draft, numberValue })}
      />
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <NumberInput
        id={`expectation-min-${expectation._id}-${studentUserId}`}
        aria-label={`${expectation.name} ${t("rangeMinLabel")} (${expectation.unit})`}
        value={draft.rangeMin}
        className="max-w-full"
        onValueChange={(rangeMin) => setDraft(expectation._id, { ...draft, rangeMin })}
      />
      <span className="text-muted-foreground" aria-hidden>
        –
      </span>
      <NumberInput
        id={`expectation-max-${expectation._id}-${studentUserId}`}
        aria-label={`${expectation.name} ${t("rangeMaxLabel")} (${expectation.unit})`}
        value={draft.rangeMax}
        className="max-w-full"
        onValueChange={(rangeMax) => setDraft(expectation._id, { ...draft, rangeMax })}
      />
    </div>
  );
}
