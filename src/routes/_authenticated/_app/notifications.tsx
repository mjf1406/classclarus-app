import { createFileRoute } from "@tanstack/react-router";

import { NotificationsPage } from "@/components/notifications/NotificationsPage";

export const Route = createFileRoute("/_authenticated/_app/notifications")({
  component: NotificationsPage,
});
