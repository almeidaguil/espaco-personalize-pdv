import { expect, test, vi } from "vitest";

import { readAuthenticatedProfile } from "./read-authenticated-profile.mjs";

test("filters the profile query by the authenticated user before requiring one row", async () => {
  const single = vi.fn().mockResolvedValue({
    data: { id: "admin-id", role: "admin" },
    error: null,
  });
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });

  await expect(readAuthenticatedProfile({ from }, "admin-id")).resolves.toEqual(
    { id: "admin-id", role: "admin" },
  );
  expect(from).toHaveBeenCalledWith("profiles");
  expect(select).toHaveBeenCalledWith("id,role");
  expect(eq).toHaveBeenCalledWith("id", "admin-id");
  expect(single).toHaveBeenCalledOnce();
});

test("fails closed when the authenticated profile cannot be read", async () => {
  const single = vi.fn().mockResolvedValue({
    data: null,
    error: { code: "PGRST116" },
  });
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });

  await expect(readAuthenticatedProfile({ from }, "admin-id")).rejects.toThrow(
    "Unable to read the admin profile.",
  );
});
