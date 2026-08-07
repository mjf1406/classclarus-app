import { UserMinusIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ClassRoleSelectLabel } from "@/components/badges/ClassRoleBadges";
import { Can } from "@/components/permissions/Can";
import { useClassPermissionsContext } from "@/components/permissions/classPermissionsContext";
import { useIsClassMemberOnline } from "@/components/presence/classPresenceContext";
import { Avatar, AvatarBadge, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  assignableRolesFor,
  canChangeMemberRole,
  removePermissionForMember,
  type JoinCodeRole,
} from "@/lib/members/members";
import { isJoinCodeRole } from "@/lib/permissions/classPermissions";
import {
  genderLabelKey,
  getRosterDisplayName,
  pronounLabelKey,
  type StudentRosterEntry,
} from "@/lib/roster/roster";
import { getInitials } from "@/lib/user/userDisplay";
import { sanitizeAvatarUrl } from "../../../convex/lib/avatarUrl";

type StudentRosterCardProps = {
  student: StudentRosterEntry;
  isSelf: boolean;
  onRemove: (student: StudentRosterEntry) => void;
  onChangeRole: (student: StudentRosterEntry, role: JoinCodeRole) => void;
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <span className="truncate text-sm">{value}</span>
    </div>
  );
}

export function StudentRosterCard({
  student,
  isSelf,
  onRemove,
  onChangeRole,
}: StudentRosterCardProps) {
  const { t } = useTranslation("classes");
  const { role: actorRole } = useClassPermissionsContext();
  const displayName = getRosterDisplayName(student, t("unnamedMember"));
  const initials = getInitials({
    _id: student.userId,
    name: displayName,
    email: student.email,
  });
  const safeImage = sanitizeAvatarUrl(student.image);
  const isOnline = useIsClassMemberOnline(student.userId);
  const removePermission = removePermissionForMember("student");
  const showRemove = !isSelf && removePermission !== null;
  const showRoleSelect = !isSelf && canChangeMemberRole(actorRole, "student");
  const roleOptions = actorRole ? assignableRolesFor(actorRole) : [];
  const dash = t("rosterUnset");

  const genderValue = student.gender
    ? student.gender === "selfDescribe" && student.genderSelfDescribe
      ? student.genderSelfDescribe
      : t(genderLabelKey(student.gender))
    : dash;

  const pronounsValue = student.pronouns
    ? student.pronouns === "askSelfDescribe" && student.pronounsSelfDescribe
      ? student.pronounsSelfDescribe
      : t(pronounLabelKey(student.pronouns))
    : dash;

  return (
    <div className="flex h-full flex-col gap-3 rounded-2xl border p-4">
      <div className="flex min-w-0 items-start gap-3">
        <Avatar className="size-12 shrink-0">
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
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex size-7 items-center justify-center rounded-md bg-muted text-xs font-semibold tabular-nums">
              {student.rosterNumber}
            </span>
            <span className="truncate text-sm font-medium">{displayName}</span>
          </div>
          {student.email?.trim() ? (
            <span className="truncate text-xs text-muted-foreground">{student.email}</span>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("rosterColumnLastName")} value={student.lastName?.trim() || dash} />
        <Field label={t("rosterColumnFirstName")} value={student.firstName?.trim() || dash} />
        <Field label={t("rosterColumnGender")} value={genderValue} />
        <Field label={t("rosterColumnPronouns")} value={pronounsValue} />
      </div>

      <div className="mt-auto flex flex-col gap-2">
        {showRoleSelect ? (
          <Select
            value="student"
            onValueChange={(next) => {
              if (next == null || !isJoinCodeRole(next) || next === "student") return;
              onChangeRole(student, next);
            }}
          >
            <SelectTrigger size="sm" className="w-full" aria-label={t("changeRole")}>
              <SelectValue>
                <ClassRoleSelectLabel role="student" colored />
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
              onClick={() => onRemove(student)}
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
