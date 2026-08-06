import { Link } from "@tanstack/react-router";
import { AlertTriangle, FileQuestion } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageSkeleton } from "@/components/ui/image-skeleton";

type ClickAction = {
  label: string;
  onClick: () => void;
};

type LinkAction = {
  label: string;
  to: "/";
};

type Action = ClickAction | LinkAction;

type RouteErrorCardProps = {
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  primaryAction: Action;
  secondaryAction?: Action;
  tertiaryAction?: Action;
  icon?: "error" | "notFound";
};

export function RouteErrorCard({
  title,
  description,
  imageSrc,
  imageAlt,
  primaryAction,
  secondaryAction,
  tertiaryAction,
  icon = "error",
}: RouteErrorCardProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3 text-center">
          <div className="flex justify-center">
            <ImageSkeleton src={imageSrc} alt={imageAlt} width={327} height={341} />
          </div>
          <div>
            <CardTitle className="flex items-center justify-center gap-2 text-2xl">
              {icon === "error" ? <AlertTriangle className="text-destructive" /> : null}
              {icon === "notFound" ? <FileQuestion className="text-muted-foreground" /> : null}
              {title}
            </CardTitle>
            <CardDescription className="mt-2">{description}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <ActionButton action={primaryAction} variant="default" />
          {secondaryAction ? <ActionButton action={secondaryAction} variant="outline" /> : null}
          {tertiaryAction ? <ActionButton action={tertiaryAction} variant="ghost" /> : null}
        </CardContent>
      </Card>
    </div>
  );
}

function ActionButton({
  action,
  variant,
}: {
  action: Action;
  variant: "default" | "outline" | "ghost";
}) {
  if ("to" in action) {
    return (
      <Button
        variant={variant}
        className="w-full"
        size="lg"
        nativeButton={false}
        render={<Link to={action.to} />}
      >
        {action.label}
      </Button>
    );
  }

  return (
    <Button variant={variant} className="w-full" size="lg" onClick={action.onClick}>
      {action.label}
    </Button>
  );
}
