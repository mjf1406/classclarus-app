"use client";

import { SignIn } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { useTheme } from "next-themes";

export default function Page() {
  const { resolvedTheme } = useTheme();
  return (
    <div className="flex min-h-screen w-full items-center justify-center">
      <SignIn
        appearance={{
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          baseTheme: resolvedTheme === "dark" ? dark : undefined,
        }}
      />
    </div>
  );
}
