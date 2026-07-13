import { ipcMain, BrowserWindow } from "electron";
import { getDeviceFingerprint } from "./fingerprint";
import { can } from "../src/lib/permissions";
import { AppRole } from "../src/hooks/use-auth";

export function registerIpcHandlers() {
  ipcMain.on("toggle-protection", (event, enable: boolean) => {
    const webContents = event.sender;
    const win = BrowserWindow.fromWebContents(webContents);
    if (win) {
      win.setContentProtection(enable);
    }
  });

  ipcMain.handle("get-device-fingerprint", async () => {
    return await getDeviceFingerprint();
  });

  ipcMain.on("log-security-event", (event, logPayload) => {
    console.warn(`[SECURITY AUDIT LOG]: ${JSON.stringify(logPayload)}`);
  });

  ipcMain.handle("secure-database-operation", async (event, requestPayload) => {
    const { action, userRole, userId } = requestPayload;
    const permissions = can(userRole as AppRole);
    let isAuthorized = false;

    switch (action) {
      case "deleteCustomer":
        isAuthorized = permissions.deleteCustomer();
        break;
      case "exportCustomers":
        isAuthorized = permissions.exportCustomers();
        break;
      case "accessCompanySettings":
        isAuthorized = permissions.accessCompanySettings();
        break;
      default:
        isAuthorized = false;
    }

    if (!isAuthorized) {
      ipcMain.emit("log-security-event", null, {
        action: "BYPASS_ATTEMPT_FLAGGED",
        user: userId,
        actionType: action,
        timestamp: new Date().toISOString(),
      });
      throw new Error("Access denied: Security assertion check failed.");
    }

    return { success: true, message: "IPC Verification cleared." };
  });
}
