import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import {
  useLeadAssignmentSettings,
  useUpdateLeadAssignmentSettings,
  useCRMUsers,
  useProjects,
  useUpdateUserAssignmentStatus,
} from "@/lib/queries";
import { toast } from "sonner";
import {
  Workflow,
  Settings,
  ShieldAlert,
  Save,
  RotateCw,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Users,
  Building2,
  Share2,
  Lock,
  PauseCircle,
  PlayCircle,
  HelpCircle,
} from "lucide-react";

export const Route = createFileRoute("/lead-assignment-settings")({
  head: () => ({ meta: [{ title: "Lead Assignment Engine · BLX Realty CRM" }] }),
  component: LeadAssignmentSettingsPage,
});

function LeadAssignmentSettingsPage() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const hasAccess = role === "super_admin" || role === "admin";

  const { data: settings, isLoading: settingsLoading } = useLeadAssignmentSettings();
  const updateSettings = useUpdateLeadAssignmentSettings();
  const { data: crmUsers = [] } = useCRMUsers();
  const { data: projects = [] } = useProjects();
  const updateUserAssignment = useUpdateUserAssignmentStatus();

  // Local settings state
  const [strategy, setStrategy] = useState<string>("round_robin");
  const [autoAssign, setAutoAssign] = useState<boolean>(true);
  const [skipPaused, setSkipPaused] = useState<boolean>(true);
  const [skipInactive, setSkipInactive] = useState<boolean>(true);
  const [enableProjectRouting, setEnableProjectRouting] = useState<boolean>(false);
  const [enableSourceRouting, setEnableSourceRouting] = useState<boolean>(false);
  const [allowManagerOverride, setAllowManagerOverride] = useState<boolean>(true);
  const [maintainHistory, setMaintainHistory] = useState<boolean>(true);

  // SLA states
  const [slaContactMins, setSlaContactMins] = useState<number>(30);
  const [slaEscalateHours, setSlaEscalateHours] = useState<number>(2);
  const [slaReassignHours, setSlaReassignHours] = useState<number>(24);

  // Source routes mapping
  const [sourceRoutes, setSourceRoutes] = useState<Record<string, string>>({
    Facebook: "sales_executive",
    Instagram: "sales_executive",
    Website: "sales_executive",
    Referral: "sales_executive",
    "Walk-in": "sales_executive",
    "Landing Page": "sales_executive",
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setStrategy(settings.distribution_strategy || "round_robin");
      setAutoAssign(settings.auto_assign_leads ?? true);
      setSkipPaused(settings.skip_paused_users ?? true);
      setSkipInactive(settings.skip_inactive_users ?? true);
      setEnableProjectRouting(settings.enable_project_routing ?? false);
      setEnableSourceRouting(settings.enable_source_routing ?? false);
      setAllowManagerOverride(settings.allow_manager_override ?? true);
      setMaintainHistory(settings.maintain_assignment_history ?? true);
      setSlaContactMins(settings.sla_first_contact_mins ?? 30);
      setSlaEscalateHours(settings.sla_manager_escalate_hours ?? 2);
      setSlaReassignHours(settings.sla_auto_reassign_hours ?? 24);
      if (settings.source_routes) {
        setSourceRoutes(settings.source_routes);
      }
    }
  }, [settings]);

  if (!hasAccess) {
    return (
      <AppShell title="Access Denied" subtitle="Security Exception">
        <div className="max-w-md mx-auto mt-12 text-center p-8 border rounded-2xl bg-card shadow-2xl space-y-4">
          <ShieldAlert className="h-16 w-16 text-destructive mx-auto animate-bounce" />
          <h2 className="text-xl font-bold text-foreground">Unauthorized Access</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Only Administrators can configure system lead assignment distribution rules.
          </p>
          <Button onClick={() => navigate({ to: "/" })} className="w-full">
            Back to Dashboard
          </Button>
        </div>
      </AppShell>
    );
  }

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await updateSettings.mutateAsync({
        distribution_strategy: strategy as any,
        auto_assign_leads: autoAssign,
        skip_paused_users: skipPaused,
        skip_inactive_users: skipInactive,
        enable_project_routing: enableProjectRouting,
        enable_source_routing: enableSourceRouting,
        allow_manager_override: allowManagerOverride,
        maintain_assignment_history: maintainHistory,
        source_routes: sourceRoutes,
        sla_first_contact_mins: Number(slaContactMins),
        sla_manager_escalate_hours: Number(slaEscalateHours),
        sla_auto_reassign_hours: Number(slaReassignHours),
      });
      toast.success("Lead Assignment Engine settings updated successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update lead assignment settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "available" ? "paused" : "available";
    try {
      await updateUserAssignment.mutateAsync({ id: userId, assignment_status: nextStatus });
      toast.success(`Executive assignment status updated to ${nextStatus.toUpperCase()}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  };

  const eligibleExecutives = crmUsers.filter(
    (u) => u.role === "sales_executive" || u.role === "admin" || u.role === "super_admin",
  );

  return (
    <AppShell
      title="Lead Assignment Settings"
      subtitle="Configure centralized lead routing, round-robin distribution strategies, user availability, and SLA escalation rules"
    >
      <div className="space-y-6">
        {/* Header Action Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Workflow className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                Lead Assignment Engine Pipeline
              </h2>
              <p className="text-xs text-muted-foreground">
                Single source of truth for all incoming leads across Webhooks, Forms, CSV, and
                Manual creation.
              </p>
            </div>
          </div>
          <Button onClick={handleSaveSettings} disabled={saving} className="gap-2 shadow-md">
            <Save className="h-4 w-4" />
            {saving ? "Saving Changes..." : "Save Assignment Settings"}
          </Button>
        </div>

        {/* Distribution Strategy Selector */}
        <Card className="border border-border bg-card shadow-md">
          <CardHeader className="text-left border-b border-border/40 pb-4">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <Sliders className="h-4 w-4 text-primary" /> Core Distribution Strategy
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Select how new incoming leads are allocated to your Sales Team.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Option 1: Round Robin */}
              <div
                onClick={() => setStrategy("round_robin")}
                className={`cursor-pointer rounded-xl border p-4 transition-all text-left space-y-2 ${
                  strategy === "round_robin"
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm"
                    : "border-border hover:border-primary/50 bg-card"
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <RotateCw className="h-4 w-4 text-primary" /> Round Robin (Default)
                  </span>
                  {strategy === "round_robin" && <CheckCircle2 className="h-4 w-4 text-primary" />}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Fair sequential distribution across all eligible, available Sales Executives.
                  Rotation state persists automatically.
                </p>
              </div>

              {/* Option 2: Project-Based */}
              <div
                onClick={() => {
                  setStrategy("project_based");
                  setEnableProjectRouting(true);
                }}
                className={`cursor-pointer rounded-xl border p-4 transition-all text-left space-y-2 ${
                  strategy === "project_based"
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm"
                    : "border-border hover:border-primary/50 bg-card"
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <Building2 className="h-4 w-4 text-primary" /> Project-Based Round Robin
                  </span>
                  {strategy === "project_based" && (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Routes leads to executives assigned specifically to the lead's project pool before
                  applying round-robin.
                </p>
              </div>

              {/* Option 3: Source-Based */}
              <div
                onClick={() => {
                  setStrategy("source_based");
                  setEnableSourceRouting(true);
                }}
                className={`cursor-pointer rounded-xl border p-4 transition-all text-left space-y-2 ${
                  strategy === "source_based"
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm"
                    : "border-border hover:border-primary/50 bg-card"
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <Share2 className="h-4 w-4 text-primary" /> Source-Based Routing
                  </span>
                  {strategy === "source_based" && <CheckCircle2 className="h-4 w-4 text-primary" />}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Routes leads based on channel origin (Facebook Ads, Website, Referrals, Walk-ins)
                  to designated teams.
                </p>
              </div>

              {/* Option 4: Manual */}
              <div
                onClick={() => setStrategy("manual")}
                className={`cursor-pointer rounded-xl border p-4 transition-all text-left space-y-2 ${
                  strategy === "manual"
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm"
                    : "border-border hover:border-primary/50 bg-card"
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <Lock className="h-4 w-4 text-primary" /> Manual Assignment Only
                  </span>
                  {strategy === "manual" && <CheckCircle2 className="h-4 w-4 text-primary" />}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Disables automatic distribution. All new leads enter as "Unassigned" until
                  manually allocated by Managers.
                </p>
              </div>

              {/* Option 5: Capacity-Based (Future) */}
              <div
                onClick={() => setStrategy("capacity_based")}
                className={`cursor-pointer rounded-xl border p-4 transition-all text-left space-y-2 ${
                  strategy === "capacity_based"
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm"
                    : "border-border hover:border-primary/50 bg-card"
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-primary" /> Capacity-Based (Workload)
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                    Phase 2 Ready
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Evaluates active workload (open leads count) and prioritizes executives with lower
                  active lead volume.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Global Controls & Engine Rules */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border border-border bg-card shadow-md">
            <CardHeader className="text-left border-b border-border/40 pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                <Settings className="h-4 w-4 text-primary" /> Engine Rules & Safeguards
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Configure auto-assignment behavior and availability checks.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4 text-left">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-bold text-foreground">Auto Assign New Leads</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically process incoming leads through assignment engine
                  </p>
                </div>
                <Switch checked={autoAssign} onCheckedChange={setAutoAssign} />
              </div>

              <div className="flex items-center justify-between border-t border-border/40 pt-3">
                <div>
                  <Label className="text-sm font-bold text-foreground">Skip Paused Users</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically bypass executives marked as Paused (Leave/Travel)
                  </p>
                </div>
                <Switch checked={skipPaused} onCheckedChange={setSkipPaused} />
              </div>

              <div className="flex items-center justify-between border-t border-border/40 pt-3">
                <div>
                  <Label className="text-sm font-bold text-foreground">Skip Inactive Users</Label>
                  <p className="text-xs text-muted-foreground">
                    Exclude disabled or inactive user accounts
                  </p>
                </div>
                <Switch checked={skipInactive} onCheckedChange={setSkipInactive} />
              </div>

              <div className="flex items-center justify-between border-t border-border/40 pt-3">
                <div>
                  <Label className="text-sm font-bold text-foreground">
                    Allow Manager Manual Override
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Managers & Super Admins can reassign leads at any time
                  </p>
                </div>
                <Switch checked={allowManagerOverride} onCheckedChange={setAllowManagerOverride} />
              </div>

              <div className="flex items-center justify-between border-t border-border/40 pt-3">
                <div>
                  <Label className="text-sm font-bold text-foreground">
                    Maintain Assignment Audit Trail
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Log complete assignment and reassignment history for every lead
                  </p>
                </div>
                <Switch checked={maintainHistory} onCheckedChange={setMaintainHistory} />
              </div>
            </CardContent>
          </Card>

          {/* SLA Response & Escalation Timers */}
          <Card className="border border-border bg-card shadow-md">
            <CardHeader className="text-left border-b border-border/40 pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                <Clock className="h-4 w-4 text-primary" /> SLA Response & Escalation Monitoring
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Configure response-time thresholds to prevent neglected leads.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4 text-left">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">
                  1st Contact Reminder (Minutes)
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={slaContactMins}
                    onChange={(e) => setSlaContactMins(Number(e.target.value))}
                    className="w-32 text-xs font-bold"
                  />
                  <span className="text-xs text-muted-foreground">
                    Notify Sales Executive if no activity logged
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 border-t border-border/40 pt-3">
                <Label className="text-xs font-bold text-foreground">
                  Manager Escalation Alert (Hours)
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={slaEscalateHours}
                    onChange={(e) => setSlaEscalateHours(Number(e.target.value))}
                    className="w-32 text-xs font-bold"
                  />
                  <span className="text-xs text-muted-foreground">
                    Notify Sales Manager if lead untouched
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 border-t border-border/40 pt-3">
                <Label className="text-xs font-bold text-foreground">
                  Auto-Reassign Threshold (Hours)
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={slaReassignHours}
                    onChange={(e) => setSlaReassignHours(Number(e.target.value))}
                    className="w-32 text-xs font-bold"
                  />
                  <span className="text-xs text-muted-foreground">
                    Trigger re-assignment option for un-contacted leads
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Executive Availability Matrix */}
        <Card className="border border-border bg-card shadow-md">
          <CardHeader className="text-left border-b border-border/40 pb-4">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <Users className="h-4 w-4 text-primary" /> Sales Executive Availability Matrix
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Manage executive availability status (🟢 Available | ⏸ Paused | 🔴 Inactive) for the
              Round Robin pool.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Executive Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Assignment Availability</TableHead>
                  <TableHead>Assigned Projects</TableHead>
                  <TableHead className="text-right">Quick Toggle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eligibleExecutives.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-6 text-xs text-muted-foreground"
                    >
                      No Sales Executives found in CRM database.
                    </TableCell>
                  </TableRow>
                ) : (
                  eligibleExecutives.map((exec) => {
                    const status =
                      exec.assignment_status || (exec.isDisabled ? "inactive" : "available");
                    return (
                      <TableRow key={exec.id}>
                        <TableCell className="text-left font-semibold text-sm">
                          {exec.name}
                          <div className="text-xs text-muted-foreground font-normal">
                            {exec.email}
                          </div>
                        </TableCell>
                        <TableCell className="text-left">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                            {(exec.role || "sales_executive").replace("_", " ")}
                          </span>
                        </TableCell>
                        <TableCell className="text-left">
                          {status === "available" && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                              🟢 Available
                            </span>
                          )}
                          {status === "paused" && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                              ⏸ Paused
                            </span>
                          )}
                          {status === "inactive" && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-destructive bg-destructive/10 px-2.5 py-1 rounded-full border border-destructive/20">
                              🔴 Inactive
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-left">
                          {exec.assigned_projects && exec.assigned_projects.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {exec.assigned_projects.map((pId) => {
                                const proj = projects.find((p) => p.id === pId);
                                return (
                                  <span
                                    key={pId}
                                    className="text-[10px] font-medium bg-muted px-2 py-0.5 rounded border border-border"
                                  >
                                    {proj ? proj.name : pId}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground font-italic">
                              All Projects
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={exec.isDisabled}
                            onClick={() => handleToggleUserStatus(exec.id, status)}
                            className="gap-1.5 text-xs font-semibold"
                          >
                            {status === "available" ? (
                              <>
                                <PauseCircle className="h-3.5 w-3.5 text-amber-500" /> Pause
                                Executive
                              </>
                            ) : (
                              <>
                                <PlayCircle className="h-3.5 w-3.5 text-emerald-500" /> Set
                                Available
                              </>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
