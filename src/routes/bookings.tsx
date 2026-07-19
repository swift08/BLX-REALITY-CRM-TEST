import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import {
  useBookings,
  useProjects,
  useInvoiceSettings,
  useCreateBookingInvoice,
} from "@/lib/queries";
import { downloadPdfInvoice, downloadDemandLetterPdf } from "@/lib/pdf-generator";
import { toast } from "sonner";
import {
  Search,
  Filter,
  Download,
  KeyRound,
  DollarSign,
  FileText,
  CheckCircle,
  Clock,
  Ban,
  Building,
  Calendar,
  Sparkles,
  ClipboardList,
  Lock,
  Receipt,
  AlertCircle,
  UserCheck,
  CreditCard,
  RefreshCw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

import { useAuth } from "@/hooks/use-auth";
import { can, isLeadVisible, canGenerateInvoiceForCustomer } from "@/lib/permissions";

export const Route = createFileRoute("/bookings")({
  head: () => ({ meta: [{ title: "Property Unit Bookings · BLX Realty CRM" }] }),
  component: PropertyBookingsPage,
});

function PropertyBookingsPage() {
  const { role, userId } = useAuth();
  const userCan = can(role);

  const { data: bookings = [], isLoading: isBookingsLoading } = useBookings();
  const { data: projects = [] } = useProjects();
  const { data: invoiceSettings } = useInvoiceSettings();

  const createInvoiceMutation = useCreateBookingInvoice();

  const [searchTerm, setSearchTerm] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Selected Booking for Primary Invoice Creation Modal
  const [selectedBookingForInvoice, setSelectedBookingForInvoice] = useState<any | null>(null);
  const [invoiceDueDate, setInvoiceDueDate] = useState<string>(
    new Date(Date.now() + 15 * 86400000).toISOString().split("T")[0],
  );

  // Role Scoped Bookings (Sales Exec = own, Manager = team, SA/Admin = company)
  const scopedBookings = useMemo(() => {
    return bookings.filter((b) => isLeadVisible(role, userId, b.owner_id || null));
  }, [bookings, role, userId]);

  // Dashboard Metrics
  const metrics = useMemo(() => {
    const active = scopedBookings.filter((b) => b.booking?.payment_status !== "void");
    const totalVolume = active.reduce((sum, b) => sum + (b.booking?.amount || 0), 0);
    const completed = scopedBookings
      .filter((b) => b.booking?.payment_status === "completed")
      .reduce((sum, b) => sum + (b.booking?.amount || 0), 0);
    const pending = scopedBookings
      .filter((b) => b.booking?.payment_status === "pending")
      .reduce((sum, b) => sum + (b.booking?.amount || 0), 0);

    return {
      count: active.length,
      volume: totalVolume,
      completed,
      pending,
    };
  }, [scopedBookings]);

  // Search & Filters logic
  const filteredBookings = useMemo(() => {
    return scopedBookings.filter((b) => {
      const term = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !term ||
        b.customer_name.toLowerCase().includes(term) ||
        b.unit_number.toLowerCase().includes(term) ||
        b.project_name.toLowerCase().includes(term) ||
        b.id.toLowerCase().includes(term);

      const matchesProject = projectFilter === "all" || b.project_name === projectFilter;
      const matchesStatus = statusFilter === "all" || b.booking?.payment_status === statusFilter;

      return matchesSearch && matchesProject && matchesStatus;
    });
  }, [scopedBookings, searchTerm, projectFilter, statusFilter]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const handleOpenIssueModal = (item: any) => {
    const validation = canGenerateInvoiceForCustomer(
      role,
      userId,
      item.owner_id || null,
      item.customer_stage || "booking_initiated",
    );

    if (!validation.allowed) {
      toast.error(validation.reason || "Invoice generation restricted for this customer.");
      return;
    }

    if (
      item.invoice?.status === "issued" ||
      item.invoice?.status === "paid" ||
      item.invoice?.status === "partially_paid"
    ) {
      toast.info(`Invoice ${item.invoice.invoice_number} is already officially issued and locked.`);
      downloadPdfInvoice(
        {
          bookingId: item.id,
          customerName: item.customer_name,
          customerPhone: item.customer_phone,
          customerEmail: item.customer_email,
          projectName: item.project_name,
          unitNumber: item.unit_number,
          amount: item.amount,
          paymentStatus: item.booking?.payment_status,
        },
        invoiceSettings,
      );
      return;
    }

    setSelectedBookingForInvoice(item);
  };

  const handleConfirmIssueInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBookingForInvoice) return;

    try {
      toast.loading("Issuing official tax invoice and locking booking contract...", {
        id: "issue-inv",
      });
      const snapshot = {
        customer_name: selectedBookingForInvoice.customer_name,
        customer_phone: selectedBookingForInvoice.customer_phone,
        customer_email: selectedBookingForInvoice.customer_email,
        project_name: selectedBookingForInvoice.project_name,
        unit_number: selectedBookingForInvoice.unit_number,
        amount: selectedBookingForInvoice.amount,
        issued_at: new Date().toISOString(),
        cms_settings: invoiceSettings,
      };

      await createInvoiceMutation.mutateAsync({
        bookingId: selectedBookingForInvoice.id,
        dueDate: invoiceDueDate,
        snapshot,
      });

      toast.success(`Tax Invoice issued successfully! Booking contract is now LOCKED 🔒.`, {
        id: "issue-inv",
      });

      // Trigger PDF download
      downloadPdfInvoice(
        {
          bookingId: selectedBookingForInvoice.id,
          customerName: selectedBookingForInvoice.customer_name,
          customerPhone: selectedBookingForInvoice.customer_phone,
          customerEmail: selectedBookingForInvoice.customer_email,
          projectName: selectedBookingForInvoice.project_name,
          unitNumber: selectedBookingForInvoice.unit_number,
          amount: selectedBookingForInvoice.amount,
          paymentStatus: selectedBookingForInvoice.booking?.payment_status,
        },
        invoiceSettings,
      );

      setSelectedBookingForInvoice(null);
    } catch (err: any) {
      toast.error(err?.message || "Failed to issue tax invoice.", { id: "issue-inv" });
    }
  };

  return (
    <AppShell
      title="Property Unit Bookings"
      subtitle="Primary source of invoice generation, booking contract locking & financial tracking"
    >
      <div className="space-y-6">
        {/* Key Metrics Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border/60 shadow-xs relative overflow-hidden bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Total Active Bookings
              </CardTitle>
              <ClipboardList className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold font-display text-foreground">
                {metrics.count}{" "}
                <span className="text-xs font-normal text-muted-foreground">units</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Excludes cancelled/void tokens
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-xs relative overflow-hidden bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Secured Token Volume
              </CardTitle>
              <DollarSign className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold font-display text-emerald-600 dark:text-emerald-400">
                {formatCurrency(metrics.volume)}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Total booked inventory contract value
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-xs relative overflow-hidden bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Completed Collections
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold font-display text-blue-600 dark:text-blue-400">
                {formatCurrency(metrics.completed)}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Token funds verified & cleared
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-xs relative overflow-hidden bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Pending Clearance
              </CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold font-display text-amber-600 dark:text-amber-400">
                {formatCurrency(metrics.pending)}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Tokens awaiting bank clearance
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Search & Filter Panel */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 rounded-xl border border-border bg-card shadow-xs">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by customer, unit number, project..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 text-xs h-9 bg-card"
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] font-bold text-muted-foreground uppercase">
                Project:
              </span>
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger className="h-9 min-w-[140px] text-xs">
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.name}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-muted-foreground uppercase">Status:</span>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 min-w-[130px] text-xs">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="booking_initiated">Booking Initiated</SelectItem>
                  <SelectItem value="pending">Payment Pending</SelectItem>
                  <SelectItem value="completed">Payment Completed</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="void">Void / Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Ledger Table */}
        <Card className="border-border/60 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="w-[120px] text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Booking ID
                  </TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Customer Name
                  </TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Project & Unit
                  </TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-right">
                    Booked Amount
                  </TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Financial Indicators
                  </TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Contract Status
                  </TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-center">
                    Primary Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isBookingsLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-12 text-xs text-muted-foreground"
                    >
                      Loading unit bookings ledger...
                    </TableCell>
                  </TableRow>
                ) : filteredBookings.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-16 text-xs text-muted-foreground space-y-2"
                    >
                      <div className="flex justify-center">
                        <KeyRound className="h-8 w-8 opacity-20" />
                      </div>
                      <p className="font-semibold text-foreground text-sm">
                        No unit bookings found
                      </p>
                      <p className="max-w-xs mx-auto text-xs text-muted-foreground">
                        Bookings are created when reserving a unit for an active customer
                        opportunity in the Customer Workspace.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBookings.map((item) => {
                    const bookingIdShort = item.id
                      .replace(/[^a-zA-Z0-9]/g, "")
                      .slice(-6)
                      .toUpperCase();
                    const status = item.booking?.payment_status || "pending";
                    const isIssued =
                      item.invoice?.status === "issued" ||
                      item.invoice?.status === "paid" ||
                      item.invoice?.status === "partially_paid";
                    const isFullyPaid = item.invoice?.status === "paid" || status === "completed";

                    return (
                      <TableRow key={item.id} className="hover:bg-muted/10">
                        <TableCell className="font-mono text-[11px] font-bold text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <span>#BK-{bookingIdShort}</span>
                            {item.is_locked && (
                              <Badge
                                variant="outline"
                                className="text-[9px] bg-amber-500/10 text-amber-600 border-amber-500/30 gap-0.5 px-1"
                              >
                                <Lock className="h-2.5 w-2.5" /> Locked
                              </Badge>
                            )}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="font-semibold text-xs text-foreground">
                            {item.customer_name}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {item.customer_phone || "+91 98450 00000"}
                          </div>
                        </TableCell>

                        <TableCell className="text-xs">
                          <div className="font-semibold text-foreground flex items-center gap-1.5">
                            <Building className="h-3.5 w-3.5 text-muted-foreground/75" />
                            {item.project_name}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            Unit:{" "}
                            <span className="font-mono font-bold text-primary">
                              {item.unit_number}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell className="text-xs font-bold text-foreground text-right font-mono">
                          {formatCurrency(item.amount || 0)}
                        </TableCell>

                        {/* Financial Indicators Cell */}
                        <TableCell className="text-xs">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-[11px]">
                              <span className="font-medium text-muted-foreground">Invoice:</span>
                              {isIssued ? (
                                <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/30 text-[10px] py-0">
                                  ✓ Issued ({item.invoice?.invoice_number || item.id.slice(-4)})
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] text-muted-foreground py-0"
                                >
                                  Draft / Unissued
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                              <span className="text-emerald-600 font-semibold">
                                Paid: ₹
                                {(
                                  item.invoice?.amount_paid || (isFullyPaid ? item.amount : 0)
                                ).toLocaleString("en-IN")}
                              </span>
                              <span>·</span>
                              <span className="text-amber-600 font-semibold">
                                Bal: ₹
                                {(
                                  item.invoice?.outstanding_amount ||
                                  (isFullyPaid ? 0 : item.amount)
                                ).toLocaleString("en-IN")}
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          {(status === "booking_initiated" || status === "initiated") && (
                            <Badge className="bg-blue-500/10 hover:bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20 gap-1 text-[10px] font-bold">
                              <Sparkles className="h-3 w-3" /> Booking Initiated
                            </Badge>
                          )}
                          {(status === "completed" || status === "payment_completed") && (
                            <Badge className="bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 gap-1 text-[10px] font-bold">
                              <CheckCircle className="h-3 w-3" /> Payment Completed
                            </Badge>
                          )}
                          {(status === "pending" || status === "payment_pending") && (
                            <Badge className="bg-amber-500/10 hover:bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20 gap-1 text-[10px] font-bold">
                              <Clock className="h-3 w-3" /> Payment Pending
                            </Badge>
                          )}
                          {status === "closed" && (
                            <Badge className="bg-purple-500/10 hover:bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20 gap-1 text-[10px] font-bold">
                              <UserCheck className="h-3 w-3" /> Closed
                            </Badge>
                          )}
                          {status === "void" && (
                            <Badge className="bg-slate-500/10 hover:bg-slate-500/15 text-slate-500 border-slate-500/20 gap-1 text-[10px] font-bold">
                              <Ban className="h-3 w-3" /> Voided
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {isIssued ? (
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-[11px] gap-1 font-semibold text-primary hover:bg-primary/10 border-primary/30"
                                  onClick={() => handleOpenIssueModal(item)}
                                >
                                  <Download className="h-3 w-3" /> PDF Invoice
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-[11px] gap-1 font-semibold text-red-600 hover:bg-red-50 border-red-500/30"
                                  title="Issue Milestone Demand Letter PDF"
                                  onClick={() => {
                                    downloadDemandLetterPdf(
                                      {
                                        demandNumber: `DEM-2026-${Math.floor(1000 + Math.random() * 9000)}`,
                                        bookingId: item.id,
                                        customerName: item.customer_name,
                                        customerPhone: item.customer_phone,
                                        customerEmail: item.customer_email,
                                        projectName: item.project_name,
                                        unitNumber: item.unit_number,
                                        milestoneName: "Plinth / Slab 1 Completion (15%)",
                                        milestoneAmount: Math.round((item.amount || 0) * 0.15),
                                        dueDate: new Date(Date.now() + 15 * 86400000).toISOString(),
                                      },
                                      invoiceSettings,
                                    );
                                  }}
                                >
                                  <FileText className="h-3 w-3" /> Demand Letter
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                className="h-7 text-[11px] gap-1 font-bold bg-primary text-primary-foreground shadow-xs"
                                onClick={() => handleOpenIssueModal(item)}
                              >
                                <Receipt className="h-3 w-3" /> Issue Tax Invoice
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* Primary Invoice Issuance Modal (Pre-bound to Selected Booking) */}
      <Dialog
        open={Boolean(selectedBookingForInvoice)}
        onOpenChange={(open) => !open && setSelectedBookingForInvoice(null)}
      >
        <DialogContent className="max-w-md bg-card rounded-xl border border-border shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold font-display text-foreground flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" /> Confirm Tax Invoice Issuance
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Issuing an official tax invoice locks the booking contract and establishes the
              permanent financial record.
            </DialogDescription>
          </DialogHeader>

          {selectedBookingForInvoice && (
            <form onSubmit={handleConfirmIssueInvoice} className="space-y-4 mt-3">
              <div className="p-4 rounded-xl border bg-muted/40 space-y-2 text-xs">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="font-bold text-foreground flex items-center gap-1.5">
                    <UserCheck className="h-4 w-4 text-emerald-600" />{" "}
                    {selectedBookingForInvoice.customer_name}
                  </div>
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-primary/10 text-primary border-primary/30"
                  >
                    Booking #BK-{selectedBookingForInvoice.id.slice(-6).toUpperCase()}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground pt-1">
                  <div>
                    <strong>Phone:</strong>{" "}
                    {selectedBookingForInvoice.customer_phone || "+91 98450 00000"}
                  </div>
                  <div>
                    <strong>Email:</strong>{" "}
                    {selectedBookingForInvoice.customer_email || "client@example.com"}
                  </div>
                  <div>
                    <strong>Project:</strong> {selectedBookingForInvoice.project_name}
                  </div>
                  <div>
                    <strong>Unit Number:</strong> {selectedBookingForInvoice.unit_number}
                  </div>
                  <div>
                    <strong>Sales Executive:</strong> {selectedBookingForInvoice.owner_id}
                  </div>
                  <div>
                    <strong>Billed Amount:</strong> ₹
                    {(selectedBookingForInvoice.amount || 0).toLocaleString("en-IN")}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="inv-due-date" className="text-xs font-semibold">
                  Invoice Payment Due Date *
                </Label>
                <Input
                  id="inv-due-date"
                  type="date"
                  required
                  value={invoiceDueDate}
                  onChange={(e) => setInvoiceDueDate(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-600 text-[11px] flex items-start gap-2">
                <Lock className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="leading-tight">
                  <span className="font-bold text-foreground">Contract Lock Notice</span>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Once issued, core booking parameters (Customer, Unit, Amount) will be locked
                    from arbitrary edits.
                  </p>
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedBookingForInvoice(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="gap-1.5">
                  <Receipt className="h-3.5 w-3.5" /> Issue & Lock Booking
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
