import { describe, expect, test, vi } from "vitest";

import { runCliCommand } from "./run-cli-command.mjs";

describe("runCliCommand", () => {
  test("runs .cmd tools through cmd.exe on Windows without a nested shell", () => {
    const spawn = vi.fn().mockReturnValue({
      status: 0,
      stderr: "",
      stdout: "ok",
    });
    const environment = { PATH: "sentinel" };

    const result = runCliCommand(
      "npx.cmd",
      ["supabase", "--version"],
      { commandInterpreter: "C:\\Windows\\System32\\cmd.exe", environment },
      { platform: "win32", spawn },
    );

    expect(spawn).toHaveBeenCalledWith(
      "C:\\Windows\\System32\\cmd.exe",
      ["/d", "/s", "/c", "npx.cmd", "supabase", "--version"],
      expect.objectContaining({ env: environment, shell: false }),
    );
    expect(result).toEqual({ status: 0, stderr: "", stdout: "ok" });
  });

  test("runs the executable directly on non-Windows platforms", () => {
    const spawn = vi.fn().mockReturnValue({
      error: new Error("failed"),
      status: null,
      stderr: "",
      stdout: "",
    });

    const result = runCliCommand(
      "npx",
      ["supabase", "--version"],
      { environment: {} },
      { platform: "linux", spawn },
    );

    expect(spawn).toHaveBeenCalledWith(
      "npx",
      ["supabase", "--version"],
      expect.objectContaining({ env: {}, shell: false }),
    );
    expect(result).toEqual({ status: 1, stderr: "failed", stdout: "" });
  });
});
