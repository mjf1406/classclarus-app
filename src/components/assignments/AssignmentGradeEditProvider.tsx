import type { ReactNode } from "react";

import {
  AssignmentGradeEditContext,
  type AssignmentGradeEditContextValue,
} from "@/components/assignments/assignmentGradeEditContext";

export function AssignmentGradeEditProvider({
  value,
  children,
}: {
  value: AssignmentGradeEditContextValue;
  children: ReactNode;
}) {
  return (
    <AssignmentGradeEditContext.Provider value={value}>
      {children}
    </AssignmentGradeEditContext.Provider>
  );
}
