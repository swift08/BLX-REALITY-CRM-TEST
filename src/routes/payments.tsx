import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
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
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { can, isLeadVisible } from "@/lib/permissions";
import { useBookings, useInvoiceSettings, useRecordPayment, useCancelInvoice } from "@/lib/queries";
import { downloadPdfInvoice, generatePaymentReceiptPdf } from "@/lib/pdf-generator";
import {
  DollarSign,
  Receipt,
  Download,
  RefreshCw,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Sparkles,
  Settings,
  Building,
  CreditCard,
  FileText,
  AlertCircle,
  UserCheck,
  Ban,
  Lock,
} from "lucide-react";

export const Route = createFileRoute("/payments")({
  head: () => ({ meta: [{ title: "Payments & Invoices · BLX Realty CRM" }] }),
  component: PaymentsPage,
});

function PaymentsPage() {
  const { role, userId } = useAuth();
  const userCan = can(role);

  const { data: bookings = [] } = useBookings();
  const { data: invoiceSettings } = useInvoiceSettings();

  const recordPaymentMutation = useRecordPayment();
  const cancelInvoiceMutation = useCancelInvoice();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Record Payment Modal State
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<any | null>(null);
  const [payAmount, setPayAmount] = useState<string>("");
  const [payMethod, setPayMethod] = useState<string>("bank_transfer");
  const [payReference, setPayReference] = useState<string>("");
  const [payNotes, setPayNotes] = useState<string>("");

  // Role Scoped Bookings & Invoices
  const scopedBookings = useMemo(() => {
    return bookings.filter((b) => isLeadVisible(role, userId, b.owner_id || null));
  }, [bookings, role, userId]);

  // Aggregate invoice items
  const allInvoiceItems = useMemo(() => {
    return scopedBookings.map((b) => {
      const inv = b.invoice;
      const invId = inv?.id || `inv-${b.id}`;
      const invNumber =
        inv?.invoice_number ||
        `INV-2026-${b.id
          .replace(/[^a-zA-Z0-9]/g, "")
          .slice(-4)
          .padStart(4, "0")}/BLX`;
      const invStatus =
        inv?.status || (b.booking?.payment_status === "completed" ? "paid" : "issued");
      const invAmount = inv?.amount || b.amount || 100000;
      const paid = inv?.amount_paid || (invStatus === "paid" ? invAmount : 0);
      const outstanding =
        inv?.outstanding_amount !== undefined
          ? inv.outstanding_amount
          : invStatus === "paid"
            ? 0
            : invAmount;

      return {
        id: invId,
        invoiceNumber: invNumber,
        bookingId: b.id,
        customerName: b.customer_name || "Valued Client",
        customerPhone: b.customer_phone || "+91 98123 45678",
        customerEmail: b.customer_email || "client@example.com",
        projectName: b.project_name || "BLX Premier Residence",
        unitNumber: b.unit_number || "A-101",
        amount: invAmount,
        amountPaid: paid,
        outstandingAmount: outstanding,
        status: invStatus,
        dueDate: inv?.due_date || new Date(Date.now() + 15 * 86400000).toISOString(),
        date: inv?.issued_at || b.booking_date || new Date().toISOString(),
        issuedBy: inv?.issued_by || "System",
        payments: inv?.payments || [],
      };
    });
  }, [scopedBookings]);

  // Statistics
  const totalBilled = allInvoiceItems.reduce((sum, i) => sum + i.amount, 0);
  const totalCollected = allInvoiceItems.reduce((sum, i) => sum + i.amountPaid, 0);
  const pendingAmount = Math.max(0, totalBilled - totalCollected);

  const filteredInvoices = useMemo(() => {
    return allInvoiceItems.filter((item) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        item.customerName.toLowerCase().includes(term) ||
        item.invoiceNumber.toLowerCase().includes(term) ||
        item.projectName.toLowerCase().includes(term);
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [allInvoiceItems, searchTerm, statusFilter]);

  const handleOpenPaymentModal = (inv: any) => {
    setSelectedInvoiceForPayment(inv);
    setPayAmount(String(inv.outstandingAmount || inv.amount));
    setPayReference(`UTR-${Math.random().toString(36).substring(2, 9).toUpperCase()}`);
    setPayNotes("");
  };

  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceForPayment || !payAmount) return;

    const amt = parseFloat(payAmount) || 0;
    if (amt <= 0) {
      toast.error("Payment amount must be greater than zero.");
      return;
    }

    try {
      toast.loading("Recording collection payment and generating receipt...", { id: "rec-pay" });
      await recordPaymentMutation.mutateAsync({
        invoiceId: selectedInvoiceForPayment.id,
        amount: amt,
        paymentMethod: payMethod,
        reference: payReference.trim() || `TXN-${Date.now()}`,
        notes: payNotes.trim(),
      });

      toast.success(`Payment of ₹${amt.toLocaleString("en-IN")} recorded successfully!`, {
        id: "rec-pay",
      });

      // Generate instant Payment Receipt PDF
      generatePaymentReceiptPdf(
        {
          receiptNumber: `RCPT-2026-${Math.floor(10000 + Math.random() * 90000)}`,
          invoiceNumber: selectedInvoiceForPayment.invoiceNumber,
          customerName: selectedInvoiceForPayment.customerName,
          projectName: selectedInvoiceForPayment.projectName,
          unitNumber: selectedInvoiceForPayment.unitNumber,
          amountPaid: amt,
          paymentMethod: payMethod,
          reference: payReference,
          date: new Date().toISOString(),
        },
        invoiceSettings,
      );

      setSelectedInvoiceForPayment(null);
    } catch (err: any) {
      toast.error(err?.message || "Failed to record payment.", { id: "rec-pay" });
    }
  };

  const handleCancelInvoice = async (inv: any) => {
    const reason = window.prompt(
      `Enter reason for cancelling official invoice ${inv.invoiceNumber}:`,
    );
    if (!reason || !reason.trim()) {
      toast.info("Invoice cancellation aborted.");
      return;
    }

    try {
      toast.loading("Cancelling tax invoice...", { id: "canc-inv" });
      await cancelInvoiceMutation.mutateAsync({
        invoiceId: inv.id,
        reason: reason.trim(),
      });
      toast.success(`Invoice ${inv.invoiceNumber} cancelled. Booking unlocked.`, {
        id: "canc-inv",
      });
    } catch (err: any) {
      toast.error(err?.message || "Failed to cancel invoice.", { id: "canc-inv" });
    }
  };

  return (
    <AppShell
      title="Payment Ledger & Finance Operations"
      subtitle="Track collections, record received payments & issue payment receipts"
    >
      <div className="space-y-6 pb-12">
        {/* Top Header Guidance Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-5 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-brand font-bold text-base text-foreground">
                  Finance Operations & Collections
                </h2>
                <Badge
                  variant="outline"
                  className="text-[10px] bg-primary/5 text-primary border-primary/20"
                >
                  Role Scoped ({userCan.roleLabel()})
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Invoices originate from the{" "}
                <Link to="/bookings" className="font-bold text-primary underline">
                  Bookings Workspace
                </Link>
                . Record payments and download receipts here.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {userCan.viewInvoiceCMS() && (
              <Link to="/invoice-cms">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  <Settings className="h-3.5 w-3.5" /> Invoice CMS Settings
                </Button>
              </Link>
            )}
            <Link to="/bookings">
              <Button size="sm" className="gap-1.5 text-xs">
                <Building className="h-3.5 w-3.5" /> Go to Bookings Workspace
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold">
                Total Revenue Invoiced
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-foreground">
                ₹{totalBilled.toLocaleString("en-IN")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                <FileText className="h-3.5 w-3.5 text-primary" /> {allInvoiceItems.length} Tax
                Invoices Issued
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold">
                Total Collections Received
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-emerald-600">
                ₹{totalCollected.toLocaleString("en-IN")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Cleared Escrow Receipts
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold">
                Outstanding Balance Due
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-amber-600">
                ₹{pendingAmount.toLocaleString("en-IN")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-[11px] text-amber-600 font-medium flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> Pending Collection Balance
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold text-primary">
                CMS Financial Template
              </CardDescription>
              <CardTitle className="text-base font-bold text-foreground capitalize">
                {invoiceSettings?.default_template_id?.replace("_", " ") || "Modern Executive"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> Dynamic Template Engine
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Invoice Ledger Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" /> Tax Invoices & Collections Ledger
                </CardTitle>
                <CardDescription className="text-xs">
                  Record collections against issued invoices, view payment histories, and download
                  receipts.
                </CardDescription>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search client, invoice #..."
                    className="h-8 w-48 pl-8 text-xs"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <select
                  className="h-8 px-2 rounded border text-xs bg-card font-semibold focus:outline-none"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All Lifecycle Statuses</option>
                  <option value="issued">Issued (Awaiting Payment)</option>
                  <option value="partially_paid">Partially Paid</option>
                  <option value="paid">Paid (Fully Cleared)</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="overflow-x-auto border rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b font-semibold text-muted-foreground uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Invoice Number</th>
                    <th className="p-3">Client Details</th>
                    <th className="p-3">Property Allocation</th>
                    <th className="p-3 font-mono">Billed / Paid / Outstanding</th>
                    <th className="p-3">Lifecycle Status</th>
                    <th className="p-3">Issued Date</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredInvoices.map((inv) => {
                    const isFullyPaid = inv.status === "paid";
                    const isCancelled = inv.status === "cancelled";

                    return (
                      <tr key={inv.id} className="hover:bg-muted/20 transition-colors">
                        <td className="p-3 font-mono font-bold text-primary">
                          {inv.invoiceNumber}
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-foreground">{inv.customerName}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {inv.customerPhone}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-foreground">{inv.projectName}</div>
                          <div className="text-[10px] text-muted-foreground">
                            Unit: {inv.unitNumber}
                          </div>
                        </td>
                        <td className="p-3 font-mono text-[11px]">
                          <div className="font-bold text-foreground">
                            Billed: ₹{inv.amount.toLocaleString("en-IN")}
                          </div>
                          <div className="text-[10px] text-emerald-600 font-semibold">
                            Paid: ₹{inv.amountPaid.toLocaleString("en-IN")}
                          </div>
                          <div className="text-[10px] text-amber-600 font-semibold">
                            Bal: ₹{inv.outstandingAmount.toLocaleString("en-IN")}
                          </div>
                        </td>
                        <td className="p-3">
                          {inv.status === "paid" && (
                            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]">
                              ✓ PAID (100%)
                            </Badge>
                          )}
                          {inv.status === "partially_paid" && (
                            <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/30 text-[10px]">
                              PARTIALLY PAID
                            </Badge>
                          )}
                          {inv.status === "issued" && (
                            <Badge
                              variant="outline"
                              className="bg-blue-500/10 text-blue-600 border-blue-500/30 text-[10px]"
                            >
                              ISSUED (UNPAID)
                            </Badge>
                          )}
                          {inv.status === "cancelled" && (
                            <Badge
                              variant="outline"
                              className="bg-red-500/10 text-red-500 border-red-500/30 text-[10px] line-through"
                            >
                              CANCELLED
                            </Badge>
                          )}
                        </td>
                        <td className="p-3 text-muted-foreground font-mono text-[11px]">
                          {new Date(inv.date).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {!isFullyPaid && !isCancelled && userCan.recordPayments() && (
                              <Button
                                size="sm"
                                className="h-7 text-[11px] gap-1 font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                                onClick={() => handleOpenPaymentModal(inv)}
                              >
                                <DollarSign className="h-3 w-3" /> Record Payment
                              </Button>
                            )}

                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px] gap-1"
                              onClick={() => downloadPdfInvoice(inv, invoiceSettings)}
                            >
                              <Download className="h-3 w-3" /> Invoice PDF
                            </Button>

                            {!isCancelled && userCan.cancelInvoices() && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-[11px] text-destructive hover:bg-destructive/10"
                                title="Cancel Invoice"
                                onClick={() => handleCancelInvoice(inv)}
                              >
                                <Ban className="h-3 w-3" /> Cancel
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredInvoices.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-muted-foreground text-xs">
                        No invoice records match your search filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Record Received Payment Dialog Modal */}
      <Dialog
        open={Boolean(selectedInvoiceForPayment)}
        onOpenChange={(open) => !open && setSelectedInvoiceForPayment(null)}
      >
        <DialogContent className="max-w-md bg-card rounded-xl border border-border shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold font-display text-foreground flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-600" /> Record Received Payment
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Record a collection payment against tax invoice{" "}
              {selectedInvoiceForPayment?.invoiceNumber}.
            </DialogDescription>
          </DialogHeader>

          {selectedInvoiceForPayment && (
            <form onSubmit={handleRecordPaymentSubmit} className="space-y-4 mt-3">
              <div className="p-4 rounded-xl border bg-muted/40 space-y-2 text-xs">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="font-bold text-foreground">
                    {selectedInvoiceForPayment.customerName}
                  </div>
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-primary/10 text-primary border-primary/30"
                  >
                    {selectedInvoiceForPayment.invoiceNumber}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                  <div>
                    <strong>Total Invoice:</strong> ₹
                    {selectedInvoiceForPayment.amount.toLocaleString("en-IN")}
                  </div>
                  <div>
                    <strong>Already Paid:</strong> ₹
                    {selectedInvoiceForPayment.amountPaid.toLocaleString("en-IN")}
                  </div>
                  <div className="col-span-2 font-bold text-amber-600">
                    <strong>Outstanding Balance:</strong> ₹
                    {selectedInvoiceForPayment.outstandingAmount.toLocaleString("en-IN")}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pay-amt" className="text-xs font-semibold">
                  Payment Amount Received (INR) *
                </Label>
                <Input
                  id="pay-amt"
                  type="number"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="h-9 text-xs font-mono font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pay-method" className="text-xs font-semibold">
                    Payment Method *
                  </Label>
                  <select
                    id="pay-method"
                    className="w-full h-9 px-3 rounded border bg-card text-xs text-foreground font-semibold focus:outline-none"
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                  >
                    <option value="bank_transfer">Bank Transfer (NEFT/RTGS)</option>
                    <option value="cheque">Cheque / DD</option>
                    <option value="upi">UPI / NetBanking</option>
                    <option value="card">Credit / Debit Card</option>
                    <option value="cash">Cash Receipt</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="pay-ref" className="text-xs font-semibold">
                    Transaction / Ref ID *
                  </Label>
                  <Input
                    id="pay-ref"
                    required
                    placeholder="e.g. UTR981240129"
                    value={payReference}
                    onChange={(e) => setPayReference(e.target.value)}
                    className="h-9 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pay-notes" className="text-xs font-semibold">
                  Payment Notes / Clearance Remarks
                </Label>
                <Input
                  id="pay-notes"
                  placeholder="e.g. HDFC Escrow account cleared"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedInvoiceForPayment(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Record Payment & Issue Receipt
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
