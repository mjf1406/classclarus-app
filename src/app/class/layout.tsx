import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import "@/styles/globals.css";
import { type Metadata } from "next";

export const metadata: Metadata = {
  title: `ClassClarus - App`,
  description: `ClassClarus offers various tools and worksheet generators to help teachers create engaging and effective learning materials for their students.`,
  keywords: `ClassClarus, teacher tools, worksheet generator, education, classroom resources`,
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function ClassLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div>
      <SidebarProvider>
        <AppSidebar />
        <main className="w-full">
          <SidebarTrigger />
          {children}
        </main>
      </SidebarProvider>
    </div>
  );
}
