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
import { isSelfHosted } from "@/lib/selfHosted";

function pageFromPathname(pathname: string): "users" | "feedback" {
  if (pathname === "/admin/feedback" || pathname.startsWith("/admin/feedback/")) {
    return "feedback";
  }
  return "users";
}

export function AdminBreadcrumb() {
  const { t } = useTranslation(["admin", "feedback", "common"]);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const page = pageFromPathname(pathname);
  const adminHomeTo = isSelfHosted() ? "/admin" : "/admin/feedback";
  const pageLabel = page === "feedback" ? t("feedback:adminNav") : t("admin:usersNav");

  return (
    <Breadcrumb aria-label={t("admin:breadcrumb")} className="min-w-0">
      <BreadcrumbList className="text-muted-foreground/80">
        <BreadcrumbItem>
          <BreadcrumbLink
            render={<Link to="/" />}
            aria-label={t("common:goHome")}
            className="text-muted-foreground hover:text-foreground"
          >
            <Home className="size-4" />
            <span className="sr-only">{t("common:goHome")}</span>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="text-muted-foreground/50" />
        <BreadcrumbItem>
          <BreadcrumbLink
            render={<Link to={adminHomeTo} />}
            className="text-muted-foreground hover:text-foreground"
          >
            {t("common:admin")}
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="text-muted-foreground/50" />
        <BreadcrumbItem>
          <BreadcrumbPage className="font-medium text-foreground">{pageLabel}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
