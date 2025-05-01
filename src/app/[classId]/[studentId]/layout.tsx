import "@/styles/globals.css";
import { StudentDashboardNavbar } from "./components/StudentDashboardNavbar";
import type React from "react";

export default function StudentDashboardLayout({
  children,
  greeting,
  points,
}: Readonly<{
  children: React.ReactNode;
  greeting: React.ReactNode;
  points: React.ReactNode;
}>) {
  return (
    // <html lang="en" className={`${nunito.variable}`} suppressHydrationWarning>
    //   <body>
    //     <ThemeProvider
    //       attribute="class"
    //       defaultTheme="system"
    //       enableSystem
    //       disableTransitionOnChange
    //     >
    <>
      <StudentDashboardNavbar />
      <main className="flex grid-cols-3 flex-col gap-5 px-2 pb-10 md:px-4 lg:grid lg:pt-3">
        {children}
        {greeting}
        {points}
      </main>
    </>
    //       <Toaster richColors />
    //     </ThemeProvider>
    //   </body>
    // </html>
  );
}
