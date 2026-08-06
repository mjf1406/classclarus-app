import { useMemo, useState } from "react";
import { KeyRound, SearchIcon, UsersIcon, XIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ResetPasswordCredenza } from "@/components/admin/ResetPasswordCredenza";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminResetPassword } from "@/hooks/admin/useAdminResetPassword";
import { useAdminUsers } from "@/hooks/admin/useAdminUsers";
import type { Id } from "../../../convex/_generated/dataModel";

type AdminUserRow = {
  _id: Id<"users">;
  email: string;
  name?: string;
  hasPassword: boolean;
};

export function AdminUsersPage() {
  const { t } = useTranslation("admin");
  const usersQuery = useAdminUsers();
  const resetPassword = useAdminResetPassword();
  const [searchQuery, setSearchQuery] = useState("");
  const [selected, setSelected] = useState<AdminUserRow | null>(null);

  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) => {
      const name = user.name?.toLowerCase() ?? "";
      return user.email.toLowerCase().includes(q) || name.includes(q);
    });
  }, [users, searchQuery]);

  const isPending = usersQuery.isPending || usersQuery.isAuthLoading;
  const showSearch = !isPending && !usersQuery.isError && (users.length > 0 || searchQuery.trim());
  const showEmpty = !isPending && !usersQuery.isError && users.length === 0;
  const showNoResults =
    !isPending && !usersQuery.isError && users.length > 0 && filtered.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      {showSearch ? (
        <InputGroup className="max-w-md">
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
            <InputGroupText>{t("searchResults", { count: filtered.length })}</InputGroupText>
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
      ) : null}

      {isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : null}

      {!isPending && usersQuery.isError ? (
        <ErrorState
          title={t("loadFailed")}
          onRetry={() => {
            void usersQuery.refetch();
          }}
        />
      ) : null}

      {showEmpty ? (
        <Empty card>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersIcon />
            </EmptyMedia>
            <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("emptyDescription")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {showNoResults ? (
        <Empty card>
          <EmptyHeader>
            <EmptyTitle>{t("searchNoResultsTitle")}</EmptyTitle>
            <EmptyDescription>{t("searchNoResults")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {!isPending && !usersQuery.isError && filtered.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {filtered.map((user) => (
            <li
              key={user._id}
              className="flex flex-col gap-3 rounded-2xl border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{user.name?.trim() || t("unnamedUser")}</p>
                <p className="truncate text-sm text-muted-foreground">{user.email}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                disabled={!user.hasPassword}
                title={user.hasPassword ? undefined : t("noPasswordAccount")}
                onClick={() => setSelected(user)}
              >
                <KeyRound data-icon="inline-start" />
                {t("resetPassword")}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {selected ? (
        <ResetPasswordCredenza
          open={selected !== null}
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
          email={selected.email}
          onConfirm={async (newPassword) => {
            await resetPassword.mutateAsync({
              userId: selected._id,
              newPassword,
            });
            setSelected(null);
          }}
        />
      ) : null}
    </div>
  );
}
