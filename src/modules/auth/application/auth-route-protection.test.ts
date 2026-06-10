import { describe, expect, it } from "vitest";

import { getAuthRouteProtectionDecision } from "./auth-route-protection";

describe("getAuthRouteProtectionDecision", () => {
  it("allows anonymous users on the login route", () => {
    expect(
      getAuthRouteProtectionDecision({
        isAuthenticated: false,
        pathname: "/login",
      }),
    ).toEqual({
      type: "allow",
    });
  });

  it("redirects anonymous users away from private routes", () => {
    expect(
      getAuthRouteProtectionDecision({
        isAuthenticated: false,
        pathname: "/pdv",
        search: "?eventId=event-1",
      }),
    ).toEqual({
      destination: "/login?next=%2Fpdv%3FeventId%3Devent-1",
      type: "redirect",
    });
  });

  it("allows authenticated users on private routes", () => {
    expect(
      getAuthRouteProtectionDecision({
        isAuthenticated: true,
        pathname: "/reports",
      }),
    ).toEqual({
      type: "allow",
    });
  });

  it("redirects authenticated users away from login", () => {
    expect(
      getAuthRouteProtectionDecision({
        isAuthenticated: true,
        pathname: "/login",
      }),
    ).toEqual({
      destination: "/",
      type: "redirect",
    });
  });
});
