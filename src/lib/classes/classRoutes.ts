export type ClassNavTo =
  | "/class/$classId"
  | "/class/$classId/settings"
  | "/class/$classId/activity"
  | "/class/$classId/teachers"
  | "/class/$classId/assistant-teachers"
  | "/class/$classId/students"
  | "/class/$classId/guardians"
  | "/class/$classId/invitations";

const REST_TO_ROUTE: Record<string, ClassNavTo> = {
  "": "/class/$classId",
  "/settings": "/class/$classId/settings",
  "/activity": "/class/$classId/activity",
  "/teachers": "/class/$classId/teachers",
  "/assistant-teachers": "/class/$classId/assistant-teachers",
  "/students": "/class/$classId/students",
  "/guardians": "/class/$classId/guardians",
  "/invitations": "/class/$classId/invitations",
};

export function pathFor(to: ClassNavTo, classId: string): string {
  switch (to) {
    case "/class/$classId":
      return `/class/${classId}`;
    case "/class/$classId/settings":
      return `/class/${classId}/settings`;
    case "/class/$classId/activity":
      return `/class/${classId}/activity`;
    case "/class/$classId/teachers":
      return `/class/${classId}/teachers`;
    case "/class/$classId/assistant-teachers":
      return `/class/${classId}/assistant-teachers`;
    case "/class/$classId/students":
      return `/class/${classId}/students`;
    case "/class/$classId/guardians":
      return `/class/${classId}/guardians`;
    case "/class/$classId/invitations":
      return `/class/${classId}/invitations`;
  }
}

/** Map a class pathname to its nav route, preserving the subpage when possible. */
export function classRouteFromPathname(pathname: string, classId: string): ClassNavTo {
  const prefix = `/class/${classId}`;
  if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) {
    return "/class/$classId";
  }
  const rest = pathname.slice(prefix.length);
  return REST_TO_ROUTE[rest] ?? "/class/$classId";
}
