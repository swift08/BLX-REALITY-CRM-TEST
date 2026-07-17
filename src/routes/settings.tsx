import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  useSettings,
  useCRMUsers,
  useWorkflowRules,
  saveCompanySettings,
  addCRMUser,
  updateCRMUserRole,
  resetCRMUserPassword,
  deleteCRMUser,
} from "@/lib/queries";
import { useAuth } from "@/hooks/use-auth";
import { can, canResetPasswordFor } from "@/lib/permissions";
import { securityConfig } from "@/lib/security.config";
import type { AppRole } from "@/hooks/use-auth";
import {
  Building2,
  Users,
  ShieldCheck,
  History,
  Settings2,
  CheckCircle2,
  XCircle,
  Pencil,
  Trash2,
  KeyRound,
  UserPlus,
  ShieldOff,
  Eye,
  EyeOff,
  Clock,
  Tag,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings · BLX Realty CRM" }] }),
  component: SettingsPage,
});

type SettingsTab = "company" | "team" | "security";

function AccessDenied() {
  const { role } = useAuth();
  return (
    <AppShell title="Settings" subtitle="Users, roles & system configuration">
      <Card className="border-destructive/20 bg-destructive/[0.03]">
        <CardContent className="p-12 flex flex-col items-center gap-4 text-center">
          <div className="h-16 w-16 rounded-2xl bg-destructive/10 border border-destructive/20 grid place-items-center">
            <ShieldOff className="h-7 w-7 text-destructive" />
          </div>
          <div className="space-y-1.5">
            <h3 className="font-bold text-base text-foreground">Access Restricted</h3>
            <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
              Settings are available to{" "}
              <span className="font-semibold text-foreground">Super Admin</span> and{" "}
              <span className="font-semibold text-foreground">Admin</span> roles only.
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

function SettingsPage() {
  const { role, user } = useAuth();
  const [tab, setTab] = useState<SettingsTab>("company");

  if (!can(role).accessCompanySettings()) {
    return <AccessDenied />;
  }

  const tabs: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
    { id: "company", label: "Company", icon: Building2 },
    { id: "team", label: "Team", icon: Users },
    { id: "security", label: "Security", icon: ShieldCheck },
  ];

  return (
    <AppShell title="Settings" subtitle="Users, roles & system configuration">
      <div className="space-y-6">
        {/* Tab Bar */}
        <div className="flex flex-nowrap gap-2 border-b border-border pb-1 overflow-x-auto scrollbar-none">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  tab === t.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === "company" && <CompanyTab role={role} />}
        {tab === "team" && <TeamTab role={role} user={user} />}
        {tab === "security" && <SecurityTab role={role} />}
      </div>
    </AppShell>
  );
}

/* ─────────────────────────────────────────
   COMPANY TAB
───────────────────────────────────────── */
function CompanyTab({ role }: { role: AppRole | null }) {
  const qc = useQueryClient();
  const { data: settings } = useSettings();
  const [companyName, setCompanyName] = useState("");
  const [workingHours, setWorkingHours] = useState("");
  const [reminderTime, setReminderTime] = useState(30);
  const [responseSla, setResponseSla] = useState(30);
  const [escalationSla, setEscalationSla] = useState(2);
  const [leadSourcesStr, setLeadSourcesStr] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setCompanyName(settings.company_name || "");
      setWorkingHours(settings.working_hours || "");
      setReminderTime(settings.reminder_time || 30);
      setResponseSla(settings.response_sla_mins || 30);
      setEscalationSla(settings.escalation_sla_hours || 2);
      setLeadSourcesStr((settings.lead_sources || []).join(", "));
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const sources = leadSourcesStr
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      await saveCompanySettings({
        company_name: companyName,
        working_hours: workingHours,
        reminder_time: Number(reminderTime),
        lead_sources: sources,
        response_sla_mins: Number(responseSla),
        escalation_sla_hours: Number(escalationSla),
      });
      toast.success("Company settings saved!");
      qc.invalidateQueries({ queryKey: ["settings"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const isReadOnly = !can(role).accessCompanySettings();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4 text-primary" /> Company Profile
          </CardTitle>
          <CardDescription>Business identity and operational settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Company Name</Label>
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                disabled={isReadOnly}
                placeholder="BLX Realty"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Working Hours
              </Label>
              <Input
                value={workingHours}
                onChange={(e) => setWorkingHours(e.target.value)}
                disabled={isReadOnly}
                placeholder="09:00 AM - 07:00 PM"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Follow-up Reminder (mins)</Label>
              <Input
                type="number"
                value={reminderTime}
                onChange={(e) => setReminderTime(Number(e.target.value))}
                disabled={isReadOnly}
                min={5}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Response SLA (mins)</Label>
              <Input
                type="number"
                value={responseSla}
                onChange={(e) => setResponseSla(Number(e.target.value))}
                disabled={isReadOnly}
                min={5}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Escalation SLA (hours)</Label>
              <Input
                type="number"
                value={escalationSla}
                onChange={(e) => setEscalationSla(Number(e.target.value))}
                disabled={isReadOnly}
                min={1}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5" /> Lead Sources
            </Label>
            <Input
              value={leadSourcesStr}
              onChange={(e) => setLeadSourcesStr(e.target.value)}
              disabled={isReadOnly}
              placeholder="Website, Instagram, Referral (comma-separated)"
            />
            <p className="text-xs text-muted-foreground">
              Separate sources with commas. These appear in the New Lead form.
            </p>
          </div>

          {!isReadOnly && (
            <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
              {saving ? "Saving…" : "Save Company Settings"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─────────────────────────────────────────
   TEAM TAB
───────────────────────────────────────── */
function TeamTab({ role, user }: { role: AppRole | null; user: any }) {
  const qc = useQueryClient();
  const { data: crmUsers = [], isLoading } = useCRMUsers();

  const [showAddUser, setShowAddUser] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<AppRole>("sales_executive");
  const [addBusy, setAddBusy] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [showResetPw, setShowResetPw] = useState(false);

  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) {
      toast.error("All fields are required");
      return;
    }
    setAddBusy(true);
    try {
      await addCRMUser({ name: newName, email: newEmail, password: newPassword, role: newRole });
      toast.success(`User ${newName} created successfully!`);
      qc.invalidateQueries({ queryKey: ["crm-users"] });
      setShowAddUser(false);
      setNewName("");
      setNewEmail("");
      setNewPassword("");
      setNewRole("sales_executive");
    } catch (err: any) {
      toast.error(err.message || "Failed to create user");
    } finally {
      setAddBusy(false);
    }
  };

  const handleRoleChange = async (userId: string, newRoleVal: string) => {
    try {
      await updateCRMUserRole(userId, newRoleVal);
      toast.success("Role updated successfully");
      qc.invalidateQueries({ queryKey: ["crm-users"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to update role");
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPassword.trim() || resetPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setResetBusy(true);
    try {
      await resetCRMUserPassword(resetUserId!, resetPassword);
      toast.success("Password reset successfully");
      setResetUserId(null);
      setResetPassword("");
    } catch (err: any) {
      toast.error(err.message || "Failed to reset password");
    } finally {
      setResetBusy(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserId) return;
    setDeleteBusy(true);
    try {
      await deleteCRMUser(deleteUserId);
      toast.success("User deleted");
      qc.invalidateQueries({ queryKey: ["crm-users"] });
      setDeleteUserId(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete user");
    } finally {
      setDeleteBusy(false);
    }
  };

  const canManageTeam = can(role).accessTeamManagement();
  const canCreateUsers = can(role).createSalesExecutive();
  const canDeleteUsers = can(role).deleteUser();

  const roleColors: Record<AppRole, string> = {
    super_admin: "bg-amber-500/10 text-amber-600",
    admin: "bg-indigo-500/10 text-indigo-600",
    manager: "bg-purple-500/10 text-purple-600",
    sales_executive: "bg-emerald-500/10 text-emerald-600",
  };

  const roleLabels: Record<AppRole, string> = {
    super_admin: "Super Admin",
    admin: "Admin",
    manager: "Manager",
    sales_executive: "Sales Executive",
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" /> Team Members
            </CardTitle>
            <CardDescription>Manage CRM users, roles, and permissions</CardDescription>
          </div>
          {canCreateUsers && (
            <Button size="sm" onClick={() => setShowAddUser(true)} className="gap-2">
              <UserPlus className="h-4 w-4" /> Add User
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : (
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-y bg-muted/30">
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-3 py-3 font-medium">Email</th>
                  <th className="px-3 py-3 font-medium">Role</th>
                  {canManageTeam && <th className="px-3 py-3 font-medium text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {crmUsers.map((u) => {
                  const isSelf = u.id === user?.id;
                  const targetUser = { id: u.id, role: u.role };
                  const canReset = canResetPasswordFor(role, user?.id, targetUser);
                  const canDel = canDeleteUsers && !isSelf;
                  return (
                    <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground grid place-items-center text-xs font-semibold flex-shrink-0">
                            {u.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()
                              .slice(0, 2)}
                          </div>
                          <span className="font-medium">
                            {u.name}
                            {isSelf && (
                              <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground text-xs">{u.email}</td>
                      <td className="px-3 py-3">
                        {can(role).changeUserRole() && !isSelf ? (
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            className={`text-xs font-semibold px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30 ${roleColors[u.role as AppRole] || "bg-muted"}`}
                          >
                            <option value="super_admin">Super Admin</option>
                            <option value="admin">Admin</option>
                            <option value="manager">Manager</option>
                            <option value="sales_executive">Sales Executive</option>
                          </select>
                        ) : (
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${roleColors[u.role as AppRole] || "bg-muted"}`}
                          >
                            {roleLabels[u.role as AppRole] || u.role}
                          </span>
                        )}
                      </td>
                      {canManageTeam && (
                        <td className="px-3 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {canReset && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title="Reset Password"
                                onClick={() => {
                                  setResetUserId(u.id);
                                  setResetPassword("");
                                }}
                              >
                                <KeyRound className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {canDel && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                title="Delete User"
                                onClick={() => setDeleteUserId(u.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Add User Dialog */}
      <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" /> Add New User
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddUser} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ravi Kumar"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email Address</Label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="ravi@blxrealty.com"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Initial Password</Label>
              <div className="relative">
                <Input
                  type={showNewPw ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(!showNewPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as AppRole)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {can(role).createSuperAdmin() && <option value="super_admin">Super Admin</option>}
                {can(role).createAdmin() && <option value="admin">Admin</option>}
                {can(role).createManager() && <option value="manager">Manager</option>}
                <option value="sales_executive">Sales Executive</option>
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddUser(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={addBusy}>
                {addBusy ? "Creating…" : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetUserId} onOpenChange={() => setResetUserId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" /> Reset Password
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label>New Password</Label>
              <div className="relative">
                <Input
                  type={showResetPw ? "text" : "password"}
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowResetPw(!showResetPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showResetPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setResetUserId(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={resetBusy}>
                {resetBusy ? "Resetting…" : "Reset Password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> Delete User
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This action is permanent and cannot be undone. The user will lose access immediately.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUserId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={deleteBusy} onClick={handleDeleteUser}>
              {deleteBusy ? "Deleting…" : "Delete User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─────────────────────────────────────────
   SECURITY TAB
───────────────────────────────────────── */
function SecurityTab({ role }: { role: AppRole | null }) {
  const isSA = role === "super_admin";

  const features = [
    {
      key: "watermarking",
      label: "Dynamic Watermarking",
      desc: "Overlay user identity on all sensitive pages",
      value: securityConfig.watermarking,
    },
    {
      key: "clipboardBlocking",
      label: "Clipboard Protection",
      desc: "Block copy, cut, and paste operations",
      value: securityConfig.clipboardBlocking,
    },
    {
      key: "printBlocking",
      label: "Print Protection",
      desc: "Prevent printing and page saves",
      value: securityConfig.printBlocking,
    },
    {
      key: "contentProtection",
      label: "Content Protection",
      desc: "Block screen capture on sensitive pages (Electron)",
      value: securityConfig.contentProtection,
    },
    {
      key: "idleTimeout",
      label: "Idle Session Timeout",
      desc: `Auto-logout after ${securityConfig.idleTimeoutMs / 60000} minutes`,
      value: securityConfig.idleTimeout,
    },
    {
      key: "deviceBinding",
      label: "Device Binding",
      desc: "Bind sessions to verified devices (Electron)",
      value: securityConfig.deviceBinding,
    },
    {
      key: "exportRestrictions",
      label: "Export Restrictions",
      desc: "Restrict data export to authorized roles",
      value: securityConfig.exportRestrictions,
    },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-primary" /> Security Configuration
          </CardTitle>
          <CardDescription>
            Active security controls. Configuration changes require a deployment update.
            {!isSA && " View-only for your role."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {features.map((f) => (
              <div
                key={f.key}
                className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 gap-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground">{f.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{f.desc}</div>
                </div>
                <div
                  className={`flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                    f.value
                      ? "bg-emerald-500/10 text-emerald-600"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {f.value ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Enabled
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3.5 w-3.5" /> Disabled
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
            <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
              🔒 Security Config Note
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              To change security settings, edit{" "}
              <code className="px-1 py-0.5 rounded bg-muted text-xs font-mono">
                src/lib/security.config.ts
              </code>{" "}
              and redeploy. Runtime toggling of security controls is intentionally restricted to
              prevent tampering.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings2 className="h-4 w-4 text-primary" /> Audit Verbosity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
            <div>
              <div className="text-sm font-medium">Current Level</div>
              <div className="text-xs text-muted-foreground">
                Controls granularity of security audit logs
              </div>
            </div>
            <span className="ml-auto text-xs font-bold px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-600 uppercase">
              {securityConfig.auditVerbosity}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


