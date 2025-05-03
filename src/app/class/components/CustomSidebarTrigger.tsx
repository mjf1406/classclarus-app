"use client";

import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { PanelLeftIcon } from "lucide-react";

export function CustomSidebarTrigger() {
  const { isMobile, toggleSidebar } = useSidebar();

  return (
    <Button
      data-sidebar="trigger"
      data-slot="sidebar-trigger"
      onClick={toggleSidebar}
      variant="ghost"
      //   className={isMobile ? "size-5" : "size-7"}
      className="-mt-2"
      //   size="icon"
    >
      <PanelLeftIcon className={isMobile ? "[&>svg]:size-6" : "!h-4 !w-4"} />
      {/* <PanelLeftIcon size={isMobile ? 36 : 12} /> */}
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  );
}
