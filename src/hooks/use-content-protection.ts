import { useEffect } from "react";

declare global {
  interface Window {
    electronSecurity?: {
      setContentProtection: (enable: boolean) => void;
      getDeviceFingerprint: () => Promise<string>;
      logSecurityEvent: (event: any) => void;
      onForceLogout: (callback: () => void) => void;
    };
  }
}

export function useContentProtection(enabled: boolean = true) {
  useEffect(() => {
    if (window.electronSecurity?.setContentProtection) {
      window.electronSecurity.setContentProtection(enabled);
    }
    return () => {
      if (window.electronSecurity?.setContentProtection) {
        window.electronSecurity.setContentProtection(false);
      }
    };
  }, [enabled]);
}
