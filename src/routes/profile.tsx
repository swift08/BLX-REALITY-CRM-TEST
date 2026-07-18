import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { updateUserProfile } from "@/lib/queries";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Mail, Phone, Shield, Building2, Calendar, CheckCircle } from "lucide-react";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "My Profile · BLX Realty CRM" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, role } = useAuth();
  const [name, setName] = useState(user?.user_metadata?.full_name || user?.email?.split("@")[0] || "");
  const [phone, setPhone] = useState(user?.user_metadata?.phone || "");
  const [busy, setBusy] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name is required.");
      return;
    }
    setBusy(true);
    try {
      await updateUserProfile(name, phone);
      
      // Update session storage so that changes are immediately reflected in the UI
      const sessionStr = localStorage.getItem("blx-realty-session");
      if (sessionStr) {
        const parsed = JSON.parse(sessionStr);
        if (parsed.user) {
          parsed.user.user_metadata = {
            ...parsed.user.user_metadata,
            full_name: name,
            phone: phone,
          };
          localStorage.setItem("blx-realty-session", JSON.stringify(parsed));
        }
      }
      
      toast.success("Profile updated successfully!");
      // Reload page to propagate changes
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile.");
    } finally {
      setBusy(false);
    }
  };

  const getRoleBadgeColor = (r: string | null) => {
    switch (r) {
      case "super_admin":
        return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case "admin":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "manager":
        return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      default:
        return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
    }
  };

  const formatRole = (r: string | null) => {
    if (!r) return "User";
    return r.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  };

  return (
    <AppShell title="My Profile" subtitle="Manage your personal CRM profile and security settings">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card Left: Photo & Quick info */}
          <Card className="md:col-span-1 border border-border bg-card shadow-lg flex flex-col justify-between">
            <CardHeader className="text-center pb-2">
              <div className="flex justify-center mb-4">
                <Avatar className="h-24 w-24 ring-4 ring-primary/10">
                  <AvatarImage src={user?.user_metadata?.avatar_url || ""} />
                  <AvatarFallback className="bg-primary/5 text-primary text-2xl font-bold uppercase">
                    {(user?.user_metadata?.full_name || user?.email || "U").substring(0, 2)}
                  </AvatarFallback>
                </Avatar>
              </div>
              <CardTitle className="text-lg font-bold text-foreground">
                {user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User"}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground truncate">
                {user?.email || "harshith@blxrealty.com"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4 text-sm text-left">
              <div className="flex items-center gap-2.5 py-1">
                <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1">
                  <div className="text-[10px] text-muted-foreground uppercase font-semibold">Role</div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border mt-0.5 ${getRoleBadgeColor(role)}`}>
                    {formatRole(role)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2.5 py-1">
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1">
                  <div className="text-[10px] text-muted-foreground uppercase font-semibold">Department</div>
                  <span className="text-xs font-semibold text-foreground">
                    {role === "sales_executive" ? "Sales & Acquisitions" : role === "manager" ? "Sales Management" : "Operations"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2.5 py-1">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1">
                  <div className="text-[10px] text-muted-foreground uppercase font-semibold">Joined At</div>
                  <span className="text-xs font-semibold text-foreground">
                    {user?.created_at ? new Date(user.created_at).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" }) : "July 18, 2026"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2.5 py-1">
                <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                <div className="flex-1">
                  <div className="text-[10px] text-muted-foreground uppercase font-semibold">Account Status</div>
                  <span className="text-xs font-bold text-emerald-500">Active</span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/30 border-t py-3 text-center text-[10px] text-muted-foreground justify-center">
              Account ID: {user?.id?.slice(0, 8).toUpperCase() || "MOCK-USER"}
            </CardFooter>
          </Card>

          {/* Card Right: Editable Profile Details */}
          <Card className="md:col-span-2 border border-border bg-card shadow-lg">
            <CardHeader className="text-left border-b border-border/40">
              <CardTitle className="text-base font-bold text-foreground">Edit Profile Information</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Update your personal info, like display name and direct phone number.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSave}>
              <CardContent className="space-y-4 pt-6 text-left">
                <div className="space-y-1.5">
                  <Label htmlFor="profile-name" className="flex items-center gap-1">
                    <User className="h-3.5 w-3.5 text-muted-foreground" /> Full Name
                  </Label>
                  <Input
                    id="profile-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter full name"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="profile-email" className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" /> Email Address (Read-only)
                  </Label>
                  <Input
                    id="profile-email"
                    value={user?.email || ""}
                    disabled
                    className="bg-muted/50 cursor-not-allowed"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="profile-phone" className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" /> Phone Number
                  </Label>
                  <Input
                    id="profile-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Enter phone number"
                  />
                </div>
              </CardContent>
              <CardFooter className="border-t border-border/40 justify-end pt-4 gap-2">
                <Button type="submit" disabled={busy}>
                  {busy ? "Saving Changes..." : "Save Profile"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
