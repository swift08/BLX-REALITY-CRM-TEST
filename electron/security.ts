import { app } from "electron";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

export async function verifyAppIntegrity(): Promise<boolean> {
  const args = process.argv;
  const devToolsFlags = ["--inspect", "--inspect-brk", "--remote-debugging-port"];
  const hasDebugFlags = args.some((arg) => devToolsFlags.some((flag) => arg.startsWith(flag)));

  if (hasDebugFlags && app.isPackaged) {
    return false;
  }

  if (app.isPackaged) {
    try {
      const resourcesPath = path.join(process.resourcesPath, "app.asar");
      if (fs.existsSync(resourcesPath)) {
        const fileBuffer = fs.readFileSync(resourcesPath);
        const hashSum = crypto.createHash("sha256");
        hashSum.update(fileBuffer);
        const hex = hashSum.digest("hex");

        const expectedHash = process.env.EXPECTED_ASAR_SHA256;
        if (expectedHash && hex !== expectedHash) {
          return false;
        }
      }
    } catch (e) {
      return false;
    }
  }

  return true;
}
