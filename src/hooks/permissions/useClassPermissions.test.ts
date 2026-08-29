import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vite-plus/test";

import {
  cachedClassHasPermission,
  classPermissionsQueryKey,
} from "@/hooks/permissions/useClassPermissions";
import type { Id } from "../../../convex/_generated/dataModel";

const classId = "k5760dnm43rwxxy6gseazphqts8bek0s" as Id<"classes">;

describe("cachedClassHasPermission", () => {
  it("returns false when the snapshot is not cached", () => {
    const queryClient = new QueryClient();
    expect(cachedClassHasPermission(queryClient, classId, "points:manage")).toBe(false);
  });

  it("returns false for manage when the snapshot only has read", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(classPermissionsQueryKey(classId), {
      role: "student",
      permissions: ["class:read", "points:read", "attendance:read"],
    });
    expect(cachedClassHasPermission(queryClient, classId, "points:manage")).toBe(false);
    expect(cachedClassHasPermission(queryClient, classId, "attendance:manage")).toBe(false);
    expect(cachedClassHasPermission(queryClient, classId, "points:read")).toBe(true);
  });

  it("returns true when the snapshot includes the permission", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(classPermissionsQueryKey(classId), {
      role: "teacher",
      permissions: ["points:read", "points:manage", "attendance:manage"],
    });
    expect(cachedClassHasPermission(queryClient, classId, "points:manage")).toBe(true);
    expect(cachedClassHasPermission(queryClient, classId, "attendance:manage")).toBe(true);
  });
});
