import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { ImageSkeleton } from "@/components/ui/image-skeleton";

export const Route = createFileRoute("/_public/unauthorized")({
  component: UnauthorizedUser,
});

function UnauthorizedUser() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-3">
          <div className="flex justify-center">
            <ImageSkeleton
              src="/brand/logo-403.webp"
              alt="Unauthorized User"
              width={327}
              height={341}
            />
          </div>
          <div>
            <CardTitle className="text-2xl flex items-center justify-center gap-2">
              <AlertTriangle className="h-6 w-6 text-destructive" />
              Unauthorized User
            </CardTitle>
            <CardDescription className="mt-2">
              You are not authorized to access this data/page/application.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              Only authorized accounts can access this data/page/application. If you believe this is
              an error, please contact the administrator.
            </p>
          </div>
          <Button variant="default" className="w-full" size="lg">
            <a href="https://www.classclarus.com">Learn more about ClassClarus</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
