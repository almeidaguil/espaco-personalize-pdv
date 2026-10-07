import { spawnSync } from "node:child_process";

export function runCliCommand(
  command,
  args,
  { commandInterpreter = process.env.ComSpec, environment },
  { platform = process.platform, spawn = spawnSync } = {},
) {
  const useCommandInterpreter =
    platform === "win32" && command.endsWith(".cmd");
  const executable = useCommandInterpreter
    ? commandInterpreter || "cmd.exe"
    : command;
  const commandArgs = useCommandInterpreter
    ? ["/d", "/s", "/c", command, ...args]
    : args;
  const result = spawn(executable, commandArgs, {
    encoding: "utf8",
    env: environment,
    shell: false,
  });

  return {
    status: result.status ?? 1,
    stderr: result.stderr || result.error?.message || "",
    stdout: result.stdout ?? "",
  };
}
