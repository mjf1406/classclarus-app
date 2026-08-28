import { describe, expect, it } from "vite-plus/test";

import { classDeletionJobsQueryKey } from "@/hooks/classes/useClassDeletionJobs";

describe("classDeletionJobsQueryKey", () => {
  it("uses the listForRequester convex query key", () => {
    const key = classDeletionJobsQueryKey();
    expect(key).toBeDefined();
    expect(JSON.stringify(key)).toContain("classDeletion");
    expect(JSON.stringify(key)).toContain("listForRequester");
  });
});
