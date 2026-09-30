import * as fs from "fs";
import * as path from "path";

const EVENTS = ["beforeSubmitPrompt", "afterAgentResponse", "postToolUseFailure", "afterFileEdit", "stop"];
const COMMAND = "./hooks/headroom-hook.js";

interface HookEntry {
  command: string;
  timeout?: number;
  loop_limit?: number | null;
}

interface HooksFile {
  version: number;
  hooks: Record<string, HookEntry[]>;
}

export function installUserHooks(extensionHookPath: string, cursorDir: string): void {
  const hooksDir = path.join(cursorDir, "hooks");
  fs.mkdirSync(hooksDir, { recursive: true });
  const destination = path.join(hooksDir, "headroom-hook.js");
  fs.copyFileSync(extensionHookPath, destination);
  fs.chmodSync(destination, 0o755);

  const configPath = path.join(cursorDir, "hooks.json");
  let config: HooksFile = { version: 1, hooks: {} };
  if (fs.existsSync(configPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(configPath, "utf8")) as HooksFile;
      config = {
        version: 1,
        hooks: parsed.hooks && typeof parsed.hooks === "object" ? parsed.hooks : {},
      };
    } catch {
      config = { version: 1, hooks: {} };
    }
  }

  for (const event of EVENTS) {
    const existing = Array.isArray(config.hooks[event]) ? config.hooks[event] : [];
    const kept = existing.filter((entry) => !String(entry.command || "").includes("headroom-hook.js"));
    const entry: HookEntry = { command: COMMAND, timeout: 5 };
    if (event === "stop") entry.loop_limit = 1;
    config.hooks[event] = [...kept, entry];
  }

  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
}
