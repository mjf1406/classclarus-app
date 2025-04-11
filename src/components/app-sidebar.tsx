import { Dices, Hammer, MonitorIcon, Signpost } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { ThemeSelector } from "./theme-selector";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { SignInButton } from "./SignInButton";
import MyClassesSidebar from "@/app/class/components/MyClassesSidebar";
import { LogoHeader } from "./brand/logo";
import { currentUser } from "@clerk/nextjs/server";
import type { PrivateMetaData } from "@/server/db/types/clerk-types";

const items = [
  {
    title: "Assigners",
    url: "/assigners",
    icon: Signpost,
  },
  {
    title: "Generators",
    url: "/generators",
    icon: Dices,
  },
  {
    title: "Screens",
    url: "/screens",
    icon: MonitorIcon,
  },
  {
    title: "Tools",
    url: "/tools",
    icon: Hammer,
  },
];

export async function AppSidebar() {
  const user = await currentUser();

  // Compute the display name:
  // If firstName and lastName exist, display them together.
  // Otherwise, fallback to username (or "User" if even username is not available).
  const displayName =
    (user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.username) ?? "User";

  // Compute plan from private metadata using ?? for fallback.
  const plan = (user?.privateMetadata?.plan as string) ?? "Free";
  const capitalizedPlan = plan.charAt(0).toUpperCase() + plan.slice(1);

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu className="items-center justify-center">
          <SidebarMenuItem>
            <LogoHeader />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Application</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <a href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {/* Class List */}
        <MyClassesSidebar />
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center justify-center gap-2">
          <SignedOut>
            <SignInButton />
          </SignedOut>
          <SignedIn>
            <div className="flex gap-2">
              <UserButton />
              <div className="flex flex-col">
                <div className="text-sm font-bold">{displayName}</div>
                <div className="text-xs font-semibold">{capitalizedPlan}</div>
              </div>
            </div>
          </SignedIn>
          <ThemeSelector />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
