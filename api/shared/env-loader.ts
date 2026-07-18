import fs from "node:fs";
import path from "node:path";
import process from "node:process";

try {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...valParts] = trimmed.split("=");
        const val = valParts.join("=");
        if (key && val) {
          process.env[key.trim()] = val.trim();
        }
      }
    }
  }
} catch (e) {
  console.error("Failed to load local .env file:", e);
}
