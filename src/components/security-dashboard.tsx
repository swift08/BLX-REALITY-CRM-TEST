import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert, Terminal, Lock } from "lucide-react";
import { useAuditLogs } from "@/lib/queries";

export function SecurityDashboard() {
  const { data: auditLogs = [] } = useAuditLogs();
  const [violations, setViolations] = useState<any[]>([]);

  useEffect(() => {
    // Filter audit logs for security exceptions
    const securityLogs = auditLogs.filter(
      (log) =>
        log.action.includes("BLOCKED") ||
        log.action.includes("SECURITY") ||
        log.action.includes("BYPASS") ||
        log.action.includes("REVEALED"),
    );
    setViolations(securityLogs.slice(0, 10));
  }, [auditLogs]);

  return (
    <div className="space-y-6 text-left">
      <h2 className="text-xl font-bold tracking-tight">System Security Telemetry</h2>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-destructive/10 border-destructive/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bypasses Blocked</CardTitle>
            <ShieldAlert className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{violations.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Attempts flagged on device</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Device Signature Binding</CardTitle>
            <Lock className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Active</div>
            <p className="text-xs text-muted-foreground mt-1">Unique bound keys enforced</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Terminal className="h-4 w-4 text-amber-500" /> Recent Security Flag Events
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {violations.map((log) => (
              <div key={log.id} className="flex justify-between items-start text-xs border-b pb-2">
                <div>
                  <p className="font-semibold text-foreground">{log.action}</p>
                  <p className="text-muted-foreground">
                    User: {log.user} | Detail: {log.new_value || log.old_value}
                  </p>
                </div>
                <span className="text-muted-foreground">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
            {violations.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                No security logs recorded.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
