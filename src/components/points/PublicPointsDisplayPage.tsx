import { Gift, TrophyIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { FontAwesomeIconFromId } from "@/components/icons/FontAwesomeIconFromId";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { APP_CONFIG } from "@/config/app";
import { usePublicPointsBoard } from "@/hooks/points/usePublicPointsBoard";
import { formatPurchaseLimitSummary } from "@/lib/rewards/purchaseLimit";
import { formatRewardPoints } from "@/lib/rewards/rewards";

type PublicPointsDisplayPageProps = {
  publicSlug: string;
};

export function PublicPointsDisplayPage({ publicSlug }: PublicPointsDisplayPageProps) {
  const { t, i18n } = useTranslation("points");
  const { t: tRewards } = useTranslation("rewards");
  const { data, isPending, isError, refetch } = usePublicPointsBoard(publicSlug);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col gap-10 px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">{APP_CONFIG.name}</p>
        {data ? <h1 className="text-3xl font-semibold tracking-tight">{data.className}</h1> : null}
      </header>

      {isPending ? (
        <div className="flex flex-col gap-8">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 12 }, (_, index) => (
              <Skeleton key={index} className="aspect-square rounded-2xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-36 rounded-2xl" />
            ))}
          </div>
        </div>
      ) : null}

      {isError ? (
        <ErrorState
          title={t("publicLoadFailed")}
          description={t("publicLoadFailedDescription")}
          onRetry={() => void refetch()}
        />
      ) : null}

      {!isPending && !isError && !data ? (
        <ErrorState title={t("publicNotFoundTitle")} description={t("publicNotFoundDescription")} />
      ) : null}

      {!isPending && !isError && data ? (
        <>
          <section className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold tracking-tight">{t("publicStudentsHeading")}</h2>
            {data.students.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("publicStudentsEmpty")}</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {data.students.map((student) => (
                  <div
                    key={student.rosterNumber}
                    className="relative flex aspect-square flex-col items-center justify-center rounded-2xl border border-border bg-card p-3"
                  >
                    <span
                      className="absolute top-1.5 left-1.5 inline-flex size-6 items-center justify-center rounded-md bg-muted text-xs font-semibold tabular-nums"
                      aria-label={t("publicRosterNumberAria", { number: student.rosterNumber })}
                    >
                      {student.rosterNumber}
                    </span>
                    <span
                      className="inline-flex items-center gap-1.5 text-3xl font-semibold tabular-nums tracking-tight sm:text-4xl"
                      aria-label={t("publicPointsAria", { points: student.pointsBalance })}
                    >
                      <TrophyIcon className="size-6 text-amber-400 sm:size-7" aria-hidden="true" />
                      {student.pointsBalance}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold tracking-tight">{t("publicRewardsHeading")}</h2>
            {data.rewards.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("publicRewardsEmpty")}</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.rewards.map((reward, index) => {
                  const description =
                    reward.description?.trim() || tRewards("emptyDescriptionPreview");
                  const pointsLabel = formatRewardPoints(reward.points, i18n.language);
                  const limitSummary = reward.purchaseLimit
                    ? formatPurchaseLimitSummary(reward.purchaseLimit, {
                        max: (count) => tRewards("purchaseLimitSummaryMax", { count }),
                        every: (count, period) =>
                          tRewards("purchaseLimitSummaryEvery", { count, period }),
                        period: (period) =>
                          tRewards(
                            `purchaseLimitPeriod_${period}` as
                              | "purchaseLimitPeriod_day"
                              | "purchaseLimitPeriod_week"
                              | "purchaseLimitPeriod_month",
                          ),
                      })
                    : null;

                  return (
                    <Card key={`${index}-${reward.name}`} size="sm" className="h-full">
                      <CardHeader className="flex flex-row items-start gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <FontAwesomeIconFromId
                            id={reward.icon}
                            className="size-5"
                            fallback={<Gift className="size-5" />}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-base font-semibold">{reward.name}</CardTitle>
                          <CardDescription className="mt-1 line-clamp-3">
                            {description}
                          </CardDescription>
                        </div>
                      </CardHeader>
                      <CardContent className="mt-auto flex flex-col gap-1">
                        <span className="inline-flex w-fit items-center rounded-md bg-muted px-2 py-0.5 text-sm font-semibold tabular-nums text-muted-foreground">
                          {tRewards("pointsValue", { points: pointsLabel })}
                        </span>
                        {limitSummary ? (
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {limitSummary}
                          </p>
                        ) : null}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
