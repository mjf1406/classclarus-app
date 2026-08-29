import { PencilIcon, ExternalLink } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { ClockSettingsSection } from "@/components/classroomScreen/ClockSettingsSection";
import {
  ClassFormCredenza,
  type ClassFormInitialValues,
} from "@/components/classes/ClassFormCredenza";
import { ClassIconDisplay } from "@/components/classes/ClassIconDisplay";
import { TableOfContents } from "@/components/navigation/TableOfContents";
import { PointsBadgeCustomAlertsField } from "@/components/classes/PointsBadgeCustomAlertsField";
import { TimezoneSelect } from "@/components/classes/TimezoneSelect";
import { LanguageSelect } from "@/components/i18n/LanguageSelect";
import { RosterNameFormatControls } from "@/components/students/RosterNameFormatControls";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { ErrorState } from "@/components/ui/error-state";
import { Field, FieldLabel } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { FileDropzone } from "@/components/upload/FileDropzone";
import { useCan } from "@/hooks/permissions/useCan";
import { useClass } from "@/hooks/classes/useClass";
import { useClearClassBanner } from "@/hooks/classes/useClearClassBanner";
import { useSetClassBanner } from "@/hooks/classes/useSetClassBanner";
import { useSetPointsBadgeWindows } from "@/hooks/classes/useSetPointsBadgeWindows";
import { useSetPointsPublicDisplay } from "@/hooks/classes/useSetPointsPublicDisplay";
import { useSetRosterNameFormat } from "@/hooks/classes/useSetRosterNameFormat";
import { useSetStudentLanguage } from "@/hooks/classes/useSetStudentLanguage";
import { useSetTimezone } from "@/hooks/classes/useSetTimezone";
import { useUpdateClass } from "@/hooks/classes/useUpdateClass";
import { useFileBytes } from "@/hooks/files/useFileBytes";
import type { ClassFormValues } from "@/lib/classes/classFormSchema";
import type { AppLanguage } from "@/lib/languages";
import {
  isPointsBadgeWindowUnit,
  MAX_POINTS_BADGE_WINDOW_AMOUNT,
  MIN_POINTS_BADGE_WINDOW_AMOUNT,
  POINTS_BADGE_WINDOW_UNITS,
  type PointsBadgeWindowUnit,
} from "@/lib/points/pointsBadgeWindow";
import {
  pointsBadgeAlertsEqual,
  type PointsBadgeAlert,
} from "../../../convex/lib/points/pointsBadgeAlert";
import { pointsPublicDisplayUrl } from "@/lib/points/pointsPublicUrls";
import { formatLocalizedDateTime } from "@/i18n/formatDate";
import { resolveRosterNameFormat, type RosterNameFormat } from "@/lib/roster/roster";
import type { Id } from "../../../convex/_generated/dataModel";

type ClassSettingsPageProps = {
  classId: Id<"classes">;
};

const SETTINGS_SECTION_IDS = {
  class: "settings-class",
  studentLanguage: "settings-student-language",
  timezone: "settings-timezone",
  rosterNames: "settings-roster-names",
  pointsWarnings: "settings-points-warnings",
  pointsRemoving: "settings-points-removing",
  pointsPublic: "settings-points-public",
  banner: "settings-banner",
  clock: "settings-clock",
} as const;

const SETTINGS_CARD_CLASS = "scroll-mt-20";

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

function PointsBadgeLookbackField({
  amount,
  unit,
  disabled,
  label,
  amountAria,
  unitAria,
  onAmountChange,
  onUnitChange,
}: {
  amount: number;
  unit: PointsBadgeWindowUnit;
  disabled: boolean;
  label: string;
  amountAria: string;
  unitAria: string;
  onAmountChange: (amount: number) => void;
  onUnitChange: (unit: PointsBadgeWindowUnit) => void;
}) {
  const { t } = useTranslation("classes");
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <NumberInput
          value={amount}
          min={MIN_POINTS_BADGE_WINDOW_AMOUNT}
          max={MAX_POINTS_BADGE_WINDOW_AMOUNT}
          disabled={disabled}
          aria-label={amountAria}
          className="shrink-0"
          onValueChange={onAmountChange}
        />
        <Select
          value={unit}
          disabled={disabled}
          onValueChange={(next) => {
            if (next == null || !isPointsBadgeWindowUnit(next)) return;
            onUnitChange(next);
          }}
        >
          <SelectTrigger className="w-36 shrink-0" aria-label={unitAria}>
            <SelectValue>{t(`pointsBadgeWindowUnit_${unit}`)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {POINTS_BADGE_WINDOW_UNITS.map((windowUnit) => (
                <SelectItem key={windowUnit} value={windowUnit}>
                  {t(`pointsBadgeWindowUnit_${windowUnit}`)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </Field>
  );
}

function PointsPublicDisplayShare({
  publicSlug,
  copyLabel,
  qrLabel,
}: {
  publicSlug: string;
  copyLabel: string;
  qrLabel: string;
}) {
  const publicUrl = pointsPublicDisplayUrl(publicSlug);
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border p-4">
      <div className="flex justify-center rounded-lg bg-white p-3">
        <QRCodeSVG
          value={publicUrl}
          size={180}
          level="M"
          marginSize={2}
          bgColor="#FFFFFF"
          fgColor="#000000"
          title={qrLabel}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1 text-xs">
          {publicUrl}
        </code>
        <CopyButton type="link" value={publicUrl} aria-label={copyLabel} />
      </div>
    </div>
  );
}

export function ClassSettingsPage({ classId }: ClassSettingsPageProps) {
  const { t } = useTranslation("classes");
  const { t: tClassroomScreen } = useTranslation("classroomScreen");
  const { can, isPending: permissionsPending } = useCan();
  const canUpdateClass = !permissionsPending && can("class:update");
  const canManageClassroomScreen = !permissionsPending && can("classroomScreen:manage");
  const { data: classDoc, isPending, isError, refetch, isAuthLoading } = useClass(classId);
  const updateClass = useUpdateClass();
  const setBanner = useSetClassBanner();
  const clearBanner = useClearClassBanner();
  const setStudentLanguage = useSetStudentLanguage();
  const setTimezone = useSetTimezone();
  const setRosterNameFormat = useSetRosterNameFormat();
  const setPointsBadgeWindows = useSetPointsBadgeWindows();
  const setPointsPublicDisplay = useSetPointsPublicDisplay();
  const [editOpen, setEditOpen] = useState(false);

  const nameFormat = resolveRosterNameFormat({
    rosterNameOrder: classDoc?.rosterNameOrder,
    rosterNameSpace: classDoc?.rosterNameSpace,
  });

  const handleNameFormatChange = (next: RosterNameFormat) => {
    if (next.order === nameFormat.order && next.space === nameFormat.space) return;
    setRosterNameFormat.mutate({
      classId,
      rosterNameOrder: next.order,
      rosterNameSpace: next.space,
    });
  };

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

  const handleStudentLanguageChange = (studentLanguage: AppLanguage) => {
    setStudentLanguage.mutate({ classId, studentLanguage });
  };

  const tocItems = useMemo(() => {
    if (!classDoc) return [];
    const items = [
      { title: classDoc.name, url: `#${SETTINGS_SECTION_IDS.class}`, depth: 2 },
      {
        title: t("studentLanguageTitle"),
        url: `#${SETTINGS_SECTION_IDS.studentLanguage}`,
        depth: 2,
      },
      { title: t("timezoneTitle"), url: `#${SETTINGS_SECTION_IDS.timezone}`, depth: 2 },
      {
        title: t("rosterNameFormatTitle"),
        url: `#${SETTINGS_SECTION_IDS.rosterNames}`,
        depth: 2,
      },
      {
        title: t("pointsBadgeWarningsSection"),
        url: `#${SETTINGS_SECTION_IDS.pointsWarnings}`,
        depth: 2,
      },
      {
        title: t("pointsBadgeRemovingPointsSection"),
        url: `#${SETTINGS_SECTION_IDS.pointsRemoving}`,
        depth: 2,
      },
      {
        title: t("pointsPublicDisplayTitle"),
        url: `#${SETTINGS_SECTION_IDS.pointsPublic}`,
        depth: 2,
      },
      { title: t("bannerTitle"), url: `#${SETTINGS_SECTION_IDS.banner}`, depth: 2 },
    ];
    if (canManageClassroomScreen) {
      items.push({
        title: tClassroomScreen("clockSettingsTitle"),
        url: `#${SETTINGS_SECTION_IDS.clock}`,
        depth: 2,
      });
    }
    return items;
  }, [canManageClassroomScreen, classDoc, t, tClassroomScreen]);

  const savePointsBadgeWindows = (patch: {
    warningWindowAmount?: number;
    warningWindowUnit?: PointsBadgeWindowUnit;
    minusWindowAmount?: number;
    minusWindowUnit?: PointsBadgeWindowUnit;
    warningAlerts?: PointsBadgeAlert[];
    minusAlerts?: PointsBadgeAlert[];
  }) => {
    if (!classDoc || !canUpdateClass) return;
    const next = {
      warningWindowAmount: patch.warningWindowAmount ?? classDoc.warningWindowAmount,
      warningWindowUnit: patch.warningWindowUnit ?? classDoc.warningWindowUnit,
      minusWindowAmount: patch.minusWindowAmount ?? classDoc.minusWindowAmount,
      minusWindowUnit: patch.minusWindowUnit ?? classDoc.minusWindowUnit,
      warningAlerts: patch.warningAlerts ?? classDoc.warningAlerts,
      minusAlerts: patch.minusAlerts ?? classDoc.minusAlerts,
    };
    if (
      next.warningWindowAmount === classDoc.warningWindowAmount &&
      next.warningWindowUnit === classDoc.warningWindowUnit &&
      next.minusWindowAmount === classDoc.minusWindowAmount &&
      next.minusWindowUnit === classDoc.minusWindowUnit &&
      pointsBadgeAlertsEqual(next.warningAlerts, classDoc.warningAlerts) &&
      pointsBadgeAlertsEqual(next.minusAlerts, classDoc.minusAlerts)
    ) {
      return;
    }
    setPointsBadgeWindows.mutate({ classId, ...next });
  };

  return (
    <div className="flex w-full items-start gap-12 px-4 py-8 sm:px-8">
      <div className="flex min-w-0 w-full max-w-2xl flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("navSettings")}</h1>
          <p className="hidden text-muted-foreground sm:block">{t("settingsDescription")}</p>
        </div>

        {!showSkeleton && !isError && classDoc ? (
          <TableOfContents items={tocItems} variant="dropdown" className="xl:hidden" />
        ) : null}

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
            <Card id={SETTINGS_SECTION_IDS.class} className={SETTINGS_CARD_CLASS}>
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
                      date: formatLocalizedDateTime(classDoc._creationTime),
                    })}
                  </span>
                  <span>
                    {t("updatedAt", {
                      date: formatLocalizedDateTime(classDoc.updatedAt),
                    })}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card id={SETTINGS_SECTION_IDS.studentLanguage} className={SETTINGS_CARD_CLASS}>
              <CardHeader>
                <CardTitle className="text-lg font-semibold">{t("studentLanguageTitle")}</CardTitle>
                <CardDescription>{t("studentLanguageDescription")}</CardDescription>
              </CardHeader>
              <CardContent>
                <LanguageSelect
                  value={classDoc.studentLanguage}
                  onValueChange={handleStudentLanguageChange}
                  disabled={setStudentLanguage.isPending}
                  triggerClassName="w-auto min-w-40"
                />
              </CardContent>
            </Card>

            <Card id={SETTINGS_SECTION_IDS.timezone} className={SETTINGS_CARD_CLASS}>
              <CardHeader>
                <CardTitle className="text-lg font-semibold">{t("timezoneTitle")}</CardTitle>
                <CardDescription>{t("timezoneDescription")}</CardDescription>
              </CardHeader>
              <CardContent>
                <TimezoneSelect
                  value={classDoc.timezone}
                  disabled={!canUpdateClass || setTimezone.isPending}
                  onValueChange={(timezone) => {
                    setTimezone.mutate({ classId, timezone });
                  }}
                />
              </CardContent>
            </Card>

            <Card id={SETTINGS_SECTION_IDS.rosterNames} className={SETTINGS_CARD_CLASS}>
              <CardHeader>
                <CardTitle className="text-lg font-semibold">
                  {t("rosterNameFormatTitle")}
                </CardTitle>
                <CardDescription>{t("rosterNameFormatDescription")}</CardDescription>
              </CardHeader>
              <CardContent>
                <RosterNameFormatControls
                  value={nameFormat}
                  onChange={handleNameFormatChange}
                  disabled={!canUpdateClass || setRosterNameFormat.isPending}
                />
              </CardContent>
            </Card>

            <Card id={SETTINGS_SECTION_IDS.pointsWarnings} className={SETTINGS_CARD_CLASS}>
              <CardHeader>
                <CardTitle className="text-lg font-semibold">
                  {t("pointsBadgeWarningsSection")}
                </CardTitle>
                <CardDescription>{t("pointsBadgeWarningWindowDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                <PointsBadgeLookbackField
                  amount={classDoc.warningWindowAmount}
                  unit={classDoc.warningWindowUnit}
                  disabled={!canUpdateClass || setPointsBadgeWindows.isPending}
                  label={t("pointsBadgeWarningWindowLabel")}
                  amountAria={t("pointsBadgeWarningWindowAmountAria")}
                  unitAria={t("pointsBadgeWarningWindowUnitAria")}
                  onAmountChange={(warningWindowAmount) =>
                    savePointsBadgeWindows({ warningWindowAmount })
                  }
                  onUnitChange={(warningWindowUnit) =>
                    savePointsBadgeWindows({ warningWindowUnit })
                  }
                />
                <PointsBadgeCustomAlertsField
                  idPrefix="points-badge-warning-alert"
                  alerts={classDoc.warningAlerts}
                  disabled={!canUpdateClass || setPointsBadgeWindows.isPending}
                  onChange={(warningAlerts) => savePointsBadgeWindows({ warningAlerts })}
                />
              </CardContent>
            </Card>

            <Card id={SETTINGS_SECTION_IDS.pointsRemoving} className={SETTINGS_CARD_CLASS}>
              <CardHeader>
                <CardTitle className="text-lg font-semibold">
                  {t("pointsBadgeRemovingPointsSection")}
                </CardTitle>
                <CardDescription>{t("pointsBadgeMinusWindowDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                <PointsBadgeLookbackField
                  amount={classDoc.minusWindowAmount}
                  unit={classDoc.minusWindowUnit}
                  disabled={!canUpdateClass || setPointsBadgeWindows.isPending}
                  label={t("pointsBadgeMinusWindowLabel")}
                  amountAria={t("pointsBadgeMinusWindowAmountAria")}
                  unitAria={t("pointsBadgeMinusWindowUnitAria")}
                  onAmountChange={(minusWindowAmount) =>
                    savePointsBadgeWindows({ minusWindowAmount })
                  }
                  onUnitChange={(minusWindowUnit) => savePointsBadgeWindows({ minusWindowUnit })}
                />
                <PointsBadgeCustomAlertsField
                  idPrefix="points-badge-minus-alert"
                  alerts={classDoc.minusAlerts}
                  disabled={!canUpdateClass || setPointsBadgeWindows.isPending}
                  onChange={(minusAlerts) => savePointsBadgeWindows({ minusAlerts })}
                />
              </CardContent>
            </Card>

            <Card id={SETTINGS_SECTION_IDS.pointsPublic} className={SETTINGS_CARD_CLASS}>
              <CardHeader>
                <CardTitle className="text-lg font-semibold">
                  {t("pointsPublicDisplayTitle")}
                </CardTitle>
                <CardDescription>{t("pointsPublicDisplayDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-col gap-0.5">
                    <Label htmlFor="points-public-display">{t("pointsPublicDisplayLabel")}</Label>
                    <p className="text-sm text-muted-foreground">{t("pointsPublicDisplayHint")}</p>
                  </div>
                  <Switch
                    id="points-public-display"
                    checked={classDoc.pointsPublicEnabled === true}
                    disabled={!canUpdateClass || setPointsPublicDisplay.isPending}
                    onCheckedChange={(checked) => {
                      void setPointsPublicDisplay.mutateAsync({
                        classId,
                        enabled: checked,
                      });
                    }}
                  />
                </div>
                {classDoc.pointsPublicEnabled === true && classDoc.pointsPublicSlug ? (
                  <PointsPublicDisplayShare
                    publicSlug={classDoc.pointsPublicSlug}
                    copyLabel={t("pointsPublicDisplayCopyLink")}
                    qrLabel={t("pointsPublicDisplayQrLabel")}
                  />
                ) : null}
              </CardContent>
            </Card>

            <Card id={SETTINGS_SECTION_IDS.banner} className={SETTINGS_CARD_CLASS}>
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

            {canManageClassroomScreen ? (
              <Card id={SETTINGS_SECTION_IDS.clock} className={SETTINGS_CARD_CLASS}>
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg font-semibold">
                      {tClassroomScreen("clockSettingsTitle")}
                    </CardTitle>
                    <CardDescription>
                      {tClassroomScreen("clockSettingsDescription")}
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    render={
                      <Link
                        to="/class/$classId/classroom-screen"
                        params={{ classId }}
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    }
                  >
                    <ExternalLink aria-hidden="true" />
                    {tClassroomScreen("openDisplay")}
                  </Button>
                </CardHeader>
                <CardContent>
                  <ClockSettingsSection classId={classId} />
                </CardContent>
              </Card>
            ) : null}
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
      {!showSkeleton && !isError && classDoc ? (
        <div className="sticky top-16 ml-auto hidden h-[calc(100vh-5rem)] w-52 shrink-0 overflow-y-auto xl:block">
          <TableOfContents items={tocItems} />
        </div>
      ) : null}
    </div>
  );
}
