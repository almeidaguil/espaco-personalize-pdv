const publicRoutes = new Set(["/login"]);

type AuthRouteProtectionInput = {
  isAuthenticated: boolean;
  pathname: string;
  search?: string;
};

export type AuthRouteProtectionDecision =
  | {
      type: "allow";
    }
  | {
      destination: string;
      type: "redirect";
    };

export function getAuthRouteProtectionDecision({
  isAuthenticated,
  pathname,
  search = "",
}: AuthRouteProtectionInput): AuthRouteProtectionDecision {
  if (isAuthenticated && pathname === "/login") {
    return {
      destination: "/",
      type: "redirect",
    };
  }

  if (publicRoutes.has(pathname) || isAuthenticated) {
    return {
      type: "allow",
    };
  }

  const nextPath = `${pathname}${search}`;
  const encodedNextPath = encodeURIComponent(nextPath);

  return {
    destination: `/login?next=${encodedNextPath}`,
    type: "redirect",
  };
}
