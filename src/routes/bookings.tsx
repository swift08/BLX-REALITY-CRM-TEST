import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import { useBookings, useProjects } from "@/lib/queries";
import { downloadPdfInvoice } from "@/lib/pdf-generator";
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
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export const Route = createFileRoute("/bookings")({
  head: () => ({ meta: [{ title: "Property Unit Bookings · BLX Realty CRM" }] }),
  component: PropertyBookingsPage,
});

function PropertyBookingsPage() {
  const { data: bookings = [], isLoading: isBookingsLoading } = useBookings();
  const { data: projects = [] } = useProjects();

  const [searchTerm, setSearchTerm] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Premium Dashboard Metrics
  const metrics = useMemo(() => {
    const active = bookings.filter((b) => b.booking?.payment_status !== "void");
    const totalVolume = active.reduce((sum, b) => sum + (b.booking?.amount || 0), 0);
    const completed = bookings
      .filter((b) => b.booking?.payment_status === "completed")
      .reduce((sum, b) => sum + (b.booking?.amount || 0), 0);
    const pending = bookings
      .filter((b) => b.booking?.payment_status === "pending")
      .reduce((sum, b) => sum + (b.booking?.amount || 0), 0);

    return {
      count: active.length,
      volume: totalVolume,
      completed,
      pending,
    };
  }, [bookings]);

  // Search & Filters logic
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
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
  }, [bookings, searchTerm, projectFilter, statusFilter]);

  const handleDownloadInvoice = async (item: any) => {
    try {
      const payload = {
        bookingId: item.booking?.id || item.id,
        leadId: item.lead_id,
        customerName: item.customer_name,
        projectName: item.project_name,
        unitNumber: item.unit_number,
        amount: item.booking?.amount || 0,
        paymentStatus: item.booking?.payment_status || "pending",
        bookingDate: item.booking?.booking_date,
      };

      toast.loading("Generating luxury Tax Invoice PDF...", { id: "invoice-pdf" });
      await downloadPdfInvoice(payload);
      toast.success("Tax Invoice PDF downloaded successfully!", { id: "invoice-pdf" });
    } catch (error: any) {
      toast.error(error?.message || "Failed to generate Tax Invoice PDF.", { id: "invoice-pdf" });
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <AppShell
      title="Property Unit Bookings"
      subtitle="Track token collections, sales agreements, and invoice generation for secured developer inventory."
    >
      <div className="space-y-6">
        {/* ── Key Metrics Cards ── */}
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

        {/* ── Search & Filter Panel ── */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 rounded-xl border border-border bg-card shadow-xs">
          <div className="flex items-center gap-2 h-9 px-3 rounded-lg bg-muted/40 border flex-1 max-w-md">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent outline-none text-xs flex-1 placeholder:text-muted-foreground/80"
              placeholder="Search by customer, unit number, or project..."
            />
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Project Filter */}
            <div className="flex items-center gap-1.5">
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

            {/* Status Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-muted-foreground uppercase">Status:</span>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 min-w-[130px] text-xs">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="void">Void</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* ── Ledger Table ── */}
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
                    Project
                  </TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Unit
                  </TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-right">
                    Booked Amount
                  </TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Booking Date
                  </TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Payment Status
                  </TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-center">
                    Invoice
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isBookingsLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-12 text-xs text-muted-foreground"
                    >
                      Loading unit bookings ledger...
                    </TableCell>
                  </TableRow>
                ) : filteredBookings.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
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

                    return (
                      <TableRow key={item.id} className="hover:bg-muted/10">
                        <TableCell className="font-mono text-[11px] font-bold text-muted-foreground">
                          #BK-{bookingIdShort}
                        </TableCell>
                        <TableCell className="font-semibold text-xs text-foreground">
                          {item.customer_name}
                        </TableCell>
                        <TableCell className="text-xs text-foreground flex items-center gap-1.5 py-3">
                          <Building className="h-3.5 w-3.5 text-muted-foreground/75" />
                          {item.project_name}
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge
                            variant="outline"
                            className="bg-primary/5 border-primary/20 text-primary text-[10px] font-mono font-bold"
                          >
                            {item.unit_number}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-bold text-foreground text-right">
                          {formatCurrency(item.booking?.amount || 0)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {item.booking?.booking_date
                            ? new Date(item.booking.booking_date).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                            : "N/A"}
                        </TableCell>
                        <TableCell>
                          {status === "completed" && (
                            <Badge className="bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 gap-1 text-[10px] font-bold">
                              <CheckCircle className="h-3 w-3" /> Completed
                            </Badge>
                          )}
                          {status === "pending" && (
                            <Badge className="bg-amber-500/10 hover:bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20 gap-1 text-[10px] font-bold">
                              <Clock className="h-3 w-3" /> Pending
                            </Badge>
                          )}
                          {status === "void" && (
                            <Badge className="bg-slate-500/10 hover:bg-slate-500/15 text-slate-500 border-slate-500/20 gap-1 text-[10px] font-bold">
                              <Ban className="h-3 w-3" /> Voided
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDownloadInvoice(item)}
                            className="h-8 w-8 text-primary hover:bg-primary/5 hover:text-primary rounded-lg"
                            title="Download Tax Invoice"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
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
    </AppShell>
  );
}
