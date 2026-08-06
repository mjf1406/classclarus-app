import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { MenuIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { ThemeToggle } from "../theme/theme-toggle";
import { FeedbackNavButton } from "@/components/navigation/FeedbackNavButton";
import { NavUser } from "@/components/navigation/NavUser";
import { Logo } from "@/components/brand/Logo";
import { ConnectionStatus } from "@/components/navigation/ConnectionStatus";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useIsAppAdmin } from "@/hooks/admin/useIsAppAdmin";
import { isSelfHosted } from "@/lib/selfHosted";

const BASE_NAV_LINKS = [
  { to: "/account", labelKey: "account" },
  { to: "/billing", labelKey: "billing" },
  { to: "/join", labelKey: "join" },
  { to: "/settings", labelKey: "settings" },
] as const;

const desktopLinkClassName =
  "text-sm font-medium text-muted-foreground transition-colors hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

const mobileLinkClassName =
  "block w-full rounded-md px-3 py-3 text-base font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export function Navbar() {
  const { t } = useTranslation("common");
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isAdmin } = useIsAppAdmin();
  const selfHosted = isSelfHosted();
  const showAdmin = selfHosted && isAdmin;

  const navLinks = [
    ...BASE_NAV_LINKS,
    ...(showAdmin ? [{ to: "/admin", labelKey: "admin" } as const] : []),
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background pt-[env(safe-area-inset-top)]">
      <div className="relative mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-8">
        <Link
          to="/"
          className="flex shrink-0 items-center outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Logo />
        </Link>
        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-4 md:flex">
          {navLinks.map(({ to, labelKey }) => (
            <Link key={to} to={to} className={desktopLinkClassName}>
              {t(labelKey)}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden" />}>
              <MenuIcon />
              <span className="sr-only">{t("openNavMenu")}</span>
            </SheetTrigger>
            <SheetContent side="right" className="w-3/4 sm:max-w-sm">
              <SheetHeader>
                <SheetTitle>{t("navMenu")}</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-1 flex-col gap-1 px-4">
                {navLinks.map(({ to, labelKey }) => (
                  <Link
                    key={to}
                    to={to}
                    className={mobileLinkClassName}
                    onClick={() => setMobileOpen(false)}
                  >
                    {t(labelKey)}
                  </Link>
                ))}
              </nav>
              <SheetFooter className="border-t border-border">
                <div className="flex items-center gap-2">
                  <ThemeToggle />
                  <LanguageSwitcher />
                </div>
              </SheetFooter>
            </SheetContent>
          </Sheet>
          <FeedbackNavButton />
          <ConnectionStatus />
          <NavUser variant="avatar" />
          <div className="hidden items-center gap-2 md:flex">
            <ThemeToggle />
            <LanguageSwitcher />
          </div>
        </div>
      </div>
    </header>
  );
}
