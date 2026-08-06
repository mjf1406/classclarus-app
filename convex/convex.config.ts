import { defineApp } from "convex/server";
import aggregate from "@convex-dev/aggregate/convex.config.js";
import polar from "@convex-dev/polar/convex.config";
import presence from "@convex-dev/presence/convex.config";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import authz from "@djpanda/convex-authz/convex.config";

const app = defineApp();
app.use(authz);
app.use(rateLimiter);
app.use(polar);
app.use(presence);
app.use(aggregate, { name: "usageByKind" });
app.use(aggregate, { name: "usageByDownloadOs" });
app.use(aggregate, { name: "githubClones" });

export default app;
