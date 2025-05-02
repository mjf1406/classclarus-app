import "@/styles/globals.css";
import React from "react";
import { StudentDashboardNavbar } from "./components/StudentDashboardNavbar";
import StudentIconDecoration from "./components/StudentIconDecoration";

export default function StudentDashboardLayout({
  children,
  greeting,
  points,
  tasks,
  printing,
  glowsandgrows,
  rewarditems,
  expectations,
  achievements,
}: Readonly<{
  children: React.ReactNode;
  greeting: React.ReactNode;
  points: React.ReactNode;
  tasks: React.ReactNode;
  printing: React.ReactNode;
  glowsandgrows: React.ReactNode;
  rewarditems: React.ReactNode;
  expectations: React.ReactNode;
  achievements: React.ReactNode;
}>) {
  return (
    <>
      <StudentDashboardNavbar />
      <main className="mx-auto flex w-full flex-col items-center justify-center">
        <div className="flex w-full max-w-6xl flex-col gap-5 px-2 pb-10 md:px-4 lg:pt-3">
          {children}
          {greeting}
          <div className="flex w-full grid-cols-2 flex-col gap-5 pb-16 lg:grid">
            {tasks}
            {points}
            {glowsandgrows}
            {rewarditems}
            {expectations}
            {achievements}
            {printing}
          </div>
        </div>
        <StudentIconDecoration />
      </main>
    </>
  );
}
