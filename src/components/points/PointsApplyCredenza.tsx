import {
  AwardIcon,
  BanIcon,
  ChevronRightIcon,
  CoinsIcon,
  FlagIcon,
  FolderIcon,
  GiftIcon,
  LayoutGridIcon,
  ListIcon,
  LockIcon,
  LockOpenIcon,
  SearchIcon,
  TriangleAlertIcon,
  TrophyIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { FontAwesomeIconFromId } from "@/components/icons/FontAwesomeIconFromId";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Credenza,
  CredenzaBody,
  CredenzaClose,
  CredenzaContent,
  CredenzaDescription,
  CredenzaFooter,
  CredenzaHeader,
  CredenzaTitle,
} from "@/components/ui/credenza";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { HelpTip } from "@/components/ui/help-tip";
import { IconSwitch } from "@/components/ui/icon-switch";
import { NumberInput } from "@/components/ui/number-input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePointsCatalogSearch } from "@/hooks/points/usePointsCatalogSearch";
import { useLocalStorageValue } from "@/hooks/useLocalStorageValue";
import type { BehaviorListItem } from "@/lib/behaviors/behaviors";
import type {
  PointsApplyTab,
  PointsBoardStudent,
  PointsCatalogFolder,
  PointsCatalogView,
} from "@/lib/points/points";
import {
  formatApplyCatalogPoints,
  isPointsCatalogView,
  MAX_APPLICATION_NOTE_LENGTH,
  partitionPointsCatalogByFolder,
} from "@/lib/points/points";
import { STORAGE_KEYS } from "@/lib/storageKeys";
import { formatPurchaseLimitSummary, type PurchaseLimitPeriod } from "@/lib/rewards/purchaseLimit";
import {
  redeemPurchaseLimitBlock,
  type RewardPurchaseLimitStatus,
} from "@/lib/rewards/redeemPurchaseLimits";
import type { RewardListItem } from "@/lib/rewards/rewards";
import {
  genderLabelKey,
  getRosterDisplayName,
  pronounLabelKey,
  type RosterNameFormat,
} from "@/lib/roster/roster";
import { cn } from "@/lib/utils";
import type { Id } from "../../../convex/_generated/dataModel";

/** Fixed note + catalog panel — catalog flex-fills so tabs never shift height. */
const CATALOG_PANEL_CLASS = "flex h-80 flex-col gap-3";
const CATALOG_SCROLL_CLASS = "min-h-0 flex-1 overflow-y-auto rounded-xl border p-2";

/** Same column count on mobile and desktop (matches points student cards). */
const CATALOG_GRID_CLASS = "grid grid-cols-3 gap-2";

type CatalogItem = BehaviorListItem | RewardListItem;

function normalizeQty(quantity: number): number {
  return Number.isFinite(quantity) && quantity >= 1 ? Math.floor(quantity) : 1;
}

function minStudentBalance(students: readonly PointsBoardStudent[]): number {
  if (students.length === 0) return 0;
  return Math.min(...students.map((student) => student.pointsBalance));
}

function StudentWarningBits({ student }: { student: PointsBoardStudent }) {
  const { t } = useTranslation("points");
  if (student.warningCount <= 0 && student.minusCount <= 0) return null;
  return (
    <span className="inline-flex items-center gap-1.5">
      {student.warningCount > 0 ? (
        <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
          <TriangleAlertIcon className="size-3.5" aria-hidden />
          <span className="text-xs font-semibold tabular-nums">{student.warningCount}</span>
          <span className="sr-only">{t("warningsCount", { count: student.warningCount })}</span>
        </span>
      ) : null}
      {student.minusCount > 0 ? (
        <span className="inline-flex items-center gap-0.5 text-red-600 dark:text-red-400">
          <FlagIcon className="size-3.5" aria-hidden />
          <span className="text-xs font-semibold tabular-nums">{student.minusCount}</span>
          <span className="sr-only">{t("minusCount", { count: student.minusCount })}</span>
        </span>
      ) : null}
    </span>
  );
}

function StudentPointsBreakdown({ student }: { student: PointsBoardStudent }) {
  const { t } = useTranslation("points");
  return (
    <div className="mt-2 flex flex-col items-center gap-1.5">
      <div
        className="flex items-center gap-2 text-lg font-semibold tabular-nums"
        aria-label={t("statBalanceAria", { count: student.pointsBalance })}
      >
        <TrophyIcon className="size-5 shrink-0 text-amber-400" aria-hidden />
        <span>{student.pointsBalance}</span>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm tabular-nums text-muted-foreground">
        <span
          className="inline-flex items-center gap-1.5"
          aria-label={t("statAwardedAria", { count: student.pointsAwarded })}
        >
          <AwardIcon className="size-4 shrink-0 text-amber-500/90" aria-hidden />
          <span>{student.pointsAwarded}</span>
        </span>
        <span
          className="inline-flex items-center gap-1.5"
          aria-label={t("statRemovedAria", { count: student.pointsRemoved })}
        >
          <FlagIcon className="size-4 shrink-0 text-rose-500/90" aria-hidden />
          <span>{student.pointsRemoved === 0 ? 0 : -student.pointsRemoved}</span>
        </span>
        <span
          className="inline-flex items-center gap-1.5"
          aria-label={t("statRedeemedAria", { count: student.pointsRedeemed })}
        >
          <GiftIcon className="size-4 shrink-0 text-emerald-500/90" aria-hidden />
          <span>{student.pointsRedeemed}</span>
        </span>
      </div>
    </div>
  );
}

type ItemConstraint = {
  disabled: boolean;
  insufficientTooltip: string | null;
  limitTooltip: string | null;
};

type CatalogItemProps = {
  item: CatalogItem;
  checked: boolean;
  constraint: ItemConstraint;
  pointsLabel: string;
  view: PointsCatalogView;
  onToggle: (id: string, disabled: boolean) => void;
};

function CatalogItemControl({
  item,
  checked,
  constraint,
  pointsLabel,
  view,
  onToggle,
}: CatalogItemProps) {
  const { disabled, insufficientTooltip, limitTooltip } = constraint;
  const id = item._id;

  if (view === "grid") {
    return (
      <label
        className={cn(
          "relative flex min-h-[5.5rem] flex-col items-center gap-1 rounded-lg border px-1.5 py-2 text-center",
          disabled ? "cursor-not-allowed opacity-55" : "cursor-pointer hover:bg-muted/60",
          checked && !disabled && "border-primary/40 bg-muted/80",
        )}
      >
        <Checkbox
          checked={checked}
          disabled={disabled}
          onCheckedChange={() => onToggle(id, disabled)}
          aria-label={item.name}
          className="absolute top-1.5 left-1.5"
        />
        {item.icon ? (
          <FontAwesomeIconFromId id={item.icon} className="mt-3 size-5 shrink-0" />
        ) : (
          <span className="mt-3 size-5 shrink-0" />
        )}
        <span className="line-clamp-2 w-full text-xs font-medium leading-snug">{item.name}</span>
        <span className="text-xs tabular-nums text-muted-foreground">{pointsLabel}</span>
        {insufficientTooltip || limitTooltip ? (
          <span className="inline-flex items-center gap-1.5">
            {insufficientTooltip ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      className="inline-flex text-amber-600 dark:text-amber-400"
                      aria-label={insufficientTooltip}
                      onClick={(event) => event.preventDefault()}
                    />
                  }
                >
                  <CoinsIcon className="size-3.5" aria-hidden />
                </TooltipTrigger>
                <TooltipContent side="top">{insufficientTooltip}</TooltipContent>
              </Tooltip>
            ) : null}
            {limitTooltip ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      className="inline-flex text-amber-600 dark:text-amber-400"
                      aria-label={limitTooltip}
                      onClick={(event) => event.preventDefault()}
                    />
                  }
                >
                  <BanIcon className="size-3.5" aria-hidden />
                </TooltipTrigger>
                <TooltipContent side="top">{limitTooltip}</TooltipContent>
              </Tooltip>
            ) : null}
          </span>
        ) : null}
      </label>
    );
  }

  return (
    <label
      className={cn(
        "flex items-center gap-3 rounded-lg px-2 py-2",
        disabled ? "cursor-not-allowed opacity-55" : "cursor-pointer hover:bg-muted/60",
        checked && !disabled && "bg-muted/80",
      )}
    >
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={() => onToggle(id, disabled)}
        aria-label={item.name}
      />
      {item.icon ? (
        <FontAwesomeIconFromId id={item.icon} className="size-4 shrink-0" />
      ) : (
        <span className="size-4 shrink-0" />
      )}
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.name}</span>
      {insufficientTooltip || limitTooltip ? (
        <span className="inline-flex shrink-0 items-center gap-2.5">
          {insufficientTooltip ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    className="inline-flex text-amber-600 dark:text-amber-400"
                    aria-label={insufficientTooltip}
                    onClick={(event) => event.preventDefault()}
                  />
                }
              >
                <CoinsIcon className="size-4" aria-hidden />
              </TooltipTrigger>
              <TooltipContent side="top">{insufficientTooltip}</TooltipContent>
            </Tooltip>
          ) : null}
          {limitTooltip ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    className="inline-flex text-amber-600 dark:text-amber-400"
                    aria-label={limitTooltip}
                    onClick={(event) => event.preventDefault()}
                  />
                }
              >
                <BanIcon className="size-4" aria-hidden />
              </TooltipTrigger>
              <TooltipContent side="top">{limitTooltip}</TooltipContent>
            </Tooltip>
          ) : null}
        </span>
      ) : null}
      <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{pointsLabel}</span>
    </label>
  );
}

type PointsApplyCredenzaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  students: PointsBoardStudent[];
  nameFormat: RosterNameFormat;
  behaviors: BehaviorListItem[];
  rewards: RewardListItem[];
  behaviorFolders: PointsCatalogFolder[];
  rewardFolders: PointsCatalogFolder[];
  purchaseLimitStatuses: ReadonlyArray<RewardPurchaseLimitStatus>;
  purchaseLimitsPending: boolean;
  onApplyBehaviors: (args: {
    mode: "award" | "remove";
    items: Array<{ behaviorId: Id<"behaviors">; quantity: number; points: number }>;
    note?: string;
  }) => Promise<void>;
  onRedeemRewards: (args: {
    items: Array<{ rewardId: Id<"rewards">; quantity: number; points: number }>;
    allowOverride: boolean;
  }) => Promise<void>;
};

function studentMeta(
  student: PointsBoardStudent,
  tClasses: (key: string) => string,
): string | null {
  const genderLabel = student.gender
    ? student.gender === "selfDescribe" && student.genderSelfDescribe
      ? student.genderSelfDescribe
      : tClasses(genderLabelKey(student.gender))
    : null;
  const pronounsLabel = student.pronouns
    ? student.pronouns === "askSelfDescribe" && student.pronounsSelfDescribe
      ? student.pronounsSelfDescribe
      : tClasses(pronounLabelKey(student.pronouns))
    : null;
  const line = [genderLabel, pronounsLabel].filter(Boolean).join(" · ");
  return line || null;
}

export function PointsApplyCredenza({
  open,
  onOpenChange,
  students,
  nameFormat,
  behaviors,
  rewards,
  behaviorFolders,
  rewardFolders,
  purchaseLimitStatuses,
  purchaseLimitsPending,
  onApplyBehaviors,
  onRedeemRewards,
}: PointsApplyCredenzaProps) {
  const { t, i18n } = useTranslation("points");
  const { t: tClasses } = useTranslation("classes");
  const { t: tCommon } = useTranslation("common");
  const { t: tRewards } = useTranslation("rewards");
  const [tab, setTab] = useState<PointsApplyTab>("award");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [allowOverrides, setAllowOverrides] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [catalogView, setCatalogView] = useLocalStorageValue(
    STORAGE_KEYS.pointsCatalogView,
    "list",
    isPointsCatalogView,
  );
  const [openFolderIds, setOpenFolderIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) {
      setIsSubmitting(false);
      setSelectedIds(new Set());
      setQuantity(1);
      setNote("");
      setAllowOverrides(false);
      setTab("award");
      setSearchQuery("");
      setOpenFolderIds(new Set());
    }
  }, [open]);

  const awardBehaviors = useMemo(
    () => behaviors.filter((behavior) => behavior.points > 0),
    [behaviors],
  );
  const removeBehaviors = useMemo(
    () => behaviors.filter((behavior) => behavior.points < 0),
    [behaviors],
  );

  const panelCatalog = useMemo((): CatalogItem[] => {
    if (tab === "award") return awardBehaviors;
    if (tab === "remove") return removeBehaviors;
    return rewards;
  }, [tab, awardBehaviors, removeBehaviors, rewards]);

  const folders = tab === "redeem" ? rewardFolders : behaviorFolders;

  const { filtered: filteredCatalog } = usePointsCatalogSearch({
    items: panelCatalog,
    query: searchQuery,
  });

  const unfiledItems = useMemo(
    () => partitionPointsCatalogByFolder(filteredCatalog, null),
    [filteredCatalog],
  );

  const foldersWithItems = useMemo(
    () =>
      folders
        .map((folder) => ({
          folder,
          items: partitionPointsCatalogByFolder(filteredCatalog, folder._id),
        }))
        .filter((entry) => entry.items.length > 0),
    [folders, filteredCatalog],
  );

  // Search: auto-open folders that have matches. Clearing search collapses again.
  // Do not reset on live catalog updates while the query is empty (keeps manual opens).
  const prevHadSearchRef = useRef(false);
  useEffect(() => {
    const hasSearch = searchQuery.trim().length > 0;
    if (hasSearch) {
      setOpenFolderIds(new Set(foldersWithItems.map((entry) => entry.folder._id)));
    } else if (prevHadSearchRef.current) {
      setOpenFolderIds(new Set());
    }
    prevHadSearchRef.current = hasSearch;
  }, [searchQuery, foldersWithItems]);

  const primaryStudent = students[0];
  const multi = students.length > 1;
  const displayName = primaryStudent
    ? getRosterDisplayName(primaryStudent, tClasses("unnamedMember"), nameFormat)
    : "";
  const qty = normalizeQty(quantity);
  const redeemBalance = minStudentBalance(students);

  const selectedRedeemCost = useMemo(() => {
    if (tab !== "redeem") return 0;
    return rewards
      .filter((reward) => selectedIds.has(reward._id))
      .reduce((sum, reward) => sum + reward.points * qty, 0);
  }, [tab, rewards, selectedIds, qty]);

  const studentUserIds = useMemo(() => students.map((student) => student.userId), [students]);

  const formatLimitSummary = (limit: {
    maxPurchases: number;
    period: PurchaseLimitPeriod;
    every: number;
  }) =>
    formatPurchaseLimitSummary(
      { ...limit, type: "recurring" },
      {
        max: (count) => tRewards("purchaseLimitSummaryMax", { count }),
        every: (count, period) => tRewards("purchaseLimitSummaryEvery", { count, period }),
        period: (period) => tRewards(`purchaseLimitPeriod_${period}`),
      },
    );

  useEffect(() => {
    if (tab !== "redeem" || allowOverrides) return;
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      let running = 0;
      const next = new Set<string>();
      for (const reward of rewards) {
        if (!prev.has(reward._id)) continue;
        const cost = reward.points * qty;
        if (running + cost > redeemBalance) continue;
        const limitBlock = redeemPurchaseLimitBlock(
          reward._id,
          qty,
          next,
          studentUserIds,
          purchaseLimitStatuses,
        );
        if (limitBlock) continue;
        next.add(reward._id);
        running += cost;
      }
      if (next.size === prev.size && [...next].every((id) => prev.has(id))) return prev;
      return next;
    });
  }, [tab, rewards, qty, redeemBalance, studentUserIds, purchaseLimitStatuses, allowOverrides]);

  const toggleId = (id: string, disabled: boolean) => {
    if (disabled) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const itemConstraint = (item: CatalogItem): ItemConstraint => {
    const checked = selectedIds.has(item._id);
    const itemCost = item.points * qty;
    const otherSelectedCost = checked ? selectedRedeemCost - itemCost : selectedRedeemCost;
    const insufficient =
      tab === "redeem" &&
      (checked ? selectedRedeemCost > redeemBalance : otherSelectedCost + itemCost > redeemBalance);
    const limitBlock =
      tab === "redeem" && !purchaseLimitsPending
        ? redeemPurchaseLimitBlock(
            item._id as Id<"rewards">,
            qty,
            selectedIds,
            studentUserIds,
            purchaseLimitStatuses,
          )
        : null;
    const restricted = insufficient || limitBlock !== null;
    const disabled = (tab === "redeem" && purchaseLimitsPending) || (restricted && !allowOverrides);
    return {
      disabled,
      insufficientTooltip: insufficient
        ? t("insufficientPointsTooltip", {
            cost: itemCost,
            balance: redeemBalance,
          })
        : null,
      limitTooltip: limitBlock
        ? t("purchaseLimitReachedTooltip", {
            summary: formatLimitSummary(limitBlock),
          })
        : null,
    };
  };

  const renderItems = (items: CatalogItem[]) => {
    if (catalogView === "grid") {
      return (
        <div className={CATALOG_GRID_CLASS}>
          {items.map((item) => (
            <CatalogItemControl
              key={item._id}
              item={item}
              checked={selectedIds.has(item._id)}
              constraint={itemConstraint(item)}
              pointsLabel={formatApplyCatalogPoints(tab, item.points, i18n.language)}
              view="grid"
              onToggle={toggleId}
            />
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-1">
        {items.map((item) => (
          <CatalogItemControl
            key={item._id}
            item={item}
            checked={selectedIds.has(item._id)}
            constraint={itemConstraint(item)}
            pointsLabel={formatApplyCatalogPoints(tab, item.points, i18n.language)}
            view="list"
            onToggle={toggleId}
          />
        ))}
      </div>
    );
  };

  const submit = async () => {
    if (isSubmitting || selectedIds.size === 0 || students.length === 0) return;
    setIsSubmitting(true);
    onOpenChange(false);
    try {
      if (tab === "redeem") {
        const items = rewards
          .filter((reward) => selectedIds.has(reward._id))
          .map((reward) => ({
            rewardId: reward._id,
            quantity: qty,
            points: reward.points,
          }));
        await onRedeemRewards({ items, allowOverride: allowOverrides });
      } else {
        const source = tab === "award" ? awardBehaviors : removeBehaviors;
        const items = source
          .filter((behavior) => selectedIds.has(behavior._id))
          .map((behavior) => ({
            behaviorId: behavior._id,
            quantity: qty,
            points: behavior.points,
          }));
        const trimmedNote = note.trim();
        await onApplyBehaviors({
          mode: tab,
          items,
          ...(tab === "remove" && trimmedNote.length > 0 ? { note: trimmedNote } : {}),
        });
      }
    } catch {
      onOpenChange(true);
      setIsSubmitting(false);
    }
  };

  const singleMeta = !multi && primaryStudent ? studentMeta(primaryStudent, tClasses) : "";

  const catalogIsEmpty = panelCatalog.length === 0;
  const noMatches =
    !catalogIsEmpty && filteredCatalog.length === 0 && searchQuery.trim().length > 0;

  return (
    <Credenza open={open} onOpenChange={onOpenChange}>
      <CredenzaContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
        <CredenzaHeader
          className={cn(!multi && "relative items-center px-10 text-center md:text-center")}
        >
          {!multi && primaryStudent ? (
            <span className="absolute top-0 left-0 inline-flex items-center gap-1.5">
              <span className="inline-flex size-6 items-center justify-center rounded-md bg-muted text-[10px] font-semibold tabular-nums">
                {primaryStudent.rosterNumber}
              </span>
              <StudentWarningBits student={primaryStudent} />
            </span>
          ) : null}
          <CredenzaTitle>
            {multi ? t("applyTitleMulti", { count: students.length }) : displayName}
          </CredenzaTitle>
          <CredenzaDescription className={cn(!multi && "sr-only")}>
            {multi
              ? t("applyDescriptionMulti", { count: students.length })
              : primaryStudent
                ? t("applyDescriptionSingle", {
                    rosterNumber: primaryStudent.rosterNumber,
                  })
                : t("applyDescriptionMulti", { count: 0 })}
          </CredenzaDescription>
          {!multi && primaryStudent ? (
            <>
              {singleMeta ? <p className="text-sm text-muted-foreground">{singleMeta}</p> : null}
              <StudentPointsBreakdown student={primaryStudent} />
            </>
          ) : (
            <ul className="max-h-24 space-y-0.5 overflow-y-auto text-sm text-muted-foreground">
              {students.map((student) => (
                <li key={student.userId}>
                  #{student.rosterNumber}{" "}
                  {getRosterDisplayName(student, tClasses("unnamedMember"), nameFormat)}{" "}
                  <span className="tabular-nums">({student.pointsBalance})</span>
                </li>
              ))}
            </ul>
          )}
        </CredenzaHeader>

        <CredenzaBody className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <Tabs
            value={tab}
            onValueChange={(value) => {
              setTab(value as PointsApplyTab);
              setSelectedIds(new Set());
              setSearchQuery("");
              setOpenFolderIds(new Set());
              setNote("");
            }}
            className="min-h-0 flex-1"
          >
            <TabsList className="w-full">
              <TabsTrigger value="award">{t("tabAward")}</TabsTrigger>
              <TabsTrigger value="remove">{t("tabRemove")}</TabsTrigger>
              <TabsTrigger value="redeem">{t("tabRedeem")}</TabsTrigger>
            </TabsList>

            <div className="mt-3 mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <Field orientation="horizontal" className="w-auto">
                <FieldLabel htmlFor="points-qty" className="sr-only">
                  {t("quantityLabel")}
                </FieldLabel>
                <NumberInput
                  id="points-qty"
                  prefix="×"
                  min={1}
                  max={999}
                  value={quantity}
                  onValueChange={setQuantity}
                />
              </Field>
              {tab === "redeem" ? (
                <div className="inline-flex shrink-0 items-center gap-1">
                  <IconSwitch
                    id="points-allow-overrides"
                    checked={allowOverrides}
                    onCheckedChange={setAllowOverrides}
                    aria-label={t("allowOverridesLabel")}
                    checkedIcon={<LockOpenIcon aria-hidden="true" />}
                    uncheckedIcon={<LockIcon aria-hidden="true" />}
                  />
                  <HelpTip
                    title={t("allowOverridesLabel")}
                    description={t("allowOverridesDescription")}
                    ariaLabel={t("allowOverridesHelpAria")}
                  />
                </div>
              ) : null}
            </div>

            <div className="mb-3 flex items-center gap-2">
              <InputGroup className="min-w-0 flex-1">
                <InputGroupInput
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={t("searchPlaceholder")}
                  aria-label={t("searchLabel")}
                  autoComplete="off"
                  spellCheck={false}
                />
                <InputGroupAddon>
                  <SearchIcon aria-hidden="true" />
                </InputGroupAddon>
                <InputGroupAddon align="inline-end">
                  <InputGroupText>
                    {t("searchResults", { count: filteredCatalog.length })}
                  </InputGroupText>
                  {searchQuery ? (
                    <InputGroupButton
                      size="icon-xs"
                      aria-label={t("searchClear")}
                      onClick={() => setSearchQuery("")}
                    >
                      <XIcon />
                    </InputGroupButton>
                  ) : null}
                </InputGroupAddon>
              </InputGroup>
              <ToggleGroup
                variant="outline"
                spacing={0}
                value={[catalogView]}
                onValueChange={(value) => {
                  const next = value[0] as PointsCatalogView | undefined;
                  if (next === "list" || next === "grid") setCatalogView(next);
                }}
                className="shrink-0"
              >
                <ToggleGroupItem value="grid" aria-label={t("viewGrid")}>
                  <LayoutGridIcon />
                </ToggleGroupItem>
                <ToggleGroupItem value="list" aria-label={t("viewList")}>
                  <ListIcon />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* Fixed-height panel: catalog flex-fills leftover space when note is hidden. */}
            <div className={CATALOG_PANEL_CLASS}>
              {tab === "remove" ? (
                <Field className="shrink-0">
                  <FieldLabel htmlFor="points-remove-note">
                    {t("removeNoteLabel")}
                    <span className="font-normal text-muted-foreground">
                      ({tCommon("optional")})
                    </span>
                  </FieldLabel>
                  <Textarea
                    id="points-remove-note"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={t("removeNotePlaceholder")}
                    rows={2}
                    maxLength={MAX_APPLICATION_NOTE_LENGTH}
                  />
                </Field>
              ) : null}
              <div className={CATALOG_SCROLL_CLASS}>
                {catalogIsEmpty ? (
                  <p className="p-3 text-sm text-muted-foreground">{t("catalogEmpty")}</p>
                ) : noMatches ? (
                  <p className="p-3 text-sm text-muted-foreground">{t("catalogNoMatches")}</p>
                ) : (
                  <div className="space-y-2">
                    {foldersWithItems.map(({ folder, items }) => {
                      const open = openFolderIds.has(folder._id);
                      return (
                        <Collapsible
                          key={folder._id}
                          open={open}
                          onOpenChange={(nextOpen) => {
                            setOpenFolderIds((prev) => {
                              const next = new Set(prev);
                              if (nextOpen) next.add(folder._id);
                              else next.delete(folder._id);
                              return next;
                            });
                          }}
                        >
                          <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-medium hover:bg-muted/60">
                            <ChevronRightIcon
                              className={cn(
                                "size-4 shrink-0 text-muted-foreground transition-transform",
                                open && "rotate-90",
                              )}
                              aria-hidden
                            />
                            {folder.icon ? (
                              <FontAwesomeIconFromId id={folder.icon} className="size-4 shrink-0" />
                            ) : (
                              <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
                            )}
                            <span className="min-w-0 flex-1 truncate">{folder.name}</span>
                            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                              {t("folderItemCount", { count: items.length })}
                            </span>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="pt-1 pl-2">
                            {renderItems(items)}
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}

                    {unfiledItems.length > 0 ? (
                      <div className="space-y-1">
                        {foldersWithItems.length > 0 ? (
                          <p className="px-2 pt-1 text-xs font-medium text-muted-foreground">
                            {t("unfiledTitle")}
                          </p>
                        ) : null}
                        {renderItems(unfiledItems)}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </Tabs>
        </CredenzaBody>

        <CredenzaFooter className="gap-2 sm:justify-end">
          <CredenzaClose render={<Button type="button" variant="outline" />}>
            {t("cancel")}
          </CredenzaClose>
          <Button
            type="button"
            disabled={
              isSubmitting || selectedIds.size === 0 || (tab === "redeem" && purchaseLimitsPending)
            }
            onClick={() => {
              void submit();
            }}
          >
            {t("applyAction")}
          </Button>
        </CredenzaFooter>
      </CredenzaContent>
    </Credenza>
  );
}
