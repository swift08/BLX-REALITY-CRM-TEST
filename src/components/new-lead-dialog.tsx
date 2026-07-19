import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, AlertTriangle, User, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { addMockLead, mergeLeads, useProjects, useSettings, useCRMUsers } from "@/lib/queries";
import { useAuth } from "@/hooks/use-auth";

export function NewLeadDialog({ trigger }: { trigger?: React.ReactNode }) {
  const qc = useQueryClient();
  const { data: projects = [] } = useProjects();
  const { data: settings } = useSettings();
  const { data: crmUsers = [] } = useCRMUsers();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { role, user } = useAuth();
  const [dupInfo, setDupInfo] = useState<{ id: string; name: string; owner: string } | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    source: "Website",
    budget: "",
    projectId: "none",
    temperature: "warm" as "hot" | "warm" | "cold",
    owner: "Unassigned",
  });
  const [budgetNum, setBudgetNum] = useState("");
  const [budgetUnit, setBudgetUnit] = useState("Lakhs");

  useEffect(() => {
    if (role === "sales_executive" && user) {
      const userFullName =
        user.user_metadata?.full_name || user.email?.split("@")[0] || "Unassigned";
      setForm((prev) => ({ ...prev, owner: userFullName }));
    }
  }, [role, user]);

  const sourcesList = settings?.lead_sources || [
    "Website Forms",
    "Landing Pages",
    "Facebook Leads",
    "Instagram Leads",
    "Meta Lead Ads",
    "WhatsApp Leads",
    "Manual Entry",
    "Walk-in Customers",
    "Referral Leads",
    "Direct Phone Calls",
  ];

  const resetForm = () => {
    const userFullName =
      user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Unassigned";
    setForm({
      name: "",
      phone: "",
      email: "",
      source: "Website",
      budget: "",
      projectId: "none",
      temperature: "warm",
      owner: role === "sales_executive" ? userFullName : "Unassigned",
    });
    setBudgetNum("");
    setBudgetUnit("Lakhs");
    setDupInfo(null);
  };

  async function handleMerge() {
    if (!dupInfo) return;
    setBusy(true);
    try {
      const duplicateLead = await addMockLead(
        {
          name: form.name,
          phone: form.phone,
          email: form.email || null,
          source: form.source,
          budget: budgetNum ? `₹${budgetNum} ${budgetUnit}` : null,
          temperature: form.temperature,
          stage: "new",
          project_id: form.projectId,
          owner: form.owner,
        },
        true,
      );

      await mergeLeads(dupInfo.id, duplicateLead.id);
      toast.success(
        `Leads merged successfully! All timeline & activity logged under #${dupInfo.id}.`,
      );
      qc.invalidateQueries({ queryKey: ["leads"] });
      setOpen(false);
      resetForm();
    } catch (err: any) {
      toast.error(err.message || "Failed to merge leads");
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent, forceDuplicate = false) {
    if (e) e.preventDefault();
    setBusy(true);
    try {
      await addMockLead(
        {
          name: form.name,
          phone: form.phone,
          email: form.email || null,
          source: form.source,
          budget: budgetNum ? `₹${budgetNum} ${budgetUnit}` : null,
          temperature: form.temperature,
          stage: "new",
          project_id: form.projectId,
          owner: form.owner,
        },
        forceDuplicate,
      );

      toast.success("Lead added successfully!");
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setOpen(false);
      resetForm();
    } catch (err: any) {
      if (err.message.startsWith("DUPLICATE_DETECTED:")) {
        const [, id, name, owner] = err.message.split(":");
        setDupInfo({ id, name, owner });
      } else {
        toast.error(err?.message || "Failed to add lead");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" /> Add Lead
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="font-display font-bold">
            {dupInfo ? "Duplicate Lead Alert" : "Create New CRM Lead"}
          </DialogTitle>
        </DialogHeader>

        {dupInfo ? (
          <div className="space-y-6 py-4">
            <div className="p-4 border border-orange-500/20 bg-orange-500/[0.02] rounded-xl flex gap-3 text-xs">
              <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-foreground">Active Lead Already Exists</span>
                <p className="text-muted-foreground leading-relaxed mt-1">
                  A lead with this phone number is already active in the CRM database.
                </p>
                <div className="pt-2 grid grid-cols-2 gap-y-1 max-w-sm">
                  <span className="font-semibold text-muted-foreground">Customer Name:</span>
                  <span className="font-bold text-foreground">{dupInfo.name}</span>
                  <span className="font-semibold text-muted-foreground">Assigned Owner:</span>
                  <span className="font-bold text-foreground">
                    {dupInfo.owner === "Arjun" ? "Arjun K (Sales)" : dupInfo.owner}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button
                onClick={() => {
                  window.location.hash = `/leads?id=${dupInfo.id}`;
                  setOpen(false);
                  resetForm();
                }}
                className="w-full justify-start gap-2 h-10 text-xs font-semibold text-foreground hover:bg-muted"
                variant="outline"
              >
                <User className="h-4 w-4 text-muted-foreground" /> View Existing Lead File
              </Button>

              {(role === "super_admin" || role === "admin") && (
                <Button
                  onClick={handleMerge}
                  disabled={busy}
                  className="w-full justify-start gap-2 h-10 text-xs font-semibold text-foreground hover:bg-muted"
                  variant="outline"
                >
                  <ArrowRightLeft className="h-4 w-4 text-muted-foreground" /> Merge New Data into
                  Existing Lead
                </Button>
              )}

              <Button
                onClick={() => submit(null as any, true)}
                disabled={busy}
                className="w-full justify-start gap-2 h-10 text-xs font-semibold bg-primary hover:bg-primary/95 text-primary-foreground"
              >
                <Plus className="h-4 w-4" /> Create Duplicate Lead Anyway
              </Button>

              <Button
                variant="ghost"
                onClick={() => setDupInfo(null)}
                className="w-full text-xs h-9 text-muted-foreground hover:text-foreground"
              >
                Go Back
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={(e) => submit(e, false)} className="space-y-4 py-2 text-left">
            <div className="space-y-1.5">
              <Label htmlFor="lname">Customer Name *</Label>
              <Input
                id="lname"
                required
                placeholder="e.g. Harshith Malipatil"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="lphone">Phone Number *</Label>
                <Input
                  id="lphone"
                  required
                  placeholder="10 digit mobile"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lemail">Email Address</Label>
                <Input
                  id="lemail"
                  type="email"
                  placeholder="name@domain.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Lead Source</Label>
                <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sourcesList.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Lead Temperature</Label>
                <Select
                  value={form.temperature}
                  onValueChange={(v) => setForm({ ...form, temperature: v as any })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hot">🔥 Hot</SelectItem>
                    <SelectItem value="warm">⚡ Warm</SelectItem>
                    <SelectItem value="cold">❄️ Cold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Interested Project</Label>
                <Select
                  value={form.projectId}
                  onValueChange={(v) => setForm({ ...form, projectId: v })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None / Unassigned</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Assigned Sales Owner</Label>
                <Select
                  value={form.owner}
                  onValueChange={(v) => setForm({ ...form, owner: v })}
                  disabled={role === "sales_executive"}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Unassigned">Unassigned</SelectItem>
                    {crmUsers.map((u) => (
                      <SelectItem key={u.id} value={u.name}>
                        {u.name} (
                        {u.role === "sales_executive"
                          ? "Sales"
                          : u.role === "super_admin"
                            ? "Super Admin"
                            : u.role === "manager"
                              ? "Manager"
                              : "Admin"}
                        )
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lbudget">Budget Description</Label>
              <div className="flex gap-2">
                <Input
                  id="lbudget"
                  type="number"
                  step="any"
                  placeholder="e.g. 2.5 or 80"
                  value={budgetNum}
                  onChange={(e) => setBudgetNum(e.target.value)}
                  className="flex-1"
                />
                <Select value={budgetUnit} onValueChange={setBudgetUnit}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Lakhs">Lakhs</SelectItem>
                    <SelectItem value="Cr">Crores (Cr)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button type="submit" disabled={busy} className="w-full sm:w-auto">
                {busy ? "Saving Lead..." : "Save Lead"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
