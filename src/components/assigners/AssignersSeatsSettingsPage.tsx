import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { AssignersSeatsShell } from "@/components/assigners/AssignersSeatsShell";
import { ImportSeatAlgorithmSettingsCredenza } from "@/components/assigners/ImportSeatAlgorithmSettingsCredenza";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { useImportSeatAlgorithmSettings } from "@/hooks/assigners/useImportSeatAlgorithmSettings";
import { useSeatAlgorithmSettings } from "@/hooks/assigners/useSeatAlgorithmSettings";
import { useUpdateSeatAlgorithmSettings } from "@/hooks/assigners/useUpdateSeatAlgorithmSettings";
import { useCan } from "@/hooks/permissions/useCan";
import type { Id } from "../../../convex/_generated/dataModel";

const WEIGHT_KEYS = ["seat", "zone", "team", "neighbor", "gender", "combination"] as const;

type WeightKey = (typeof WEIGHT_KEYS)[number];

const WEIGHT_I18N: Record<
  WeightKey,
  | { label: "settingsWeightSeat"; hint: "settingsWeightSeatHint" }
  | {
      label:
        | "settingsWeightZone"
        | "settingsWeightTeam"
        | "settingsWeightNeighbor"
        | "settingsWeightGender"
        | "settingsWeightCombination";
      hint:
        | "settingsWeightZoneHint"
        | "settingsWeightTeamHint"
        | "settingsWeightNeighborHint"
        | "settingsWeightGenderHint"
        | "settingsWeightCombinationHint";
    }
> = {
  seat: { label: "settingsWeightSeat", hint: "settingsWeightSeatHint" },
  zone: { label: "settingsWeightZone", hint: "settingsWeightZoneHint" },
  team: { label: "settingsWeightTeam", hint: "settingsWeightTeamHint" },
  neighbor: { label: "settingsWeightNeighbor", hint: "settingsWeightNeighborHint" },
  gender: { label: "settingsWeightGender", hint: "settingsWeightGenderHint" },
  combination: { label: "settingsWeightCombination", hint: "settingsWeightCombinationHint" },
};

type AssignersSeatsSettingsPageProps = {
  classId: Id<"classes">;
};

export function AssignersSeatsSettingsPage({ classId }: AssignersSeatsSettingsPageProps) {
  const { t } = useTranslation("assigners");
  const { can } = useCan();
  const canManage = can("assigners:manage");
  const { data, isPending, isError, refetch } = useSeatAlgorithmSettings(classId);
  const updateSettings = useUpdateSeatAlgorithmSettings();
  const importSettings = useImportSeatAlgorithmSettings();
  const [importOpen, setImportOpen] = useState(false);
  const [weights, setWeights] = useState<Record<WeightKey, number>>({
    seat: 40,
    zone: 40,
    team: 60,
    neighbor: 50,
    gender: 30,
    combination: 35,
  });
  const [genderMode, setGenderMode] = useState<"off" | "oddEven">("oddEven");

  useEffect(() => {
    if (!data) return;
    setWeights({
      seat: data.weights.seat,
      zone: data.weights.zone,
      team: data.weights.team,
      neighbor: data.weights.neighbor,
      gender: data.weights.gender,
      combination: data.weights.combination,
    });
    setGenderMode(data.genderParity.mode);
  }, [data]);

  const persist = async (next: {
    weights: Record<WeightKey, number>;
    genderParity: { mode: "off" | "oddEven" };
  }) => {
    if (!canManage) return;
    await updateSettings.mutateAsync({
      classId,
      weights: next.weights,
      genderParity: next.genderParity,
    });
  };

  return (
    <AssignersSeatsShell
      classId={classId}
      tab="settings"
      description={t("settingsDescription")}
      action={
        canManage ? (
          <Button type="button" variant="outline" onClick={() => setImportOpen(true)}>
            <Download data-icon="inline-start" />
            {t("settingsImport")}
          </Button>
        ) : null
      }
    >
      {isPending ? <Skeleton className="h-64 w-full rounded-xl" /> : null}
      {isError ? (
        <ErrorState
          title={t("settingsSaveFailed")}
          description={t("loadFailedDescription")}
          onRetry={() => void refetch()}
        />
      ) : null}
      {!isPending && !isError && data ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("settingsTitle")}</CardTitle>
            <CardDescription>{t("settingsDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {WEIGHT_KEYS.map((key) => {
              const copy = WEIGHT_I18N[key];
              return (
                <Field key={key}>
                  <div className="flex items-center justify-between gap-3">
                    <FieldLabel>{t(copy.label)}</FieldLabel>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {weights[key]}
                    </span>
                  </div>
                  <FieldDescription>{t(copy.hint)}</FieldDescription>
                  <Slider
                    value={[weights[key]]}
                    min={0}
                    max={100}
                    step={5}
                    disabled={!canManage || updateSettings.isPending}
                    onValueChange={(value) => {
                      const nextValue = Array.isArray(value) ? (value[0] ?? weights[key]) : value;
                      const nextWeights = { ...weights, [key]: nextValue };
                      setWeights(nextWeights);
                    }}
                    onValueCommitted={(value) => {
                      const nextValue = Array.isArray(value) ? (value[0] ?? weights[key]) : value;
                      void persist({
                        weights: { ...weights, [key]: nextValue },
                        genderParity: { mode: genderMode },
                      });
                    }}
                  />
                </Field>
              );
            })}
            <Field>
              <FieldLabel>{t("settingsGenderParityLabel")}</FieldLabel>
              <Select
                value={genderMode}
                disabled={!canManage || updateSettings.isPending}
                onValueChange={(value) => {
                  if (value !== "off" && value !== "oddEven") return;
                  setGenderMode(value);
                  void persist({
                    weights,
                    genderParity: { mode: value },
                  });
                }}
              >
                <SelectTrigger className="max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="off">{t("settingsGenderParityOff")}</SelectItem>
                  <SelectItem value="oddEven">{t("settingsGenderParityOddEven")}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </CardContent>
        </Card>
      ) : null}

      <ImportSeatAlgorithmSettingsCredenza
        open={importOpen}
        onOpenChange={setImportOpen}
        targetClassId={classId}
        onSubmit={async (sourceClassId) => {
          await importSettings.mutateAsync({ classId, sourceClassId });
        }}
      />
    </AssignersSeatsShell>
  );
}
