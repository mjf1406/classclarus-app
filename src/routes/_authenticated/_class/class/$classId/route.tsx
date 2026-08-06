import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { TrialBanner } from "@/components/billing/TrialBanner";
import { ClassPresenceChip } from "@/components/classes/ClassPresenceChip";
import { SelfHostUpdateBanner } from "@/components/classroom/SelfHostUpdateBanner";
import { AppFooter } from "@/components/navigation/AppFooter";
import { ClassContent } from "@/components/navigation/class-sidebar/ClassContent";
import {
  ClassBreadcrumbSkeleton,
  ClassSidebarSkeleton,
} from "@/components/navigation/class-sidebar/ClassLayoutSkeleton";
import { ClassAppSidebar } from "@/components/navigation/class-sidebar/ClassSidebar";
import { ClassBreadcrumb } from "@/components/navigation/class-sidebar/ClassBreadcrumb";
import { FeedbackNavButton } from "@/components/navigation/FeedbackNavButton";
import { ClassPermissionsProvider } from "@/components/permissions/ClassPermissionsProvider";
import { ClassPresenceProvider } from "@/components/presence/ClassPresenceProvider";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useClass } from "@/hooks/classes/useClass";
import { useRemoveFileBytesOnAccessLoss } from "@/hooks/files/useFileBytes";
import { isSubscriptionRequiredError } from "@/lib/billing/errors";
import type { Id } from "../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/_class/class/$classId")({
  component: function ClassLayout() {
    const { classId: classIdParam } = Route.useParams();
    const classId = classIdParam as Id<"classes">;
    const { data: classDoc, isPending, isError, error, refetch } = useClass(classId);
    const { t } = useTranslation("classes");
    const { t: tCommon } = useTranslation("common");
    const subscriptionRequired = !isPending && isError && isSubscriptionRequiredError(error);
    const classUnavailable = !isPending && (isError || !classDoc);

    useRemoveFileBytesOnAccessLoss(subscriptionRequired || classUnavailable);

    if (subscriptionRequired) {
      return <Navigate to="/billing" replace />;
    }

    if (classUnavailable) {
      return (
        <div>
          <div className="flex min-h-svh flex-col">
            <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 py-8">
              <Empty card>
                <EmptyHeader>
                  <EmptyTitle>{t("classNotFound")}</EmptyTitle>
                  <EmptyDescription>{tCommon("notFoundDescription")}</EmptyDescription>
                </EmptyHeader>
                <EmptyContent className="flex flex-row justify-center gap-2">
                  <Button type="button" variant="outline" onClick={() => void refetch()}>
                    {tCommon("tryAgain")}
                  </Button>
                  <Button type="button" nativeButton={false} render={<Link to="/" />}>
                    {tCommon("goHome")}
                  </Button>
                </EmptyContent>
              </Empty>
            </main>
          </div>
          <AppFooter />
        </div>
      );
    }

    return (
      <ClassPermissionsProvider classId={classId}>
        <ClassPresenceProvider classId={classId}>
          <SidebarProvider>
            {classDoc ? <ClassAppSidebar classDoc={classDoc} /> : <ClassSidebarSkeleton />}
            <SidebarInset>
              <div className="flex min-h-svh flex-col">
                <header className="sticky top-0 z-40 flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4">
                  <SidebarTrigger className="-ml-1" />
                  <Separator orientation="vertical" className="mr-2 h-4" />
                  <div className="min-w-0 flex-1">
                    {classDoc ? (
                      <ClassBreadcrumb classDoc={classDoc} />
                    ) : (
                      <ClassBreadcrumbSkeleton />
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <FeedbackNavButton />
                    {classDoc ? <ClassPresenceChip /> : null}
                  </div>
                </header>
                <SelfHostUpdateBanner />
                <TrialBanner />
                <div className="flex flex-1 flex-col">
                  <ClassContent classPending={isPending || !classDoc} />
                </div>
              </div>
              <AppFooter />
            </SidebarInset>
          </SidebarProvider>
        </ClassPresenceProvider>
      </ClassPermissionsProvider>
    );
  },
});
