import { useTranslation } from "react-i18next";

import { WorksheetImagePreview } from "@/components/upload/WorksheetImagePreview";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { FileDropzone } from "@/components/upload/FileDropzone";
import type { Id } from "../../../convex/_generated/dataModel";

type WorksheetImageFieldProps = {
  classId: Id<"classes">;
  fileId?: Id<"files">;
  onChange: (fileId: Id<"files"> | undefined) => void;
  label: string;
  description: string;
  removeLabel: string;
  previewAlt: string;
};

export function WorksheetImageField({
  classId,
  fileId,
  onChange,
  label,
  description,
  removeLabel,
  previewAlt,
}: WorksheetImageFieldProps) {
  const { t: tCommon } = useTranslation("common");

  return (
    <Field>
      <FieldLabel>
        {label}
        <span className="font-normal text-muted-foreground">({tCommon("optional")})</span>
      </FieldLabel>
      <FieldDescription>{description}</FieldDescription>
      <div className="flex flex-col gap-3">
        {fileId !== undefined ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <WorksheetImagePreview fileId={fileId} alt={previewAlt} variant="form" />
            <Button type="button" variant="outline" size="sm" onClick={() => onChange(undefined)}>
              {removeLabel}
            </Button>
          </div>
        ) : null}
        <FileDropzone
          title={label}
          variant="compact"
          presetKey="images"
          classId={classId}
          multiple={false}
          onUploaded={onChange}
        />
      </div>
    </Field>
  );
}
