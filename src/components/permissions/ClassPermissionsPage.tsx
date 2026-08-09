import { KeyRoundIcon, TriangleAlertIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { ClassRoleSelectLabel } from "@/components/badges/ClassRoleBadges";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ErrorState } from "@/components/ui/error-state";
import { Field, FieldLabel } from "@/components/ui/field";
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
import { useMemberPermissions } from "@/hooks/permissions/useMemberPermissions";
import { useSetMemberPermission } from "@/hooks/permissions/useSetMemberPermission";
import { useStaffForPermissions } from "@/hooks/permissions/useStaffForPermissions";
import type { PermissionOverrideTargetRole } from "@/lib/permissions/classPermissions";
import { groupedGrantablePermissions } from "@/lib/permissions/permissionLabels";
import { getDisplayName } from "@/lib/user/userDisplay";
import type { Id } from "../../../convex/_generated/dataModel";

type ClassPermissionsPageProps = {
  classId: Id<"classes">;
};

type StaffMember = {
  userId: Id<"users">;
  name?: string;
  image?: string;
  email?: string;
  role: PermissionOverrideTargetRole;
};

type PermissionEntry = {
  permission: string;
  roleDefault: boolean;
  override: "allow" | "deny" | null;
  effective: boolean;
};

function PermissionsSkeleton() {
  return (
    <div className="flex w-full max-w-3xl flex-col gap-4">
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-10 w-full max-w-sm rounded-xl" />
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}

export function ClassPermissionsPage({ classId }: ClassPermissionsPageProps) {
  const { t } = useTranslation("classes");
  const staffQuery = useStaffForPermissions(classId);
  const [selectedUserId, setSelectedUserId] = useState<Id<"users"> | null>(null);
  const detailQuery = useMemberPermissions(classId, selectedUserId);
  const setPermission = useSetMemberPermission();
  const groups = useMemo(() => groupedGrantablePermissions(), []);

  const staff = (staffQuery.data ?? []) as StaffMember[];
  const selectedMember = staff.find((member) => member.userId === selectedUserId) ?? null;

  const showStaffLoading = staffQuery.isPending || staffQuery.isAuthLoading;
  const showStaffError = !showStaffLoading && staffQuery.isError;
  const showEmptyStaff = !showStaffLoading && !showStaffError && staff.length === 0;
  const showDetailLoading =
    selectedUserId !== null && (detailQuery.isPending || detailQuery.isAuthLoading);
  const showDetailError = selectedUserId !== null && !showDetailLoading && detailQuery.isError;

  const permissionByKey = useMemo(() => {
    const detailPermissions = (detailQuery.data?.permissions ?? []) as PermissionEntry[];
    const map = new Map<string, PermissionEntry>();
    for (const entry of detailPermissions) {
      map.set(entry.permission, entry);
    }
    return map;
  }, [detailQuery.data?.permissions]);

  return (
    <div className="flex w-full flex-col gap-6 p-4 md:p-6">
      <div className="flex max-w-3xl flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t("permissionsPageTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("permissionsPageDescription")}</p>
      </div>

      <Alert variant="warning" className="max-w-3xl">
        <TriangleAlertIcon className="size-6" />
        <AlertTitle>{t("permissionsRoleChangeWarningTitle")}</AlertTitle>
        <AlertDescription>{t("permissionsRoleChangeWarning")}</AlertDescription>
      </Alert>

      {showStaffLoading ? <PermissionsSkeleton /> : null}
      {showStaffError ? (
        <ErrorState
          title={t("permissionsLoadFailed")}
          onRetry={() => {
            void staffQuery.refetch();
          }}
        />
      ) : null}
      {showEmptyStaff ? (
        <Empty className="max-w-3xl border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <KeyRoundIcon />
            </EmptyMedia>
            <EmptyTitle>{t("permissionsEmptyStaffTitle")}</EmptyTitle>
            <EmptyDescription>{t("permissionsEmptyStaffDescription")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {!showStaffLoading && !showStaffError && staff.length > 0 ? (
        <div className="flex w-full max-w-3xl flex-col gap-6">
          <Field className="max-w-sm">
            <FieldLabel>{t("permissionsSelectMember")}</FieldLabel>
            <Select
              value={selectedUserId ?? undefined}
              onValueChange={(next) => {
                if (next == null) {
                  setSelectedUserId(null);
                  return;
                }
                setSelectedUserId(next as Id<"users">);
              }}
            >
              <SelectTrigger className="w-full" aria-label={t("permissionsSelectMember")}>
                <SelectValue placeholder={t("permissionsSelectMemberPlaceholder")}>
                  {selectedMember
                    ? getDisplayName(
                        {
                          _id: selectedMember.userId,
                          name: selectedMember.name,
                          email: selectedMember.email,
                        },
                        t("unnamedMember"),
                      )
                    : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {staff.map((member) => {
                    const label = getDisplayName(
                      {
                        _id: member.userId,
                        name: member.name,
                        email: member.email,
                      },
                      t("unnamedMember"),
                    );
                    return (
                      <SelectItem key={member.userId} value={member.userId}>
                        <span className="flex items-center gap-2">
                          <span>{label}</span>
                          <ClassRoleSelectLabel role={member.role} />
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          {selectedUserId === null ? (
            <p className="text-sm text-muted-foreground">{t("permissionsSelectMemberHint")}</p>
          ) : null}

          {showDetailLoading ? <Skeleton className="h-64 w-full rounded-2xl" /> : null}
          {showDetailError ? (
            <ErrorState
              title={t("permissionsLoadFailed")}
              onRetry={() => {
                void detailQuery.refetch();
              }}
            />
          ) : null}

          {selectedUserId !== null && detailQuery.data && !showDetailLoading && !showDetailError
            ? groups.map((group) => (
                <section
                  key={group.resource}
                  className="flex flex-col gap-3 rounded-2xl border p-4"
                >
                  <h2 className="text-sm font-semibold">
                    {t(group.groupKey as "permGroup_class")}
                  </h2>
                  <ul className="flex flex-col gap-3">
                    {group.permissions.map(({ permission, labelKey }) => {
                      const entry = permissionByKey.get(permission);
                      if (!entry) return null;
                      const modified = entry.override !== null;
                      return (
                        <li
                          key={permission}
                          className="flex items-center justify-between gap-3 border-b border-border/60 pb-3 last:border-b-0 last:pb-0"
                        >
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className="text-sm">{t(labelKey as "perm_class_read")}</span>
                            {modified ? (
                              <Badge variant="secondary">{t("permissionsModified")}</Badge>
                            ) : null}
                          </div>
                          <Switch
                            checked={entry.effective}
                            aria-label={t(labelKey as "perm_class_read")}
                            onCheckedChange={(checked) => {
                              void setPermission.mutateAsync({
                                classId,
                                userId: selectedUserId,
                                permission,
                                enabled: checked === true,
                              });
                            }}
                          />
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))
            : null}
        </div>
      ) : null}
    </div>
  );
}
