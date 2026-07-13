import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { securityConfig } from "@/lib/security.config";

// Generate session ID once per application load
const SESSION_ID =
  Math.random().toString(36).substring(2, 6).toUpperCase() +
  "-" +
  Math.random().toString(36).substring(2, 6).toUpperCase();

export function Watermark() {
  const { user, role } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const [deviceFingerprint, setDeviceFingerprint] = useState("");
  const [timeTick, setTimeTick] = useState(Date.now());

  const email = user?.email || "unauthenticated@blxrealty.com";
  const name = user?.user_metadata?.full_name || email.split("@")[0];
  const roleLabel = role || "guest";
  const version = "3.2.1";

  useEffect(() => {
    const fetchFingerprint = async () => {
      if (window.electronSecurity?.getDeviceFingerprint) {
        try {
          const fingerprint = await window.electronSecurity.getDeviceFingerprint();
          setDeviceFingerprint(fingerprint.substring(0, 12).toUpperCase());
        } catch (e) {
          setDeviceFingerprint("UNKNOWN-DEV");
        }
      } else {
        setDeviceFingerprint("WEB-SESSION");
      }
    };
    fetchFingerprint();
  }, []);

  // Update watermark timestamp every 60 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeTick(Date.now());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const createSvgPattern = () => {
    const dateObj = new Date(timeTick);
    const dateStr = dateObj.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const timeStr = dateObj.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    // Draw low opacity multi-line diagonal SVG watermark text blocks
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="450" height="350">
        <text x="225" y="100" fill="rgba(148, 163, 184, 0.055)" font-size="9" font-family="monospace" font-weight="bold" transform="rotate(-25 225 175)" text-anchor="middle">
          <tspan x="225" dy="0">BLX REALTY - CONFIDENTIAL</tspan>
          <tspan x="225" dy="13">${name}</tspan>
          <tspan x="225" dy="13">${email}</tspan>
          <tspan x="225" dy="13">Role: ${roleLabel.replace("_", " ").toUpperCase()}</tspan>
          <tspan x="225" dy="13">Device: ${deviceFingerprint}</tspan>
          <tspan x="225" dy="13">Session: ${SESSION_ID}</tspan>
          <tspan x="225" dy="13">CRM Version: v${version}</tspan>
          <tspan x="225" dy="13">${dateStr}</tspan>
          <tspan x="225" dy="13">${timeStr}</tspan>
        </text>
      </svg>
    `;
    return `url('data:image/svg+xml;base64,${btoa(svg)}')`;
  };

  useEffect(() => {
    if (!securityConfig.watermarking) {
      if (containerRef.current) {
        containerRef.current.style.display = "none";
      }
      return;
    }

    const enforceWatermark = () => {
      const el = containerRef.current;
      if (!el) return;

      // Force absolute styling constraints dynamically
      el.style.position = "fixed";
      el.style.inset = "0";
      el.style.pointerEvents = "none";
      el.style.zIndex = "2147483647"; // Maximum possible z-index
      el.style.backgroundImage = createSvgPattern();
      el.style.backgroundRepeat = "repeat";
      el.style.display = "block";
      el.style.visibility = "visible";
      el.style.opacity = "1";
    };

    enforceWatermark();

    // MutationObserver to prevent deleting or altering style
    const observer = new MutationObserver(() => {
      enforceWatermark();
    });

    if (containerRef.current) {
      observer.observe(containerRef.current, {
        attributes: true,
        childList: true,
        subtree: true,
      });
    }

    // Set fallback interval check
    const interval = setInterval(enforceWatermark, 1000);

    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, [name, email, roleLabel, deviceFingerprint, timeTick]);

  if (!securityConfig.watermarking) return null;

  return (
    <div
      ref={containerRef}
      id="enterprise-watermark-layer"
      className="absolute inset-0 pointer-events-none"
    />
  );
}
