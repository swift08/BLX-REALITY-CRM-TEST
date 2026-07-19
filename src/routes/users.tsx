import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import {
  useCRMUsers,
  addCRMUser,
  updateCRMUserRole,
  resetCRMUserPassword,
  deleteCRMUser,
  toggleCRMUserStatus,
  useUpdateUserAssignmentStatus,
  useProjects,
} from "@/lib/queries";

import { toast } from "sonner";
import {
  Users,
  UserPlus,
  KeyRound,
  Trash2,
  ShieldAlert,
  UserCheck,
  Power,
  Edit2,
  Mail,
  User,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/users")({
  head: () => ({ meta: [{ title: "User Management · BLX Realty CRM" }] }),
  component: UsersPage,
});

function UsersPage() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Guard: Admin & Super Admin only
  const hasAccess = role === "super_admin" || role === "admin";

  const { data: users = [], isLoading } = useCRMUsers();

  // Create user states
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<AppRole>("sales_executive");
  const [addBusy, setAddBusy] = useState(false);

  // Edit user states
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editRole, setEditRole] = useState<AppRole>("sales_executive");
  const [editBusy, setEditBusy] = useState(false);

  // Password reset states
  const [resettingUser, setResettingUser] = useState<any | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetBusy, setResetBusy] = useState(false);

  // Loading/Busy overlays
  const [busyUser, setBusyUser] = useState<string | null>(null);

  // These hooks must be called unconditionally before any early returns (React rules of hooks)
  const updateUserAssignment = useUpdateUserAssignmentStatus();
  const { data: projects = [] } = useProjects();

  if (!hasAccess) {
    return (
      <AppShell title="Access Denied" subtitle="Security Exception">
        <div className="max-w-md mx-auto mt-12 text-center p-8 border rounded-2xl bg-card shadow-2xl space-y-4">
          <ShieldAlert className="h-16 w-16 text-destructive mx-auto animate-bounce" />
          <h2 className="text-xl font-bold text-foreground">Unauthorized Access</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            You do not have administrative privileges to access this area. If you believe this is an
            error, please contact your Super Administrator.
          </p>
          <Button onClick={() => navigate({ to: "/" })} className="w-full">
            Back to Dashboard
          </Button>
        </div>
      </AppShell>
    );
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) {
      toast.error("All fields are required.");
      return;
    }
    setAddBusy(true);
    try {
      await addCRMUser({ name: newName, email: newEmail, password: newPassword, role: newRole });
      toast.success("CRM User created successfully!");
      setShowAddModal(false);
      setNewName("");
      setNewEmail("");
      setNewPassword("");
      setNewRole("sales_executive");
      qc.invalidateQueries({ queryKey: ["crm-users"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to create user.");
    } finally {
      setAddBusy(false);
    }
  };

  const handleEditRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditBusy(true);
    try {
      await updateCRMUserRole(editingUser.id, editRole);
      toast.success(`Role updated to ${editRole.replace("_", " ")}.`);
      setEditingUser(null);
      qc.invalidateQueries({ queryKey: ["crm-users"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to update user role.");
    } finally {
      setEditBusy(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingUser || !resetPassword.trim()) return;
    setResetBusy(true);
    try {
      await resetCRMUserPassword(resettingUser.id, resetPassword);
      toast.success("Password reset completed successfully.");
      setResettingUser(null);
      setResetPassword("");
    } catch (err: any) {
      toast.error(err.message || "Failed to reset password.");
    } finally {
      setResetBusy(false);
    }
  };

  const handleToggleStatus = async (user: any) => {
    const nextStatus = !user.isDisabled;
    setBusyUser(user.id);
    try {
      await toggleCRMUserStatus(user.id, nextStatus);
      toast.success(`User ${nextStatus ? "deactivated" : "activated"} successfully.`);
      qc.invalidateQueries({ queryKey: ["crm-users"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to toggle status.");
    } finally {
      setBusyUser(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (role !== "super_admin") {
      toast.error("Security Exception: Only Super Admins can hard delete users.");
      return;
    }
    if (
      !confirm(
        "Are you absolutely sure you want to permanently delete this user? This cannot be undone.",
      )
    )
      return;

    setBusyUser(userId);
    try {
      await deleteCRMUser(userId);
      toast.success("User deleted successfully.");
      qc.invalidateQueries({ queryKey: ["crm-users"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to delete user.");
    } finally {
      setBusyUser(null);
    }
  };

  const getRoleBadge = (uRole: AppRole) => {
    switch (uRole) {
      case "super_admin":
        return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case "admin":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "manager":
        return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      case "marketing":
        return "bg-cyan-500/10 text-cyan-500 border-cyan-500/20";
      default:
        return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
    }
  };

  const formatRole = (uRole: string = "sales_executive") => {
    return (uRole || "sales_executive")
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  };

  const handleAssignmentStatusChange = async (
    userId: string,
    newStatus: "available" | "paused" | "inactive",
  ) => {
    setBusyUser(userId);
    try {
      await updateUserAssignment.mutateAsync({ id: userId, assignment_status: newStatus });
      toast.success(`Assignment status updated to ${newStatus.toUpperCase()}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update assignment status");
    } finally {
      setBusyUser(null);
    }
  };

  return (
    <AppShell
      title="Users Management"
      subtitle="Manage CRM users, permissions, lead assignment availability, and credentials"
    >
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Active Directory</h2>
          </div>
          <Button onClick={() => setShowAddModal(true)} size="sm" className="gap-1.5 shadow-md">
            <UserPlus className="h-4 w-4" /> Add User Account
          </Button>
        </div>

        <Card className="border border-border bg-card shadow-lg">
          <CardHeader className="text-left pb-3 border-b border-border/40">
            <CardTitle className="text-base font-bold text-foreground">
              CRM Accounts & Lead Distribution
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Configure user access, active status, and Lead Assignment Engine availability
              (Available 🟢, Paused ⏸, Inactive 🔴).
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-muted-foreground font-medium">
                Loading CRM User Accounts...
              </div>
            ) : users.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground font-medium">
                No users found.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User Details</TableHead>
                    <TableHead>Role Perspective</TableHead>
                    <TableHead>Account Status</TableHead>
                    <TableHead>Lead Assignment Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => {
                    const currentAssignmentStatus =
                      u.assignment_status || (u.isDisabled ? "inactive" : "available");
                    return (
                      <TableRow key={u.id} className={u.isDisabled ? "opacity-60 bg-muted/20" : ""}>
                        <TableCell className="text-left font-medium">
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-foreground">{u.name}</span>
                            <span className="text-xs text-muted-foreground">{u.email}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-left">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getRoleBadge(u.role)}`}
                          >
                            {formatRole(u.role)}
                          </span>
                        </TableCell>
                        <TableCell className="text-left">
                          {u.isDisabled ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-destructive">
                              <XCircle className="h-3.5 w-3.5" /> Deactivated
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-500">
                              <CheckCircle className="h-3.5 w-3.5" /> Active
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-left">
                          <Select
                            value={currentAssignmentStatus}
                            disabled={busyUser === u.id || u.isDisabled}
                            onValueChange={(val) => handleAssignmentStatusChange(u.id, val as any)}
                          >
                            <SelectTrigger className="h-8 text-xs font-semibold w-[130px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="available">
                                <span className="flex items-center gap-1.5 text-emerald-600 font-bold">
                                  🟢 Available
                                </span>
                              </SelectItem>
                              <SelectItem value="paused">
                                <span className="flex items-center gap-1.5 text-amber-600 font-bold">
                                  ⏸ Paused
                                </span>
                              </SelectItem>
                              <SelectItem value="inactive">
                                <span className="flex items-center gap-1.5 text-destructive font-bold">
                                  🔴 Inactive
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={busyUser === u.id}
                              onClick={() => {
                                setEditingUser(u);
                                setEditRole(u.role);
                              }}
                              title="Edit Role"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={busyUser === u.id}
                              onClick={() => setResettingUser(u)}
                              title="Reset Password"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            >
                              <KeyRound className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={busyUser === u.id}
                              onClick={() => handleToggleStatus(u)}
                              title={u.isDisabled ? "Activate User" : "Deactivate User"}
                              className={`h-8 w-8 ${u.isDisabled ? "text-emerald-500 hover:bg-emerald-500/10" : "text-amber-500 hover:bg-amber-500/10"}`}
                            >
                              <Power className="h-3.5 w-3.5" />
                            </Button>
                            {role === "super_admin" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={busyUser === u.id}
                                onClick={() => handleDeleteUser(u.id)}
                                title="Delete User"
                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Add User Modal */}
        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogContent className="max-w-md bg-card text-left rounded-xl border border-border shadow-2xl p-6">
            <DialogHeader>
              <DialogTitle className="text-base font-bold font-display text-foreground flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" /> Create User Account
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-1">
                Fill out the credentials to register a new user in the CRM directory.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleAddUser} className="space-y-4 mt-3">
              <div className="space-y-1.5">
                <Label htmlFor="add-name" className="flex items-center gap-1">
                  <User className="h-3.5 w-3.5 text-muted-foreground" /> Full Name
                </Label>
                <Input
                  id="add-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Enter full name"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="add-email" className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" /> Email Address
                </Label>
                <Input
                  id="add-email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Enter email address"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="add-password" className="flex items-center gap-1">
                  <KeyRound className="h-3.5 w-3.5 text-muted-foreground" /> Initial Password
                </Label>
                <Input
                  id="add-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter password (min. 6 chars)"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="add-role">Assigned Role Perspective</Label>
                <Select value={newRole} onValueChange={(val: any) => setNewRole(val)}>
                  <SelectTrigger id="add-role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sales_executive">💼 Sales Executive</SelectItem>
                    <SelectItem value="manager">🛡️ Manager</SelectItem>
                    <SelectItem value="admin">🛠️ Admin Operations</SelectItem>
                    <SelectItem value="marketing">📢 Marketing</SelectItem>
                    {role === "super_admin" && (
                      <SelectItem value="super_admin">👑 Super Admin</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddModal(false)}
                  disabled={addBusy}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={addBusy}>
                  {addBusy ? "Creating User..." : "Register User"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Role Modal */}
        <Dialog open={editingUser !== null} onOpenChange={(open) => !open && setEditingUser(null)}>
          <DialogContent className="max-w-md bg-card text-left rounded-xl border border-border shadow-2xl p-6">
            <DialogHeader>
              <DialogTitle className="text-base font-bold font-display text-foreground flex items-center gap-2">
                <Edit2 className="h-5 w-5 text-primary" /> Modify Role Perspective
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-1">
                Change the assigned security role for{" "}
                <span className="font-bold text-foreground">{editingUser?.name}</span>.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleEditRole} className="space-y-4 mt-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-role">Role Perspective</Label>
                <Select value={editRole} onValueChange={(val: any) => setEditRole(val)}>
                  <SelectTrigger id="edit-role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sales_executive">💼 Sales Executive</SelectItem>
                    <SelectItem value="manager">🛡️ Manager</SelectItem>
                    <SelectItem value="admin">🛠️ Admin Operations</SelectItem>
                    <SelectItem value="marketing">📢 Marketing</SelectItem>
                    {role === "super_admin" && (
                      <SelectItem value="super_admin">👑 Super Admin</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingUser(null)}
                  disabled={editBusy}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={editBusy}>
                  {editBusy ? "Saving Changes..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Password Reset Modal */}
        <Dialog
          open={resettingUser !== null}
          onOpenChange={(open) => !open && setResettingUser(null)}
        >
          <DialogContent className="max-w-md bg-card text-left rounded-xl border border-border shadow-2xl p-6">
            <DialogHeader>
              <DialogTitle className="text-base font-bold font-display text-foreground flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" /> Reset Account Password
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-1">
                Enter a new secure password for{" "}
                <span className="font-bold text-foreground">{resettingUser?.name}</span>.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleResetPassword} className="space-y-4 mt-3">
              <div className="space-y-1.5">
                <Label htmlFor="reset-pass">New Secure Password</Label>
                <Input
                  id="reset-pass"
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Enter new password (min. 6 chars)"
                  required
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setResettingUser(null);
                    setResetPassword("");
                  }}
                  disabled={resetBusy}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={resetBusy}>
                  {resetBusy ? "Resetting..." : "Reset Password"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
