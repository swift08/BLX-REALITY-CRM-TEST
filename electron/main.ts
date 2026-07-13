import { app, BrowserWindow, session } from "electron";
import * as path from "path";
import { registerIpcHandlers } from "./ipc";
import { verifyAppIntegrity } from "./security";

let mainWindow: BrowserWindow | null = null;

async function createWindow() {
  const isGenuine = await verifyAppIntegrity();
  if (!isGenuine) {
    console.error("Security Violation: Binary signature or files modified. Terminating.");
    app.quit();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  mainWindow.setContentProtection(true);

  const startUrl = app.isPackaged
    ? `file://${path.join(__dirname, "../dist/index.html")}`
    : "http://localhost:8080";

  mainWindow.loadURL(startUrl);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://*.supabase.co;",
        ],
      },
    });
  });
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
