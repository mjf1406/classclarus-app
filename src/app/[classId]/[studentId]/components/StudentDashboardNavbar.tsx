/** @format */
import React from "react";
import { LogoHeader } from "@/components/brand/logo";
import { ThemeSelector } from "@/components/theme-selector";
import ThemeColorSelector from "./ThemeColorSelector";

export function StudentDashboardNavbar() {
  return (
    <nav className="bg-opacity-5 bg-card dark:border-b-foreground sticky top-0 z-10 w-full border-b backdrop-blur-xl backdrop-filter dark:border-b">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-2 md:px-4">
        <LogoHeader />
        <div className="flex items-center gap-2">
          <ThemeColorSelector />
          <ThemeSelector />
        </div>
      </div>
    </nav>
  );
}
