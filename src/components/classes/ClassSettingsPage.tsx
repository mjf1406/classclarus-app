import { PencilIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  ClassFormCredenza,
  type ClassFormInitialValues,
} from "@/components/classes/ClassFormCredenza";
import { ClassIconDisplay } from "@/components/classes/ClassIconDisplay";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { FileDropzone } from "@/components/upload/FileDropzone";
import { useClass } from "@/hooks/classes/useClass";
import { useClearClassBanner } from "@/hooks/classes/useClearClassBanner";
import { useSetClassBanner } from "@/hooks/classes/useSetClassBanner";
import { useUpdateClass } from "@/hooks/classes/useUpdateClass";
import { useFileBytes } from "@/hooks/files/useFileBytes";
import type { ClassFormValues } from "@/lib/classes/classFormSchema";
import type { Id } from "../../../convex/_generated/dataModel";

type ClassSettingsPageProps = {
  classId: Id<"classes">;
};

function formatTimestamp(value: number, language: string): string {
  return new Intl.DateTimeFormat(language, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function SettingsSkeleton() {
  return <Skeleton className="h-48 w-full max-w-2xl rounded-2xl" />;
}

function BannerPreview({ fileId }: { fileId: Id<"files"> }) {
  const { t } = useTranslation("classes");
  const { url, isPending, isError } = useFileBytes(fileId);

  if (isPending) {
    return <Skeleton className="aspect-[3/1] w-full rounded-lg" />;
  }
  if (isError || !url) {
    return <p className="text-sm text-muted-foreground">{t("bannerLoadFailed")}</p>;
  }
  return (
    <img
      src={url}
      alt={t("bannerPreviewAlt")}
      className="aspect-[3/1] w-full rounded-lg object-cover"
    />
  );
}

export function ClassSettingsPage({ classId }: ClassSettingsPageProps) {
  const { t, i18n } = useTranslation("classes");
  const { data: classDoc, isPending, isError, refetch, isAuthLoading } = useClass(classId);
  const updateClass = useUpdateClass();
  const setBanner = useSetClassBanner();
  const clearBanner = useClearClassBanner();
  const [editOpen, setEditOpen] = useState(false);

  const showSkeleton = (isPending || isAuthLoading) && classDoc == null;

  const formInitialValues: ClassFormInitialValues | undefined = classDoc
    ? {
        name: classDoc.name,
        year: classDoc.year,
        description: classDoc.description,
        icon: classDoc.icon,
      }
    : undefined;

  const handleSubmit = async (values: ClassFormValues) => {
    await updateClass.mutateAsync({
      classId,
      name: values.name,
      year: values.year,
      description: values.description,
      icon: values.icon,
    });
  };

  const handleBannerUploaded = useCallback(
    (fileId: Id<"files">) => {
      setBanner.mutate({ classId, fileId });
    },
    [classId, setBanner],
  );

  const handleClearBanner = () => {
    clearBanner.mutate({ classId });
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("navSettings")}</h1>
      </div>

      {showSkeleton ? <SettingsSkeleton /> : null}

      {!showSkeleton && isError ? (
        <ErrorState
          card
          onRetry={async () => {
            await refetch();
          }}
          description={t("loadFailed")}
        />
      ) : null}

      {!showSkeleton && !isError && classDoc ? (
        <>
          <Card className="max-w-2xl">
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <ClassIconDisplay icon={classDoc.icon} />
                <div className="min-w-0">
                  <CardTitle className="text-lg font-semibold">{classDoc.name}</CardTitle>
                  <CardDescription>{classDoc.year}</CardDescription>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={t("editAction")}
                onClick={() => setEditOpen(true)}
              >
                <PencilIcon aria-hidden="true" />
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                {classDoc.description?.trim() || t("noDescription")}
              </p>
              <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                <span>
                  {t("createdAt", {
                    date: formatTimestamp(classDoc._creationTime, i18n.language),
                  })}
                </span>
                <span>
                  {t("updatedAt", {
                    date: formatTimestamp(classDoc.updatedAt, i18n.language),
                  })}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">{t("bannerTitle")}</CardTitle>
              <CardDescription>{t("bannerDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {classDoc.bannerFileId ? (
                <div className="flex flex-col gap-3">
                  <BannerPreview fileId={classDoc.bannerFileId} />
                  <div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={clearBanner.isPending}
                      onClick={handleClearBanner}
                    >
                      {t("bannerRemove")}
                    </Button>
                  </div>
                </div>
              ) : null}
              <FileDropzone
                title={t("bannerTitle")}
                variant="compact"
                presetKey="images"
                classId={classId}
                multiple={false}
                onUploaded={handleBannerUploaded}
              />
            </CardContent>
          </Card>
        </>
      ) : null}

      {classDoc ? (
        <ClassFormCredenza
          key={`edit:${classDoc._id}:${classDoc.updatedAt}`}
          open={editOpen}
          onOpenChange={setEditOpen}
          mode="edit"
          initialValues={formInitialValues}
          onSubmit={handleSubmit}
        />
      ) : null}
    </div>
  );
}
