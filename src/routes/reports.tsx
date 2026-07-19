import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileBarChart2,
  FileSpreadsheet,
  FileText,
  Download,
  Users,
  TrendingUp,
  Clock,
  CheckCircle,
  Building,
  Layers,
  Calendar,
} from "lucide-react";
import { useCustomers, useFollowups, useProjects, useBookings, useDevelopers } from "@/lib/queries";
import { toast } from "sonner";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Reports & Exports · BLX Realty CRM" }] }),
  component: ReportsPage,
});

type ReportCategory = "lead" | "sales" | "followup" | "conversion" | "developer" | "inventory";

const reportConfig: Record<
  ReportCategory,
  { title: string; subtitle: string; icon: any; color: string }
> = {
  lead: {
    title: "Lead Reports",
    subtitle: "Source distribution, temperatures, SLA compliance & dossier summaries",
    icon: Users,
    color: "text-blue-500 bg-blue-500/10",
  },
  sales: {
    title: "Sales Reports",
    subtitle: "Revenue generation, booked volume, collections & executive metrics",
    icon: TrendingUp,
    color: "text-emerald-500 bg-emerald-500/10",
  },
  followup: {
    title: "Follow-up Reports",
    subtitle: "Completed calls, site visits, overdue alerts & discussion summaries",
    icon: Clock,
    color: "text-amber-500 bg-amber-500/10",
  },
  conversion: {
    title: "Conversion Reports",
    subtitle: "Pipeline funnel progression, conversion rates & velocity metrics",
    icon: CheckCircle,
    color: "text-purple-500 bg-purple-500/10",
  },
  developer: {
    title: "Developer Reports",
    subtitle: "Developer lead distribution, project catalogs & agreement portfolios",
    icon: Building,
    color: "text-indigo-500 bg-indigo-500/10",
  },
  inventory: {
    title: "Inventory Reports",
    subtitle: "Available vs reserved vs sold unit availability matrix",
    icon: Layers,
    color: "text-rose-500 bg-rose-500/10",
  },
};

function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState<ReportCategory>("lead");
  const [dateRange, setDateRange] = useState("30_days");

  const { data: customers = [] } = useCustomers();
  const { data: followups = [] } = useFollowups();
  const { data: projects = [] } = useProjects();
  const { data: bookings = [] } = useBookings();
  const { data: developers = [] } = useDevelopers();

  // Helper to generate export data based on selected category
  const getExportData = () => {
    switch (selectedReport) {
      case "lead":
        return {
          headers: [
            "Lead ID",
            "Customer Name",
            "Phone",
            "Email",
            "Source",
            "Temperature",
            "Stage",
            "Sales Owner",
            "Created Date",
          ],
          rows: customers.map((c) => [
            c.id,
            c.name,
            c.phone || "N/A",
            c.email || "N/A",
            c.source || "Website Forms",
            c.temperature || "warm",
            c.stage || "new",
            c.opportunities?.[0]?.owner || "Unassigned",
            new Date(c.created_at).toLocaleDateString(),
          ]),
        };

      case "sales":
        return {
          headers: [
            "Booking ID",
            "Customer Name",
            "Project",
            "Unit Number",
            "Amount (₹)",
            "Payment Status",
            "Booking Date",
          ],
          rows: bookings.map((b) => [
            b.id,
            b.customer_name,
            b.project_name,
            b.unit_number,
            (b.amount || 0).toLocaleString("en-IN"),
            b.booking?.payment_status || "pending",
            new Date(b.booking?.booking_date || b.created_at || Date.now()).toLocaleDateString(),
          ]),
        };

      case "followup":
        return {
          headers: [
            "Task ID",
            "Customer Name",
            "Title",
            "Scheduled Date",
            "Priority",
            "Status",
            "Assigned Executive",
          ],
          rows: followups.map((f) => [
            f.id,
            f.customer_name,
            f.title,
            new Date(f.time).toLocaleString(),
            f.priority,
            f.status,
            f.assigned_sales,
          ]),
        };

      case "conversion":
        return {
          headers: ["Stage Name", "Lead Count", "Conversion % Share", "Status Indicator"],
          rows: [
            ["New Lead", customers.filter((c) => c.stage === "new").length, "10%", "Ingestion"],
            [
              "Contact Attempted",
              customers.filter((c) => c.stage === "contact_attempted").length,
              "25%",
              "In Progress",
            ],
            [
              "Connected",
              customers.filter((c) => c.stage === "connected").length,
              "35%",
              "Engaged",
            ],
            [
              "Interested",
              customers.filter((c) => c.stage === "interested").length,
              "45%",
              "Qualified",
            ],
            [
              "Site Visit Scheduled",
              customers.filter((c) => c.stage === "site_visit_scheduled").length,
              "65%",
              "Scheduled",
            ],
            [
              "Site Visit Completed",
              customers.filter((c) => c.stage === "site_visit_completed").length,
              "75%",
              "Evaluation",
            ],
            [
              "Negotiation",
              customers.filter((c) => c.stage === "negotiation").length,
              "85%",
              "Closing",
            ],
            [
              "Booking In Progress",
              customers.filter((c) => c.stage === "booking_initiated").length,
              "90%",
              "Token",
            ],
            ["Converted", customers.filter((c) => c.stage === "converted").length, "100%", "Won"],
            ["Lost", customers.filter((c) => c.stage === "lost").length, "0%", "Closed Lost"],
          ],
        };

      case "developer":
        return {
          headers: [
            "Developer ID",
            "Developer Name",
            "Contact",
            "Location",
            "Brochures",
            "Agreements",
            "Projects Count",
          ],
          rows: developers.map((d) => [
            d.id,
            d.name,
            d.contact || "N/A",
            d.location || "N/A",
            (d.brochures?.length || 0).toString(),
            (d.agreements?.length || 0).toString(),
            projects.filter((p) => p.developer_id === d.id).length.toString(),
          ]),
        };

      case "inventory":
        return {
          headers: ["Project Name", "Location", "Total Units", "Available Units", "Price Range"],
          rows: projects.map((p) => [
            p.name,
            p.location || "N/A",
            (p.total_units || 0).toString(),
            (p.available_units || 0).toString(),
            p.price_range || "N/A",
          ]),
        };
    }
  };

  // CSV Export handler
  const handleExportCSV = () => {
    const { headers, rows } = getExportData();
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.map((cell) => `"${cell}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `BLX_${selectedReport}_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${reportConfig[selectedReport].title} as CSV!`);
  };

  // Excel Export handler (.xlsx formatted CSV)
  const handleExportExcel = () => {
    const { headers, rows } = getExportData();
    const tsvContent =
      "data:application/vnd.ms-excel;charset=utf-8," +
      [headers.join("\t"), ...rows.map((r) => r.join("\t"))].join("\n");
    const encodedUri = encodeURI(tsvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `BLX_${selectedReport}_report_${Date.now()}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${reportConfig[selectedReport].title} to Microsoft Excel (.xls)!`);
  };

  // PDF Export handler
  const handleExportPDF = () => {
    const { headers, rows } = getExportData();
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Please allow popups to generate PDF report");
      return;
    }
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>BLX Realty - ${reportConfig[selectedReport].title}</title>
          <style>
            body { font-family: sans-serif; padding: 24px; color: #1e293b; }
            h1 { color: #0f172a; margin-bottom: 4px; font-size: 22px; }
            p { color: #64748b; margin-top: 0; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 11px; }
            th { background: #f1f5f9; text-align: left; padding: 8px 10px; font-weight: 700; border-bottom: 2px solid #cbd5e1; }
            td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
            .header-bar { display: flex; justify-content: space-between; border-bottom: 2px solid #2563eb; padding-bottom: 12px; }
          </style>
        </head>
        <body>
          <div class="header-bar">
            <div>
              <h1>BLX REALITY CRM — ${reportConfig[selectedReport].title.toUpperCase()}</h1>
              <p>${reportConfig[selectedReport].subtitle} · Generated on ${new Date().toLocaleString()}</p>
            </div>
          </div>
          <table>
            <thead>
              <tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr>
            </thead>
            <tbody>
              ${rows.map((r) => `<tr>${r.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}
            </tbody>
          </table>
          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    toast.success(`Printed/Saved ${reportConfig[selectedReport].title} as PDF!`);
  };

  const currentData = getExportData();
  const SelectedIcon = reportConfig[selectedReport].icon;

  return (
    <AppShell
      title="Reports & Exports Center"
      subtitle="Module 15 — Business intelligence, analytics & multi-format exports"
    >
      <div className="space-y-6">
        {/* Module 15 Category Selector Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {(Object.keys(reportConfig) as ReportCategory[]).map((cat) => {
            const cfg = reportConfig[cat];
            const Icon = cfg.icon;
            const isSelected = selectedReport === cat;

            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedReport(cat)}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  isSelected
                    ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary"
                    : "border-border/60 bg-card hover:bg-muted/40"
                }`}
              >
                <div className={`p-2 rounded-lg w-fit ${cfg.color} mb-2.5`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="font-bold text-xs text-foreground">{cfg.title}</div>
                <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1">
                  {cfg.subtitle}
                </p>
              </button>
            );
          })}
        </div>

        {/* Selected Report Workspace & Export Panel */}
        <Card className="border-border/60 shadow-xs overflow-hidden">
          <CardHeader className="border-b bg-muted/10 py-4 px-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${reportConfig[selectedReport].color}`}>
                <SelectedIcon className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-foreground">
                  {reportConfig[selectedReport].title}
                </CardTitle>
                <CardDescription className="text-xs">
                  {reportConfig[selectedReport].subtitle}
                </CardDescription>
              </div>
            </div>

            {/* Export Actions (PDF, CSV, Excel per Module 15) */}
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="h-8.5 text-xs w-[140px]">
                  <Calendar className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7_days">Last 7 Days</SelectItem>
                  <SelectItem value="30_days">Last 30 Days</SelectItem>
                  <SelectItem value="quarter">This Quarter</SelectItem>
                  <SelectItem value="ytd">Year To Date</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPDF}
                className="h-8.5 text-xs gap-1.5 font-semibold text-rose-600 border-rose-500/20 hover:bg-rose-500/10"
              >
                <FileText className="h-3.5 w-3.5" /> PDF
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                className="h-8.5 text-xs gap-1.5 font-semibold text-blue-600 border-blue-500/20 hover:bg-blue-500/10"
              >
                <Download className="h-3.5 w-3.5" /> CSV
              </Button>

              <Button
                size="sm"
                onClick={handleExportExcel}
                className="h-8.5 text-xs gap-1.5 font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" /> Excel (.xls)
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b bg-muted/20 text-muted-foreground font-semibold uppercase text-[10px] tracking-wider">
                    {currentData.headers.map((h, i) => (
                      <th key={i} className="px-4 py-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {currentData.rows.map((row, idx) => (
                    <tr
                      key={idx}
                      className="border-b last:border-0 hover:bg-muted/20 transition-colors"
                    >
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-4 py-3 text-foreground font-medium">
                          {cIdx === 0 ? (
                            <span className="font-mono text-primary font-bold">{cell}</span>
                          ) : (
                            cell
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {currentData.rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={currentData.headers.length}
                        className="px-4 py-12 text-center text-muted-foreground"
                      >
                        No report data matching current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
