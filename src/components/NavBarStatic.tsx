/** @format */
import React from "react";
import { LogoHeader } from "./brand/logo";
import { ThemeSelector } from "./theme-selector";
import { itemsCunt as navItems } from "./app-sidebar"; // renamed to navItems
import Link from "next/link";

export function NavbarStatic() {
  return (
    <nav className="bg-opacity-5 bg-card dark:border-b-foreground sticky top-0 z-10 w-full border-b backdrop-blur-xl backdrop-filter dark:border-b">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-2 md:px-4">
        <LogoHeader />
        <div className="flex items-center gap-4">
          <ul className="hidden space-x-4 md:flex">
            {navItems.map((item) => (
              <li key={item.title} className="flex items-center gap-1">
                <Link href={item.url} legacyBehavior>
                  <a
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-0.5 text-sm hover:underline"
                  >
                    {item.icon && (
                      <item.icon
                        size={18}
                        className="mr-1 inline align-middle"
                      />
                    )}
                    <span className="align-middle">{item.title}</span>
                    {item.icon_suffix && (
                      <item.icon_suffix
                        size={18}
                        className="ml-1 inline align-middle"
                      />
                    )}
                  </a>
                </Link>
              </li>
            ))}
          </ul>
          {/* <SignedOut>
            <SignInButton />
          </SignedOut>
          <SignedIn>
            <UserButton />
          </SignedIn> */}
          <ThemeSelector />
        </div>
      </div>
    </nav>
  );
}
