import { useCallback, useMemo, useRef, useState } from "react";
import { useConvexMutation } from "@convex-dev/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useAction } from "convex/react";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { classFilesListQueryKey } from "@/hooks/files/useClassFiles";
import type { UploadPresetKey, UploadPreset } from "@/lib/upload/acceptPresets";
import { getUploadPreset } from "@/lib/upload/acceptPresets";
import { codeFromError } from "@/lib/errors/convexError";
import { randomClientId } from "@/lib/optimistic";

export type UploadFileStatus = "queued" | "uploading" | "done" | "error" | "aborted";

export type UploadErrorCode =
  | "invalid_type"
  | "invalid_size"
  | "invalid_content"
  | "quota_exceeded"
  | "upload_failed"
  | "finalize_failed"
  | "aborted";

export type UploadFileItem = {
  id: string;
  file: File;
  status: UploadFileStatus;
  progress: number; // 0..100
  attempt: number;
  storageId?: Id<"_storage">;
  fileId?: Id<"files">;
  errorCode?: UploadErrorCode;
};

type UploadOneResult = {
  storageId: Id<"_storage">;
};

function createUploadId() {
  return randomClientId();
}

function getFileExtension(file: File): string | null {
  const name = file.name.toLowerCase();
  const idx = name.lastIndexOf(".");
  if (idx === -1) {
    return null;
  }
  return name.slice(idx);
}

function finalizeErrorCode(error: unknown): UploadErrorCode {
  const code = codeFromError(error);
  if (code === "INVALID_UPLOAD_SIZE") return "invalid_size";
  if (code === "INVALID_UPLOAD_TYPE") return "invalid_type";
  if (code === "INVALID_UPLOAD_CONTENT") return "invalid_content";
  if (code === "QUOTA_EXCEEDED") return "quota_exceeded";
  if (code === "INVALID_UPLOAD" || code === "UPLOAD_NOT_FOUND" || code === "UPLOAD_FORBIDDEN") {
    return "finalize_failed";
  }
  if (code === "CLASS_UNAVAILABLE") {
    return "finalize_failed";
  }
  return "finalize_failed";
}

async function uploadViaXhr(opts: {
  uploadUrl: string;
  file: File;
  onProgress: (progress: number) => void;
  onAbortSignal: (abort: () => void) => void;
}): Promise<UploadOneResult> {
  return await new Promise<UploadOneResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open("POST", opts.uploadUrl);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        return;
      }
      const percent = Math.round((event.loaded / event.total) * 100);
      opts.onProgress(Math.max(0, Math.min(100, percent)));
    };

    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`Upload failed (${xhr.status})`));
        return;
      }

      try {
        const parsed: unknown = JSON.parse(xhr.responseText);
        if (
          typeof parsed === "object" &&
          parsed !== null &&
          "storageId" in parsed &&
          typeof (parsed as { storageId?: unknown }).storageId === "string"
        ) {
          resolve({
            storageId: (parsed as { storageId: string }).storageId as Id<"_storage">,
          });
          return;
        }
        reject(new Error("Upload response missing storageId"));
      } catch (e) {
        reject(e instanceof Error ? e : new Error("Upload response parse failed"));
      }
    };

    xhr.onerror = () => {
      reject(new Error("Upload failed"));
    };

    xhr.onabort = () => {
      // Treat abort as a distinct error so the UI can offer retry.
      reject(new Error("aborted"));
    };

    opts.onAbortSignal(() => {
      xhr.abort();
    });

    xhr.send(opts.file);
  });
}

export function useUploadFiles(
  presetKey: UploadPresetKey = "images",
  options?: { classId?: Id<"classes"> },
) {
  const preset = useMemo<UploadPreset>(() => getUploadPreset(presetKey), [presetKey]);
  const classId = options?.classId;

  const [items, setItems] = useState<UploadFileItem[]>([]);
  // Source of truth for the drain loop. Updated synchronously in setItemsSync
  // (not inside the setState updater) so processQueue never races a deferred
  // React updater and misses the first queued file.
  const itemsRef = useRef<UploadFileItem[]>([]);

  const setItemsSync = useCallback((updater: (prev: UploadFileItem[]) => UploadFileItem[]) => {
    const next = updater(itemsRef.current);
    itemsRef.current = next;
    setItems(next);
  }, []);

  const generateUploadUrlMutation = useConvexMutation(api.files.generateUploadUrl);
  const watchPendingUploadMutation = useConvexMutation(api.files.watchPendingUpload);
  const finalizeUploadAction = useAction(api.files.finalizeUpload);
  const queryClient = useQueryClient();

  const xhrByIdRef = useRef<Map<string, () => void>>(new Map());
  const processingRef = useRef(false);

  // Convex hook identities change often; keep the drain closure stable via refs.
  const generateUploadUrlRef = useRef(generateUploadUrlMutation);
  const watchPendingUploadRef = useRef(watchPendingUploadMutation);
  const finalizeUploadRef = useRef(finalizeUploadAction);
  const classIdRef = useRef(classId);
  const presetKeyRef = useRef(presetKey);
  const queryClientRef = useRef(queryClient);
  generateUploadUrlRef.current = generateUploadUrlMutation;
  watchPendingUploadRef.current = watchPendingUploadMutation;
  finalizeUploadRef.current = finalizeUploadAction;
  classIdRef.current = classId;
  presetKeyRef.current = presetKey;
  queryClientRef.current = queryClient;

  const getNextQueuedItem = () => {
    return itemsRef.current.find((item) => item.status === "queued") ?? null;
  };

  const uploadOne = useCallback(
    async (item: UploadFileItem): Promise<void> => {
      setItemsSync((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? { ...it, status: "uploading", progress: 0, errorCode: undefined }
            : it,
        ),
      );

      try {
        const uploadUrl = await generateUploadUrlRef.current({});
        const result = await uploadViaXhr({
          uploadUrl,
          file: item.file,
          onProgress: (progress) => {
            setItemsSync((prev) =>
              prev.map((it) => (it.id === item.id ? { ...it, progress } : it)),
            );
          },
          onAbortSignal: (abort) => {
            xhrByIdRef.current.set(item.id, abort);
          },
        });

        await watchPendingUploadRef.current({ storageId: result.storageId });

        const activeClassId = classIdRef.current;
        const fileId = await finalizeUploadRef.current({
          storageId: result.storageId,
          name: item.file.name,
          preset: presetKeyRef.current,
          ...(activeClassId !== undefined ? { classId: activeClassId } : {}),
        });

        if (activeClassId !== undefined) {
          void queryClientRef.current.invalidateQueries({
            queryKey: classFilesListQueryKey(activeClassId),
          });
        }

        setItemsSync((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? {
                  ...it,
                  status: "done",
                  storageId: result.storageId,
                  fileId,
                  progress: 100,
                }
              : it,
          ),
        );
      } catch (e) {
        const message = e instanceof Error ? e.message : "upload_failed";
        let errorCode: UploadErrorCode;
        if (message === "aborted") {
          errorCode = "aborted";
        } else if (codeFromError(e) !== undefined) {
          errorCode = finalizeErrorCode(e);
        } else {
          errorCode = "upload_failed";
        }
        setItemsSync((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? {
                  ...it,
                  status: errorCode === "aborted" ? "aborted" : "error",
                  errorCode,
                }
              : it,
          ),
        );
      } finally {
        xhrByIdRef.current.delete(item.id);
      }
    },
    [setItemsSync],
  );

  const uploadOneRef = useRef(uploadOne);
  uploadOneRef.current = uploadOne;

  const processQueue = useCallback(async () => {
    if (processingRef.current) {
      return;
    }
    processingRef.current = true;
    try {
      while (true) {
        const next = getNextQueuedItem();
        if (!next) {
          break;
        }
        await uploadOneRef.current(next);
      }
    } finally {
      processingRef.current = false;
    }
    // Enqueues that arrived while processingRef was true early-returned.
    // Re-check only after releasing the lock so the first file never stalls
    // until a second enqueue "kicks" the drain.
    if (getNextQueuedItem()) {
      void processQueue();
    }
  }, []);

  const validateFile = useCallback(
    (file: File): UploadErrorCode | null => {
      if (file.size > preset.maxSizeBytes) {
        return "invalid_size";
      }
      if (preset.allowedExtensions.length > 0) {
        const ext = getFileExtension(file);
        if (!ext || !preset.allowedExtensions.includes(ext)) {
          return "invalid_type";
        }
      }
      return null;
    },
    [preset],
  );

  const uploadFiles = useCallback(
    (files: readonly File[]) => {
      const newItems: UploadFileItem[] = files.map((file) => {
        const errorCode = validateFile(file);
        const id = createUploadId();
        if (errorCode) {
          return {
            id,
            file,
            status: "error",
            progress: 0,
            attempt: 1,
            errorCode,
          };
        }
        return {
          id,
          file,
          status: "queued",
          progress: 0,
          attempt: 1,
        };
      });

      setItemsSync((prev) => [...prev, ...newItems]);
      void processQueue();
    },
    [processQueue, setItemsSync, validateFile],
  );

  const abortFile = useCallback(
    (id: string) => {
      setItemsSync((prev) =>
        prev.map((it) => {
          if (it.id !== id) {
            return it;
          }
          if (it.status === "queued") {
            return { ...it, status: "aborted", errorCode: "aborted" };
          }
          return it;
        }),
      );

      const abort = xhrByIdRef.current.get(id);
      if (abort) {
        abort();
      }
    },
    [setItemsSync],
  );

  const retryFile = useCallback(
    (id: string) => {
      setItemsSync((prev) =>
        prev.map((it) => {
          if (it.id !== id) {
            return it;
          }
          if (it.status !== "error" && it.status !== "aborted") {
            return it;
          }
          return {
            ...it,
            status: "queued",
            progress: 0,
            attempt: it.attempt + 1,
            errorCode: undefined,
          };
        }),
      );
      void processQueue();
    },
    [processQueue, setItemsSync],
  );

  return {
    items,
    uploadFiles,
    abortFile,
    retryFile,
    isUploading: items.some((item) => item.status === "uploading"),
  };
}
