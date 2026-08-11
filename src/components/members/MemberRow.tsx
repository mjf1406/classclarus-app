import { UserMinusIcon } from "lucide-react";
import { useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";

import { ClassRoleSelectLabel } from "@/components/badges/ClassRoleBadges";
import { Can } from "@/components/permissions/Can";
import { useClassPermissionsContext } from "@/components/permissions/classPermissionsContext";
import { useIsClassMemberOnline } from "@/components/presence/classPresenceContext";
import { Avatar, AvatarBadge, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
} from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useClassMembersByRole } from "@/hooks/members/useClassMembersByRole";
import { useCan } from "@/hooks/permissions/useCan";
import {
  assignableRolesFor,
  canChangeMemberRole,
  removePermissionForMember,
  roleLabelKey,
  type ClassMemberPublic,
  type JoinCodeRole,
  type LinkedStudentPublic,
} from "@/lib/members/members";
import { isJoinCodeRole } from "@/lib/permissions/classPermissions";
import { getDisplayName, getInitials } from "@/lib/user/userDisplay";
import type { Id } from "../../../convex/_generated/dataModel";
import { sanitizeAvatarUrl } from "../../../convex/lib/avatarUrl";

type MemberRowProps = {
  member: ClassMemberPublic;
  classId: Id<"classes">;
  /** Hide remove / role change for the current viewer (server also rejects). */
  isSelf: boolean;
  onRemove: (member: ClassMemberPublic) => void;
  onChangeRole: (member: ClassMemberPublic, role: JoinCodeRole) => void;
  onSetLinkedStudents?: (member: ClassMemberPublic, linkedStudents: LinkedStudentPublic[]) => void;
};

type StudentOption = {
  value: Id<"users">;
  label: string;
  name?: string;
};

function GuardianStudentSelect({
  classId,
  member,
  onSetLinkedStudents,
}: {
  classId: Id<"classes">;
  member: ClassMemberPublic;
  onSetLinkedStudents: (member: ClassMemberPublic, linkedStudents: LinkedStudentPublic[]) => void;
}) {
  const { t } = useTranslation("classes");
  const chipsAnchorRef = useRef<HTMLDivElement | null>(null);
  const { data: students, isPending, isError } = useClassMembersByRole(classId, "student");
  const selectedIds = (member.linkedStudents ?? []).map((student) => student.userId);

  const items = useMemo((): StudentOption[] => {
    const options: StudentOption[] = [];
    const seen = new Set<string>();
    for (const student of students ?? []) {
      seen.add(student.userId);
      options.push({
        value: student.userId,
        name: student.name,
        label: getDisplayName(
          {
            _id: student.userId,
            name: student.name,
            email: student.email,
          },
          t("unnamedMember"),
        ),
      });
    }
    // Keep already-linked students visible if the students list is still loading/stale.
    for (const linked of member.linkedStudents ?? []) {
      if (seen.has(linked.userId)) continue;
      options.push({
        value: linked.userId,
        name: linked.name,
        label: getDisplayName(
          { _id: linked.userId, name: linked.name, email: linked.email },
          t("unnamedMember"),
        ),
      });
    }
    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, [students, member.linkedStudents, t]);

  const selectedValue = useMemo(
    () => items.filter((item) => selectedIds.includes(item.value)),
    [items, selectedIds],
  );

  if (isPending) {
    return <Skeleton className="h-9 w-full rounded-4xl" />;
  }

  if (isError) {
    return <p className="text-xs text-muted-foreground">{t("membersLoadFailed")}</p>;
  }

  if (!students?.length) {
    return <p className="text-xs text-muted-foreground">{t("linkStudentsEmpty")}</p>;
  }

  return (
    <Combobox
      multiple
      items={items}
      value={selectedValue}
      isItemEqualToValue={(a, b) => a.value === b.value}
      onValueChange={(next) => {
        const linkedStudents: LinkedStudentPublic[] = (next ?? [])
          .map((item) => ({ userId: item.value, name: item.name }))
          .sort((a, b) => {
            const nameA = (a.name ?? a.userId).toLocaleLowerCase();
            const nameB = (b.name ?? b.userId).toLocaleLowerCase();
            return nameA.localeCompare(nameB);
          });
        onSetLinkedStudents(member, linkedStudents);
      }}
    >
      <ComboboxChips ref={chipsAnchorRef} className="w-full">
        <ComboboxValue>
          {(values: StudentOption[]) =>
            values.map((item) => <ComboboxChip key={item.value}>{item.label}</ComboboxChip>)
          }
        </ComboboxValue>
        <ComboboxChipsInput
          placeholder={selectedValue.length === 0 ? t("linkStudentsPlaceholder") : undefined}
          aria-label={t("linkStudents")}
        />
      </ComboboxChips>
      <ComboboxContent anchor={chipsAnchorRef}>
        <ComboboxEmpty>{t("membersSearchNoResults")}</ComboboxEmpty>
        <ComboboxList>
          {(item) => (
            <ComboboxItem key={item.value} value={item}>
              {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

function LinkedStudentsReadonly({ member }: { member: ClassMemberPublic }) {
  const { t } = useTranslation("classes");
  const linkedStudents = member.linkedStudents ?? [];
  if (linkedStudents.length === 0) {
    return <p className="text-xs text-muted-foreground">{t("noLinkedStudents")}</p>;
  }
  return (
    <div className="flex w-full flex-wrap items-center gap-1.5 rounded-4xl border border-input bg-input/30 px-2.5 py-1.5">
      {linkedStudents.map((student) => (
        <Badge key={student.userId} variant="secondary" className="rounded-4xl">
          {getDisplayName(
            { _id: student.userId, name: student.name, email: student.email },
            t("unnamedMember"),
          )}
        </Badge>
      ))}
    </div>
  );
}

export function MemberRow({
  member,
  classId,
  isSelf,
  onRemove,
  onChangeRole,
  onSetLinkedStudents,
}: MemberRowProps) {
  const { t } = useTranslation("classes");
  const { role: actorRole } = useClassPermissionsContext();
  const { can, isPending: permissionsPending } = useCan();
  const displayName = getDisplayName(
    {
      _id: member.userId,
      name: member.name,
      email: member.email,
    },
    t("unnamedMember"),
  );
  const initials = getInitials({
    _id: member.userId,
    name: member.name,
    email: member.email,
  });
  const removePermission = removePermissionForMember(member.role);
  const showRemove = !isSelf && removePermission !== null;
  const safeImage = sanitizeAvatarUrl(member.image);
  const isOnline = useIsClassMemberOnline(member.userId);

  const showRoleSelect =
    !isSelf && canChangeMemberRole(actorRole, member.role) && isJoinCodeRole(member.role);
  const roleOptions = actorRole ? assignableRolesFor(actorRole) : [];
  const showGuardianLinks = member.role === "guardian" && onSetLinkedStudents !== undefined;
  const canEditLinks = !permissionsPending && can("guardians:invite");

  return (
    <div className="flex h-full flex-col gap-3 rounded-2xl border p-4">
      <div className="flex min-w-0 flex-col items-center gap-2 text-center">
        <Avatar className="size-12">
          {safeImage ? (
            <AvatarImage src={safeImage} alt={displayName} referrerPolicy="no-referrer" />
          ) : null}
          <AvatarFallback>{initials}</AvatarFallback>
          {isOnline ? (
            <AvatarBadge
              className="size-3.5 bg-emerald-500 p-0 text-transparent"
              aria-label={t("presenceOnlineNow")}
            />
          ) : null}
        </Avatar>
        <div className="flex min-w-0 flex-col items-center gap-1">
          <div className="flex min-w-0 flex-wrap items-center justify-center gap-2">
            <span className="truncate text-sm font-medium">{displayName}</span>
            {member.role === "owner" ? (
              <Badge variant="secondary">{t(roleLabelKey(member.role))}</Badge>
            ) : null}
          </div>
          {member.email?.trim() && member.name?.trim() ? (
            <span className="truncate text-xs text-muted-foreground">{member.email}</span>
          ) : null}
        </div>
      </div>
      <div className="mt-auto flex flex-col gap-2">
        {showGuardianLinks ? (
          canEditLinks ? (
            <GuardianStudentSelect
              classId={classId}
              member={member}
              onSetLinkedStudents={onSetLinkedStudents}
            />
          ) : (
            <LinkedStudentsReadonly member={member} />
          )
        ) : null}
        {showRoleSelect ? (
          <Select
            value={member.role}
            onValueChange={(next) => {
              if (next == null || !isJoinCodeRole(next) || next === member.role) return;
              onChangeRole(member, next);
            }}
          >
            <SelectTrigger size="sm" className="w-full" aria-label={t("changeRole")}>
              <SelectValue>
                <ClassRoleSelectLabel role={member.role} colored />
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {roleOptions.map((role) => (
                  <SelectItem key={role} value={role}>
                    <ClassRoleSelectLabel role={role} />
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        ) : null}
        {showRemove && removePermission ? (
          <Can permission={removePermission}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => onRemove(member)}
            >
              <UserMinusIcon data-icon="inline-start" />
              {t("removeMember")}
            </Button>
          </Can>
        ) : null}
      </div>
    </div>
  );
}
