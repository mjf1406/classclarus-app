import { createFileRoute } from "@tanstack/react-router";

import { AudioPage } from "@/components/classroomScreen/AudioPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import type { Id } from "../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/_class/class/$classId/audio")({
  component: function ClassAudioPage() {
    const { classId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;

    return (
      <RequirePermission permission="classroomScreen:manage">
        <AudioPage classId={typedClassId} />
      </RequirePermission>
    );
  },
});
