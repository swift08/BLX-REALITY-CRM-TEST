import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useInventory, useProjects, addUnit, updateUnit, useCustomers } from "@/lib/queries";
import { useAuth } from "@/hooks/use-auth";
import { can } from "@/lib/permissions";
import { toast } from "sonner";
import {
  Grid3X3,
  Plus,
  ShieldAlert,
  Sparkles,
  Building2,
  User,
  Ruler,
  CircleDollarSign,
  Check,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/inventory")({
  head: () => ({ meta: [{ title: "Inventory · BLX Realty CRM" }] }),
  component: InventoryPage,
});

function InventoryPage() {
  const qc = useQueryClient();
  const { role } = useAuth();
  const { data: projects = [] } = useProjects();
  const { data: customers = [] } = useCustomers();
  const [selectedProj, setSelectedProj] = useState<string>("all");
  const { data: inventory = [], isLoading } = useInventory(
    selectedProj === "all" ? undefined : selectedProj,
  );

  // Add unit dialog state
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    project_id: "",
    unit_number: "",
    configuration: "3 BHK",
    area: 1500,
    price: 25000000,
  });

  // Edit / Details dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<any>(null);
  const [unitForm, setUnitForm] = useState({
    unit_number: "",
    configuration: "",
    area: 0,
    price: 0,
    status: "available",
    reserved_by: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.project_id) {
      toast.error("Please select a project.");
      return;
    }
    setBusy(true);
    try {
      await addUnit({
        ...form,
        area: Number(form.area),
        price: Number(form.price),
        status: "available",
      });
      toast.success("Unit added successfully!");
      qc.invalidateQueries({ queryKey: ["inventory"] });
      setOpen(false);
      setForm({
        project_id: "",
        unit_number: "",
        configuration: "3 BHK",
        area: 1500,
        price: 25000000,
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to add unit");
    } finally {
      setBusy(false);
    }
  };

  const handleUnitClick = (u: any) => {
    setSelectedUnit(u);
    setUnitForm({
      unit_number: u.unit_number,
      configuration: u.configuration || "3 BHK",
      area: u.area || 1500,
      price: u.price || 20000000,
      status: u.status || "available",
      reserved_by: u.reserved_by || "",
    });
    setEditOpen(true);
  };

  const handleUpdateUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnit) return;
    setBusy(true);
    try {
      await updateUnit(selectedUnit.id, {
        ...unitForm,
        status: unitForm.status as any,
        area: Number(unitForm.area),
        price: Number(unitForm.price),
        reserved_by: unitForm.status !== "available" ? unitForm.reserved_by || null : null,
      });
      toast.success("Unit configuration and status updated!");
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      setEditOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update unit");
    } finally {
      setBusy(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/10";
      case "pending_reserve":
        return "bg-amber-400 hover:bg-amber-500 text-white shadow-amber-400/10 animate-pulse";
      case "reserved":
        return "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/10";
      case "sold":
        return "bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/10";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  // canEdit = manager or above can change unit status/reservation
  // canEditDetails = admin/super_admin can change price, config, unit number
  const canEdit = can(role).reserveUnit();
  const canEditDetails = can(role).editUnit();
  const canAddUnit = can(role).createUnit();

  return (
    <AppShell
      title="Unit Inventory Management"
      subtitle="Real-time status tracking of configuration units across projects"
    >
      <div className="flex flex-row items-center justify-between pb-2 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Select value={selectedProj} onValueChange={setSelectedProj}>
            <SelectTrigger className="w-56 h-9 text-xs">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {canAddUnit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" /> Add Unit
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[420px]">
              <DialogHeader>
                <DialogTitle className="font-display font-bold">Add Configuration Unit</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label>Associated Project *</Label>
                  <Select
                    value={form.project_id}
                    onValueChange={(v) => setForm({ ...form, project_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="unumber">Unit / Door Number *</Label>
                  <Input
                    id="unumber"
                    required
                    placeholder="e.g. Tower B - 402"
                    value={form.unit_number}
                    onChange={(e) => setForm({ ...form, unit_number: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Configuration *</Label>
                  <Select
                    value={form.configuration}
                    onValueChange={(v) => setForm({ ...form, configuration: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1 BHK">1 BHK</SelectItem>
                      <SelectItem value="2 BHK">2 BHK</SelectItem>
                      <SelectItem value="3 BHK">3 BHK</SelectItem>
                      <SelectItem value="4 BHK">4 BHK</SelectItem>
                      <SelectItem value="Duplex">Duplex Villa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="uarea">Super Area (Sq Ft)</Label>
                    <Input
                      id="uarea"
                      type="number"
                      value={form.area}
                      onChange={(e) => setForm({ ...form, area: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="uprice">Price (INR)</Label>
                    <Input
                      id="uprice"
                      type="number"
                      value={form.price}
                      onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <DialogFooter className="pt-2">
                  <Button type="submit" disabled={busy}>
                    {busy ? "Adding Unit..." : "Save Unit"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card className="border-border/60">
        <CardHeader className="border-b py-4 px-5">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Grid3X3 className="h-4.5 w-4.5 text-muted-foreground" />
              Units Grid Layout (Interactive Detail View)
            </CardTitle>

            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-emerald-500" /> Available
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-amber-400 animate-pulse" /> Pending Reservation
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-amber-600" /> Reserved
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-rose-500" /> Sold / Booked
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {isLoading ? (
            <p className="text-xs text-muted-foreground text-center py-6">Loading inventory...</p>
          ) : inventory.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-12">
              No units mapped under the selected project.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {inventory.map((u) => (
                <div
                  key={u.id}
                  onClick={() => handleUnitClick(u)}
                  className={`p-4 rounded-xl border text-xs font-semibold text-center flex flex-col justify-between h-28 shadow-sm transition-all duration-200 cursor-pointer hover:-translate-y-0.5 hover:shadow ${getStatusColor(u.status)}`}
                >
                  <div className="text-[10px] uppercase font-bold tracking-wider opacity-85">
                    Unit Number
                  </div>
                  <div className="text-sm font-extrabold tracking-tight mt-1">{u.unit_number}</div>
                  <div className="mt-2 text-[10px] font-medium opacity-90 border-t border-white/20 pt-1.5">
                    {u.configuration} · {(u.price / 10000000).toFixed(2)} Cr
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Interactive Unit Editor & Details Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[420px] bg-card text-left p-6 border border-border shadow-2xl rounded-xl">
          <DialogHeader>
            <DialogTitle className="font-display font-bold text-base flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" /> Unit details:{" "}
              {selectedUnit?.unit_number}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleUpdateUnit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="e_unumber">Unit/Door Number</Label>
              <Input
                id="e_unumber"
                required
                disabled={!canEditDetails}
                value={unitForm.unit_number}
                onChange={(e) => setUnitForm({ ...unitForm, unit_number: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Configuration</Label>
              <Select
                disabled={!canEditDetails}
                value={unitForm.configuration}
                onValueChange={(v) => setUnitForm({ ...unitForm, configuration: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1 BHK">1 BHK</SelectItem>
                  <SelectItem value="2 BHK">2 BHK</SelectItem>
                  <SelectItem value="3 BHK">3 BHK</SelectItem>
                  <SelectItem value="4 BHK">4 BHK</SelectItem>
                  <SelectItem value="Duplex">Duplex Villa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="e_uarea">Super Area (Sq Ft)</Label>
                <Input
                  id="e_uarea"
                  type="number"
                  disabled={!canEditDetails}
                  value={unitForm.area}
                  onChange={(e) => setUnitForm({ ...unitForm, area: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e_uprice">Base Pricing (INR)</Label>
                <Input
                  id="e_uprice"
                  type="number"
                  disabled={!canEditDetails}
                  value={unitForm.price}
                  onChange={(e) => setUnitForm({ ...unitForm, price: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Unit Allocation Status</Label>
              <Select
                disabled={
                  !can(role).approveReservation() &&
                  (!can(role).requestReservation() || selectedUnit?.status !== "available")
                }
                value={unitForm.status}
                onValueChange={(v: any) => setUnitForm({ ...unitForm, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">🟢 Available</SelectItem>
                  <SelectItem value="pending_reserve">🟡 Request Reservation (Pending)</SelectItem>
                  {can(role).approveReservation() && (
                    <SelectItem value="reserved">🟠 Reserved (Manager Confirmed)</SelectItem>
                  )}
                  {can(role).markUnitSold() && (
                    <SelectItem value="sold">🔴 Sold / Booked</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {unitForm.status !== "available" && (
              <div className="space-y-1.5 bg-muted/30 p-3 rounded-lg border border-dashed animate-in fade-in slide-in-from-top-1">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1">
                  <User className="h-3.5 w-3.5 text-primary" /> Customer Reference
                </Label>
                <Select
                  disabled={!canEdit}
                  value={unitForm.reserved_by}
                  onValueChange={(v) => setUnitForm({ ...unitForm, reserved_by: v })}
                >
                  <SelectTrigger className="h-9 mt-1">
                    <SelectValue placeholder="Link Customer Profile" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} ({c.phone})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {can(role).approveReservation() ||
            (can(role).requestReservation() && selectedUnit?.status === "available") ? (
              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={busy} className="gap-1.5">
                  <Check className="h-4 w-4" /> Save Changes
                </Button>
              </DialogFooter>
            ) : (
              <div className="text-[10px] text-muted-foreground bg-muted/40 p-2.5 rounded border text-center font-semibold">
                Read-only: Sales Executives can view unit details but cannot edit inventory records.
              </div>
            )}
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
