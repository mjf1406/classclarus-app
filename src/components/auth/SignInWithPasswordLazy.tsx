import { lazy, Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";

const SignInWithPassword = lazy(() =>
  import("@/components/auth/SignInWithPassword").then((m) => ({
    default: m.SignInWithPassword,
  })),
);

type SignInWithPasswordLazyProps = {
  termsAccepted: boolean;
  redirectTo?: string;
};

export function SignInWithPasswordLazy({ termsAccepted, redirectTo }: SignInWithPasswordLazyProps) {
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full" />}>
      <SignInWithPassword termsAccepted={termsAccepted} redirectTo={redirectTo} />
    </Suspense>
  );
}
