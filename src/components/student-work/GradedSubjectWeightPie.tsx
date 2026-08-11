import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Label, Pie, PieChart } from "recharts";

import { WeightSliceIcon, WeightSliceSvgIcon } from "@/components/student-work/WeightSliceIcon";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import {
  PIE_CHART_COLORS,
  formatWeightPercent,
  weightPercentDisplayDecimals,
} from "@/lib/gradedSubjects/gradedSubjects";
import { assignWeightSliceVisuals } from "@/lib/gradedSubjects/weightSliceVisuals";

export type WeightPieSlice = {
  /** Stable item key (`assignmentId:sectionKey`). */
  key: string;
  label: string;
  value: number;
};

type GradedSubjectWeightPieProps = {
  slices: WeightPieSlice[];
  totalPercent: number;
  totalValid: boolean;
};

const MIN_SLICE_LABEL_PERCENT = 0.02;
/** Icon size scales with the pie radius so labels stay readable on larger charts. */
function pieAnimalIconSize(outerRadius: number): number {
  return Math.round(Math.min(28, Math.max(18, outerRadius * 0.32)));
}

function pieAnimalLabelOffset(iconSize: number): number {
  return Math.round(iconSize * 0.7 + 6);
}

function weightSliceColor(index: number): string {
  return PIE_CHART_COLORS[index % PIE_CHART_COLORS.length] ?? "var(--chart-1)";
}

export function GradedSubjectWeightPie({
  slices,
  totalPercent,
  totalValid,
}: GradedSubjectWeightPieProps) {
  const { t } = useTranslation("studentWork");

  const itemKeys = useMemo(() => slices.map((slice) => slice.key), [slices]);

  const sliceVisuals = useMemo(() => assignWeightSliceVisuals(itemKeys), [itemKeys]);

  const weightDecimals = useMemo(
    () => weightPercentDisplayDecimals(slices.map((slice) => slice.value)),
    [slices],
  );

  const chartData = useMemo(
    () =>
      slices
        .map((slice, index) => ({
          key: `slice${index}`,
          itemKey: slice.key,
          label: slice.label,
          value: slice.value,
          fill: `var(--color-slice${index})`,
        }))
        .filter((slice) => slice.value > 0),
    [slices],
  );

  const chartConfig = useMemo(() => {
    const config: ChartConfig = {
      value: { label: t("weightsVisualLabel") },
    };
    for (const [index, slice] of slices.entries()) {
      config[`slice${index}`] = {
        label: slice.label,
        color: weightSliceColor(index),
      };
    }
    return config;
  }, [slices, t]);

  if (chartData.length === 0) {
    return (
      <div className="flex aspect-square max-h-64 w-full items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
        —
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer
        config={chartConfig}
        className="mx-auto aspect-square max-h-64 w-full overflow-visible [&_.recharts-wrapper]:overflow-visible"
      >
        <PieChart margin={{ top: 24, right: 24, bottom: 24, left: 24 }}>
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                hideLabel
                nameKey="key"
                formatter={(value, _name, item) => {
                  const payload =
                    typeof item?.payload === "object" && item.payload !== null
                      ? item.payload
                      : null;
                  const label =
                    payload !== null && "label" in payload && typeof payload.label === "string"
                      ? payload.label
                      : String(_name);
                  const itemKey =
                    payload !== null && "itemKey" in payload && typeof payload.itemKey === "string"
                      ? payload.itemKey
                      : null;
                  const visual = itemKey ? sliceVisuals.get(itemKey) : undefined;
                  const display =
                    typeof value === "number"
                      ? `${formatWeightPercent(value, weightDecimals)}%`
                      : String(value ?? "");
                  return (
                    <div className="flex flex-1 items-center justify-between gap-3 leading-none">
                      <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                        {visual ? (
                          <WeightSliceIcon
                            icon={visual.icon}
                            color={visual.color}
                            className="size-4"
                          />
                        ) : null}
                        <span className="truncate">{label}</span>
                      </span>
                      <span className="font-mono font-medium tabular-nums text-foreground">
                        {display}
                      </span>
                    </div>
                  );
                }}
              />
            }
          />
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="key"
            innerRadius={52}
            outerRadius={72}
            strokeWidth={2}
            paddingAngle={2}
            label={(props) => {
              const { cx, cy, midAngle, outerRadius, percent, payload } = props;
              if (
                cx == null ||
                cy == null ||
                midAngle == null ||
                outerRadius == null ||
                (percent ?? 0) < MIN_SLICE_LABEL_PERCENT
              ) {
                return null;
              }

              const itemKey =
                typeof payload === "object" &&
                payload !== null &&
                "itemKey" in payload &&
                typeof payload.itemKey === "string"
                  ? payload.itemKey
                  : null;
              if (!itemKey) return null;

              const visual = sliceVisuals.get(itemKey);
              if (!visual) return null;

              const outer = Number(outerRadius);
              const iconSize = pieAnimalIconSize(outer);
              const radian = Math.PI / 180;
              const radius = outer + pieAnimalLabelOffset(iconSize);
              const x = Number(cx) + radius * Math.cos(-midAngle * radian);
              const y = Number(cy) + radius * Math.sin(-midAngle * radian);

              return (
                <WeightSliceSvgIcon
                  icon={visual.icon}
                  color={visual.color}
                  x={x}
                  y={y}
                  size={iconSize}
                />
              );
            }}
          >
            <Label
              content={({ viewBox }) => {
                if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                  return (
                    <text
                      x={viewBox.cx}
                      y={viewBox.cy}
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      <tspan
                        x={viewBox.cx}
                        y={viewBox.cy}
                        className={cn(
                          "fill-foreground text-2xl font-semibold tabular-nums",
                          !totalValid && "fill-destructive",
                        )}
                      >
                        {formatWeightPercent(totalPercent, weightDecimals)}%
                      </tspan>
                      <tspan
                        x={viewBox.cx}
                        y={(viewBox.cy ?? 0) + 18}
                        className="fill-muted-foreground text-xs"
                      >
                        {t("weightsBreakdownTotal")}
                      </tspan>
                    </text>
                  );
                }
                return null;
              }}
            />
          </Pie>
        </PieChart>
      </ChartContainer>
      <p className="text-center text-xs text-muted-foreground">{t("weightsVisualIconsHelp")}</p>
    </div>
  );
}
