import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

function Empty({
  className,
  card = false,
  ...props
}: React.ComponentProps<"div"> & { card?: boolean }) {
  return (
    <div
      data-slot="empty"
      data-card={card || undefined}
      className={cn(
        "flex w-full min-w-0 flex-1 flex-col items-center justify-center gap-4 p-12 text-center text-balance",
        card
          ? "rounded-2xl bg-card text-card-foreground ring-1 ring-foreground/10"
          : "rounded-lg border-dashed",
        className,
      )}
      {...props}
    />
  );
}

function EmptyHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-header"
      className={cn("flex max-w-sm flex-col items-center gap-2", className)}
      {...props}
    />
  );
}

const emptyMediaVariants = cva(
  "mb-2 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        icon: "flex shrink-0 items-center justify-center rounded-lg bg-muted text-foreground",
      },
      size: {
        // `!` beats FontAwesome's inline 1em height/width
        "10": "size-10 [&_svg:not([class*='size-'])]:size-6!",
        "16": "size-16 [&_svg:not([class*='size-'])]:size-8!",
        "20": "size-20 [&_svg:not([class*='size-'])]:size-10!",
        "24": "size-24 [&_svg:not([class*='size-'])]:size-12!",
        "32": "size-32 [&_svg:not([class*='size-'])]:size-16!",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "10",
    },
  },
);

function EmptyMedia({
  className,
  variant = "default",
  size = "10",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof emptyMediaVariants>) {
  return (
    <div
      data-slot="empty-icon"
      data-variant={variant}
      data-size={size}
      className={cn(
        emptyMediaVariants({
          variant,
          size: variant === "icon" ? size : null,
          className,
        }),
      )}
      {...props}
    />
  );
}

function EmptyTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-title"
      className={cn("font-heading text-lg font-medium tracking-tight", className)}
      {...props}
    />
  );
}

function EmptyDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <div
      data-slot="empty-description"
      className={cn(
        "text-sm/relaxed text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary",
        className,
      )}
      {...props}
    />
  );
}

function EmptyContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-content"
      className={cn(
        "flex w-full max-w-sm min-w-0 flex-col items-center gap-4 text-sm text-balance",
        className,
      )}
      {...props}
    />
  );
}

export { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent, EmptyMedia };
