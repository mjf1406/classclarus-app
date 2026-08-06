export type ClassroomSessionStatus = "starting" | "running" | "deploying" | "error" | "stopped";

export type ClassroomSession = {
  status: ClassroomSessionStatus;
  lanBaseUrl: string | null;
  loopbackBaseUrl: string;
  convexUrl: string;
  convexSiteUrl: string;
  webPort: number;
  convexPort: number;
  sitePort: number;
  lanIp: string | null;
  errorMessage: string | null;
  trustedLanWarning: boolean;
};

export const CLASSROOM_IPC = {
  getSession: "classroom:getSession",
  onSession: "classroom:onSession",
} as const;
