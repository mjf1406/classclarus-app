import { BellIcon, SearchIcon, XIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { AsyncButton } from "@/components/ui/async-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ErrorState } from "@/components/ui/error-state";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useClasses } from "@/hooks/classes/useClasses";
import { useNotificationHistory } from "@/hooks/notifications/useNotificationHistory";
import {
  useDismissNotification,
  useMarkAllNotificationsSeen,
  useMarkNotificationSeen,
} from "@/hooks/notifications/useNotificationMutations";
import { useNotificationCounts } from "@/hooks/notifications/useNotifications";
import type { NotificationHistoryItem } from "@/hooks/notifications/useNotificationHistory";
import { toIntlLocale } from "@/lib/languages";
import {
  createdAfterMsForPreset,
  kindFilterArg,
  NOTIFICATION_DATE_PRESETS,
  NOTIFICATION_KIND_FILTERS,
  NOTIFICATION_STATUS_FILTERS,
  type NotificationDatePreset,
  type NotificationKindFilter,
  type NotificationStatusFilter,
} from "@/lib/notifications/history";

const SEARCH_DEBOUNCE_MS = 250;
const CLASS_FILTER_ALL = "all";

function formatNotificationTime(createdAt: number, locale: string): string {
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(createdAt));
}

function kindLabel(kind: string, t: (key: "calendarReminder") => string): string {
  return kind === "calendar_reminder" ? t("calendarReminder") : kind;
}

function NotificationsSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 5 }, (_, index) => (
        <Skeleton key={index} className="h-28 w-full rounded-2xl" />
      ))}
    </div>
  );
}

export function NotificationsPage() {
  const { t, i18n } = useTranslation("notifications");
  const navigate = useNavigate();
  const { data: classes } = useClasses();
  const { data: counts } = useNotificationCounts();
  const markSeen = useMarkNotificationSeen();
  const markAllSeen = useMarkAllNotificationsSeen();
  const dismiss = useDismissNotification();

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [status, setStatus] = useState<NotificationStatusFilter>("all");
  const [kind, setKind] = useState<NotificationKindFilter>("all");
  const [classId, setClassId] = useState(CLASS_FILTER_ALL);
  const [datePreset, setDatePreset] = useState<NotificationDatePreset>("all");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchQuery(searchInput);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [searchInput]);

  const createdAfterMs = useMemo(
    () => createdAfterMsForPreset(datePreset, Date.now()),
    [datePreset],
  );
  const history = useNotificationHistory({
    searchQuery,
    status,
    kind: kindFilterArg(kind),
    ...(classId !== CLASS_FILTER_ALL ? { classId } : {}),
    ...(createdAfterMs !== undefined ? { createdAfterMs } : {}),
  });

  const hasFilters =
    searchInput.trim().length > 0 ||
    status !== "all" ||
    kind !== "all" ||
    classId !== CLASS_FILTER_ALL ||
    datePreset !== "all";

  const classOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const classDoc of classes ?? []) {
      byId.set(classDoc._id, classDoc.name);
    }
    for (const item of history.results) {
      if (item.classId && item.className && !byId.has(item.classId)) {
        byId.set(item.classId, item.className);
      }
    }
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [classes, history.results]);

  const showLoaded = !history.isPending && !history.isAuthLoading && !history.isError;
  const showEmpty = showLoaded && history.results.length === 0 && !hasFilters;
  const showNoMatches = showLoaded && history.results.length === 0 && hasFilters;
  const unseen = counts?.unseen ?? 0;

  const openItem = (item: NotificationHistoryItem) => {
    if (!item.isSeen) {
      void markSeen.mutateAsync({ notificationId: item.notificationId });
    }
    if (item.kind === "calendar_reminder" && item.classId && item.eventId) {
      void navigate({
        to: "/class/$classId/calendar",
        params: { classId: item.classId },
        search: { event: item.eventId },
      });
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("title")}</h1>
          <p className="hidden text-muted-foreground sm:block">{t("pageDescription")}</p>
        </div>
        {unseen > 0 ? (
          <Button type="button" variant="outline" onClick={() => void markAllSeen.mutateAsync({})}>
            {t("markAllSeen")}
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        <InputGroup className="max-w-md">
          <InputGroupAddon>
            <SearchIcon aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value);
            }}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchLabel")}
            autoComplete="off"
            spellCheck={false}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupText>{t("searchResults", { count: history.results.length })}</InputGroupText>
            {searchInput ? (
              <InputGroupButton
                size="icon-xs"
                aria-label={t("searchClear")}
                onClick={() => {
                  setSearchInput("");
                  setSearchQuery("");
                }}
              >
                <XIcon />
              </InputGroupButton>
            ) : null}
          </InputGroupAddon>
        </InputGroup>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={status}
            onValueChange={(next) => {
              if (next && (NOTIFICATION_STATUS_FILTERS as ReadonlyArray<string>).includes(next)) {
                setStatus(next as NotificationStatusFilter);
              }
            }}
          >
            <SelectTrigger size="sm" aria-label={t("filterStatus")}>
              <SelectValue>{t(`status_${status}`)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {NOTIFICATION_STATUS_FILTERS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`status_${value}`)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Select
            value={kind}
            onValueChange={(next) => {
              if (next && (NOTIFICATION_KIND_FILTERS as ReadonlyArray<string>).includes(next)) {
                setKind(next as NotificationKindFilter);
              }
            }}
          >
            <SelectTrigger size="sm" aria-label={t("filterType")}>
              <SelectValue>{t(`kind_${kind}`)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {NOTIFICATION_KIND_FILTERS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`kind_${value}`)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Select
            value={classId}
            onValueChange={(next) => {
              if (next) setClassId(next);
            }}
          >
            <SelectTrigger size="sm" aria-label={t("filterClass")}>
              <SelectValue>
                {classId === CLASS_FILTER_ALL
                  ? t("classAll")
                  : (classOptions.find(([id]) => id === classId)?.[1] ?? t("classAll"))}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value={CLASS_FILTER_ALL}>{t("classAll")}</SelectItem>
                {classOptions.map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Select
            value={datePreset}
            onValueChange={(next) => {
              if (next && (NOTIFICATION_DATE_PRESETS as ReadonlyArray<string>).includes(next)) {
                setDatePreset(next as NotificationDatePreset);
              }
            }}
          >
            <SelectTrigger size="sm" aria-label={t("filterDate")}>
              <SelectValue>{t(`date_${datePreset}`)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {NOTIFICATION_DATE_PRESETS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`date_${value}`)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          {hasFilters ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchInput("");
                setSearchQuery("");
                setStatus("all");
                setKind("all");
                setClassId(CLASS_FILTER_ALL);
                setDatePreset("all");
              }}
            >
              {t("filterClear")}
            </Button>
          ) : null}
        </div>
      </div>

      {history.isPending || history.isAuthLoading ? <NotificationsSkeleton /> : null}

      {history.isError ? (
        <ErrorState
          card
          description={t("loadFailed")}
          onRetry={async () => {
            await history.refetch();
          }}
        />
      ) : null}

      {showEmpty ? (
        <Empty card>
          <EmptyHeader>
            <EmptyMedia variant="icon" size="20">
              <BellIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("emptyDescription")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {showNoMatches ? (
        <Empty card>
          <EmptyHeader>
            <EmptyMedia variant="icon" size="20">
              <SearchIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{t("searchEmptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("searchEmptyDescription")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {showLoaded && history.results.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {history.results.map((item) => (
            <li
              key={item._id}
              className={
                item.isSeen
                  ? "flex flex-col gap-3 rounded-2xl p-4 ring-1 ring-foreground/10"
                  : "flex flex-col gap-3 rounded-2xl bg-muted/50 p-4 ring-1 ring-foreground/10"
              }
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex flex-col gap-1">
                  <p className="font-medium">{item.title}</p>
                  {item.description ? (
                    <p className="line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{kindLabel(item.kind, t)}</Badge>
                    {item.className ? <Badge variant="outline">{item.className}</Badge> : null}
                    <Badge variant={item.statusKey === "unread" ? "default" : "outline"}>
                      {t(`status_${item.statusKey}`)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatNotificationTime(item.createdAt, i18n.language)}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" size="sm" onClick={() => openItem(item)}>
                    {t("view")}
                  </Button>
                  {!item.isSeen && !item.isDismissed ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void markSeen.mutateAsync({ notificationId: item.notificationId })
                      }
                    >
                      {t("markSeen")}
                    </Button>
                  ) : null}
                  {!item.isDismissed ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        void dismiss.mutateAsync({ notificationId: item.notificationId })
                      }
                    >
                      {t("dismiss")}
                    </Button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {history.hasNextPage ? (
        <AsyncButton
          type="button"
          variant="outline"
          className="self-center"
          pending={history.isFetchingNextPage}
          onClick={async () => {
            await history.fetchNextPage();
          }}
        >
          {t("loadMore")}
        </AsyncButton>
      ) : null}
    </div>
  );
}
