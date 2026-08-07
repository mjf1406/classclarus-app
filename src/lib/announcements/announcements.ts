import type { FunctionReturnType } from "convex/server";

import { api } from "../../../convex/_generated/api";

export type Announcement = NonNullable<FunctionReturnType<typeof api.announcements.get>>;
export type AnnouncementList = FunctionReturnType<typeof api.announcements.list>;
export type PublicAnnouncement = NonNullable<
  FunctionReturnType<typeof api.announcements.getByPublicSlug>
>;

export {
  MAX_ANNOUNCEMENT_ATTACHMENTS,
  MAX_ANNOUNCEMENT_BODY_JSON_LENGTH,
  MAX_ANNOUNCEMENT_TITLE_LENGTH,
} from "../../../convex/lib/announcementLimits";
