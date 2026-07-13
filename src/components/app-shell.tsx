import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";

import { AppSidebar } from "./app-sidebar";
import { AppTopbar } from "./app-topbar";
import { Watermark } from "./watermark";
import { useSessionMonitor } from "@/hooks/use-session-monitor";
import { securityConfig } from "@/lib/security.config";

const isRouteSensitive = (pathname: string): boolean => {
  const sensitivePaths = [
    "/leads",
    "/bookings",
    "/analytics",
    "/payments",
    "/reports",
    "/settings",
  ];
  return sensitivePaths.some((p) => pathname.startsWith(p));
};

export function AppShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigate = useNavigate();
  const { location } = useRouterState();

  // Enforce session inactivity timeout & fingerprint binding
  useSessionMonitor();

  const isSensitive = isRouteSensitive(location.pathname);

  // Sensitive View Controller: dynamic Content Protection & Auditing
  useEffect(() => {
    if (securityConfig.contentProtection && window.electronSecurity?.setContentProtection) {
      window.electronSecurity.setContentProtection(isSensitive);
    }

    if (isSensitive && window.electronSecurity?.logSecurityEvent) {
      window.electronSecurity.logSecurityEvent({
        action: "SENSITIVE_VIEW_ENTER",
        route: location.pathname,
        timestamp: new Date().toISOString(),
      });
    }

    return () => {
      if (isSensitive && window.electronSecurity?.logSecurityEvent) {
        window.electronSecurity.logSecurityEvent({
          action: "SENSITIVE_VIEW_EXIT",
          route: location.pathname,
          timestamp: new Date().toISOString(),
        });
      }
    };
  }, [isSensitive, location.pathname]);

  // Close sidebar on mobile when navigating
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen bg-background relative">
      {isSensitive && <Watermark />}
      <AppSidebar isOpen={sidebarOpen} />
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/45 z-20 md:hidden transition-all duration-200 animate-in fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div className="flex-1 flex flex-col min-w-0">
        <AppTopbar
          title={title}
          subtitle={subtitle}
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
        />
        <main className="flex-1 p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
