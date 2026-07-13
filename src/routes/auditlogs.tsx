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
                Audit Logs are available to{" "}
                <span className="font-semibold text-foreground">Super Admin</span> and{" "}
                <span className="font-semibold text-foreground">Admin</span> roles only. Contact
                your administrator if you need access to this section.
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
                  {filtered.map((l) => (
                    <tr
                      key={l.id}
                      className="border-b last:border-0 hover:bg-muted/20 h-11 transition-colors"
                    >
                      <td className="px-6 py-2 font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                        {new Date(l.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 font-medium text-foreground">{l.user}</td>
                      <td className="px-4 py-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide bg-primary/10 text-primary uppercase">
                          {l.action}
                        </span>
                      </td>
                      <td className="px-4 py-2 font-mono text-[10px] text-muted-foreground">
                        {l.ip || "192.168.1.105"}
                      </td>
                      <td className="px-4 py-2 font-mono text-[10px] text-muted-foreground truncate max-w-[200px]">
                        {l.old_value || "—"}
                      </td>
                      <td className="px-6 py-2 font-mono text-[10px] text-foreground font-medium truncate max-w-[200px]">
                        {l.new_value || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
