import { ArrowRight, Dices, MonitorIcon } from "lucide-react";
import "src/lib/string.extensions.ts";

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
import { ThemeSelector } from "./theme-selector";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { SignInButton } from "./SignInButton";
import MyClassesSidebar from "@/app/class/components/MyClassesSidebar";
import { LogoHeader } from "./brand/logo";
import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";

export const itemsCunt = [
  {
    title: "Generators",
    url: "/tools/generators",
    icon: Dices,
    icon_suffix: ArrowRight,
  },
  {
    title: "Screens",
    url: "/tools/screens",
    icon: MonitorIcon,
    icon_suffix: ArrowRight,
  },
];

export async function AppSidebar() {
  const user = await currentUser();

  const displayName =
    (user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.username) ?? "User";

  const plan = (user?.privateMetadata?.plan as string) ?? "Free";
  const capitalizedPlan = plan.toTitleCase();

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
              {itemsCunt.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <Link
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <item.icon />
                      <span>{item.title}</span>
                      <item.icon_suffix />
                    </Link>
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
