import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileQuestion } from "lucide-react";
import { ImageSkeleton } from "@/components/ui/image-skeleton";

export const Route = createFileRoute("/_public/$")({
  component: NotFound,
});

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-3">
          <div className="flex justify-center">
            <ImageSkeleton
              src="/brand/logo-404.webp"
              alt="404 Not Found"
              width={327}
              height={341}
            />
          </div>
          <div>
            <CardTitle className="text-2xl flex items-center justify-center gap-2">
              <FileQuestion className="h-6 w-6 text-muted-foreground" />
              404 Not Found
            </CardTitle>
            <CardDescription className="mt-2">
              The page you're looking for doesn't exist.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            variant="default"
            className="w-full"
            size="lg"
            onClick={() => window.history.back()}
          >
            Go Back
          </Button>
          <Button variant="outline" className="w-full" size="lg">
            <Link to="/" search={{ redirect: undefined }}>
              Go to Home
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
