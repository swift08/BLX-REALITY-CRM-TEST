import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAuth, type AppRole } from "@/hooks/use-auth";
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
  Bell,
  ShieldAlert,
  Sparkles,
  UserCheck,
  AlertCircle,
  AlertTriangle,
  Info,
  ShieldCheck,
  X,
  Sun,
  Moon,
  Eye,
  EyeOff,
} from "lucide-react";
import { NewLeadDialog } from "./new-lead-dialog";
import {
  useNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  useCustomers,
  useProjects,
  useDevelopers,
  useBookings,
  useInventory,
  useCRMUsers,
} from "@/lib/queries";
import { Search as SearchIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isSupabaseConfigured } from "@/lib/supabase";
import { serverSignIn } from "@/lib/queries";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export function AppTopbar({
  title,
  subtitle,
  onMenuToggle,
}: {
  title: string;
  subtitle?: string;
  onMenuToggle?: () => void;
}) {
  const { role, changeRole, user } = useAuth();
  const qc = useQueryClient();
  const { data: notifications = [] } = useNotifications();
  const [showNotifs, setShowNotifs] = useState(false);

  // Theme states
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("blx_theme");
      if (saved) return saved as "light" | "dark";
      // Match system preferences by default
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
    }
    return "light";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const root = window.document.documentElement;
      if (theme === "dark") {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
      localStorage.setItem("blx_theme", theme);
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  // Global Search states
  const { data: customers = [] } = useCustomers();
  const { data: projects = [] } = useProjects();
  const { data: developers = [] } = useDevelopers();
  const { data: bookings = [] } = useBookings();
  const { data: inventory = [] } = useInventory();

  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Search logic
  const q = searchQuery.toLowerCase().trim();
  const matchedCustomers = customers
    .filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.email && c.email.toLowerCase().includes(q)),
    )
    .slice(0, 5);

  const matchedProjects = projects
    .filter(
      (p) =>
        p.name.toLowerCase().includes(q) || (p.location && p.location.toLowerCase().includes(q)),
    )
    .slice(0, 3);

  const matchedDevelopers = developers.filter((d) => d.name.toLowerCase().includes(q)).slice(0, 3);

  const matchedBookings = bookings
    .filter(
      (b) =>
        b.customer_name.toLowerCase().includes(q) ||
        b.project_name.toLowerCase().includes(q) ||
        b.unit_number.toLowerCase().includes(q) ||
        b.lead_id.toLowerCase().includes(q),
    )
    .slice(0, 3);

  const matchedInventory = inventory
    .filter(
      (u) =>
        u.unit_number.toLowerCase().includes(q) ||
        (u.configuration && u.configuration.toLowerCase().includes(q)),
    )
    .slice(0, 5);

  const hasAnyMatch =
    matchedCustomers.length > 0 ||
    matchedProjects.length > 0 ||
    matchedDevelopers.length > 0 ||
    matchedBookings.length > 0 ||
    matchedInventory.length > 0;

  // Switch modal states
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

  const unreadCount = notifications.filter((n) => !n.read).length;

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
        // Authenticate with Supabase logic
        const emailMap: Record<AppRole, string> = {
          super_admin: "nischith@blxreality.com",
          admin: "admin@blxreality.com",
          sales_executive: "dev@blxreality.com",
          manager: "manager@blxreality.com",
        };
        const targetEmail = selectedSwapEmail || emailMap[proposedRole];

        const data = await serverSignIn({
          email: targetEmail,
          password: verifyPassword,
        });

        if (data.session) {
          localStorage.setItem("blx-realty-session", JSON.stringify(data.session));
        }
      } else {
        // Validate mock credentials
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

      toast.success(`Access verification cleared! Swapping to ${proposedRole.replace("_", " ")}.`);
      changeRole(proposedRole);
      setShowVerify(false);
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
    } catch (err: any) {
      toast.error(err.message || "Verification failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      qc.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("All notifications marked as read.");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      qc.invalidateQueries({ queryKey: ["notifications"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteNotif = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteNotification(id);
      qc.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Notification deleted.");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const getPriorityStyles = (p: string) => {
    switch (p) {
      case "critical":
        return {
          text: "text-red-500",
          bg: "bg-red-50 border-red-200 text-red-700",
          icon: <AlertCircle className="h-4 w-4 text-red-500" />,
        };
      case "high":
        return {
          text: "text-orange-500",
          bg: "bg-orange-50 border-orange-200 text-orange-700",
          icon: <AlertTriangle className="h-4 w-4 text-orange-500" />,
        };
      case "medium":
        return {
          text: "text-blue-500",
          bg: "bg-blue-50 border-blue-200 text-blue-700",
          icon: <Info className="h-4 w-4 text-blue-500" />,
        };
      default:
        return {
          text: "text-gray-500",
          bg: "bg-gray-50 border-gray-200 text-gray-700",
          icon: <Info className="h-4 w-4 text-gray-500" />,
        };
    }
  };

  const getRoleBadge = (currentRole: AppRole | null) => {
    switch (currentRole) {
      case "super_admin":
        return "bg-amber-500/10 text-amber-500 border-amber-500/30";
      case "admin":
        return "bg-blue-500/10 text-blue-500 border-blue-500/30";
      case "sales_executive":
        return "bg-emerald-500/10 text-emerald-500 border-emerald-500/30";
      case "manager":
        return "bg-purple-500/10 text-purple-500 border-purple-500/30";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const formatRoleName = (currentRole: AppRole | null) => {
    switch (currentRole) {
      case "super_admin":
        return "Super Admin";
      case "admin":
        return "Admin Operations";
      case "sales_executive":
        return "Sales Executive";
      case "manager":
        return "Manager";
      default:
        return "Loading...";
    }
  };

  return (
    <>
      <header className="h-16 border-b bg-card flex items-center gap-4 px-6 sticky top-0 z-10">
        {/* Mobile hamburger */}
        <button
          className="md:hidden mr-2 p-1 rounded-md hover:bg-muted"
          onClick={onMenuToggle}
          aria-label="Toggle menu"
        >
          <span className="sr-only">Menu</span>
          <div className="flex flex-col gap-1 w-5">
            <span className="h-0.5 w-full bg-foreground rounded" />
            <span className="h-0.5 w-full bg-foreground rounded" />
            <span className="h-0.5 w-full bg-foreground rounded" />
          </div>
        </button>

        <div className="flex-1 min-w-0 text-left">
          <h1 className="text-lg font-semibold text-foreground truncate">{title}</h1>
          {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
        </div>

        {/* Unified Global Search Bar */}
        <div className="relative max-w-md w-full mx-4 hidden lg:block">
          <div className="flex items-center gap-2 h-9 px-3 rounded-lg bg-muted border border-border/40 focus-within:border-primary/60 transition-all">
            <SearchIcon className="h-4 w-4 text-muted-foreground" />
            <input
              id="global-search-input"
              name="global-search"
              aria-label="Global Search"
              type="text"
              placeholder="Search customers, projects, developers, bookings..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearchResults(true);
              }}
              onFocus={() => setShowSearchResults(true)}
              className="bg-transparent outline-none text-xs w-full text-foreground placeholder:text-muted-foreground/60"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {showSearchResults && searchQuery.trim().length > 1 && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowSearchResults(false)} />
              <div className="absolute left-0 right-0 mt-2 rounded-xl border border-border bg-card shadow-2xl z-50 max-h-[380px] overflow-y-auto p-3 text-left space-y-3 divide-y divide-border/40">
                {!hasAnyMatch ? (
                  <div className="text-center py-6 text-xs text-muted-foreground font-medium">
                    No results found for "{searchQuery}"
                  </div>
                ) : (
                  <>
                    {/* Customers results */}
                    {matchedCustomers.length > 0 && (
                      <div className="pt-2 first:pt-0">
                        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                          Customers
                        </h4>
                        <div className="space-y-1">
                          {matchedCustomers.map((c) => (
                            <button
                              key={c.id}
                              onClick={() => {
                                setShowSearchResults(false);
                                setSearchQuery("");
                                window.location.hash = `/leads?id=${c.id}`;
                              }}
                              className="w-full text-left p-1.5 hover:bg-muted/50 rounded-lg flex flex-col transition-all"
                            >
                              <span className="text-xs font-bold text-foreground">{c.name}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {c.phone} {c.email && `| ${c.email}`}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Projects results */}
                    {matchedProjects.length > 0 && (
                      <div className="pt-2">
                        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                          Projects
                        </h4>
                        <div className="space-y-1">
                          {matchedProjects.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => {
                                setShowSearchResults(false);
                                setSearchQuery("");
                                window.location.hash = `/projects`;
                              }}
                              className="w-full text-left p-1.5 hover:bg-muted/50 rounded-lg flex flex-col transition-all"
                            >
                              <span className="text-xs font-bold text-foreground">{p.name}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {p.location}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Developers results */}
                    {matchedDevelopers.length > 0 && (
                      <div className="pt-2">
                        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                          Developers
                        </h4>
                        <div className="space-y-1">
                          {matchedDevelopers.map((d) => (
                            <button
                              key={d.id}
                              onClick={() => {
                                setShowSearchResults(false);
                                setSearchQuery("");
                                window.location.hash = `/developers`;
                              }}
                              className="w-full text-left p-1.5 hover:bg-muted/50 rounded-lg flex flex-col transition-all"
                            >
                              <span className="text-xs font-bold text-foreground">{d.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Bookings results */}
                    {matchedBookings.length > 0 && (
                      <div className="pt-2">
                        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                          Bookings
                        </h4>
                        <div className="space-y-1">
                          {matchedBookings.map((b) => (
                            <button
                              key={b.id}
                              onClick={() => {
                                setShowSearchResults(false);
                                setSearchQuery("");
                                window.location.hash = `/bookings`;
                              }}
                              className="w-full text-left p-1.5 hover:bg-muted/50 rounded-lg flex flex-col transition-all"
                            >
                              <span className="text-xs font-bold text-foreground">
                                BK-{b.lead_id.slice(0, 8).toUpperCase()}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {b.customer_name} | {b.project_name} (Unit {b.unit_number})
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Inventory results */}
                    {matchedInventory.length > 0 && (
                      <div className="pt-2">
                        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                          Inventory Units
                        </h4>
                        <div className="space-y-1">
                          {matchedInventory.map((u) => (
                            <button
                              key={u.id}
                              onClick={() => {
                                setShowSearchResults(false);
                                setSearchQuery("");
                                window.location.hash = `/inventory`;
                              }}
                              className="w-full text-left p-1.5 hover:bg-muted/50 rounded-lg flex flex-col transition-all"
                            >
                              <span className="text-xs font-bold text-foreground">
                                Unit {u.unit_number}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {u.configuration} | Status:{" "}
                                <span className="capitalize">{u.status}</span>
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Role Switcher */}
        <div className="flex items-center gap-3">
          <div
            className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-semibold uppercase tracking-wider shadow-sm mr-2 transition-all duration-200 ${getRoleBadge(role)}`}
          >
            {role === "super_admin" && <Sparkles className="h-3 w-3" />}
            {role === "admin" && <ShieldAlert className="h-3 w-3" />}
            {role === "manager" && <UserCheck className="h-3 w-3" />}
            {role === "sales_executive" && <UserCheck className="h-3 w-3" />}
            {formatRoleName(role)}
          </div>

          <div className="w-48">
            <Select value={role || "super_admin"} onValueChange={handleRoleChangeSelect}>
              <SelectTrigger className="h-9 text-xs font-medium focus:ring-1 focus:ring-primary">
                <SelectValue placeholder="Switch Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="super_admin">Super Admin View</SelectItem>
                <SelectItem value="admin">Admin Operations View</SelectItem>
                <SelectItem value="manager">Manager View</SelectItem>
                <SelectItem value="sales_executive">Sales Executive View</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Bell notifications */}
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowNotifs(!showNotifs)}
            className={`relative h-9 w-9 text-muted-foreground hover:text-foreground ${showNotifs ? "bg-muted" : ""}`}
          >
            <Bell className="h-4.5 w-4.5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[8px] font-bold flex items-center justify-center animate-in scale-in duration-200">
                {unreadCount}
              </span>
            )}
          </Button>

          {/* Theme Toggle option */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-9 w-9 text-muted-foreground hover:text-foreground shrink-0"
            aria-label="Toggle Theme"
          >
            {theme === "light" ? (
              <Moon className="h-4.5 w-4.5" />
            ) : (
              <Sun className="h-4.5 w-4.5 text-amber-400" />
            )}
          </Button>

          {showNotifs && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowNotifs(false)} />
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-border bg-card shadow-lg z-50 overflow-hidden flex flex-col max-h-[480px] animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="px-4 py-3 border-b flex items-center justify-between bg-muted/30">
                  <span className="text-xs font-bold text-foreground">In-App Notifications</span>
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleMarkAllRead}
                      className="h-7 text-[10px] text-primary hover:text-primary hover:bg-primary/5 px-2 font-semibold"
                    >
                      Mark all read
                    </Button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-border/60">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-xs text-muted-foreground font-medium">
                      No notifications logged.
                    </div>
                  ) : (
                    notifications.map((n) => {
                      const styles = getPriorityStyles(n.priority);
                      return (
                        <div
                          key={n.id}
                          onClick={() => {
                            handleMarkRead(n.id);
                            if (n.lead_id) {
                              window.location.hash = `/leads?id=${n.lead_id}`;
                            }
                          }}
                          className={`p-3 text-xs flex gap-3 cursor-pointer hover:bg-muted/30 transition-all duration-150 ${!n.read ? "bg-primary/5" : ""}`}
                        >
                          <div
                            className={`h-8 w-8 rounded-full border flex items-center justify-center shrink-0 ${styles.bg}`}
                          >
                            {styles.icon}
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <div className="font-semibold text-foreground truncate">{n.title}</div>
                            <p className="text-[10px] text-muted-foreground mt-0.5 leading-normal">
                              {n.message}
                            </p>
                            <span className="text-[9px] text-muted-foreground mt-1 block">
                              {new Date(n.created_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handleDeleteNotif(n.id, e)}
                            className="h-6 w-6 text-muted-foreground hover:text-destructive self-center"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Role Verification Dialog Modal */}
      <Dialog open={showVerify} onOpenChange={setShowVerify}>
        <DialogContent className="max-w-md bg-card text-left rounded-xl border border-border shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold font-display text-foreground flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-amber-500" /> Verify Role Perspective Swap
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
                <Label htmlFor="top-swap-email">Select Account</Label>
                <Select value={selectedSwapEmail} onValueChange={setSelectedSwapEmail}>
                  <SelectTrigger id="top-swap-email" className="w-full">
                    <SelectValue placeholder="Select user account" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredUsers.map((u) => (
                      <SelectItem key={u.id} value={u.email}>
                        {u.name} ({u.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="top-ver-pass">Verification Password</Label>
              <div className="relative">
                <Input
                  id="top-ver-pass"
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
