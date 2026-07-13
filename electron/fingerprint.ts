import * as os from "os";
import * as crypto from "crypto";

export async function getDeviceFingerprint(): Promise<string> {
  const interfaces = os.networkInterfaces();
  let rawAddressString = "";

  Object.keys(interfaces).forEach((name) => {
    interfaces[name]?.forEach((net) => {
      if (net.family === "IPv4" && !net.internal) {
        rawAddressString += net.mac;
      }
    });
  });

  const rawID = [
    os.platform(),
    os.arch(),
    os.hostname(),
    rawAddressString || "fallback-mac-uuid-string-key",
  ].join("-");

  return crypto.createHash("sha256").update(rawID).digest("hex");
}
