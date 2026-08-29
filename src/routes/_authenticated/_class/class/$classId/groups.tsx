import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { GroupsPage } from "@/components/groups/GroupsPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import { groupsBoardQueryOptions } from "@/hooks/groups/useGroupsBoard";
import { preloadQuery } from "@/lib/routing/routePreload";
import type { Id } from "../../../../../../convex/_generated/dataModel";

const groupsSearchSchema = z.object({
  focusStudentId: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/_class/class/$classId/groups")({
  validateSearch: groupsSearchSchema,
  loader: ({ context, params }) => {
    if (!context.auth.isAuthenticated) {
      return;
    }
    const classId = params.classId as Id<"classes">;
    preloadQuery(context.queryClient, groupsBoardQueryOptions(classId));
  },
  component: function ClassGroupsPage() {
    const { classId } = Route.useParams();
    const { focusStudentId } = Route.useSearch();
    const typedClassId = classId as Id<"classes">;

    return (
      <RequirePermission permission="class:read">
        <GroupsPage
          classId={typedClassId}
          focusStudentId={focusStudentId as Id<"users"> | undefined}
        />
      </RequirePermission>
    );
  },
});
