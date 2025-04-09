/** @format */
import React from "react";
import { LogoHeader } from "./brand/logo";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";
import { ThemeSelector } from "./theme-selector";

export function Navbar() {
  return (
    <nav className="bg-opacity-5 bg-foreground/5 sticky top-0 z-10 w-full border-b backdrop-blur-xl backdrop-filter">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-2 md:px-4">
        {/* Logo on the left */}
        <LogoHeader />

        {/* On the right, conditionally render Clerk user button if signed in, else sign in button */}
        <div className="flex items-center justify-center gap-2">
          <SignedOut>
            <SignInButton />
            <SignUpButton />
          </SignedOut>
          <SignedIn>
            <UserButton />
          </SignedIn>
          <ThemeSelector />
        </div>
      </div>
    </nav>
  );
}
