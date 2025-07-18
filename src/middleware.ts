import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";

const studentDashboardRegex =
  /^\/class_[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\/student_[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}(?:\/.*)?$/;

const isPublicRoute = createRouteMatcher([
  /^\/auth\/sign-in(?:\/.*)?$/, // Public: /auth/sign-in and any subpaths
  /^\/auth\/sign-up(?:\/.*)?$/, // Public: /auth/sign-up and any subpaths
  /^\/api\/webhooks(?:\/.*)?$/, // Public: /api/webhooks and any subpaths
  /^\/api\/uploadthing(?:\/.*)?$/, // Public: /api/uploadthing and any subpaths
  studentDashboardRegex, // Public: /class_<GUID>/student_<GUID> and any subpaths
]);

export default clerkMiddleware(async (auth, req: NextRequest) => {
  // Pass the entire request object to isPublicRoute.
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
