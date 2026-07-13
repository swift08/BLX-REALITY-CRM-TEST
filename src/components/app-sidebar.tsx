import { useState, useEffect } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import logo from "@/assets/blx-logo.png";
import { cn } from "@/lib/utils";
import { useAuth, AppRole } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useFollowups, serverSignIn, useCRMUsers } from "@/lib/queries";
import { can } from "@/lib/permissions";
import {
  Gauge,
  Users,
  Calendar,
  BellRing,
  MapPin,
  Briefcase,
  Building2,
  Boxes,
  KeyRound,
  TrendingUp,
  Settings,
  History,
  LogOut,
  ShieldAlert,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export function AppSidebar({ isOpen }: { isOpen?: boolean }) {
  const { location } = useRouterState();
  const { role, user, signOut, changeRole } = useAuth();
  const navigate = useNavigate();

  // Query followups to check for overdue items
  const { data: followups = [] } = useFollowups();
  const todayStr = new Date().toISOString().slice(0, 10);
  const overdueCount = followups.filter(
    (f) => f.status === "pending" && f.time.slice(0, 10) < todayStr,
  ).length;

  // Role switching validation states
  const [showVerify, setShowVerify] = useState(false);
  const [proposedRole, setProposedRole] = useState<AppRole | null>(null);
  const [verifyPassword, setVerifyPassword] = useState("");
  const [showVerifyPassword, setShowVerifyPassword] = useState(false);
  const [selectedSwapEmail, setSelectedSwapEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: crmUsers = [] } = useCRMUsers();
  const filteredUsers = proposedRole ? crmUsers.filter((u) => u.role === proposedRole) : [];

  useEffect(() => {
    if (proposedRole) {
      const emailMap: Record<AppRole, string> = {
        super_admin: "nischith@blxreality.com",
        admin: "admin@blxreality.com",
        sales_executive: "dev@blxreality.com",
        manager: "manager@blxreality.com",
      };
      const filtered = crmUsers.filter((u) => u.role === proposedRole);
      if (filtered.length > 0) {
        setSelectedSwapEmail(filtered[0].email);
      } else {
        setSelectedSwapEmail(emailMap[proposedRole] || "");
      }
    }
  }, [proposedRole, crmUsers]);

  const getNavItems = () => {
    const items = [
      { to: "/", label: "Dashboard", icon: Gauge },
      { to: "/leads", label: "Customers", icon: Users },
      { to: "/calendar", label: "Calendar", icon: Calendar },
      { to: "/followups", label: "Follow-ups", icon: BellRing },
      { to: "/sitevisits", label: "Site Visits", icon: MapPin },
      { to: "/projects", label: "Projects", icon: Briefcase },
      { to: "/developers", label: "Developers", icon: Building2 },
      { to: "/inventory", label: "Inventory", icon: Boxes },
      { to: "/bookings", label: "Bookings", icon: KeyRound },
    ];

    // Analytics: all roles see analytics (Sales Exec gets personal-only view)
    items.push({ to: "/analytics", label: "Analytics", icon: TrendingUp });

    if (can(role).viewAuditLogs()) {
      items.push({ to: "/auditlogs", label: "Audit Logs", icon: History });
    }

    items.push({ to: "/settings", label: "Settings", icon: Settings });

    return items;
  };

  const navItems = getNavItems();

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/auth" });
  };

  const handleRoleChangeSelect = (val: string) => {
    const target = val as AppRole;
    if (target === role) return;
    setProposedRole(target);
    setVerifyPassword("");
    setShowVerify(true);
  };

  const handleVerifyPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proposedRole || !verifyPassword.trim()) return;
    setBusy(true);

    try {
      if (isSupabaseConfigured) {
        // Find email for target role
        const emailMap: Record<AppRole, string> = {
          super_admin: "nischith@blxreality.com",
          admin: "admin@blxreality.com",
          sales_executive: "dev@blxreality.com",
          manager: "manager@blxreality.com",
        };

        // Log in to target account to switch session
        const targetEmail = selectedSwapEmail || emailMap[proposedRole];

        const data = await serverSignIn({
          email: targetEmail,
          password: verifyPassword,
        });

        if (data.session) {
          localStorage.setItem("blx-realty-session", JSON.stringify(data.session));
        }
      } else {
        // Mock credentials validation
        const validPasswords: Record<AppRole, string[]> = {
          super_admin: ["Nischith@2026", "Madhu@2026"],
          admin: ["Admin@2026"],
          manager: ["Manager@2026"],
          sales_executive: ["Dev@2026", "Vishal@2026", "Manoj@2026", "Tejasvijois@2026"],
        };

        const allowed = validPasswords[proposedRole] || [];
        if (!allowed.includes(verifyPassword)) {
          throw new Error("Invalid password for target security perspective.");
        }
      }

      // Successful verification
      toast.success(`Access verification cleared! Swapping to ${proposedRole.replace("_", " ")}.`);
      changeRole(proposedRole);
      setShowVerify(false);
    } catch (err: any) {
      toast.error(err.message || "Verification failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col transform transition-transform ${isOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 md:static md:block`}
      >
        <div className="flex items-center gap-3 px-5 h-16 border-b border-sidebar-border">
          <div className="h-9 w-9 rounded-lg bg-white grid place-items-center overflow-hidden border">
            <img src={logo} alt="BLX Realty" className="h-7 w-7 object-contain" />
          </div>
          <div className="leading-tight">
            <div className="font-brand font-bold tracking-tight text-sidebar-foreground">
              BLX Realty
            </div>
            <div className="text-[10px] text-sidebar-foreground/60 uppercase tracking-[0.18em]">
              CRM Suite
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = location.pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm font-semibold"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-4.5 w-4.5" />
                  <span>{item.label}</span>
                </div>
                {item.to === "/followups" && overdueCount > 0 && (
                  <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center animate-in scale-in duration-200">
                    {overdueCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Active Session & Logout deck */}
        <div className="m-3 rounded-xl bg-sidebar-accent/50 p-4 text-xs text-sidebar-foreground/70 border border-sidebar-border/40 space-y-3.5 text-left">
          <div>
            <div className="font-semibold text-sidebar-foreground">Active Session</div>
            <p className="text-[10px] text-muted-foreground truncate">
              {user?.email || "harshith@blxrealty.com"}
            </p>
          </div>

          {/* Role Switcher Selector */}
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">
              Assign Role View
            </label>
            <select
              value={role || "super_admin"}
              onChange={(e) => handleRoleChangeSelect(e.target.value)}
              className="w-full h-8 px-2 rounded border bg-card text-xs text-foreground font-semibold focus:outline-none"
            >
              <option value="super_admin">👑 Super Admin</option>
              <option value="admin">💼 Admin</option>
              <option value="manager">🛡️ Manager</option>
              <option value="sales_executive">📞 Sales Executive</option>
            </select>
          </div>

          {/* Sign Out Action Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="w-full text-xs font-semibold h-8 rounded-lg gap-1.5 flex items-center justify-center bg-red-500/10 text-rose-500 hover:bg-rose-500 hover:text-white border border-rose-500/20"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign Out
          </Button>
        </div>
      </aside>

      {/* Role Verification Dialog Modal */}
      <Dialog open={showVerify} onOpenChange={setShowVerify}>
        <DialogContent className="max-w-md bg-card text-left rounded-xl border border-border shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold font-display text-foreground flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" /> Verify Role Perspective Swap
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              You are switching your security level to{" "}
              <span className="font-bold text-foreground capitalize">
                {proposedRole?.replace("_", " ")}
              </span>
              . Enter the perspective password to continue:
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleVerifyPasswordSubmit} className="space-y-4 mt-3">
            {filteredUsers.length > 0 && (
              <div className="space-y-1.5 text-left">
                <Label htmlFor="swap-email">Select Account</Label>
                <select
                  id="swap-email"
                  value={selectedSwapEmail}
                  onChange={(e) => setSelectedSwapEmail(e.target.value)}
                  className="w-full h-9 px-2 rounded border bg-card text-xs text-foreground font-semibold focus:outline-none"
                >
                  {filteredUsers.map((u) => (
                    <option key={u.id} value={u.email}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="ver-pass">Verification Password</Label>
              <div className="relative">
                <Input
                  id="ver-pass"
                  type={showVerifyPassword ? "text" : "password"}
                  placeholder="Enter password"
                  value={verifyPassword}
                  onChange={(e) => setVerifyPassword(e.target.value)}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowVerifyPassword(!showVerifyPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                >
                  {showVerifyPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowVerify(false)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={busy}>
                {busy ? "Verifying..." : "Verify Access"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
