import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { AttachmentItem } from "@/components/upload/AttachmentList";
import type { Id } from "../../../convex/_generated/dataModel";

export type ImageDocumentAttachmentItem = AttachmentItem;

type AttachmentInitial = {
  attachmentFileIds: Array<Id<"files">>;
  attachments: Array<ImageDocumentAttachmentItem>;
} | null;

export function useImageDocumentAttachments(max: number) {
  const { t } = useTranslation("upload");
  const [fileIds, setFileIds] = useState<Array<Id<"files">>>([]);
  const [items, setItems] = useState<Array<ImageDocumentAttachmentItem>>([]);

  const reset = useCallback((initial: AttachmentInitial) => {
    setFileIds(initial?.attachmentFileIds ?? []);
    setItems(
      initial?.attachments.map((item) => ({
        fileId: item.fileId,
        name: item.name,
        contentType: item.contentType,
        size: item.size,
        preset: item.preset,
      })) ?? [],
    );
  }, []);

  const onUploaded = useCallback(
    (fileId: Id<"files">) => {
      setFileIds((prev) => {
        if (prev.includes(fileId) || prev.length >= max) return prev;
        return [...prev, fileId];
      });
      setItems((prev) => {
        if (prev.some((item) => item.fileId === fileId)) return prev;
        return [
          ...prev,
          {
            fileId,
            name: t("unnamedAttachment"),
            contentType: "application/octet-stream",
            size: 0,
            preset: "documents",
          },
        ];
      });
    },
    [max, t],
  );

  const onRemove = useCallback((fileId: Id<"files">) => {
    setFileIds((prev) => prev.filter((id) => id !== fileId));
    setItems((prev) => prev.filter((item) => item.fileId !== fileId));
  }, []);

  return useMemo(
    () => ({ fileIds, items, reset, onUploaded, onRemove }),
    [fileIds, items, reset, onUploaded, onRemove],
  );
}
