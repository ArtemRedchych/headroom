import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { installUserHooks } from "./installHooks";

test("installUserHooks copies the script and keeps unrelated hooks", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "headroom-install-"));
  const source = path.join(root, "source-hook.js");
  fs.writeFileSync(source, "#!/usr/bin/env node\nprocess.stdout.write('{}');\n");
  const cursorDir = path.join(root, ".cursor");
  fs.mkdirSync(cursorDir, { recursive: true });
  fs.writeFileSync(
    path.join(cursorDir, "hooks.json"),
    JSON.stringify({
      version: 1,
      hooks: {
        beforeShellExecution: [{ command: "./hooks/other.sh" }],
        stop: [{ command: "./hooks/headroom-hook.js", timeout: 1 }],
      },
    }),
  );

  installUserHooks(source, cursorDir);
  installUserHooks(source, cursorDir);

  const installed = fs.readFileSync(path.join(cursorDir, "hooks", "headroom-hook.js"), "utf8");
  assert.match(installed, /process.stdout.write/);
  const config = JSON.parse(fs.readFileSync(path.join(cursorDir, "hooks.json"), "utf8")) as {
    hooks: Record<string, Array<{ command: string; loop_limit?: number }>>;
  };
  assert.deepEqual(config.hooks.beforeShellExecution, [{ command: "./hooks/other.sh" }]);
  assert.equal(config.hooks.stop.filter((entry) => entry.command.includes("headroom-hook.js")).length, 1);
  assert.equal(config.hooks.stop[0].loop_limit, 1);
  assert.equal(config.hooks.beforeSubmitPrompt[0].command, "./hooks/headroom-hook.js");
});
