import { Link, useRouterState } from "@tanstack/react-router";
import { Home } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import type { ClassDoc } from "@/lib/classes/classes";

type ClassBreadcrumbProps = {
  classDoc: ClassDoc;
};

function pageLabelKey(pathname: string, classId: string): string {
  const base = `/class/${classId}`;
  if (pathname === base || pathname === `${base}/`) {
    return "navDashboard";
  }
  if (pathname === `${base}/settings`) return "navSettings";
  if (pathname === `${base}/activity`) return "navActivityLog";
  if (pathname === `${base}/teachers`) return "navTeachers";
  if (pathname === `${base}/assistant-teachers`) return "navAssistantTeachers";
  if (pathname === `${base}/students`) return "navStudents";
  if (pathname === `${base}/guardians`) return "navGuardians";
  if (pathname === `${base}/invitations`) return "navInvitations";
  return "navDashboard";
}

export function ClassBreadcrumb({ classDoc }: ClassBreadcrumbProps) {
  const { t } = useTranslation("classes");
  const { t: tCommon } = useTranslation("common");
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const pageKey = pageLabelKey(pathname, classDoc._id);

  return (
    <Breadcrumb aria-label={t("breadcrumb")}>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink render={<Link to="/" />} aria-label={tCommon("goHome")}>
            <Home className="size-4" />
            <span className="sr-only">{tCommon("goHome")}</span>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink
            render={
              <Link
                to="/class/$classId"
                params={{ classId: classDoc._id }}
                className="max-w-40 truncate"
              />
            }
          >
            {classDoc.name}
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{t(pageKey)}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
