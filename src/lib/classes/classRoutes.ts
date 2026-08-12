export type ClassNavTo =
  | "/class/$classId"
  | "/class/$classId/settings"
  | "/class/$classId/permissions"
  | "/class/$classId/activity"
  | "/class/$classId/announcements"
  | "/class/$classId/attendance"
  | "/class/$classId/tasks"
  | "/class/$classId/assignments"
  | "/class/$classId/points"
  | "/class/$classId/behaviors"
  | "/class/$classId/rewards"
  | "/class/$classId/expectations"
  | "/class/$classId/raz"
  | "/class/$classId/groups"
  | "/class/$classId/assigners/seats"
  | "/class/$classId/assigners/random"
  | "/class/$classId/assigners/equitable"
  | "/class/$classId/sw/grade-scales"
  | "/class/$classId/sw/graded-subjects"
  | "/class/$classId/teachers"
  | "/class/$classId/assistant-teachers"
  | "/class/$classId/students"
  | "/class/$classId/guardians"
  | "/class/$classId/invitations";

const REST_TO_ROUTE: Record<string, ClassNavTo> = {
  "": "/class/$classId",
  "/settings": "/class/$classId/settings",
  "/permissions": "/class/$classId/permissions",
  "/activity": "/class/$classId/activity",
  "/announcements": "/class/$classId/announcements",
  "/attendance": "/class/$classId/attendance",
  "/tasks": "/class/$classId/tasks",
  "/assignments": "/class/$classId/assignments",
  "/points": "/class/$classId/points",
  "/behaviors": "/class/$classId/behaviors",
  "/rewards": "/class/$classId/rewards",
  "/expectations": "/class/$classId/expectations",
  "/raz": "/class/$classId/raz",
  "/groups": "/class/$classId/groups",
  "/assigners/seats": "/class/$classId/assigners/seats",
  "/assigners/random": "/class/$classId/assigners/random",
  "/assigners/equitable": "/class/$classId/assigners/equitable",
  "/sw/grade-scales": "/class/$classId/sw/grade-scales",
  "/sw/graded-subjects": "/class/$classId/sw/graded-subjects",
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
    case "/class/$classId/permissions":
      return `/class/${classId}/permissions`;
    case "/class/$classId/activity":
      return `/class/${classId}/activity`;
    case "/class/$classId/announcements":
      return `/class/${classId}/announcements`;
    case "/class/$classId/attendance":
      return `/class/${classId}/attendance`;
    case "/class/$classId/tasks":
      return `/class/${classId}/tasks`;
    case "/class/$classId/assignments":
      return `/class/${classId}/assignments`;
    case "/class/$classId/points":
      return `/class/${classId}/points`;
    case "/class/$classId/behaviors":
      return `/class/${classId}/behaviors`;
    case "/class/$classId/rewards":
      return `/class/${classId}/rewards`;
    case "/class/$classId/expectations":
      return `/class/${classId}/expectations`;
    case "/class/$classId/raz":
      return `/class/${classId}/raz`;
    case "/class/$classId/groups":
      return `/class/${classId}/groups`;
    case "/class/$classId/assigners/seats":
      return `/class/${classId}/assigners/seats`;
    case "/class/$classId/assigners/random":
      return `/class/${classId}/assigners/random`;
    case "/class/$classId/assigners/equitable":
      return `/class/${classId}/assigners/equitable`;
    case "/class/$classId/sw/grade-scales":
      return `/class/${classId}/sw/grade-scales`;
    case "/class/$classId/sw/graded-subjects":
      return `/class/${classId}/sw/graded-subjects`;
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
  if (rest === "/announcements" || rest.startsWith("/announcements/")) {
    return "/class/$classId/announcements";
  }
  if (rest === "/tasks" || rest.startsWith("/tasks/")) {
    return "/class/$classId/tasks";
  }
  if (rest === "/assignments" || rest.startsWith("/assignments/")) {
    return "/class/$classId/assignments";
  }
  if (rest === "/expectations" || rest.startsWith("/expectations/")) {
    return "/class/$classId/expectations";
  }
  if (rest === "/raz" || rest.startsWith("/raz/")) {
    return "/class/$classId/raz";
  }
  if (rest === "/assigners/seats" || rest.startsWith("/assigners/seats/")) {
    return "/class/$classId/assigners/seats";
  }
  if (rest === "/assigners/random" || rest.startsWith("/assigners/random/")) {
    return "/class/$classId/assigners/random";
  }
  if (rest === "/assigners/equitable" || rest.startsWith("/assigners/equitable/")) {
    return "/class/$classId/assigners/equitable";
  }
  if (rest === "/sw/grade-scales" || rest.startsWith("/sw/grade-scales/")) {
    return "/class/$classId/sw/grade-scales";
  }
  if (rest === "/sw/graded-subjects" || rest.startsWith("/sw/graded-subjects/")) {
    return "/class/$classId/sw/graded-subjects";
  }
  return REST_TO_ROUTE[rest] ?? "/class/$classId";
}
