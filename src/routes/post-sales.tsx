import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { can, isLeadVisible } from "@/lib/permissions";
import {
  useBookings,
  usePostSalesOperations,
  useUpdateRegistration,
  useUpdatePossession,
} from "@/lib/queries";
import {
  Building,
  CheckCircle2,
  Clock,
  FileText,
  Key,
  ShieldCheck,
  Search,
  Plus,
  AlertTriangle,
  FileCheck,
  UserCheck,
} from "lucide-react";

export const Route = createFileRoute("/post-sales")({
  head: () => ({ meta: [{ title: "Post-Sales Operations · Registration & Possession" }] }),
  component: PostSalesPage,
});

function PostSalesPage() {
  const { role, userId } = useAuth();
  const userCan = can(role);

  const { data: bookings = [] } = useBookings();
  const { data: postSalesData } = usePostSalesOperations();

  const updateRegistrationMutation = useUpdateRegistration();
  const updatePossessionMutation = useUpdatePossession();

  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("registration");

  // Active Dialog States
  const [selectedBookingForReg, setSelectedBookingForReg] = useState<any | null>(null);
  const [regDate, setRegDate] = useState("");
  const [regOffice, setRegOffice] = useState("Sub-Registrar Office, MG Road");
  const [regDocNum, setRegDocNum] = useState("");
  const [regStampDuty, setRegStampDuty] = useState("350000");
  const [regCharges, setRegCharges] = useState("30000");
  const [regStatus, setRegStatus] = useState("scheduled");

  const [selectedBookingForPoss, setSelectedBookingForPoss] = useState<any | null>(null);
  const [possDate, setPossDate] = useState("");
  const [keyStatus, setKeyStatus] = useState("scheduled");
  const [snagInput, setSnagInput] = useState("");
  const [snagList, setSnagList] = useState<string[]>([]);

  const scopedBookings = useMemo(() => {
    return bookings.filter((b) => isLeadVisible(role, userId, b.owner_id || null));
  }, [bookings, role, userId]);

  const filteredBookings = useMemo(() => {
    return scopedBookings.filter((b) => {
      const term = searchTerm.toLowerCase();
      return (
        b.customer_name.toLowerCase().includes(term) ||
        b.project_name.toLowerCase().includes(term) ||
        b.unit_number.toLowerCase().includes(term) ||
        b.id.toLowerCase().includes(term)
      );
    });
  }, [scopedBookings, searchTerm]);

  const handleOpenRegModal = (item: any) => {
    setSelectedBookingForReg(item);
    setRegDate(new Date().toISOString().split("T")[0]);
    setRegDocNum(`DOC-2026-${Math.floor(10000 + Math.random() * 90000)}`);
    setRegStampDuty(String(Math.round((item.amount || 0) * 0.05)));
    setRegCharges("30000");
    setRegStatus("scheduled");
  };

  const handleRegSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBookingForReg) return;

    try {
      toast.loading("Updating sale deed registration record...", { id: "reg-up" });
      await updateRegistrationMutation.mutateAsync({
        bookingId: selectedBookingForReg.id,
        registrationDate: regDate,
        subRegistrarOffice: regOffice,
        documentNumber: regDocNum,
        stampDuty: parseFloat(regStampDuty) || 0,
        registrationCharges: parseFloat(regCharges) || 0,
        status: regStatus,
      });

      toast.success(`Registration record saved for Unit ${selectedBookingForReg.unit_number}!`, {
        id: "reg-up",
      });
      setSelectedBookingForReg(null);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update registration record.", { id: "reg-up" });
    }
  };

  const handleOpenPossModal = (item: any) => {
    setSelectedBookingForPoss(item);
    setPossDate(new Date().toISOString().split("T")[0]);
    setKeyStatus("scheduled");
    setSnagList(["Minor paint touchup in master bedroom", "Electrical switch plate alignment"]);
  };

  const handlePossSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBookingForPoss) return;

    try {
      toast.loading("Updating unit possession & key handover status...", { id: "poss-up" });
      await updatePossessionMutation.mutateAsync({
        bookingId: selectedBookingForPoss.id,
        possessionDate: possDate,
        keysHandoverStatus: keyStatus,
        snagList: snagList,
        signedOffBy: selectedBookingForPoss.customer_name,
      });

      toast.success(`Possession record saved for Unit ${selectedBookingForPoss.unit_number}!`, {
        id: "poss-up",
      });
      setSelectedBookingForPoss(null);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update possession record.", { id: "poss-up" });
    }
  };

  return (
    <AppShell
      title="Post-Sales Operations"
      subtitle="Sale deed registrations, stamp duty tracking & key handover possession workspace"
    >
      <div className="space-y-6 pb-12">
        {/* Top Header Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-5 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-brand font-bold text-base text-foreground">
                  Post-Sales Operations Lifecycle
                </h2>
                <Badge
                  variant="outline"
                  className="text-[10px] bg-primary/5 text-primary border-primary/20"
                >
                  Role Scoped ({userCan.roleLabel()})
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Manage property sale deed registrations, sub-registrar document filings, snag lists,
                and final key handovers.
              </p>
            </div>
          </div>

          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search client, unit, project..."
              className="h-8 w-60 pl-8 text-xs bg-card"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Tabbed Operations Workspace */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-card border p-1 rounded-xl h-10">
            <TabsTrigger value="registration" className="gap-1.5 text-xs font-bold">
              <FileCheck className="h-4 w-4 text-primary" /> Sale Deed Registration Tracker
            </TabsTrigger>
            <TabsTrigger value="possession" className="gap-1.5 text-xs font-bold">
              <Key className="h-4 w-4 text-emerald-600" /> Key Handover & Possession Manager
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: REGISTRATION TRACKER */}
          <TabsContent value="registration" className="space-y-4 m-0">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileCheck className="h-4 w-4 text-primary" /> Sub-Registrar Office Filings &
                  Stamp Duty
                </CardTitle>
                <CardDescription className="text-xs">
                  Log official registration dates, sub-registrar office locations, index document
                  numbers, and stamp duty clearances.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <div className="overflow-x-auto border rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/50 border-b font-semibold text-muted-foreground uppercase text-[10px]">
                      <tr>
                        <th className="p-3">Booking & Unit</th>
                        <th className="p-3">Customer Profile</th>
                        <th className="p-3">Sub-Registrar Office</th>
                        <th className="p-3">Doc # & Stamp Duty</th>
                        <th className="p-3">Registration Status</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredBookings.map((b) => (
                        <tr key={b.id} className="hover:bg-muted/20 transition-colors">
                          <td className="p-3">
                            <div className="font-bold text-foreground">{b.project_name}</div>
                            <div className="text-[10px] font-mono text-primary font-bold">
                              Unit: {b.unit_number} (#BK-{b.id.slice(-6).toUpperCase()})
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-foreground">{b.customer_name}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {b.customer_phone}
                            </div>
                          </td>
                          <td className="p-3 text-muted-foreground">
                            Sub-Registrar Office, MG Road
                          </td>
                          <td className="p-3 font-mono">
                            <div className="font-bold text-foreground">Doc: DOC-2026-94812</div>
                            <div className="text-[10px] text-muted-foreground">
                              Stamp Duty: ₹
                              {Math.round((b.amount || 0) * 0.05).toLocaleString("en-IN")}
                            </div>
                          </td>
                          <td className="p-3">
                            <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/30 text-[10px]">
                              SCHEDULED
                            </Badge>
                          </td>
                          <td className="p-3 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px] gap-1 font-bold"
                              onClick={() => handleOpenRegModal(b)}
                            >
                              <FileText className="h-3 w-3" /> Log Registration
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: POSSESSION MANAGER */}
          <TabsContent value="possession" className="space-y-4 m-0">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Key className="h-4 w-4 text-emerald-600" /> Unit Handover & Snag Clearance
                  Tracker
                </CardTitle>
                <CardDescription className="text-xs">
                  Manage key handovers, quality inspection snag lists, and final customer sign-off
                  certificates.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <div className="overflow-x-auto border rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/50 border-b font-semibold text-muted-foreground uppercase text-[10px]">
                      <tr>
                        <th className="p-3">Booking & Unit</th>
                        <th className="p-3">Customer Profile</th>
                        <th className="p-3">Key Handover Status</th>
                        <th className="p-3">Snag List Items</th>
                        <th className="p-3">Sign-off Certificate</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredBookings.map((b) => (
                        <tr key={b.id} className="hover:bg-muted/20 transition-colors">
                          <td className="p-3">
                            <div className="font-bold text-foreground">{b.project_name}</div>
                            <div className="text-[10px] font-mono text-primary font-bold">
                              Unit: {b.unit_number}
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-foreground">{b.customer_name}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {b.customer_phone}
                            </div>
                          </td>
                          <td className="p-3">
                            <Badge
                              variant="outline"
                              className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[10px]"
                            >
                              INSPECTION PENDING
                            </Badge>
                          </td>
                          <td className="p-3 text-muted-foreground text-[11px]">
                            2 snag items logged
                          </td>
                          <td className="p-3 text-muted-foreground text-[11px]">
                            Pending customer signature
                          </td>
                          <td className="p-3 text-right">
                            <Button
                              size="sm"
                              className="h-7 text-[11px] gap-1 font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                              onClick={() => handleOpenPossModal(b)}
                            >
                              <Key className="h-3 w-3" /> Manage Handover
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Registration Edit Modal */}
      <Dialog
        open={Boolean(selectedBookingForReg)}
        onOpenChange={(open) => !open && setSelectedBookingForReg(null)}
      >
        <DialogContent className="max-w-md bg-card rounded-xl border border-border p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold font-display flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-primary" /> Log Sale Deed Registration
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Record sub-registrar filing details for {selectedBookingForReg?.customer_name} (Unit{" "}
              {selectedBookingForReg?.unit_number}).
            </DialogDescription>
          </DialogHeader>

          {selectedBookingForReg && (
            <form onSubmit={handleRegSubmit} className="space-y-3 mt-2">
              <div className="space-y-1">
                <Label htmlFor="reg-date" className="text-xs font-semibold">
                  Registration Date *
                </Label>
                <Input
                  id="reg-date"
                  type="date"
                  required
                  value={regDate}
                  onChange={(e) => setRegDate(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="reg-office" className="text-xs font-semibold">
                  Sub-Registrar Office Location *
                </Label>
                <Input
                  id="reg-office"
                  required
                  value={regOffice}
                  onChange={(e) => setRegOffice(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="reg-doc" className="text-xs font-semibold">
                    Doc / Index II Number *
                  </Label>
                  <Input
                    id="reg-doc"
                    required
                    value={regDocNum}
                    onChange={(e) => setRegDocNum(e.target.value)}
                    className="h-9 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="reg-stamp" className="text-xs font-semibold">
                    Stamp Duty (INR)
                  </Label>
                  <Input
                    id="reg-stamp"
                    type="number"
                    value={regStampDuty}
                    onChange={(e) => setRegStampDuty(e.target.value)}
                    className="h-9 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="reg-st" className="text-xs font-semibold">
                  Registration Status
                </Label>
                <select
                  id="reg-st"
                  className="w-full h-9 px-3 rounded border bg-card text-xs text-foreground font-semibold focus:outline-none"
                  value={regStatus}
                  onChange={(e) => setRegStatus(e.target.value)}
                >
                  <option value="scheduled">Scheduled / Appointment Fixed</option>
                  <option value="in_progress">Documents Submitted to Sub-Registrar</option>
                  <option value="registered">Registered & Index II Copy Handed Over</option>
                </select>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedBookingForReg(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="gap-1.5 font-bold">
                  <FileCheck className="h-3.5 w-3.5" /> Save Registration Details
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Possession Edit Modal */}
      <Dialog
        open={Boolean(selectedBookingForPoss)}
        onOpenChange={(open) => !open && setSelectedBookingForPoss(null)}
      >
        <DialogContent className="max-w-md bg-card rounded-xl border border-border p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold font-display flex items-center gap-2">
              <Key className="h-5 w-5 text-emerald-600" /> Unit Possession & Key Handover
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Manage key handover status & snag list for {selectedBookingForPoss?.customer_name}{" "}
              (Unit {selectedBookingForPoss?.unit_number}).
            </DialogDescription>
          </DialogHeader>

          {selectedBookingForPoss && (
            <form onSubmit={handlePossSubmit} className="space-y-3 mt-2">
              <div className="space-y-1">
                <Label htmlFor="poss-date" className="text-xs font-semibold">
                  Possession Date *
                </Label>
                <Input
                  id="poss-date"
                  type="date"
                  required
                  value={possDate}
                  onChange={(e) => setPossDate(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="key-st" className="text-xs font-semibold">
                  Key Handover Clearance Status
                </Label>
                <select
                  id="key-st"
                  className="w-full h-9 px-3 rounded border bg-card text-xs text-foreground font-semibold focus:outline-none"
                  value={keyStatus}
                  onChange={(e) => setKeyStatus(e.target.value)}
                >
                  <option value="scheduled">Scheduled Inspection</option>
                  <option value="snag_pending">Snag List Work Underway</option>
                  <option value="handed_over">Keys Handed Over & Customer Signed-off</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Snag List Items Logged</Label>
                <div className="space-y-1">
                  {snagList.map((snag, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded border bg-muted/30 text-xs flex items-center justify-between"
                    >
                      <span>• {snag}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-5 text-[10px] text-destructive"
                        onClick={() => setSnagList(snagList.filter((_, i) => i !== idx))}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 pt-1">
                  <Input
                    placeholder="Add new snag item..."
                    className="h-8 text-xs"
                    value={snagInput}
                    onChange={(e) => setSnagInput(e.target.value)}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs shrink-0"
                    onClick={() => {
                      if (snagInput.trim()) {
                        setSnagList([...snagList, snagInput.trim()]);
                        setSnagInput("");
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedBookingForPoss(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  <Key className="h-3.5 w-3.5" /> Save Possession Certificate
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
