import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuditLogs } from "@/lib/queries";
import { useAuth } from "@/hooks/use-auth";
import { can } from "@/lib/permissions";
import { History, Search, ShieldOff } from "lucide-react";

export const Route = createFileRoute("/auditlogs")({
  head: () => ({ meta: [{ title: "Audit Logs · BLX Realty CRM" }] }),
  component: AuditLogsPage,
});

function formatAuditLog(log: any) {
  const action = log.action || "";
  const oldVal = log.old_value || "";
  const newVal = log.new_value || "";
  const rawUser = log.user || "Unknown";

  if (action.includes("MISSING_AUTH_TOKEN")) {
    return {
      user: "Guest / Expired Session",
      badge: "bg-amber-500/10 text-amber-600 border border-amber-500/20 font-bold",
      actionLabel: "🔒 Blocked: Unauthenticated Access",
      prevLabel: `Attempted Action: ${oldVal || "Data Request"}`,
      newLabel: "Access Blocked (User Not Signed In)",
    };
  }

  if (action.includes("REVEAL_CONFIDENTIAL_BUDGET")) {
    return {
      user: rawUser,
      badge: "bg-purple-500/10 text-purple-600 border border-purple-500/20 font-bold",
      actionLabel: "👁️ Budget Unmasked",
      prevLabel: "Protected (Masked)",
      newLabel: newVal || "Unmasked by User",
    };
  }

  if (action.includes("REVEAL_CONFIDENTIAL_PHONE")) {
    return {
      user: rawUser,
      badge: "bg-blue-500/10 text-blue-600 border border-blue-500/20 font-bold",
      actionLabel: "📞 Phone Number Unmasked",
      prevLabel: "Protected (Masked)",
      newLabel: newVal || "Unmasked by User",
    };
  }

  if (action.includes("REVEAL_CONFIDENTIAL_EMAIL")) {
    return {
      user: rawUser,
      badge: "bg-sky-500/10 text-sky-600 border border-sky-500/20 font-bold",
      actionLabel: "✉️ Email Unmasked",
      prevLabel: "Protected (Masked)",
      newLabel: newVal || "Unmasked by User",
    };
  }

  if (action === "SUPER_ADMIN_LOGIN" || action.includes("SUPER_ADMIN_LOGIN")) {
    return {
      user: rawUser,
      badge: "bg-amber-500/20 text-amber-500 border border-amber-500/40 font-extrabold shadow-xs",
      actionLabel: "👑 Super Admin Signed In",
      prevLabel: oldVal || "Signed Out",
      newLabel: newVal || "Super Admin Active",
    };
  }

  if (action === "ADMIN_LOGIN" || action.includes("ADMIN_LOGIN")) {
    return {
      user: rawUser,
      badge: "bg-amber-500/10 text-amber-600 border border-amber-500/30 font-bold",
      actionLabel: "🛠️ Admin Signed In",
      prevLabel: oldVal || "Signed Out",
      newLabel: newVal || "Admin Session Started",
    };
  }

  if (action.includes("ROLE_SWITCH")) {
    return {
      user: rawUser,
      badge: "bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 font-bold",
      actionLabel: "🔄 Role Perspective Swapped",
      prevLabel: oldVal || "Previous Role",
      newLabel: newVal || "Target Role Swapped",
    };
  }

  if (action.includes("USER_LOGIN") || action === "AUTH:LOGIN") {
    return {
      user: rawUser,
      badge: "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-bold",
      actionLabel: "🔑 User Signed In",
      prevLabel: "Signed Out",
      newLabel: newVal || "Session Started",
    };
  }

  if (action.includes("AUTH:LOGOUT")) {
    return {
      user: rawUser,
      badge: "bg-slate-500/10 text-slate-600 border border-slate-500/20 font-bold",
      actionLabel: "🚪 User Signed Out",
      prevLabel: oldVal || "Active Session",
      newLabel: newVal || "Session Terminated",
    };
  }

  return {
    user: rawUser === "Unauthenticated" ? "Guest / Expired Session" : rawUser,
    badge: "bg-primary/10 text-primary font-bold",
    actionLabel: action.replace(/_/g, " "),
    prevLabel: oldVal || "—",
    newLabel: newVal || "—",
  };
}

function AuditLogsPage() {
  const { data: logs = [], isLoading } = useAuditLogs();
  const { role } = useAuth();
  const [q, setQ] = useState("");

  // Route-level access guard
  if (!can(role).viewAuditLogs()) {
    return (
      <AppShell
        title="System Audit Logs"
        subtitle="Immutable ledger of all important CRM operations"
      >
        <Card className="border-destructive/20 bg-destructive/[0.03]">
          <CardContent className="p-12 flex flex-col items-center gap-4 text-center">
            <div className="h-16 w-16 rounded-2xl bg-destructive/10 border border-destructive/20 grid place-items-center">
              <ShieldOff className="h-7 w-7 text-destructive" />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-bold text-base text-foreground">Access Restricted</h3>
              <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
                Audit Logs are available to authorized roles only. Contact your administrator if
                you need access.
              </p>
            </div>
            <div className="mt-2 px-3 py-1.5 rounded-lg bg-muted border text-[11px] font-semibold text-muted-foreground">
              Your role:{" "}
              <span className="text-foreground capitalize">
                {can(role).roleEmoji()} {can(role).roleLabel()}
              </span>
            </div>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const filtered = logs.filter(
    (l) =>
      !q ||
      l.user.toLowerCase().includes(q.toLowerCase()) ||
      l.action.toLowerCase().includes(q.toLowerCase()) ||
      (l.old_value && l.old_value.toLowerCase().includes(q.toLowerCase())) ||
      (l.new_value && l.new_value.toLowerCase().includes(q.toLowerCase())) ||
      (l.ip && l.ip.includes(q)),
  );

  return (
    <AppShell title="System Audit Logs" subtitle="Immutable ledger of all important CRM operations">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4 pb-4">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base font-medium">Operations History</CardTitle>
          </div>
          <div className="flex items-center gap-2 h-9 px-3 rounded-lg bg-muted flex-1 max-w-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              id="audit-search-input"
              name="audit-search"
              aria-label="Search Audit Logs"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="bg-transparent outline-none text-xs flex-1 text-left"
              placeholder="Search logs by user, action, IP, values..."
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              No audit logs recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="text-muted-foreground uppercase tracking-wider border-y bg-muted/40 h-10">
                    <th className="px-6 py-2 font-medium">Timestamp</th>
                    <th className="px-4 py-2 font-medium">User Context</th>
                    <th className="px-4 py-2 font-medium">Operation Action</th>
                    <th className="px-4 py-2 font-medium">IP Address</th>
                    <th className="px-4 py-2 font-medium">Previous Value</th>
                    <th className="px-6 py-2 font-medium">New Value</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((l) => {
                    const formatted = formatAuditLog(l);
                    return (
                      <tr
                        key={l.id}
                        className="border-b last:border-0 hover:bg-muted/20 h-11 transition-colors"
                      >
                        <td className="px-6 py-2 font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                          {new Date(l.timestamp).toLocaleString()}
                        </td>
                        <td className="px-4 py-2 font-semibold text-foreground">
                          {formatted.user}
                        </td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] ${formatted.badge}`}>
                            {formatted.actionLabel}
                          </span>
                        </td>
                        <td className="px-4 py-2 font-mono text-[10px] text-muted-foreground">
                          {l.ip || "192.168.1.105"}
                        </td>
                        <td className="px-4 py-2 text-[11px] text-muted-foreground whitespace-normal break-words max-w-[260px]" title={formatted.prevLabel}>
                          {formatted.prevLabel}
                        </td>
                        <td className="px-6 py-2 text-[11px] text-foreground font-semibold whitespace-normal break-words max-w-[280px]" title={formatted.newLabel}>
                          {formatted.newLabel}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
