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

function humanizeCode(value: string) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Converts raw audit rows into plain-English labels for non-technical reviewers.
 */
function formatAuditLog(log: any) {
  const action = String(log.action || "");
  const oldVal = String(log.old_value || "");
  const newVal = String(log.new_value || "");
  const rawUser = String(log.user || "Unknown");

  const base = {
    user: rawUser === "Unauthenticated" ? "Guest / Expired Session" : rawUser,
    prevLabel: oldVal || "—",
    newLabel: newVal || "—",
  };

  if (action.includes("MISSING_AUTH_TOKEN")) {
    return {
      ...base,
      badge: "bg-amber-500/10 text-amber-600 border border-amber-500/20 font-bold",
      actionLabel: "Blocked unsigned access attempt",
      prevLabel: `Tried to run: ${humanizeCode(oldVal) || "a protected action"}`,
      newLabel: "Access blocked because the user was not signed in",
    };
  }

  if (action.includes("REVEAL_CONFIDENTIAL_BUDGET")) {
    return {
      ...base,
      badge: "bg-purple-500/10 text-purple-600 border border-purple-500/20 font-bold",
      actionLabel: "Budget shown (unmasked)",
      prevLabel: oldVal || "Budget was hidden on screen",
      newLabel: newVal || `${rawUser} viewed a customer's budget`,
    };
  }

  if (action.includes("REVEAL_CONFIDENTIAL_PHONE")) {
    return {
      ...base,
      badge: "bg-blue-500/10 text-blue-600 border border-blue-500/20 font-bold",
      actionLabel: "Phone number shown (unmasked)",
      prevLabel: oldVal || "Phone was hidden on screen",
      newLabel: newVal || `${rawUser} viewed a customer's phone number`,
    };
  }

  if (action.includes("REVEAL_CONFIDENTIAL_EMAIL")) {
    return {
      ...base,
      badge: "bg-sky-500/10 text-sky-600 border border-sky-500/20 font-bold",
      actionLabel: "Email shown (unmasked)",
      prevLabel: oldVal || "Email was hidden on screen",
      newLabel: newVal || `${rawUser} viewed a customer's email`,
    };
  }

  if (action.includes("LEAD_PERMANENTLY_DELETED") || action.includes("PERMANENTLY_DELETE")) {
    return {
      ...base,
      badge: "bg-rose-500/10 text-rose-600 border border-rose-500/20 font-bold",
      actionLabel: "Lead permanently deleted",
      prevLabel: oldVal || "Lead existed in CRM",
      newLabel: newVal || `${rawUser} permanently deleted a lead`,
    };
  }

  if (action.includes("LEAD_ARCHIVED") || action.includes("SOFT_DELETE") || action === "CUSTOMER_ARCHIVE") {
    return {
      ...base,
      badge: "bg-orange-500/10 text-orange-600 border border-orange-500/20 font-bold",
      actionLabel: "Lead archived (moved to recycle bin)",
      prevLabel: oldVal || "Lead was active",
      newLabel: newVal || `${rawUser} archived a lead`,
    };
  }

  if (action.includes("LEAD_RESTORED") || action.includes("RESTORE_LEAD")) {
    return {
      ...base,
      badge: "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-bold",
      actionLabel: "Lead restored from recycle bin",
      prevLabel: oldVal || "Lead was in recycle bin",
      newLabel: newVal || `${rawUser} restored a lead`,
    };
  }

  if (action.includes("OPPORTUNITY_STAGE_CHANGE") || action.includes("STAGE_CHANGE")) {
    return {
      ...base,
      badge: "bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 font-bold",
      actionLabel: "Lead stage changed",
      prevLabel: oldVal || "Previous stage",
      newLabel: newVal || "Stage updated",
    };
  }

  if (action.includes("OPPORTUNITY_ASSIGN") || action.includes("LEAD_ASSIGN")) {
    return {
      ...base,
      badge: "bg-cyan-500/10 text-cyan-700 border border-cyan-500/20 font-bold",
      actionLabel: "Lead assigned / reassigned",
      prevLabel: oldVal || "Previous owner",
      newLabel: newVal || "New owner assigned",
    };
  }

  if (action.includes("CUSTOMER_CREATE") || action.includes("LEAD_CREATE")) {
    return {
      ...base,
      badge: "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-bold",
      actionLabel: "New lead created",
      prevLabel: oldVal || "—",
      newLabel: newVal || "Lead created",
    };
  }

  if (action.includes("CUSTOMER_UPDATE")) {
    return {
      ...base,
      badge: "bg-slate-500/10 text-slate-700 border border-slate-500/20 font-bold",
      actionLabel: "Lead / customer profile updated",
      prevLabel: oldVal || "Previous profile details",
      newLabel: newVal || "Profile updated",
    };
  }

  if (action.includes("INVOICE_ISSUED")) {
    return {
      ...base,
      badge: "bg-amber-500/10 text-amber-700 border border-amber-500/20 font-bold",
      actionLabel: "Tax invoice issued",
      prevLabel: oldVal || "No invoice",
      newLabel: newVal || "Invoice issued",
    };
  }

  if (action.includes("PAYMENT_RECORDED") || action.includes("PAYMENT_CLEAR")) {
    return {
      ...base,
      badge: "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 font-bold",
      actionLabel: "Payment recorded",
      prevLabel: oldVal || "Payment pending",
      newLabel: newVal || "Payment recorded",
    };
  }

  if (action.includes("INVOICE_CANCELLED")) {
    return {
      ...base,
      badge: "bg-rose-500/10 text-rose-600 border border-rose-500/20 font-bold",
      actionLabel: "Invoice cancelled",
      prevLabel: oldVal || "Invoice was active",
      newLabel: newVal || "Invoice cancelled",
    };
  }

  if (action.includes("UNIT_RESERVE")) {
    return {
      ...base,
      badge: "bg-blue-500/10 text-blue-700 border border-blue-500/20 font-bold",
      actionLabel: "Unit reserved / booking started",
      prevLabel: oldVal || "Unit available",
      newLabel: newVal || "Unit reserved",
    };
  }

  if (action.includes("BOOKING_VOID")) {
    return {
      ...base,
      badge: "bg-orange-500/10 text-orange-700 border border-orange-500/20 font-bold",
      actionLabel: "Booking cancelled / unit released",
      prevLabel: oldVal || "Unit was reserved",
      newLabel: newVal || "Booking cancelled",
    };
  }

  if (action.includes("FOLLOWUP_CREATE")) {
    return {
      ...base,
      badge: "bg-violet-500/10 text-violet-700 border border-violet-500/20 font-bold",
      actionLabel: "Follow-up scheduled",
      prevLabel: oldVal || "—",
      newLabel: newVal || "Follow-up created",
    };
  }

  if (action.includes("FOLLOWUP_COMPLETE")) {
    return {
      ...base,
      badge: "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 font-bold",
      actionLabel: "Follow-up completed",
      prevLabel: oldVal || "Pending",
      newLabel: newVal || "Completed",
    };
  }

  if (action.includes("DOCUMENT_UPLOAD") || action.includes("DOCUMENT_UPLOADED")) {
    return {
      ...base,
      badge: "bg-slate-500/10 text-slate-700 border border-slate-500/20 font-bold",
      actionLabel: "Document uploaded",
      prevLabel: oldVal || "—",
      newLabel: newVal || "Document added",
    };
  }

  if (action.includes("LOG_CALL") || action.includes("CALL_LOGGED")) {
    return {
      ...base,
      badge: "bg-blue-500/10 text-blue-700 border border-blue-500/20 font-bold",
      actionLabel: "Call logged",
      prevLabel: oldVal || "—",
      newLabel: newVal || "Call recorded",
    };
  }

  if (action.includes("LOG_WHATSAPP") || action.includes("WHATSAPP")) {
    return {
      ...base,
      badge: "bg-green-500/10 text-green-700 border border-green-500/20 font-bold",
      actionLabel: "WhatsApp activity logged",
      prevLabel: oldVal || "—",
      newLabel: newVal || "WhatsApp note recorded",
    };
  }

  if (action.includes("INVOICE_PERMISSIONS") || action.includes("USER_INVOICE_PERMISSIONS")) {
    return {
      ...base,
      badge: "bg-amber-500/10 text-amber-700 border border-amber-500/20 font-bold",
      actionLabel: "Invoice permissions updated",
      prevLabel: oldVal || "Previous permissions",
      newLabel: newVal || "Permissions saved",
    };
  }

  if (action.includes("LEAD_ASSIGNMENT_SETTINGS") || action.includes("UPDATE_LEAD_ASSIGNMENT")) {
    return {
      ...base,
      badge: "bg-indigo-500/10 text-indigo-700 border border-indigo-500/20 font-bold",
      actionLabel: "Lead assignment settings changed",
      prevLabel: oldVal || "Previous settings",
      newLabel: newVal || "Settings updated",
    };
  }

  if (action.includes("UPDATE_USER_ASSIGNMENT_STATUS")) {
    return {
      ...base,
      badge: "bg-cyan-500/10 text-cyan-700 border border-cyan-500/20 font-bold",
      actionLabel: "Sales executive availability changed",
      prevLabel: oldVal || "Previous status",
      newLabel: newVal || "Availability updated",
    };
  }

  if (action.includes("ROLE_SWITCH")) {
    return {
      ...base,
      badge: "bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 font-bold",
      actionLabel: "View role switched",
      prevLabel: oldVal || "Previous role view",
      newLabel: newVal || "New role view",
    };
  }

  if (action.includes("SUPER_ADMIN_LOGIN") || action === "SUPER_ADMIN_LOGIN") {
    return {
      ...base,
      badge: "bg-amber-500/20 text-amber-500 border border-amber-500/40 font-extrabold shadow-xs",
      actionLabel: "Super Admin signed in",
      prevLabel: oldVal || "Signed out",
      newLabel: newVal || "Super Admin session started",
    };
  }

  if (action.includes("ADMIN_LOGIN") || action === "ADMIN_LOGIN") {
    return {
      ...base,
      badge: "bg-amber-500/10 text-amber-600 border border-amber-500/30 font-bold",
      actionLabel: "Admin signed in",
      prevLabel: oldVal || "Signed out",
      newLabel: newVal || "Admin session started",
    };
  }

  if (action.includes("USER_LOGIN") || action === "AUTH:LOGIN" || action.includes("AUTH:LOGIN_SUCCESS")) {
    return {
      ...base,
      badge: "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-bold",
      actionLabel: "User signed in",
      prevLabel: oldVal || "Signed out",
      newLabel: newVal || "Session started",
    };
  }

  if (action.includes("AUTH:LOGIN_FAILED")) {
    return {
      ...base,
      badge: "bg-rose-500/10 text-rose-600 border border-rose-500/20 font-bold",
      actionLabel: "Sign-in failed",
      prevLabel: oldVal || "Sign-in attempt",
      newLabel: newVal || "Wrong email or password",
    };
  }

  if (action.includes("AUTH:LOGOUT") || action.includes("LOGOUT")) {
    return {
      ...base,
      badge: "bg-slate-500/10 text-slate-600 border border-slate-500/20 font-bold",
      actionLabel: "User signed out",
      prevLabel: oldVal || "Active session",
      newLabel: newVal || "Session ended",
    };
  }

  if (action.includes("INVOICE_CMS_UPDATED")) {
    return {
      ...base,
      badge: "bg-amber-500/10 text-amber-700 border border-amber-500/20 font-bold",
      actionLabel: "Invoice company settings updated",
      prevLabel: oldVal || "Previous invoice settings",
      newLabel: newVal || "Invoice settings saved",
    };
  }

  if (action.includes("DEACTIVATE_USER") || action.includes("ACTIVATE_USER")) {
    return {
      ...base,
      badge: "bg-rose-500/10 text-rose-600 border border-rose-500/20 font-bold",
      actionLabel: action.includes("DEACTIVATE") ? "User account deactivated" : "User account reactivated",
      prevLabel: oldVal || "User account",
      newLabel: newVal || "Account status changed",
    };
  }

  if (action.includes("CREATE_USER")) {
    return {
      ...base,
      badge: "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 font-bold",
      actionLabel: "New user account created",
      prevLabel: oldVal || "No account",
      newLabel: newVal || "User created",
    };
  }

  if (action.includes("UPDATE_USER_ROLE")) {
    return {
      ...base,
      badge: "bg-indigo-500/10 text-indigo-700 border border-indigo-500/20 font-bold",
      actionLabel: "User role updated",
      prevLabel: oldVal || "Previous role",
      newLabel: newVal || "Role changed",
    };
  }

  // Default: still readable, never show raw snake_case as the only label
  return {
    ...base,
    badge: "bg-primary/10 text-primary font-bold",
    actionLabel: humanizeCode(action) || "CRM activity",
    prevLabel: oldVal || "—",
    newLabel: newVal || "—",
  };
}

function AuditLogsPage() {
  const { data: logs = [], isLoading } = useAuditLogs();
  const { role } = useAuth();
  const [q, setQ] = useState("");

  if (!can(role).viewAuditLogs()) {
    return (
      <AppShell
        title="System Audit Logs"
        subtitle="Clear history of important CRM actions for managers and admins"
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

  const filtered = logs.filter((l) => {
    if (!q) return true;
    const formatted = formatAuditLog(l);
    const hay = [
      l.user,
      l.action,
      l.old_value,
      l.new_value,
      l.ip,
      formatted.actionLabel,
      formatted.prevLabel,
      formatted.newLabel,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  return (
    <AppShell
      title="System Audit Logs"
      subtitle="Plain-English history of who did what in the CRM — lead changes, data views, invoices, and more"
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4 pb-4">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base font-medium">Activity History</CardTitle>
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
              placeholder="Search by person, lead name, action..."
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
                    <th className="px-6 py-2 font-medium">When</th>
                    <th className="px-4 py-2 font-medium">Who</th>
                    <th className="px-4 py-2 font-medium">What happened</th>
                    <th className="px-4 py-2 font-medium">Before</th>
                    <th className="px-6 py-2 font-medium">Details</th>
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
                        <td className="px-4 py-2 font-semibold text-foreground">{formatted.user}</td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] ${formatted.badge}`}>
                            {formatted.actionLabel}
                          </span>
                        </td>
                        <td
                          className="px-4 py-2 text-[11px] text-muted-foreground whitespace-normal break-words max-w-[260px]"
                          title={formatted.prevLabel}
                        >
                          {formatted.prevLabel}
                        </td>
                        <td
                          className="px-6 py-2 text-[11px] text-foreground font-semibold whitespace-normal break-words max-w-[320px]"
                          title={formatted.newLabel}
                        >
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
