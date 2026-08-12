import { Navigate } from "@tanstack/react-router";

import { useCan } from "@/hooks/permissions/useCan";
import type { Id } from "../../../convex/_generated/dataModel";

type AssignersSeatsIndexRedirectProps = {
  classId: Id<"classes">;
};

export function AssignersSeatsIndexRedirect({ classId }: AssignersSeatsIndexRedirectProps) {
  const { can, isPending } = useCan();

  if (isPending) {
    return null;
  }

  const isStaff = can("students:read");

  return (
    <Navigate
      to={
        isStaff
          ? "/class/$classId/assigners/seats/layouts"
          : "/class/$classId/assigners/seats/stats"
      }
      params={{ classId }}
      replace
    />
  );
}
