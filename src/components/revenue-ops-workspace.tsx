import { useState, useMemo, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { can, isLeadVisible, canGenerateInvoiceForCustomer } from "@/lib/permissions";
import {
  useBookings,
  useProjects,
  useInvoiceSettings,
  useCRMUsers,
  useCreateBookingInvoice,
  useRecordPayment,
  useCancelInvoice,
} from "@/lib/queries";
import {
  downloadPdfInvoice,
  downloadDemandLetterPdf,
  generatePaymentReceiptPdf,
} from "@/lib/pdf-generator";
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
  TrendingUp,
  Award,
  ArrowUpRight,
  PieChart,
  ChevronRight,
  Eye,
  Settings,
  ShieldCheck,
  CheckCircle2,
  Layers,
  Activity,
  Zap,
  User,
  Phone,
  Mail,
  MapPin,
  Check,
  History,
  FileCheck,
  Hash,
  Brain,
  Lightbulb,
  Command,
  CheckSquare,
  Square,
  FolderDown,
  ArrowRight,
  ShieldAlert,
  Flame,
  FilterX,
} from "lucide-react";

export interface RevenueOpsWorkspaceProps {
  initialFocus?: "all" | "bookings" | "payments" | "analytics";
  titleOverride?: string;
  subtitleOverride?: string;
}

const MEMORY_STORAGE_KEY = "blx-revops-workspace-memory-v1";

export function RevenueOpsWorkspace({
  titleOverride,
  subtitleOverride,
}: RevenueOpsWorkspaceProps) {
  const { role, userId } = useAuth();
  const userCan = can(role);

  // Queries
  const { data: bookings = [], isLoading: isBookingsLoading } = useBookings();
  const { data: projects = [] } = useProjects();
  const { data: invoiceSettings } = useInvoiceSettings();
  const { data: crmUsers = [] } = useCRMUsers();

  // Mutations
  const createInvoiceMutation = useCreateBookingInvoice();
  const recordPaymentMutation = useRecordPayment();
  const cancelInvoiceMutation = useCancelInvoice();

  // Workspace Memory (State Persistence)
  const savedMemory = useMemo(() => {
    try {
      const item = localStorage.getItem(MEMORY_STORAGE_KEY);
      return item ? JSON.parse(item) : {};
    } catch (e) {
      return {};
    }
  }, []);

  // Universal Search & Global Filters
  const [searchTerm, setSearchTerm] = useState<string>(savedMemory.searchTerm || "");
  const [projectFilter, setProjectFilter] = useState<string>(savedMemory.projectFilter || "all");
  const [stageFilter, setStageFilter] = useState<string>(savedMemory.stageFilter || "all");
  const [executiveFilter, setExecutiveFilter] = useState<string>(savedMemory.executiveFilter || "all");

  // Selected Booking Record
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(
    savedMemory.selectedBookingId || null,
  );

  // Ctrl + K Command Palette Modal
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");

  // Bulk Operations State
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);

  // Modal States
  const [selectedBookingForInvoice, setSelectedBookingForInvoice] = useState<any | null>(null);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<any | null>(null);

  // Forms State
  const [invoiceDueDate, setInvoiceDueDate] = useState<string>(
    new Date(Date.now() + 15 * 86400000).toISOString().split("T")[0],
  );
  const [payAmount, setPayAmount] = useState<string>("");
  const [payMethod, setPayMethod] = useState<string>("bank_transfer");
  const [payReference, setPayReference] = useState<string>("");
  const [payNotes, setPayNotes] = useState<string>("");

  // Keyboard shortcut listener for Ctrl + K / Cmd + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Save workspace memory to localStorage on changes
  useEffect(() => {
    try {
      localStorage.setItem(
        MEMORY_STORAGE_KEY,
        JSON.stringify({
          searchTerm,
          projectFilter,
          stageFilter,
          executiveFilter,
          selectedBookingId,
        }),
      );
    } catch (e) {
      // ignore storage errors
    }
  }, [searchTerm, projectFilter, stageFilter, executiveFilter, selectedBookingId]);

  // Role Scoped Bookings
  const scopedBookings = useMemo(() => {
    return bookings.filter((b) => isLeadVisible(role, userId, b.owner_id || null));
  }, [bookings, role, userId]);

  // Enriched Revenue Records
  const enrichedRecords = useMemo(() => {
    return scopedBookings.map((b) => {
      const inv = b.invoice;
      const invId = inv?.id || `inv-${b.id}`;
      const invNumber =
        inv?.invoice_number ||
        `INV-2026-${b.id
          .replace(/[^a-zA-Z0-9]/g, "")
          .slice(-4)
          .padStart(4, "0")}/BLX`;

      const bookingStatus = b.booking?.payment_status || "pending";
      const isIssued =
        inv?.status === "issued" ||
        inv?.status === "paid" ||
        inv?.status === "partially_paid" ||
        b.is_locked;

      const invStatus =
        inv?.status || (bookingStatus === "completed" ? "paid" : isIssued ? "issued" : "unissued");

      const totalBilled = inv?.amount || b.amount || 0;
      const amountPaid =
        inv?.amount_paid || (invStatus === "paid" || bookingStatus === "completed" ? totalBilled : 0);
      const outstandingAmount =
        inv?.outstanding_amount !== undefined
          ? inv.outstanding_amount
          : invStatus === "paid" || bookingStatus === "completed"
            ? 0
            : totalBilled;

      let lifecycleStage: "booking_initiated" | "invoice_issued" | "partially_paid" | "paid" | "void" =
        "booking_initiated";

      if (invStatus === "cancelled" || bookingStatus === "void") {
        lifecycleStage = "void";
      } else if (invStatus === "paid" || bookingStatus === "completed") {
        lifecycleStage = "paid";
      } else if (invStatus === "partially_paid") {
        lifecycleStage = "partially_paid";
      } else if (isIssued || invStatus === "issued") {
        lifecycleStage = "invoice_issued";
      }

      const ownerUser = crmUsers.find((u) => u.id === b.owner_id || u.name === b.owner_id);
      const ownerName = ownerUser ? ownerUser.name : b.owner_id || "Unassigned";

      return {
        ...b,
        ownerName,
        invoiceId: invId,
        invoiceNumber: invNumber,
        isIssued,
        invoiceStatus: invStatus,
        lifecycleStage,
        totalBilled,
        amountPaid,
        outstandingAmount,
        dueDate: inv?.due_date || new Date(Date.now() + 15 * 86400000).toISOString(),
        issuedAt: inv?.issued_at || b.booking_date || new Date().toISOString(),
        payments: inv?.payments || [],
      };
    });
  }, [scopedBookings, crmUsers]);

  // Natural Language AI Search Parsing Logic
  const filteredRecords = useMemo(() => {
    return enrichedRecords.filter((item) => {
      const rawTerm = searchTerm.trim().toLowerCase();
      if (!rawTerm) return true;

      // Natural language Intent Parsing
      if (rawTerm.includes("unpaid") || rawTerm.includes("pending") || rawTerm.includes("due")) {
        if (item.outstandingAmount <= 0) return false;
      }
      if (rawTerm.includes("paid") || rawTerm.includes("cleared")) {
        if (item.lifecycleStage !== "paid") return false;
      }
      if (rawTerm.includes("locked")) {
        if (!item.is_locked) return false;
      }
      if (rawTerm.includes("high value") || rawTerm.includes("above 10 lakh")) {
        if (item.totalBilled < 1000000) return false;
      }

      // Normal multi-term matching
      const matchesSearch =
        item.customer_name.toLowerCase().includes(rawTerm) ||
        (item.customer_phone && item.customer_phone.toLowerCase().includes(rawTerm)) ||
        (item.customer_email && item.customer_email.toLowerCase().includes(rawTerm)) ||
        item.unit_number.toLowerCase().includes(rawTerm) ||
        item.project_name.toLowerCase().includes(rawTerm) ||
        item.id.toLowerCase().includes(rawTerm) ||
        item.invoiceNumber.toLowerCase().includes(rawTerm) ||
        item.ownerName.toLowerCase().includes(rawTerm);

      const matchesProject = projectFilter === "all" || item.project_name === projectFilter;
      const matchesExec =
        executiveFilter === "all" || item.owner_id === executiveFilter || item.ownerName === executiveFilter;

      let matchesStage = true;
      if (stageFilter !== "all") {
        if (stageFilter === "booking_initiated") matchesStage = item.lifecycleStage === "booking_initiated";
        else if (stageFilter === "invoice_issued") matchesStage = item.lifecycleStage === "invoice_issued";
        else if (stageFilter === "partially_paid") matchesStage = item.lifecycleStage === "partially_paid";
        else if (stageFilter === "paid") matchesStage = item.lifecycleStage === "paid";
        else if (stageFilter === "void") matchesStage = item.lifecycleStage === "void";
      }

      return matchesSearch && matchesProject && matchesExec && matchesStage;
    });
  }, [enrichedRecords, searchTerm, projectFilter, stageFilter, executiveFilter]);

  // Executive Revenue Cockpit KPIs & Health Calculator
  const cockpitMetrics = useMemo(() => {
    const active = filteredRecords.filter((r) => r.lifecycleStage !== "void");
    const totalSales = active.reduce((sum, r) => sum + r.totalBilled, 0);
    const totalCollected = active.reduce((sum, r) => sum + r.amountPaid, 0);
    const totalOutstanding = Math.max(0, totalSales - totalCollected);
    const collectionRate = totalSales > 0 ? (totalCollected / totalSales) * 100 : 100;

    let healthStatus: "Healthy" | "Moderate" | "Action Needed" = "Healthy";
    if (collectionRate < 70) healthStatus = "Action Needed";
    else if (collectionRate < 85) healthStatus = "Moderate";

    const highRiskCount = active.filter(
      (r) => r.outstandingAmount > 0 && r.lifecycleStage === "invoice_issued",
    ).length;

    const expectedToday = active
      .filter((r) => r.outstandingAmount > 0)
      .reduce((sum, r) => sum + Math.round(r.outstandingAmount * 0.2), 0);

    return {
      healthStatus,
      collectionRate: collectionRate.toFixed(1),
      totalSales,
      totalCollected,
      totalOutstanding,
      highRiskCount,
      expectedToday,
      activeUnits: active.length,
    };
  }, [filteredRecords]);



  // Collections Funnel Pipeline Data
  const funnelPipeline = useMemo(() => {
    const total = enrichedRecords.length;
    const invoiced = enrichedRecords.filter((r) => r.isIssued).length;
    const partial = enrichedRecords.filter((r) => r.amountPaid > 0).length;
    const completed = enrichedRecords.filter((r) => r.lifecycleStage === "paid").length;
    const locked = enrichedRecords.filter((r) => r.is_locked).length;

    return { total, invoiced, partial, completed, locked };
  }, [enrichedRecords]);

  // Selected Record Object
  const selectedRecord = useMemo(() => {
    if (!filteredRecords.length) return null;
    if (selectedBookingId) {
      const found = filteredRecords.find((r) => r.id === selectedBookingId);
      if (found) return found;
    }
    return filteredRecords[0];
  }, [filteredRecords, selectedBookingId]);

  // Project Analytics Data
  const projectRevenue = useMemo(() => {
    return projects.map((p) => {
      const pRecords = filteredRecords.filter((r) => r.project_name === p.name);
      const unitsSold = pRecords.length;
      const totalRev = pRecords.reduce((sum, r) => sum + r.totalBilled, 0);
      const collected = pRecords.reduce((sum, r) => sum + r.amountPaid, 0);
      const pending = Math.max(0, totalRev - collected);
      const pct = totalRev > 0 ? Math.round((collected / totalRev) * 100) : 100;

      return { id: p.id, name: p.name, unitsSold, totalRev, collected, pending, pct };
    });
  }, [projects, filteredRecords]);

  // Executive Leaderboard Data
  const executivePerformance = useMemo(() => {
    const salesExecs = crmUsers.filter(
      (u) => u.role === "sales_executive" || u.role === "manager" || u.role === "super_admin",
    );
    return salesExecs
      .map((exec) => {
        const eBookings = filteredRecords.filter(
          (b) => b.owner_id === exec.name || b.owner_id === exec.id || b.ownerName === exec.name,
        );
        const salesVal = eBookings.reduce((sum, b) => sum + b.totalBilled, 0);
        const collectedVal = eBookings.reduce((sum, b) => sum + b.amountPaid, 0);
        const outstandingVal = Math.max(0, salesVal - collectedVal);
        const rate = salesVal > 0 ? Math.round((collectedVal / salesVal) * 100) : 100;

        return {
          id: exec.id,
          name: exec.name,
          role: exec.role,
          dealsCount: eBookings.length,
          salesVal,
          collectedVal,
          outstandingVal,
          rate,
        };
      })
      .filter((exec) => exec.dealsCount > 0 || executiveFilter === "all")
      .sort((a, b) => b.collectedVal - a.collectedVal);
  }, [crmUsers, filteredRecords, executiveFilter]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatShortCurrency = (val: number) => {
    if (!val || val === 0) return "₹0 L";
    const abs = Math.abs(val);
    if (abs >= 10000000) {
      const cr = val / 10000000;
      return `₹${cr.toFixed(2).replace(/\.00$/, "")} Cr`;
    }
    const lakh = val / 100000;
    return `₹${lakh.toFixed(1).replace(/\.0$/, "")} L`;
  };

  // Bulk Operations Handlers
  const handleToggleSelectAll = () => {
    if (selectedRecordIds.length === filteredRecords.length) {
      setSelectedRecordIds([]);
    } else {
      setSelectedRecordIds(filteredRecords.map((r) => r.id));
    }
  };

  const handleToggleSelectRecord = (id: string) => {
    setSelectedRecordIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleBulkExportCSV = () => {
    if (!selectedRecordIds.length) {
      toast.info("No records selected for export.");
      return;
    }
    const items = filteredRecords.filter((r) => selectedRecordIds.includes(r.id));
    const header = "Booking ID,Customer,Phone,Project,Unit,Billed,Paid,Outstanding,Stage,Invoice Number\n";
    const rows = items
      .map(
        (i) =>
          `"${i.id}","${i.customer_name}","${i.customer_phone || ""}","${i.project_name}","${i.unit_number}",${i.totalBilled},${i.amountPaid},${i.outstandingAmount},"${i.lifecycleStage}","${i.invoiceNumber}"`,
      )
      .join("\n");

    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `RevOps_Bulk_Export_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    toast.success(`Exported ${items.length} records to CSV!`);
  };

  // Tax Invoice Issuance Handler
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

    if (item.isIssued) {
      toast.info(`Invoice ${item.invoiceNumber} is officially issued & locked.`);
      downloadPdfInvoice(
        {
          bookingId: item.id,
          customerName: item.customer_name,
          customerPhone: item.customer_phone,
          customerEmail: item.customer_email,
          projectName: item.project_name,
          unitNumber: item.unit_number,
          amount: item.totalBilled,
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
      toast.loading("Issuing official tax invoice & locking booking contract...", {
        id: "issue-inv",
      });
      const snapshot = {
        customer_name: selectedBookingForInvoice.customer_name,
        customer_phone: selectedBookingForInvoice.customer_phone,
        customer_email: selectedBookingForInvoice.customer_email,
        project_name: selectedBookingForInvoice.project_name,
        unit_number: selectedBookingForInvoice.unit_number,
        amount: selectedBookingForInvoice.totalBilled,
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

      downloadPdfInvoice(
        {
          bookingId: selectedBookingForInvoice.id,
          customerName: selectedBookingForInvoice.customer_name,
          customerPhone: selectedBookingForInvoice.customer_phone,
          customerEmail: selectedBookingForInvoice.customer_email,
          projectName: selectedBookingForInvoice.project_name,
          unitNumber: selectedBookingForInvoice.unit_number,
          amount: selectedBookingForInvoice.totalBilled,
          paymentStatus: selectedBookingForInvoice.booking?.payment_status,
        },
        invoiceSettings,
      );

      setSelectedBookingForInvoice(null);
    } catch (err: any) {
      toast.error(err?.message || "Failed to issue tax invoice.", { id: "issue-inv" });
    }
  };

  // Record Payment Handler
  const handleOpenPaymentModal = (item: any) => {
    setSelectedInvoiceForPayment(item);
    setPayAmount(String(item.outstandingAmount > 0 ? item.outstandingAmount : item.totalBilled));
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
      toast.loading("Recording collection payment & issuing official receipt...", { id: "rec-pay" });
      await recordPaymentMutation.mutateAsync({
        invoiceId: selectedInvoiceForPayment.invoiceId,
        amount: amt,
        paymentMethod: payMethod,
        reference: payReference.trim() || `TXN-${Date.now()}`,
        notes: payNotes.trim(),
      });

      toast.success(`Payment of ₹${amt.toLocaleString("en-IN")} recorded successfully!`, {
        id: "rec-pay",
      });

      generatePaymentReceiptPdf(
        {
          receiptNumber: `RCPT-2026-${Math.floor(10000 + Math.random() * 90000)}`,
          invoiceNumber: selectedInvoiceForPayment.invoiceNumber,
          customerName: selectedInvoiceForPayment.customer_name,
          projectName: selectedInvoiceForPayment.project_name,
          unitNumber: selectedInvoiceForPayment.unit_number,
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

  // Cancel Invoice Handler
  const handleCancelInvoice = async (item: any) => {
    const reason = window.prompt(
      `Enter reason for cancelling official invoice ${item.invoiceNumber}:`,
    );
    if (!reason || !reason.trim()) {
      toast.info("Invoice cancellation aborted.");
      return;
    }

    try {
      toast.loading("Cancelling tax invoice & unlocking contract...", { id: "canc-inv" });
      await cancelInvoiceMutation.mutateAsync({
        invoiceId: item.invoiceId,
        reason: reason.trim(),
      });
      toast.success(`Invoice ${item.invoiceNumber} cancelled. Booking contract unlocked.`, {
        id: "canc-inv",
      });
    } catch (err: any) {
      toast.error(err?.message || "Failed to cancel invoice.", { id: "canc-inv" });
    }
  };

  return (
    <AppShell
      title={titleOverride || "Enterprise Revenue Operations Workspace"}
      subtitle={
        subtitleOverride ||
        "Native Enterprise ERP Operating System with Real-Time Revenue Cockpit & AI Intelligence"
      }
    >
      <div className="space-y-5 pb-16">
        {/* TOP PANEL: Revenue Intelligence Cockpit & Universal Search Bar */}
        <div className="bg-card rounded-2xl border border-border p-5 shadow-xs space-y-4">
          {/* Header & Ctrl+K Shortcut Trigger */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold border border-primary/20 shadow-xs">
                <Zap className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-brand font-extrabold text-lg tracking-tight text-foreground">
                    Revenue Operations Intelligence OS
                  </h2>
                  <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20 font-bold">
                    {userCan.roleLabel()}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Press <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-muted rounded border font-semibold text-foreground">Ctrl + K</kbd> anywhere for instant AI Command Palette
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCommandPaletteOpen(true)}
                className="gap-1.5 text-xs font-semibold h-9"
              >
                <Command className="h-3.5 w-3.5 text-primary" /> Command Palette (Ctrl + K)
              </Button>

              {userCan.viewInvoiceCMS() && (
                <Link to="/invoice-cms">
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs font-semibold h-9">
                    <Settings className="h-3.5 w-3.5 text-primary" /> Invoice CMS Engine
                  </Button>
                </Link>
              )}
            </div>
          </div>

          {/* Revenue Health Cockpit Meter */}
          <div className="p-4 rounded-xl border bg-muted/20 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
            <div className="lg:col-span-4 space-y-1.5 border-r border-border/60 pr-4">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-muted-foreground uppercase tracking-wider text-[10px]">
                  Revenue Health Index
                </span>
                <Badge
                  className={`text-[10px] font-bold ${
                    cockpitMetrics.healthStatus === "Healthy"
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                      : "bg-amber-500/10 text-amber-600 border-amber-500/30"
                  }`}
                >
                  {cockpitMetrics.healthStatus} ({cockpitMetrics.collectionRate}%)
                </Badge>
              </div>

              {/* Visual Health Gauge Bar */}
              <div className="w-full bg-muted h-3 rounded-full overflow-hidden flex">
                <div
                  className="bg-emerald-600 h-full transition-all duration-500"
                  style={{ width: `${Math.min(100, parseFloat(cockpitMetrics.collectionRate))}%` }}
                />
              </div>

              <div className="text-[10px] text-muted-foreground flex justify-between font-mono pt-0.5">
                <span>Collections Efficiency</span>
                <span>Target: 90.0%</span>
              </div>
            </div>

            <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-0.5">
                <div className="text-[10px] font-bold uppercase text-muted-foreground">Invoiced Revenue</div>
                <div className="text-sm font-extrabold font-display">{formatCurrency(cockpitMetrics.totalSales)}</div>
                <div className="text-[10px] text-muted-foreground font-mono">{cockpitMetrics.activeUnits} active bookings</div>
              </div>

              <div className="space-y-0.5">
                <div className="text-[10px] font-bold uppercase text-emerald-600">Escrow Cleared</div>
                <div className="text-sm font-extrabold font-display text-emerald-600">{formatCurrency(cockpitMetrics.totalCollected)}</div>
                <div className="text-[10px] text-emerald-600 font-semibold font-mono">Cleared Receipts</div>
              </div>

              <div className="space-y-0.5">
                <div className="text-[10px] font-bold uppercase text-amber-600">High Risk Overdue</div>
                <div className="text-sm font-extrabold font-display text-amber-600">{cockpitMetrics.highRiskCount} Accounts</div>
                <div className="text-[10px] text-amber-600 font-semibold font-mono">{formatCurrency(cockpitMetrics.totalOutstanding)}</div>
              </div>

              <div className="space-y-0.5">
                <div className="text-[10px] font-bold uppercase text-primary">Expected Today</div>
                <div className="text-sm font-extrabold font-display text-foreground">{formatCurrency(cockpitMetrics.expectedToday)}</div>
                <div className="text-[10px] text-muted-foreground font-mono">Estimated Inflows</div>
              </div>
            </div>
          </div>



          {/* Universal Search & Global Filter Bar */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1">
            <div className="md:col-span-4 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search (Try 'unpaid', 'overdue', 'above 10 lakh', unit #, UTR...)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 text-xs h-9 bg-card border-border/80 font-medium"
              />
            </div>

            <div className="md:col-span-3">
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger className="h-9 text-xs font-semibold">
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Property Projects</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.name}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-3">
              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger className="h-9 text-xs font-semibold">
                  <SelectValue placeholder="All Lifecycle Stages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Lifecycle Stages</SelectItem>
                  <SelectItem value="booking_initiated">1. Booking Initiated</SelectItem>
                  <SelectItem value="invoice_issued">2. Tax Invoice Issued</SelectItem>
                  <SelectItem value="partially_paid">3. Partially Paid</SelectItem>
                  <SelectItem value="paid">4. Cleared / Paid (100%)</SelectItem>
                  <SelectItem value="void">Void / Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <Select value={executiveFilter} onValueChange={setExecutiveFilter}>
                <SelectTrigger className="h-9 text-xs font-semibold">
                  <SelectValue placeholder="All Executives" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Executives</SelectItem>
                  {crmUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Smart Action Recommendation Desk */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div
            onClick={() => {
              const pending = enrichedRecords.find((r) => !r.isIssued && r.lifecycleStage !== "void");
              if (pending) {
                setSelectedBookingId(pending.id);
                setStageFilter("booking_initiated");
                handleOpenIssueModal(pending);
              } else {
                toast.info("All active booking contracts have official tax invoices issued.");
              }
            }}
            className="p-3.5 rounded-xl border bg-card hover:bg-muted/40 cursor-pointer transition-all flex items-center justify-between shadow-xs border-primary/20 hover:border-primary/50"
          >
            <div className="space-y-0.5">
              <div className="text-[10px] font-bold uppercase text-muted-foreground">Smart Recommendation</div>
              <div className="text-xs font-bold text-foreground">Issue Pending Tax Invoices</div>
            </div>
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Receipt className="h-4 w-4" />
            </div>
          </div>

          <div
            onClick={() => {
              const overdue = enrichedRecords.find((r) => r.outstandingAmount > 0 && r.lifecycleStage !== "void");
              if (overdue) {
                setSelectedBookingId(overdue.id);
                setStageFilter("invoice_issued");
                setSearchTerm("unpaid");
                toast.success(`Focused overdue account for ${overdue.customer_name} (Unit ${overdue.unit_number}).`);
              } else {
                toast.info("No overdue accounts currently requiring follow up.");
              }
            }}
            className="p-3.5 rounded-xl border bg-card hover:bg-muted/40 cursor-pointer transition-all flex items-center justify-between shadow-xs border-amber-500/20 hover:border-amber-500/50"
          >
            <div className="space-y-0.5">
              <div className="text-[10px] font-bold uppercase text-amber-600">Smart Recommendation</div>
              <div className="text-xs font-bold text-foreground">Follow Up Overdue Accounts</div>
            </div>
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Phone className="h-4 w-4" />
            </div>
          </div>

          <div
            onClick={() => {
              const target = selectedRecord || enrichedRecords.find((r) => r.isIssued && r.lifecycleStage !== "void");
              if (target) {
                setSelectedBookingId(target.id);
                downloadDemandLetterPdf(
                  {
                    demandNumber: `DEM-2026-${Math.floor(1000 + Math.random() * 9000)}`,
                    bookingId: target.id,
                    customerName: target.customer_name,
                    customerPhone: target.customer_phone,
                    customerEmail: target.customer_email,
                    projectName: target.project_name,
                    unitNumber: target.unit_number,
                    milestoneName: "Plinth / Slab 1 Completion (15%)",
                    milestoneAmount: Math.round(target.totalBilled * 0.15),
                    dueDate: new Date(Date.now() + 15 * 86400000).toISOString(),
                  },
                  invoiceSettings,
                );
                toast.success(`Generated Milestone Demand Letter PDF for ${target.customer_name} (Unit ${target.unit_number})!`);
              } else {
                toast.info("No active issued record available for demand letter generation.");
              }
            }}
            className="p-3.5 rounded-xl border bg-card hover:bg-muted/40 cursor-pointer transition-all flex items-center justify-between shadow-xs border-rose-500/20 hover:border-rose-500/50"
          >
            <div className="space-y-0.5">
              <div className="text-[10px] font-bold uppercase text-rose-600">Smart Recommendation</div>
              <div className="text-xs font-bold text-foreground">Issue Milestone Demand Letter</div>
            </div>
            <div className="h-8 w-8 rounded-lg bg-rose-500/10 text-rose-600 flex items-center justify-center">
              <FileText className="h-4 w-4" />
            </div>
          </div>

          <div
            onClick={() => {
              const target =
                (selectedRecord && selectedRecord.outstandingAmount > 0 ? selectedRecord : null) ||
                enrichedRecords.find((r) => r.outstandingAmount > 0 && r.lifecycleStage !== "void");

              if (target) {
                setSelectedBookingId(target.id);
                handleOpenPaymentModal(target);
              } else {
                toast.info("All active invoices are 100% paid and cleared!");
              }
            }}
            className="p-3.5 rounded-xl border bg-card hover:bg-muted/40 cursor-pointer transition-all flex items-center justify-between shadow-xs border-emerald-500/20 hover:border-emerald-500/50"
          >
            <div className="space-y-0.5">
              <div className="text-[10px] font-bold uppercase text-emerald-600">Smart Recommendation</div>
              <div className="text-xs font-bold text-foreground">Record Today's Clearance</div>
            </div>
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
        </div>

        {/* Visual Collections Funnel Pipeline */}
        <div className="p-4 rounded-xl border bg-card shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-muted-foreground uppercase tracking-wider text-[10px] flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-primary" /> Collections Conversion Pipeline
            </span>
            <span className="text-muted-foreground font-mono">{funnelPipeline.total} Total Bookings</span>
          </div>

          <div className="grid grid-cols-5 gap-2 text-center text-xs font-mono pt-1">
            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <div className="font-extrabold text-blue-600 text-sm">{funnelPipeline.total}</div>
              <div className="text-[10px] text-muted-foreground">Booked</div>
            </div>
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="font-extrabold text-amber-600 text-sm">{funnelPipeline.invoiced}</div>
              <div className="text-[10px] text-muted-foreground">Invoiced</div>
            </div>
            <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <div className="font-extrabold text-purple-600 text-sm">{funnelPipeline.partial}</div>
              <div className="text-[10px] text-muted-foreground">Partial Pay</div>
            </div>
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <div className="font-extrabold text-emerald-600 text-sm">{funnelPipeline.completed}</div>
              <div className="text-[10px] text-muted-foreground">100% Cleared</div>
            </div>
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
              <div className="font-extrabold text-primary text-sm">{funnelPipeline.locked}</div>
              <div className="text-[10px] text-muted-foreground">Locked 🔒</div>
            </div>
          </div>
        </div>

        {/* MAIN MULTI-PANEL ERP WORKSPACE */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* LEFT PANEL: Master Revenue Operations Ledger (Selector Desk & Bulk Ops) */}
          <div className="lg:col-span-4 space-y-3">
            <Card className="border-border/60 shadow-xs overflow-hidden">
              <CardHeader className="py-3 px-4 bg-muted/30 border-b space-y-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-primary" /> Revenue Ledger
                  </CardTitle>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[10px] px-1.5"
                      onClick={handleToggleSelectAll}
                    >
                      {selectedRecordIds.length === filteredRecords.length ? "Deselect All" : "Select All"}
                    </Button>
                    <Badge variant="outline" className="text-[10px] font-mono font-bold">
                      {filteredRecords.length}
                    </Badge>
                  </div>
                </div>

                {/* Bulk Operations Action Bar */}
                {selectedRecordIds.length > 0 && (
                  <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-between text-xs animate-in fade-in">
                    <span className="font-bold text-primary text-[11px]">
                      {selectedRecordIds.length} Selected
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px] font-bold gap-1 text-primary border-primary/30"
                      onClick={handleBulkExportCSV}
                    >
                      <FolderDown className="h-3 w-3" /> Bulk Export CSV
                    </Button>
                  </div>
                )}
              </CardHeader>

              <div className="max-h-[620px] overflow-y-auto divide-y divide-border/40 scrollbar-thin">
                {isBookingsLoading ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    Loading Revenue Records...
                  </div>
                ) : filteredRecords.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground space-y-1">
                    <p className="font-semibold text-foreground">No records match criteria</p>
                    <p className="text-[11px]">Adjust search or filter selections.</p>
                  </div>
                ) : (
                  filteredRecords.map((item) => {
                    const isSelected = selectedRecord?.id === item.id;
                    const isChecked = selectedRecordIds.includes(item.id);

                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedBookingId(item.id)}
                        className={`p-3.5 cursor-pointer transition-all ${
                          isSelected
                            ? "bg-primary/10 border-l-4 border-l-primary"
                            : "hover:bg-muted/30"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleSelectRecord(item.id);
                              }}
                              className="text-muted-foreground hover:text-foreground cursor-pointer"
                            >
                              {isChecked ? (
                                <CheckSquare className="h-3.5 w-3.5 text-primary" />
                              ) : (
                                <Square className="h-3.5 w-3.5" />
                              )}
                            </span>
                            <span className="font-mono text-[11px] font-bold text-primary flex items-center gap-1">
                              #BK-{item.id.slice(-6).toUpperCase()}
                              {item.is_locked && <Lock className="h-3 w-3 text-amber-500" />}
                            </span>
                          </div>
                          <div className="font-mono text-[11px] font-bold text-foreground">
                            ₹{item.totalBilled.toLocaleString("en-IN")}
                          </div>
                        </div>

                        <div className="font-bold text-xs text-foreground mt-1 truncate">
                          {item.customer_name}
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
                          <span className="truncate">{item.project_name} · Unit {item.unit_number}</span>
                          <span className="font-mono font-semibold text-emerald-600">
                            Paid: ₹{item.amountPaid.toLocaleString("en-IN")}
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-2 mt-2 border-t border-border/30">
                          {item.lifecycleStage === "booking_initiated" && (
                            <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-[9px] py-0">
                              Booking Initiated
                            </Badge>
                          )}
                          {item.lifecycleStage === "invoice_issued" && (
                            <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[9px] py-0">
                              Inv Issued ({item.invoiceNumber})
                            </Badge>
                          )}
                          {item.lifecycleStage === "partially_paid" && (
                            <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20 text-[9px] py-0">
                              Partially Paid
                            </Badge>
                          )}
                          {item.lifecycleStage === "paid" && (
                            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[9px] py-0">
                              ✓ Paid Cleared
                            </Badge>
                          )}
                          {item.lifecycleStage === "void" && (
                            <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 text-[9px] py-0 line-through">
                              Cancelled
                            </Badge>
                          )}

                          <span className="text-[10px] text-muted-foreground font-mono">
                            Exec: {item.ownerName.split(" ")[0]}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          </div>

          {/* CENTER PANEL: 360° Financial Journey, Timeline & Central Document Vault */}
          <div className="lg:col-span-5 space-y-4">
            <Card className="border-border/60 shadow-xs">
              <CardHeader className="py-3 px-4 bg-muted/30 border-b flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-primary" /> 360° Financial Journey & Document Vault
                </CardTitle>
                {selectedRecord && (
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {selectedRecord.invoiceNumber}
                  </Badge>
                )}
              </CardHeader>

              <CardContent className="p-4 space-y-5">
                {selectedRecord ? (
                  <>
                    {/* Customer Banner */}
                    <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="font-extrabold text-sm text-foreground">
                          {selectedRecord.customer_name}
                        </div>
                        <Badge className="bg-primary text-primary-foreground text-[9px] font-mono">
                          #BK-{selectedRecord.id.slice(-6).toUpperCase()}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground font-mono flex items-center gap-2">
                        <span>Project: <strong>{selectedRecord.project_name}</strong></span>
                        <span>·</span>
                        <span>Unit: <strong className="text-primary">{selectedRecord.unit_number}</strong></span>
                      </div>
                    </div>

                    {/* Milestone Life-Cycle Timeline */}
                    <div className="space-y-3">
                      <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <History className="h-3.5 w-3.5 text-primary" /> Financial Lifecycle Timeline
                      </h4>

                      <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                        <div className="relative">
                          <div className="absolute -left-6 top-0.5 h-5 w-5 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center">
                            ✓
                          </div>
                          <div className="text-xs space-y-0.5">
                            <div className="font-bold text-foreground">1. Booking Agreement Initiated</div>
                            <div className="text-[10px] text-muted-foreground">
                              Contract Value: ₹{selectedRecord.totalBilled.toLocaleString("en-IN")}
                            </div>
                          </div>
                        </div>

                        <div className="relative">
                          <div
                            className={`absolute -left-6 top-0.5 h-5 w-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                              selectedRecord.isIssued
                                ? "bg-emerald-500 text-white"
                                : "bg-muted border text-muted-foreground"
                            }`}
                          >
                            {selectedRecord.isIssued ? "✓" : "2"}
                          </div>
                          <div className="text-xs space-y-0.5">
                            <div className="font-bold text-foreground flex items-center gap-1.5">
                              <span>2. Official Tax Invoice & Contract Lock</span>
                              {selectedRecord.is_locked && <Lock className="h-3 w-3 text-amber-500" />}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {selectedRecord.isIssued
                                ? `Invoice ${selectedRecord.invoiceNumber} issued on ${new Date(selectedRecord.issuedAt).toLocaleDateString("en-IN")}`
                                : "Awaiting tax invoice issuance"}
                            </div>
                          </div>
                        </div>

                        <div className="relative">
                          <div
                            className={`absolute -left-6 top-0.5 h-5 w-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                              selectedRecord.isIssued
                                ? "bg-blue-500 text-white"
                                : "bg-muted border text-muted-foreground"
                            }`}
                          >
                            {selectedRecord.isIssued ? "✓" : "3"}
                          </div>
                          <div className="text-xs space-y-0.5">
                            <div className="font-bold text-foreground">3. Milestone Demand Letter</div>
                            <div className="text-[10px] text-muted-foreground">
                              Plinth Milestone (15% = ₹{Math.round(selectedRecord.totalBilled * 0.15).toLocaleString("en-IN")})
                            </div>
                          </div>
                        </div>

                        <div className="relative">
                          <div
                            className={`absolute -left-6 top-0.5 h-5 w-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                              selectedRecord.lifecycleStage === "paid"
                                ? "bg-emerald-500 text-white"
                                : selectedRecord.amountPaid > 0
                                  ? "bg-purple-500 text-white"
                                  : "bg-muted border text-muted-foreground"
                            }`}
                          >
                            {selectedRecord.lifecycleStage === "paid" ? "✓" : "4"}
                          </div>
                          <div className="text-xs space-y-0.5">
                            <div className="font-bold text-foreground">4. Collection Clearance & Escrow Receipt</div>
                            <div className="text-[10px] font-mono">
                              <span className="text-emerald-600 font-bold">
                                Received: ₹{selectedRecord.amountPaid.toLocaleString("en-IN")}
                              </span>{" "}
                              ·{" "}
                              <span className="text-amber-600 font-bold">
                                Due: ₹{selectedRecord.outstandingAmount.toLocaleString("en-IN")}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Centralized Document Vault per Record */}
                    <div className="space-y-2 pt-2 border-t border-border/60">
                      <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <FileCheck className="h-3.5 w-3.5 text-primary" /> Centralized Document Vault
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div
                          onClick={() => handleOpenIssueModal(selectedRecord)}
                          className="p-2.5 rounded-lg border bg-card hover:bg-muted/30 cursor-pointer flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-primary" />
                            <div>
                              <div className="font-bold text-[11px]">Tax Invoice PDF</div>
                              <div className="text-[9px] text-muted-foreground font-mono">{selectedRecord.invoiceNumber}</div>
                            </div>
                          </div>
                          <Download className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>

                        <div
                          onClick={() => {
                            downloadDemandLetterPdf(
                              {
                                demandNumber: `DEM-2026-${Math.floor(1000 + Math.random() * 9000)}`,
                                bookingId: selectedRecord.id,
                                customerName: selectedRecord.customer_name,
                                customerPhone: selectedRecord.customer_phone,
                                customerEmail: selectedRecord.customer_email,
                                projectName: selectedRecord.project_name,
                                unitNumber: selectedRecord.unit_number,
                                milestoneName: "Plinth / Slab 1 Completion (15%)",
                                milestoneAmount: Math.round(selectedRecord.totalBilled * 0.15),
                                dueDate: new Date(Date.now() + 15 * 86400000).toISOString(),
                              },
                              invoiceSettings,
                            );
                          }}
                          className="p-2.5 rounded-lg border bg-card hover:bg-muted/30 cursor-pointer flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-rose-500" />
                            <div>
                              <div className="font-bold text-[11px]">Demand Letter PDF</div>
                              <div className="text-[9px] text-muted-foreground font-mono">15% Milestone</div>
                            </div>
                          </div>
                          <Download className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="p-12 text-center text-xs text-muted-foreground">
                    Select a record from the ledger to view full financial journey.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT PANEL: Contextual Record Inspector & Action Palette */}
          <div className="lg:col-span-3 space-y-4">
            <Card className="border-border/60 shadow-xs">
              <CardHeader className="py-3 px-4 bg-muted/30 border-b">
                <CardTitle className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5 text-primary" /> Contextual Inspector & Actions
                </CardTitle>
              </CardHeader>

              <CardContent className="p-4 space-y-4">
                {selectedRecord ? (
                  <>
                    <div className="space-y-2">
                      <h5 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Customer & Allocation
                      </h5>
                      <div className="p-3 rounded-xl border bg-card space-y-1.5 text-xs">
                        <div className="font-bold text-foreground">{selectedRecord.customer_name}</div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {selectedRecord.customer_phone || "+91 98450 00000"}
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {selectedRecord.customer_email || "client@example.com"}
                        </div>
                        <div className="text-[11px] text-muted-foreground pt-1 border-t">
                          <strong>Owner Exec:</strong> {selectedRecord.ownerName}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h5 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Financial Position
                      </h5>
                      <div className="p-3 rounded-xl border bg-muted/20 space-y-1.5 text-xs font-mono">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Billed Value:</span>
                          <span className="font-bold">₹{selectedRecord.totalBilled.toLocaleString("en-IN")}</span>
                        </div>
                        <div className="flex justify-between text-emerald-600 font-bold">
                          <span>Cleared Paid:</span>
                          <span>₹{selectedRecord.amountPaid.toLocaleString("en-IN")}</span>
                        </div>
                        <div className="flex justify-between text-amber-600 font-bold pt-1 border-t">
                          <span>Balance Due:</span>
                          <span>₹{selectedRecord.outstandingAmount.toLocaleString("en-IN")}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t">
                      <h5 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Operational Actions
                      </h5>

                      <div className="space-y-2">
                        {!selectedRecord.isIssued ? (
                          <Button
                            size="sm"
                            className="w-full text-xs font-bold gap-1.5 bg-primary"
                            onClick={() => handleOpenIssueModal(selectedRecord)}
                          >
                            <Receipt className="h-3.5 w-3.5" /> Issue Tax Invoice & Lock
                          </Button>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full text-xs font-semibold gap-1.5 text-primary border-primary/30"
                              onClick={() => handleOpenIssueModal(selectedRecord)}
                            >
                              <Download className="h-3.5 w-3.5" /> Download Tax Inv PDF
                            </Button>

                            {selectedRecord.outstandingAmount > 0 && userCan.recordPayments() && (
                              <Button
                                size="sm"
                                className="w-full text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => handleOpenPaymentModal(selectedRecord)}
                              >
                                <DollarSign className="h-3.5 w-3.5" /> Record Payment
                              </Button>
                            )}

                            {userCan.cancelInvoices() && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="w-full text-xs text-destructive hover:bg-destructive/10"
                                onClick={() => handleCancelInvoice(selectedRecord)}
                              >
                                <Ban className="h-3.5 w-3.5" /> Cancel Official Invoice
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    Select a record to inspect.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* BOTTOM PANEL: Project Analytics & Executive Leaderboard */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-2">
          {/* Project Escrow Clearances */}
          <Card className="border-border/60 shadow-xs">
            <CardHeader className="py-3 px-4 bg-muted/30 border-b">
              <CardTitle className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Building className="h-3.5 w-3.5 text-primary" /> Project Escrow & Revenue Clearances
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {projectRevenue.map((p) => (
                <div key={p.id} className="p-3.5 rounded-xl border bg-card space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-xs text-foreground flex items-center gap-1.5">
                      <span>{p.name}</span>
                      <Badge variant="outline" className="text-[9px] bg-primary/5 text-primary border-primary/20">
                        {p.unitsSold} Units
                      </Badge>
                    </div>
                    <div className="font-mono text-xs font-bold text-foreground">
                      {formatShortCurrency(p.totalRev)}
                    </div>
                  </div>

                  <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-600 h-full transition-all duration-500"
                      style={{ width: `${p.pct}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-emerald-600 font-bold">
                      Collected: {formatShortCurrency(p.collected)} ({p.pct}%)
                    </span>
                    <span className="text-amber-600 font-bold">
                      Outstanding: {formatShortCurrency(p.pending)}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Executive Leaderboard */}
          <Card className="border-border/60 shadow-xs">
            <CardHeader className="py-3 px-4 bg-muted/30 border-b">
              <CardTitle className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Award className="h-3.5 w-3.5 text-amber-500" /> Executive Collection Performance Leaderboard
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="overflow-x-auto border rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/40 font-bold text-muted-foreground uppercase text-[9px]">
                    <tr>
                      <th className="p-2.5">Executive</th>
                      <th className="p-2.5 font-mono">Deals</th>
                      <th className="p-2.5 font-mono">Sales</th>
                      <th className="p-2.5 font-mono">Collected</th>
                      <th className="p-2.5">Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {executivePerformance.map((exec, index) => (
                      <tr key={exec.id} className="hover:bg-muted/20">
                        <td className="p-2.5 font-bold text-foreground flex items-center gap-2">
                          <span
                            className={`h-5 w-5 rounded-full text-[9px] font-bold flex items-center justify-center ${
                              index === 0
                                ? "bg-amber-500 text-white"
                                : index === 1
                                  ? "bg-slate-400 text-white"
                                  : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {index + 1}
                          </span>
                          <span>{exec.name}</span>
                        </td>
                        <td className="p-2.5 font-mono text-muted-foreground">{exec.dealsCount}</td>
                        <td className="p-2.5 font-mono font-bold text-foreground">
                          {formatShortCurrency(exec.salesVal)}
                        </td>
                        <td className="p-2.5 font-mono font-bold text-emerald-600">
                          {formatShortCurrency(exec.collectedVal)}
                        </td>
                        <td className="p-2.5">
                          <Badge
                            className={`text-[9px] ${
                              exec.rate >= 80
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                                : "bg-amber-500/10 text-amber-600 border-amber-500/30"
                            }`}
                          >
                            {exec.rate}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Ctrl + K Command Palette Dialog Modal */}
      <Dialog open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen}>
        <DialogContent className="max-w-xl bg-card rounded-xl border border-border shadow-2xl p-4">
          <DialogHeader className="pb-2 border-b">
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Command className="h-4 w-4 text-primary" /> Natural Language AI Command Palette
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Type command or natural language prompt (e.g. 'unpaid', 'overdue', 'above 10 lakh')..."
                value={commandQuery}
                onChange={(e) => setCommandQuery(e.target.value)}
                className="pl-9 text-xs h-10 font-medium"
              />
            </div>

            <div className="space-y-1 text-xs">
              <div className="text-[10px] font-bold uppercase text-muted-foreground px-1">
                Instant Actions & Filters
              </div>
              <div
                onClick={() => {
                  setSearchTerm("unpaid");
                  setCommandPaletteOpen(false);
                  toast.info("Filtered to unpaid accounts.");
                }}
                className="p-2 rounded-lg hover:bg-muted/30 cursor-pointer flex items-center justify-between"
              >
                <span>Filter Unpaid Overdue Accounts</span>
                <Badge variant="outline" className="text-[9px]">Filter</Badge>
              </div>

              <div
                onClick={() => {
                  setSearchTerm("above 10 lakh");
                  setCommandPaletteOpen(false);
                  toast.info("Filtered to high value transactions above ₹10 L.");
                }}
                className="p-2 rounded-lg hover:bg-muted/30 cursor-pointer flex items-center justify-between"
              >
                <span>Show High Value Transactions (&gt; ₹10 Lakhs)</span>
                <Badge variant="outline" className="text-[9px]">Filter</Badge>
              </div>

              <div
                onClick={() => {
                  handleBulkExportCSV();
                  setCommandPaletteOpen(false);
                }}
                className="p-2 rounded-lg hover:bg-muted/30 cursor-pointer flex items-center justify-between"
              >
                <span>Export Active Ledger Records to CSV</span>
                <Badge variant="outline" className="text-[9px]">Action</Badge>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tax Invoice Issuance Modal */}
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
              Issuing an official tax invoice locks the booking contract & establishes permanent financial records.
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
                  <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                    Booking #BK-{selectedBookingForInvoice.id.slice(-6).toUpperCase()}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground pt-1 font-mono">
                  <div>
                    <strong>Project:</strong> {selectedBookingForInvoice.project_name}
                  </div>
                  <div>
                    <strong>Unit:</strong> {selectedBookingForInvoice.unit_number}
                  </div>
                  <div className="col-span-2 font-bold text-foreground">
                    <strong>Billed Amount:</strong> ₹{(selectedBookingForInvoice.totalBilled || 0).toLocaleString("en-IN")}
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
                    Once issued, core booking parameters (Customer, Unit, Amount) will be locked from arbitrary edits.
                  </p>
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setSelectedBookingForInvoice(null)}>
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

      {/* Record Received Payment Modal */}
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
              Record a collection payment against tax invoice {selectedInvoiceForPayment?.invoiceNumber}.
            </DialogDescription>
          </DialogHeader>

          {selectedInvoiceForPayment && (
            <form onSubmit={handleRecordPaymentSubmit} className="space-y-4 mt-3">
              <div className="p-4 rounded-xl border bg-muted/40 space-y-2 text-xs">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="font-bold text-foreground">
                    {selectedInvoiceForPayment.customer_name}
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                    {selectedInvoiceForPayment.invoiceNumber}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground font-mono">
                  <div>
                    <strong>Total Invoiced:</strong> ₹{selectedInvoiceForPayment.totalBilled.toLocaleString("en-IN")}
                  </div>
                  <div>
                    <strong>Paid:</strong> ₹{selectedInvoiceForPayment.amountPaid.toLocaleString("en-IN")}
                  </div>
                  <div className="col-span-2 font-bold text-amber-600">
                    <strong>Outstanding Due:</strong> ₹{selectedInvoiceForPayment.outstandingAmount.toLocaleString("en-IN")}
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
                  placeholder="e.g. Cleared via Escrow account"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setSelectedInvoiceForPayment(null)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
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
