import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";

export function applicationIdentity(root) {
  const path = realpathSync(root);
  return createHash("sha256").update(process.platform === "win32" ? path.toLowerCase() : path).digest("hex");
}
