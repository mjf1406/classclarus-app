import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { Can } from "@/components/permissions/Can";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import { Skeleton } from "@/components/ui/skeleton";
import { FileDropzone } from "@/components/upload/FileDropzone";
import { useClass } from "@/hooks/classes/useClass";
import { useSetClassBanner } from "@/hooks/classes/useSetClassBanner";
import { useFileBytes } from "@/hooks/files/useFileBytes";
import type { Id } from "../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/_class/class/$classId/")({
  component: function ClassDashboardPage() {
    const { classId: classIdParam } = Route.useParams();
    const classId = classIdParam as Id<"classes">;
    const { t } = useTranslation("classes");
    const { data: classDoc } = useClass(classId);
    const bannerFileId = classDoc?.bannerFileId;
    const { url: bannerUrl, isPending: bannerPending } = useFileBytes(bannerFileId);
    const setBanner = useSetClassBanner();

    const handleBannerUploaded = useCallback(
      (fileId: Id<"files">) => {
        setBanner.mutate({ classId, fileId });
      },
      [classId, setBanner],
    );

    return (
      <RequirePermission permission="class:read">
        <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{t("navDashboard")}</h1>
            <p className="text-sm text-muted-foreground">{t("comingSoon")}</p>
          </div>
          {bannerFileId ? (
            bannerPending || !bannerUrl ? (
              <Skeleton className="aspect-[3/1] w-full max-w-4xl rounded-xl" />
            ) : (
              <img
                src={bannerUrl}
                alt={t("bannerPreviewAlt")}
                className="aspect-[3/1] w-full max-w-4xl rounded-xl object-cover"
              />
            )
          ) : (
            <Can permission="class:update">
              <FileDropzone
                title={t("bannerTitle")}
                presetKey="images"
                classId={classId}
                multiple={false}
                onUploaded={handleBannerUploaded}
                className="w-full max-w-4xl [&_[data-slot=empty]]:rounded-xl"
              />
            </Can>
          )}
        </div>
      </RequirePermission>
    );
  },
});
