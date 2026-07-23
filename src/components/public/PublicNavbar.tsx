import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

// import { ClassNavUser } from "@/components/class-sidebar/ClassNavUser";
import { Logo } from "@/components/brand/Logo";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { ThemeToggle } from "../theme/theme-toggle";
import { Languages } from "lucide-react";
import { Button } from "../ui/button";

export function PublicNavbar() {
  const { t } = useTranslation("common");

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-8">
        <Link
          to="/"
          className="flex shrink-0 items-center outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={t("home")}
        >
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          {/* <ClassNavUser variant="avatar" /> */}
          <Avatar>
            <AvatarImage src="https://github.com/shadcn.png" />
            <AvatarFallback>CN</AvatarFallback>
          </Avatar>
          <ThemeToggle />
          <Button variant="outline" size="icon">
            <Languages />
          </Button>
        </div>
      </div>
    </header>
  );
}
