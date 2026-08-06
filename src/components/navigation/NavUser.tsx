import { Link, useNavigate } from "@tanstack/react-router";
import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronsUpDown, CreditCard, LogOut, Settings, Shield, Wallet } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useIsAppAdmin } from "@/hooks/admin/useIsAppAdmin";
import { useEntitlement } from "@/hooks/billing/useEntitlement";
import { useIsFeedbackAdmin } from "@/hooks/feedback/useIsFeedbackAdmin";
import { removeAllFileBytesQueries } from "@/hooks/files/useFileBytes";
import { useCurrentUser } from "@/hooks/user/useCurrentUser";
import { buildPlanSummary } from "@/lib/billing/planSummary";
import { isSelfHosted } from "@/lib/selfHosted";
import { getDisplayName, getInitials } from "@/lib/user/userDisplay";
import { sanitizeAvatarUrl } from "../../../convex/lib/avatarUrl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSidebar } from "../ui/sidebar-context";

type NavUserProps = {
  variant?: "sidebar" | "avatar";
};

function useAccountMenuState() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { data: user } = useCurrentUser();
  const { signOut } = useAuthActions();

  const handleSignOut = async () => {
    removeAllFileBytesQueries(queryClient);
    await signOut();
    await navigate({ to: "/login" });
  };

  return {
    isLoading,
    isAuthenticated,
    user,
    signOut: handleSignOut,
  };
}

function AccountMenuItems({ onSignOut }: { onSignOut: () => void }) {
  const { t } = useTranslation("common");
  const selfHosted = isSelfHosted();
  const { isAdmin: isSelfHostAdmin } = useIsAppAdmin();
  const { isAdmin: isFeedbackAdmin } = useIsFeedbackAdmin();
  const showSelfHostAdmin = selfHosted && isSelfHostAdmin;
  const showCloudAdmin = !selfHosted && isFeedbackAdmin;

  return (
    <>
      <DropdownMenuItem render={<Link to="/settings" />}>
        <Settings />
        {t("settings")}
      </DropdownMenuItem>
      <DropdownMenuItem render={<Link to="/account" />}>
        <CreditCard />
        {t("account")}
      </DropdownMenuItem>
      <DropdownMenuItem render={<Link to="/billing" />}>
        <Wallet />
        {t("billing")}
      </DropdownMenuItem>
      {showSelfHostAdmin ? (
        <DropdownMenuItem render={<Link to="/admin" />}>
          <Shield />
          {t("admin")}
        </DropdownMenuItem>
      ) : null}
      {showCloudAdmin ? (
        <DropdownMenuItem render={<Link to="/admin/feedback" />}>
          <Shield />
          {t("admin")}
        </DropdownMenuItem>
      ) : null}
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onClick={() => {
          onSignOut();
        }}
      >
        <LogOut />
        {t("signOut")}
      </DropdownMenuItem>
    </>
  );
}

function NavUserAvatar() {
  const { t } = useTranslation("common");
  const { isLoading, isAuthenticated, user, signOut } = useAccountMenuState();

  if (isLoading || (isAuthenticated && user === undefined)) {
    return (
      <Avatar>
        <AvatarFallback>...</AvatarFallback>
      </Avatar>
    );
  }

  if (!user?.email) {
    return (
      <Button variant="ghost" size="sm" nativeButton={false} render={<Link to="/login" />}>
        {t("signIn")}
      </Button>
    );
  }

  const displayName = getDisplayName(user);
  const initials = getInitials(user);
  const safeImage = sanitizeAvatarUrl(user.image);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            aria-label={t("openUserMenu")}
          />
        }
      >
        <Avatar>
          {safeImage ? (
            <AvatarImage src={safeImage} alt={displayName} referrerPolicy="no-referrer" />
          ) : null}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium leading-none">{displayName}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <AccountMenuItems
          onSignOut={() => {
            void signOut();
          }}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NavUserSidebar() {
  const { t } = useTranslation("common");
  const { t: tBilling, i18n } = useTranslation("billing");
  const { isMobile } = useSidebar();
  const { isLoading, isAuthenticated, user, signOut } = useAccountMenuState();
  const { data: raw, entitlement } = useEntitlement();

  const planLabel = useMemo(
    () =>
      buildPlanSummary({
        entitlement,
        subscription: raw?.subscription ?? null,
        locale: i18n.language,
        t: tBilling,
      }).compactLabel,
    [entitlement, raw?.subscription, i18n.language, tBilling],
  );

  if (isLoading || (isAuthenticated && user === undefined)) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" disabled>
            <Avatar className="size-8 rounded-lg">
              <AvatarFallback className="rounded-lg">…</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{t("loading")}</span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  if (!user?.email) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" render={<Link to="/login" />}>
            {t("signIn")}
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  const displayName = getDisplayName(user);
  const initials = getInitials(user);
  const safeImage = sanitizeAvatarUrl(user.image);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              />
            }
          >
            <Avatar className="size-8 rounded-lg">
              {safeImage ? (
                <AvatarImage src={safeImage} alt={displayName} referrerPolicy="no-referrer" />
              ) : null}
              <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{displayName}</span>
              <span className="truncate text-xs text-muted-foreground">{planLabel}</span>
            </div>
            <ChevronsUpDown className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <AccountMenuItems
              onSignOut={() => {
                void signOut();
              }}
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

export function NavUser({ variant = "sidebar" }: NavUserProps) {
  if (variant === "avatar") {
    return <NavUserAvatar />;
  }
  return <NavUserSidebar />;
}
