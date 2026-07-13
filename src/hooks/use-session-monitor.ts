import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 Minutes

export function useSessionMonitor() {
  const { signOut, user, loading } = useAuth();
  const navigate = useNavigate();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const resetTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(handleIdleTimeout, IDLE_TIMEOUT_MS);
  };

  const handleIdleTimeout = async () => {
    if (window.electronSecurity?.logSecurityEvent) {
      window.electronSecurity.logSecurityEvent({
        action: "SESSION_IDLE_TIMEOUT",
        user: user?.email,
        timestamp: new Date().toISOString(),
      });
    }
    toast.error("Session expired due to inactivity.");
    await signOut();
    navigate({ to: "/auth" });
  };

  // Redirect to sign in page if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth" });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;

    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart"];
    events.forEach((name) => window.addEventListener(name, resetTimer));

    resetTimer();

    // Check device fingerprint matching
    const verifyDeviceBinding = async () => {
      if (window.electronSecurity?.getDeviceFingerprint) {
        try {
          const currentFingerprint = await window.electronSecurity.getDeviceFingerprint();
          const storedFingerprint = localStorage.getItem(`blx-fingerprint-${user.id}`);

          if (!storedFingerprint) {
            localStorage.setItem(`blx-fingerprint-${user.id}`, currentFingerprint);
          } else if (storedFingerprint !== currentFingerprint) {
            window.electronSecurity.logSecurityEvent({
              action: "SESSION_DEVICE_VIOLATION",
              user: user.email,
              timestamp: new Date().toISOString(),
            });
            toast.error("Security Exception: Session not authorized on this device.");
            await signOut();
            navigate({ to: "/auth" });
          }
        } catch (e) {
          console.error("Device verification error:", e);
        }
      }
    };

    verifyDeviceBinding();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((name) => window.removeEventListener(name, resetTimer));
    };
  }, [user]);
}
