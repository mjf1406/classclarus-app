import {
  AssistantTeacherIcon,
  GuardianIcon,
  OwnerIcon,
  StudentIcon,
  TeacherIcon,
} from "@/components/icons/role-icons";

export const CLASS_ROLE_ICONS = {
  owner: OwnerIcon,
  teacher: TeacherIcon,
  assistant_teacher: AssistantTeacherIcon,
  student: StudentIcon,
  guardian: GuardianIcon,
} as const;
