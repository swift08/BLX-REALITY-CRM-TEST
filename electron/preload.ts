import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronSecurity", {
  setContentProtection: (enable: boolean) => {
    ipcRenderer.send("toggle-protection", enable);
  },
  getDeviceFingerprint: () => {
    return ipcRenderer.invoke("get-device-fingerprint");
  },
  logSecurityEvent: (event: any) => {
    ipcRenderer.send("log-security-event", event);
  },
  onForceLogout: (callback: () => void) => {
    ipcRenderer.on("force-logout", () => callback());
  },
});
