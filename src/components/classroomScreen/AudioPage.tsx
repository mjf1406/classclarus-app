import { useEffect, useRef, useState } from "react";
import { ExternalLink, Music, Pause, Play, Trash2, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";

import { DeleteConfirmDialog } from "@/components/classroomScreen/DeleteConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  useDeleteClassroomAudio,
  useRegisterClassroomAudio,
} from "@/hooks/classroomScreen/useClassroomScreenMutations";
import { useClassroomAudioFiles } from "@/hooks/classroomScreen/useClassroomScreenQueries";
import { useUploadFiles } from "@/hooks/files/useUploadFiles";
import type { Id } from "../../../convex/_generated/dataModel";
import { createAudioUrlMap, useAudioPlayer } from "@/lib/classroomScreen/audio-engine";
import { toAudioUrlList } from "@/lib/classroomScreen/audioOptions";
import {
  DEFAULT_BUILTIN_AUDIO,
  builtinAudioId,
  builtinAudioI18nKey,
} from "@/lib/classroomScreen/defaultAudio";

interface AudioPageProps {
  classId: Id<"classes">;
}

export function AudioPage({ classId }: AudioPageProps) {
  const { t } = useTranslation("classroomScreen");
  const { data, isLoading } = useClassroomAudioFiles(classId);
  const registerAudio = useRegisterClassroomAudio();
  const deleteAudio = useDeleteClassroomAudio();
  const { items, uploadFiles } = useUploadFiles("audio", { classId });

  const audioFiles = data ?? [];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const registeredRef = useRef(new Set<string>());
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<Id<"classroomAudioFiles"> | null>(null);
  const [deletingName, setDeletingName] = useState("");

  const urlMap = createAudioUrlMap(toAudioUrlList(audioFiles));
  const { togglePreview, previewPlayingId } = useAudioPlayer(urlMap);

  const isUploading = items.some((item) => item.status === "queued" || item.status === "uploading");

  useEffect(() => {
    for (const item of items) {
      if (item.status !== "done" || !item.fileId) continue;
      if (registeredRef.current.has(item.id)) continue;
      registeredRef.current.add(item.id);
      void registerAudio
        .mutateAsync({
          classId,
          fileId: item.fileId,
          name: item.file.name.replace(/\.[^.]+$/, ""),
        })
        .catch((error) => {
          setUploadError(error instanceof Error ? error.message : t("audioUploadFailed"));
        });
    }
  }, [items, classId, registerAudio, t]);

  const handleUpload = (fileList: FileList | null) => {
    if (!fileList) return;
    setUploadError(null);
    uploadFiles(Array.from(fileList));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="mx-auto w-full max-w-3xl p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("audioTitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("audioDescription")}</p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
          <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
            <Upload />
            {isUploading ? t("audioUploading") : t("audioUpload")}
          </Button>
        </div>
      </div>

      {uploadError && (
        <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {uploadError}
        </p>
      )}

      {isLoading ? (
        <p className="text-muted-foreground">{t("audioLoading")}</p>
      ) : (
        <div className="grid gap-8">
          <section className="grid gap-3">
            <h2 className="text-lg font-medium">{t("audioBuiltinTitle")}</h2>
            <div className="grid gap-3">
              {DEFAULT_BUILTIN_AUDIO.map((entry) => {
                const id = builtinAudioId(entry.key);
                const isPlaying = previewPlayingId === id;
                const i18nKey = builtinAudioI18nKey(entry.key);
                return (
                  <div
                    key={entry.key}
                    className="flex items-center justify-between gap-4 rounded-xl border p-4"
                  >
                    <div>
                      <p className="font-medium">{i18nKey ? t(i18nKey) : entry.name}</p>
                      <p className="text-xs text-muted-foreground">{t("audioBuiltinBadge")}</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={() => togglePreview(id)}
                      aria-label={
                        isPlaying
                          ? t("audioPause")
                          : t("audioPreview", { label: i18nKey ? t(i18nKey) : entry.name })
                      }
                    >
                      {isPlaying ? <Pause /> : <Play />}
                    </Button>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="grid gap-3">
            <h2 className="text-lg font-medium">{t("audioUploadsTitle")}</h2>
            {audioFiles.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center">
                <Music className="mx-auto mb-3 size-8 text-muted-foreground" />
                <p className="text-muted-foreground">{t("audioUploadsEmpty")}</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {audioFiles.map((file) => (
                  <div
                    key={file._id}
                    className="flex items-center justify-between gap-4 rounded-xl border p-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="icon-sm"
                        onClick={() => togglePreview(file._id)}
                        aria-label={
                          previewPlayingId === file._id
                            ? t("audioPause")
                            : t("audioPreview", { label: file.name })
                        }
                      >
                        {previewPlayingId === file._id ? <Pause /> : <Play />}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        onClick={() => {
                          setDeletingId(file._id);
                          setDeletingName(file.name);
                        }}
                        aria-label={t("delete")}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="grid gap-3 rounded-xl border border-dashed p-6">
            <h2 className="text-lg font-medium">{t("audioFindTitle")}</h2>
            <a
              href="https://pixabay.com/sound-effects/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm hover:bg-muted/50"
            >
              {t("audioPixabayLink")}
              <ExternalLink className="size-4" />
            </a>
          </section>
        </div>
      )}

      <DeleteConfirmDialog
        open={deletingId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingId(null);
            setDeletingName("");
          }
        }}
        itemName={deletingName}
        onConfirm={async () => {
          if (deletingId) {
            await deleteAudio.mutateAsync({
              classId,
              audioFileId: deletingId,
            });
          }
        }}
      />
    </div>
  );
}
