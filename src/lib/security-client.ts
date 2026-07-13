import { toast } from "sonner";
import { securityConfig } from "./security.config";

export function initializeClientSecurity() {
  if (typeof window === "undefined") return;

  // 1. Block Context Menu
  window.addEventListener("contextmenu", (e) => {
    if (!securityConfig.clipboardBlocking) return;
    e.preventDefault();
    toast.error("Copy/Paste/Inspection operations are restricted.");
    logSecurityEvent("CONTEXT_MENU_BLOCKED");
  });

  // 2. Block Copy & Cut Operations
  window.addEventListener("copy", (e) => {
    if (!securityConfig.clipboardBlocking) return;
    e.preventDefault();
    toast.error("Clipboard copy is restricted.");
    logSecurityEvent("COPY_ATTEMPT_BLOCKED");
  });

  window.addEventListener("cut", (e) => {
    if (!securityConfig.clipboardBlocking) return;
    e.preventDefault();
    toast.error("Clipboard cut is restricted.");
    logSecurityEvent("CUT_ATTEMPT_BLOCKED");
  });

  // 3. Block Keyboard Shortcuts
  window.addEventListener("keydown", (e) => {
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();

    const blockedShortcuts = [
      { cond: key === "f12", name: "DevTools (F12)", type: "devtools" },
      {
        cond: isCtrlOrCmd && e.shiftKey && key === "i",
        name: "DevTools (Ctrl+Shift+I)",
        type: "devtools",
      },
      {
        cond: isCtrlOrCmd && e.shiftKey && key === "j",
        name: "DevTools Console (Ctrl+Shift+J)",
        type: "devtools",
      },
      {
        cond: isCtrlOrCmd && e.shiftKey && key === "c",
        name: "DevTools Element (Ctrl+Shift+C)",
        type: "devtools",
      },
      {
        cond: isCtrlOrCmd && e.shiftKey && key === "p",
        name: "DevTools Command (Ctrl+Shift+P)",
        type: "devtools",
      },
      { cond: isCtrlOrCmd && key === "u", name: "View Source (Ctrl+U)", type: "devtools" },
      { cond: isCtrlOrCmd && key === "s", name: "Save Page (Ctrl+S)", type: "other" },
      { cond: isCtrlOrCmd && key === "p", name: "Print Page (Ctrl+P)", type: "print" },
      { cond: isCtrlOrCmd && key === "c", name: "Copy (Ctrl+C)", type: "clipboard" },
      { cond: isCtrlOrCmd && key === "x", name: "Cut (Ctrl+X)", type: "clipboard" },
      { cond: isCtrlOrCmd && key === "a", name: "Select All (Ctrl+A)", type: "clipboard" },
      { cond: key === "printscreen", name: "Print Screen Key", type: "print" },
    ];

    for (const shortcut of blockedShortcuts) {
      if (shortcut.cond) {
        if (shortcut.type === "clipboard" && !securityConfig.clipboardBlocking) continue;
        if (shortcut.type === "print" && !securityConfig.printBlocking) continue;

        e.preventDefault();
        e.stopPropagation();
        toast.error(`Operation [${shortcut.name}] is restricted.`);
        logSecurityEvent(`SHORTCUT_BLOCKED:${shortcut.name}`);
        break;
      }
    }
  });

  // 4. Print Protection Overrides
  window.print = () => {
    if (!securityConfig.printBlocking) {
      // Fallback if print is enabled
      const iframe = document.createElement("iframe");
      document.body.appendChild(iframe);
      iframe.contentWindow?.print();
      document.body.removeChild(iframe);
      return;
    }
    toast.error("Printing is disabled in this application.");
    logSecurityEvent("PRINT_ATTEMPT_BLOCKED");
  };

  // Inject print restriction styles conditionally
  if (securityConfig.printBlocking) {
    const style = document.createElement("style");
    style.id = "security-print-block-style";
    style.innerHTML = `
      @media print {
        body {
          display: none !important;
        }
      }
    `;
    document.head.appendChild(style);
  }
}

function logSecurityEvent(reason: string) {
  if (window.electronSecurity?.logSecurityEvent) {
    window.electronSecurity.logSecurityEvent({
      action: "SECURITY_VIOLATION",
      reason,
      timestamp: new Date().toISOString(),
    });
  } else {
    console.warn(`[Security Alert]: ${reason}`);
  }
}
