import { useTranslation } from "react-i18next";

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { AttachmentList } from "@/components/upload/AttachmentList";
import { FileDropzone } from "@/components/upload/FileDropzone";
import type { ImageDocumentAttachmentItem } from "@/components/upload/useImageDocumentAttachments";
import type { Id } from "../../../convex/_generated/dataModel";

type ImageDocumentAttachmentsFieldProps = {
  classId: Id<"classes">;
  max: number;
  fileIds: Array<Id<"files">>;
  items: Array<ImageDocumentAttachmentItem>;
  onUploaded: (fileId: Id<"files">) => void;
  onRemove: (fileId: Id<"files">) => void;
};

export function ImageDocumentAttachmentsField({
  classId,
  max,
  fileIds,
  items,
  onUploaded,
  onRemove,
}: ImageDocumentAttachmentsFieldProps) {
  const { t } = useTranslation("upload");
  const canAddMore = fileIds.length < max;

  return (
    <Field>
      <FieldLabel>{t("attachmentsLabel")}</FieldLabel>
      <FieldDescription>{t("attachmentsDescription", { max })}</FieldDescription>
      <AttachmentList
        attachments={items.filter((item) => fileIds.includes(item.fileId))}
        onRemove={onRemove}
        className="mt-2"
      />
      {canAddMore ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <FileDropzone
            presetKey="images"
            variant="compact"
            classId={classId}
            multiple
            title={t("attachmentsImages")}
            onUploaded={onUploaded}
          />
          <FileDropzone
            presetKey="documents"
            variant="compact"
            classId={classId}
            multiple
            title={t("attachmentsDocuments")}
            onUploaded={onUploaded}
          />
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{t("attachmentsMaxReached")}</p>
      )}
    </Field>
  );
}
