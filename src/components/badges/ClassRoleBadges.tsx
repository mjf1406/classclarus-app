import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import {
  AssistantTeacherBadge,
  AssistantTeacherIcon,
  GuardianBadge,
  GuardianIcon,
  OwnerBadge,
  OwnerIcon,
  StudentBadge,
  StudentIcon,
  TeacherBadge,
  TeacherIcon,
} from "@/components/icons/role-icons";
import { CLASS_ROLE_ICONS } from "@/components/icons/role-icon-maps";
import { cn } from "@/lib/utils";

const ROLE_LABEL_KEYS = {
  owner: "roleOwner",
  teacher: "roleTeacher",
  assistant_teacher: "roleAssistantTeacher",
  student: "roleStudent",
  guardian: "roleGuardian",
} as const;

type KnownRole = keyof typeof ROLE_LABEL_KEYS;

type ClassRoleBadgeProps = {
  role: string;
  className?: string;
};

function roleLabel(role: string, t: (key: string) => string): string {
  const labelKey = role in ROLE_LABEL_KEYS ? ROLE_LABEL_KEYS[role as KnownRole] : null;
  return labelKey ? t(labelKey) : role;
}

type ClassRoleSelectLabelProps = {
  role: string;
  /** Role color on the icon. Use for the closed trigger; omit in the menu. */
  colored?: boolean;
  className?: string;
};

/** Icon + translated role label for role `<Select>` triggers and items. */
export function ClassRoleSelectLabel({
  role,
  colored = false,
  className,
}: ClassRoleSelectLabelProps) {
  const { t } = useTranslation("classes");
  const label = roleLabel(role, t);
  const Icon = role in CLASS_ROLE_ICONS ? CLASS_ROLE_ICONS[role as KnownRole] : null;

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {Icon ? (
        <Icon className={cn("size-4", !colored && "text-current dark:text-current")} aria-hidden />
      ) : null}
      {label}
    </span>
  );
}

/** Icon + translated role label (home class cards, etc.). */
export function ClassRoleBadge({ role, className }: ClassRoleBadgeProps) {
  const { t } = useTranslation("classes");
  const label = roleLabel(role, t);

  switch (role) {
    case "owner":
      return <OwnerBadge className={className}>{label}</OwnerBadge>;
    case "teacher":
      return <TeacherBadge className={className}>{label}</TeacherBadge>;
    case "assistant_teacher":
      return <AssistantTeacherBadge className={className}>{label}</AssistantTeacherBadge>;
    case "student":
      return <StudentBadge className={className}>{label}</StudentBadge>;
    case "guardian":
      return <GuardianBadge className={className}>{label}</GuardianBadge>;
    default:
      return (
        <Badge variant="outline" className={className}>
          {label}
        </Badge>
      );
  }
}

/** Icon-only role badge (class switcher, compact UI). */
export function ClassRoleIconBadge({ role, className }: ClassRoleBadgeProps) {
  const { t } = useTranslation("classes");
  const label = roleLabel(role, t);
  const iconClassName = "size-3";

  switch (role) {
    case "owner":
      return (
        <Badge
          variant="outline"
          aria-label={label}
          className={cn(
            "gap-0 border-amber-600 px-1.5 text-amber-600 dark:border-amber-400 dark:text-amber-400",
            className,
          )}
        >
          <OwnerIcon className={iconClassName} aria-hidden />
        </Badge>
      );
    case "teacher":
      return (
        <Badge
          variant="outline"
          aria-label={label}
          className={cn(
            "gap-0 border-purple-600 px-1.5 text-purple-600 dark:border-purple-400 dark:text-purple-400",
            className,
          )}
        >
          <TeacherIcon className={iconClassName} aria-hidden />
        </Badge>
      );
    case "assistant_teacher":
      return (
        <Badge
          variant="outline"
          aria-label={label}
          className={cn(
            "gap-0 border-cyan-600 px-1.5 text-cyan-600 dark:border-cyan-400 dark:text-cyan-400",
            className,
          )}
        >
          <AssistantTeacherIcon className={iconClassName} aria-hidden />
        </Badge>
      );
    case "student":
      return (
        <Badge
          variant="outline"
          aria-label={label}
          className={cn(
            "gap-0 border-green-600 px-1.5 text-green-600 dark:border-green-400 dark:text-green-400",
            className,
          )}
        >
          <StudentIcon className={iconClassName} aria-hidden />
        </Badge>
      );
    case "guardian":
      return (
        <Badge
          variant="outline"
          aria-label={label}
          className={cn(
            "gap-0 border-pink-600 px-1.5 text-pink-600 dark:border-pink-400 dark:text-pink-400",
            className,
          )}
        >
          <GuardianIcon className={iconClassName} aria-hidden />
        </Badge>
      );
    default:
      return null;
  }
}
