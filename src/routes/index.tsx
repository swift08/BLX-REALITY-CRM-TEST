import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TempBadge, StageBadge } from "@/components/temp-badge";
import { NewLeadDialog } from "@/components/new-lead-dialog";
import { Input } from "@/components/ui/input";
import {
  useDashboardStats,
  useLeads,
  useProjects,
  useFollowups,
  useAuditLogs,
} from "@/lib/queries";
import { useAuth } from "@/hooks/use-auth";
import { can } from "@/lib/permissions";
import { MaskedField } from "@/components/data-masking";
import {
  Users,
  Flame,
  MapPin,
  TrendingUp,
  Building2,
  Clock,
  AlertCircle,
  PhoneCall,
  ChevronRight,
  TrendingDown,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Settings,
  Star,
  Pin,
  Maximize2,
  FileBarChart2,
  FileCheck,
  DollarSign,
  Search,
  ExternalLink,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type Stage =
  | "new"
  | "assigned"
  | "contact_attempted"
  | "connected"
  | "interested"
  | "meeting_scheduled"
  | "meeting_completed"
  | "site_visit_scheduled"
  | "site_visit_completed"
  | "negotiation"
  | "booking_initiated"
  | "payment_pending"
  | "payment_completed"
  | "converted"
  | "closed"
  | "lost";
type Temp = "hot" | "warm" | "cold";

const stageLabels: Record<Stage, string> = {
  new: "New",
  assigned: "Assigned",
  contact_attempted: "Contact Attempted",
  connected: "Connected",
  interested: "Interested",
  meeting_scheduled: "Meeting Scheduled",
  meeting_completed: "Meeting Completed",
  site_visit_scheduled: "Site Visit Scheduled",
  site_visit_completed: "Site Visit Completed",
  negotiation: "Negotiation",
  booking_initiated: "Booking Initiated",
  payment_pending: "Payment Pending",
  payment_completed: "Payment Completed",
  converted: "Converted",
  closed: "Closed",
  lost: "Lost",
};

const tempLabels: Record<Temp, string> = {
  hot: "Hot",
  warm: "Warm",
  cold: "Cold",
};

const pipelineStages: Stage[] = [
  "new",
  "connected",
  "interested",
  "negotiation",
  "booking_initiated",
  "payment_completed",
  "converted",
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard · BLX Realty CRM" },
      {
        name: "description",
        content: "Real-time overview of BLX Realty sales, leads, follow-ups and bookings.",
      },
    ],
  }),
  component: Dashboard,
});

interface WidgetConfig {
  id: string;
  label: string;
  size: "small" | "medium" | "large";
  isPinned: boolean;
  isFavorite: boolean;
  isHidden: boolean;
}

const DEFAULT_WIDGET_DECK: WidgetConfig[] = [
  {
    id: "snapshot",
    label: "📊 Snapshot Metrics Summary",
    size: "large",
    isPinned: true,
    isFavorite: false,
    isHidden: false,
  },
  {
    id: "funnel",
    label: "🎯 Active Sales Funnel",
    size: "large",
    isPinned: false,
    isFavorite: true,
    isHidden: false,
  },
  {
    id: "recent_leads",
    label: "⚡ Active Enquiries Queue",
    size: "medium",
    isPinned: false,
    isFavorite: false,
    isHidden: false,
  },
  {
    id: "source_distribution",
    label: "📈 Lead Sources Distribution",
    size: "small",
    isPinned: false,
    isFavorite: false,
    isHidden: false,
  },
  {
    id: "top_projects",
    label: "🏢 Properties Listings Status",
    size: "small",
    isPinned: false,
    isFavorite: false,
    isHidden: false,
  },
  {
    id: "audit_operations",
    label: "📋 Recent Logged Operations",
    size: "medium",
    isPinned: false,
    isFavorite: false,
    isHidden: false,
  },
];

function Dashboard() {
  const { user, role } = useAuth();
  const firstName =
    (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0] ?? "there";

  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: rawCustomers = [] } = useLeads();
  const { data: projects = [] } = useProjects();
  const { data: followups = [] } = useFollowups();
  const { data: logs = [] } = useAuditLogs();

  // Metrics calculator
  const totalLeadsCount = rawCustomers.length;
  const newLeadsCount = rawCustomers.filter((c) => c.stage === "new").length;
  const activeLeadsCount = rawCustomers.filter(
    (c) => c.stage !== "converted" && c.stage !== "closed" && c.stage !== "lost",
  ).length;
  const hotLeadsCount = rawCustomers.filter((c) => c.temperature === "hot").length;
  const convertedLeadsCount = rawCustomers.filter((c) => c.stage === "converted").length;
  const lostLeadsCount = rawCustomers.filter(
    (c) => c.stage === "lost" || c.stage === "closed",
  ).length;
  const visitsScheduledCount = rawCustomers.filter(
    (c) => c.stage === "site_visit_scheduled",
  ).length;
  const visitsCompletedCount = rawCustomers.filter(
    (c) => c.stage === "site_visit_completed",
  ).length;
  const totalRevenueVal = rawCustomers.reduce((sum, c) => {
    const completedBookingsAmount = (c.bookings || [])
      .filter((b) => b.payment_status === "completed")
      .reduce((s, b) => s + (b.amount || 0), 0);
    return sum + completedBookingsAmount;
  }, 0);
  const conversionRatePct = totalLeadsCount
    ? ((convertedLeadsCount / totalLeadsCount) * 100).toFixed(1) + "%"
    : "0.0%";

  // Monthly charts data
  const getMonthlyLeadTrendData = () => {
    const dataMap: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toLocaleString("default", { month: "short", year: "2-digit" });
      dataMap[key] = 0;
    }
    rawCustomers.forEach((c) => {
      const cDate = new Date(c.created_at);
      const key = cDate.toLocaleString("default", { month: "short", year: "2-digit" });
      if (key in dataMap) dataMap[key]++;
    });
    return Object.entries(dataMap).map(([month, count]) => ({ month, count }));
  };

  const getMonthlyRevenueTrendData = () => {
    const dataMap: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toLocaleString("default", { month: "short", year: "2-digit" });
      dataMap[key] = 0;
    }
    rawCustomers.forEach((c) => {
      (c.opportunities || []).forEach((o) => {
        (o.bookings || []).forEach((b) => {
          if (b.payment_status === "completed") {
            const bDate = new Date(b.booking_date);
            const key = bDate.toLocaleString("default", { month: "short", year: "2-digit" });
            if (key in dataMap) dataMap[key] += Number(b.amount || 0);
          }
        });
      });
    });

    const rawAmounts = Object.values(dataMap);
    const maxAmount = Math.max(0, ...rawAmounts);
    const isCroreScale = maxAmount >= 10000000;
    const divisor = isCroreScale ? 10000000 : 100000;
    const unitLabel = isCroreScale ? "Cr" : "Lakhs";
    const suffix = isCroreScale ? "Cr" : "L";

    const formattedData = Object.entries(dataMap).map(([month, rawVal]) => ({
      month,
      amount: rawVal / divisor,
      rawAmount: rawVal,
    }));

    return {
      data: formattedData,
      unitLabel,
      suffix,
    };
  };

  const leadTrendData = getMonthlyLeadTrendData();
  const { data: revenueTrendData, unitLabel, suffix } = getMonthlyRevenueTrendData();

  const [showCustomizer, setShowCustomizer] = useState(false);
  const [selectedReport, setSelectedReport] = useState<
    "all" | "sales" | "revenue" | "pending_payment" | "hot"
  >("all");

  const [selectedCardMetric, setSelectedCardMetric] = useState<{
    id: "total_leads" | "new_leads" | "active_leads" | "hot_leads" | "converted" | "lost_leads" | "visits_scheduled" | "visits_completed" | "revenue" | "conversion_pct";
    title: string;
    description: string;
  } | null>(null);
  const [metricSearchQuery, setMetricSearchQuery] = useState("");

  const [widgetDeck, setWidgetDeck] = useState<WidgetConfig[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("blx-dashboard-widget-deck-v2");
      if (saved) return JSON.parse(saved);
    }
    return DEFAULT_WIDGET_DECK;
  });

  const saveDeck = (newDeck: WidgetConfig[]) => {
    setWidgetDeck(newDeck);
    localStorage.setItem("blx-dashboard-widget-deck-v2", JSON.stringify(newDeck));
  };

  const handleToggleHide = (id: string) => {
    const next = widgetDeck.map((w) => (w.id === id ? { ...w, isHidden: !w.isHidden } : w));
    saveDeck(next);
  };

  const handleTogglePin = (id: string) => {
    const next = widgetDeck.map((w) => (w.id === id ? { ...w, isPinned: !w.isPinned } : w));
    saveDeck(next);
  };

  const handleToggleFavorite = (id: string) => {
    const next = widgetDeck.map((w) => (w.id === id ? { ...w, isFavorite: !w.isFavorite } : w));
    saveDeck(next);
  };

  const handleResize = (id: string, size: "small" | "medium" | "large") => {
    const next = widgetDeck.map((w) => (w.id === id ? { ...w, size } : w));
    saveDeck(next);
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    const next = [...widgetDeck];
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= next.length) return;

    // Swap
    const temp = next[index];
    next[index] = next[targetIdx];
    next[targetIdx] = temp;

    saveDeck(next);
  };

  const formatINR = (n: number) => {
    if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
    if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
    return `₹${n.toLocaleString("en-IN")}`;
  };

  // Filter Customers based on Saved Report Selector
  const getFilteredCustomers = () => {
    switch (selectedReport) {
      case "sales":
        return rawCustomers.filter(
          (c) => c.stage === "converted" || c.stage === "payment_completed",
        );
      case "revenue":
        return rawCustomers.filter((c) => c.booking && c.booking.payment_status === "completed");
      case "pending_payment":
        return rawCustomers.filter((c) => c.booking && c.booking.payment_status === "pending");
      case "hot":
        return rawCustomers.filter((c) => c.temperature === "hot");
      default:
        return rawCustomers;
    }
  };

  const customers = getFilteredCustomers();

  // Aggregate source percentages
  const sources = customers.reduce(
    (acc, l) => {
      acc[l.source] = (acc[l.source] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const totalLeads = customers.length || 1;
  const sourceStats = Object.entries(sources)
    .map(([k, v]) => ({
      name: k,
      count: v,
      pct: ((v / totalLeads) * 100).toFixed(0),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  const getMetricData = () => {
    if (!selectedCardMetric) return [];
    switch (selectedCardMetric.id) {
      case "total_leads":
        return rawCustomers;
      case "new_leads":
        return rawCustomers.filter((c) => c.stage === "new");
      case "active_leads":
        return rawCustomers.filter(
          (c) => c.stage !== "converted" && c.stage !== "closed" && c.stage !== "lost",
        );
      case "hot_leads":
        return rawCustomers.filter((c) => c.temperature === "hot");
      case "converted":
        return rawCustomers.filter((c) => c.stage === "converted");
      case "lost_leads":
        return rawCustomers.filter((c) => c.stage === "lost" || c.stage === "closed");
      case "visits_scheduled":
        return rawCustomers.filter((c) => c.stage === "site_visit_scheduled");
      case "visits_completed":
        return rawCustomers.filter((c) => c.stage === "site_visit_completed");
      case "revenue":
        return rawCustomers.filter((c) => c.booking && c.booking.payment_status === "completed");
      case "conversion_pct":
        return rawCustomers;
      default:
        return [];
    }
  };

  const metricData = getMetricData();

  const filteredMetricData = metricData.filter((c) => {
    if (!metricSearchQuery) return true;
    const q = metricSearchQuery.toLowerCase();
    const matchName = c.name.toLowerCase().includes(q);
    const matchPhone = c.phone.includes(q);
    const matchEmail = (c.email ?? "").toLowerCase().includes(q);
    const matchProject = (c.projects?.name ?? "").toLowerCase().includes(q);
    const matchOwner = (c.owner ?? "").toLowerCase().includes(q);
    const matchSource = (c.source ?? "").toLowerCase().includes(q);
    return matchName || matchPhone || matchEmail || matchProject || matchOwner || matchSource;
  });

  const overdueFollowups = followups.filter((f) => f.status === "overdue");

  // Sorting widgets: Pinned first, then by layout order
  const sortedWidgets = [...widgetDeck]
    .filter((w) => !w.isHidden)
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return 0; // Maintain original indices
    });

  const getWidgetGridClass = (size: "small" | "medium" | "large") => {
    if (size === "large") return "col-span-12";
    if (size === "medium") return "col-span-12 md:col-span-8";
    return "col-span-12 md:col-span-4";
  };

  return (
    <AppShell
      title={can(role).dashboardTitle()}
      subtitle={`Welcome back, ${firstName} (${can(role).roleLabel()})`}
    >
      {/* SLA / Alerts bar for Admins */}
      {can(role).viewDashboardAuditWidget() && overdueFollowups.length > 0 && (
        <Card className="border-rose-500/30 bg-rose-500/[0.02] shadow-sm flex items-center gap-4 p-4 animate-pulse mb-4">
          <AlertCircle className="h-6 w-6 text-rose-500 shrink-0" />
          <div className="flex-1 text-xs text-left">
            <span className="font-bold text-rose-600 block">
              SLA Warning: Missed Agent Follow-ups Detected
            </span>
            <span className="text-muted-foreground mt-0.5 block">
              There are {overdueFollowups.length} scheduled callbacks past their deadlines.
            </span>
          </div>
          <a
            href="/followups"
            className="text-xs font-semibold text-rose-600 hover:underline shrink-0"
          >
            Review Tasks
          </a>
        </Card>
      )}

      {/* Saved Reports Selector & Workspace customization Controls */}
      <div className="flex items-center justify-between border-b pb-4 gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <FileBarChart2 className="h-4.5 w-4.5 text-primary" />
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider font-display">
            Saved Reports:
          </span>
          <select
            value={selectedReport}
            onChange={(e: any) => setSelectedReport(e.target.value)}
            className="h-9 px-3 rounded-lg border bg-card text-xs font-semibold text-foreground focus:outline-none"
          >
            <option value="all">📁 All Enquiries Ledger</option>
            <option value="sales">📈 Sales Conversion Report</option>
            <option value="revenue">💵 Revenue Analytics Report</option>
            <option value="pending_payment">⏳ Pending Holdings & Invoices</option>
            <option value="hot">🔥 Hot Opportunities Queue</option>
          </select>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCustomizer(true)}
          className="gap-1.5 text-xs font-semibold h-9 rounded-lg"
        >
          <Settings className="h-4 w-4" /> Customize Layout
        </Button>
      </div>

      {/* Widget Layout Customizer Modal */}
      <Dialog open={showCustomizer} onOpenChange={setShowCustomizer}>
        <DialogContent className="max-w-xl bg-card text-left rounded-xl border border-border shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold font-display text-foreground">
              Customize Dashboard Layout
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Show/Hide, Pin, Favorite, or resize widgets in your dashboard layout.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 mt-4 max-h-[50vh] overflow-y-auto pr-1">
            {widgetDeck.map((w, index) => {
              return (
                <div
                  key={w.id}
                  className="p-3 border rounded-xl flex items-center justify-between gap-3 bg-muted/20 flex-wrap sm:flex-nowrap"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground">{w.label}</span>
                    {w.isPinned && <Pin className="h-3 w-3 text-primary fill-primary" />}
                    {w.isFavorite && <Star className="h-3 w-3 text-amber-500 fill-amber-500" />}
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Size Selector */}
                    <select
                      value={w.size}
                      onChange={(e) => handleResize(w.id, e.target.value as any)}
                      className="h-7 px-1.5 rounded border bg-background text-[10px] font-semibold"
                    >
                      <option value="small">Small</option>
                      <option value="medium">Medium</option>
                      <option value="large">Large</option>
                    </select>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggleHide(w.id)}
                      className={`h-7 w-7 ${!w.isHidden ? "text-primary" : "text-muted-foreground"}`}
                      title={!w.isHidden ? "Hide Widget" : "Show Widget"}
                    >
                      {!w.isHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleTogglePin(w.id)}
                      className={`h-7 w-7 ${w.isPinned ? "text-primary" : "text-muted-foreground"}`}
                      title="Pin Widget"
                    >
                      <Pin className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggleFavorite(w.id)}
                      className={`h-7 w-7 ${w.isFavorite ? "text-amber-500" : "text-muted-foreground"}`}
                      title="Favorite Widget"
                    >
                      <Star className="h-4 w-4" />
                    </Button>

                    <div className="flex gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={index === 0}
                        onClick={() => handleMove(index, "up")}
                        className="h-7 w-7 text-muted-foreground"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={index === widgetDeck.length - 1}
                        onClick={() => handleMove(index, "down")}
                        className="h-7 w-7 text-muted-foreground"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end pt-4 border-t mt-5">
            <Button
              size="sm"
              onClick={() => setShowCustomizer(false)}
              className="font-semibold text-xs h-9 px-4"
            >
              Save Configuration
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Metric Detail Modal */}
      <Dialog 
        open={selectedCardMetric !== null} 
        onOpenChange={(open) => {
          if (!open) {
            setSelectedCardMetric(null);
            setMetricSearchQuery("");
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-6 overflow-hidden bg-card border border-border shadow-2xl rounded-xl">
          <DialogHeader className="pb-2 text-left">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-lg font-bold font-display text-foreground flex items-center gap-2">
                  {selectedCardMetric?.title}
                  <span className="text-xs px-2 py-0.5 font-sans font-medium rounded-full bg-primary/10 text-primary">
                    {filteredMetricData.length} {filteredMetricData.length === 1 ? 'item' : 'items'}
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-1">
                  {selectedCardMetric?.description}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Search bar */}
          <div className="relative mt-2 mb-4 shrink-0">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone, email, project, owner..."
              value={metricSearchQuery}
              onChange={(e) => setMetricSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs rounded-lg bg-muted/20 border-border"
            />
          </div>

          {/* Scrollable container */}
          <div className="flex-1 overflow-y-auto border rounded-lg bg-card/50">
            {filteredMetricData.length === 0 ? (
              <div className="p-12 text-center text-xs text-muted-foreground">
                No matching records found.
              </div>
            ) : selectedCardMetric?.id === "revenue" ? (
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-muted-foreground uppercase tracking-wider border-b bg-muted/20 h-10 font-semibold select-none">
                      <th className="px-6 py-2">Customer Details</th>
                      <th className="px-3 py-2">Project</th>
                      <th className="px-3 py-2">Unit ID</th>
                      <th className="px-3 py-2">Booking Date</th>
                      <th className="px-6 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMetricData.map((c) => (
                      <tr key={c.id} className="border-b last:border-0 hover:bg-muted/10 h-14 transition-colors">
                        <td className="px-6 py-2">
                          <a 
                            href={`/leads#?id=${c.id}`} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="font-semibold text-primary hover:underline inline-flex items-center gap-1"
                          >
                            {c.name}
                            <ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            <MaskedField value={c.phone} type="phone" />
                          </div>
                        </td>
                        <td className="px-3 py-2 text-foreground font-medium">
                          {c.projects?.name ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground font-mono">
                          {c.booking?.unit_id ? c.booking.unit_id.replace("unit-", "") : "—"}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground font-medium">
                          {c.booking?.booking_date ? new Date(c.booking.booking_date).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric"
                          }) : "—"}
                        </td>
                        <td className="px-6 py-2 text-right font-bold text-emerald-500">
                          {c.booking?.amount ? formatINR(c.booking.amount) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : selectedCardMetric?.id === "conversion_pct" ? (
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-muted-foreground uppercase tracking-wider border-b bg-muted/20 h-10 font-semibold select-none">
                      <th className="px-6 py-2">Customer Details</th>
                      <th className="px-3 py-2">Project</th>
                      <th className="px-3 py-2">Stage</th>
                      <th className="px-3 py-2">Win Status</th>
                      <th className="px-3 py-2">Budget</th>
                      <th className="px-6 py-2 text-right">Owner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMetricData.map((c) => {
                      const isConverted = c.stage === "converted";
                      return (
                        <tr key={c.id} className="border-b last:border-0 hover:bg-muted/10 h-14 transition-colors">
                          <td className="px-6 py-2">
                            <a 
                              href={`/leads#?id=${c.id}`} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="font-semibold text-primary hover:underline inline-flex items-center gap-1"
                            >
                              {c.name}
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              <MaskedField value={c.phone} type="phone" />
                            </div>
                          </td>
                          <td className="px-3 py-2 text-foreground font-medium">
                            {c.projects?.name ?? "—"}
                          </td>
                          <td className="px-3 py-2">
                            <StageBadge value={stageLabels[c.stage as Stage] ?? c.stage} />
                          </td>
                          <td className="px-3 py-2">
                            {isConverted ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 uppercase tracking-wide">
                                Converted
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground uppercase tracking-wide">
                                In Progress
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 font-bold text-foreground">
                            <MaskedField value={c.budget || ""} type="budget" />
                          </td>
                          <td className="px-6 py-2 text-right text-muted-foreground font-medium">
                            {c.owner}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-muted-foreground uppercase tracking-wider border-b bg-muted/20 h-10 font-semibold select-none">
                      <th className="px-6 py-2">Customer Details</th>
                      <th className="px-3 py-2">Project</th>
                      <th className="px-3 py-2">Stage</th>
                      <th className="px-3 py-2">Temp</th>
                      <th className="px-3 py-2">Budget</th>
                      <th className="px-6 py-2 text-right">Owner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMetricData.map((c) => (
                      <tr key={c.id} className="border-b last:border-0 hover:bg-muted/10 h-14 transition-colors">
                        <td className="px-6 py-2">
                          <a 
                            href={`/leads#?id=${c.id}`} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="font-semibold text-primary hover:underline inline-flex items-center gap-1"
                          >
                            {c.name}
                            <ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            <MaskedField value={c.phone} type="phone" />
                          </div>
                        </td>
                        <td className="px-3 py-2 text-foreground font-medium">
                          {c.projects?.name ?? "—"}
                        </td>
                        <td className="px-3 py-2">
                          <StageBadge value={stageLabels[c.stage as Stage] ?? c.stage} />
                        </td>
                        <td className="px-3 py-2">
                          <TempBadge value={tempLabels[c.temperature as Temp] ?? c.temperature} />
                        </td>
                        <td className="px-3 py-2 font-bold text-foreground">
                          <MaskedField value={c.budget || ""} type="budget" />
                        </td>
                        <td className="px-6 py-2 text-right text-muted-foreground font-medium">
                          {c.owner}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4 border-t mt-4 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSelectedCardMetric(null);
                setMetricSearchQuery("");
              }}
              className="font-semibold text-xs h-8 px-4"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Main Grid Render stack */}
      <div className="grid grid-cols-12 gap-6 mt-4">
        {sortedWidgets.map((w) => {
          const gridClass = getWidgetGridClass(w.size);

          if (w.id === "snapshot") {
            return (
              <div key="snapshot" className={`${gridClass} grid grid-cols-2 md:grid-cols-5 gap-4`}>
                <Card 
                  onClick={() => setSelectedCardMetric({ id: "total_leads", title: "Total Leads", description: "All registered prospects and dossiers in the CRM" })}
                  className="border-border/60 shadow-sm hover:shadow hover:border-primary/45 hover:bg-muted/10 transition-all select-none hover:-translate-y-0.5 duration-200 cursor-pointer text-left"
                >
                  <CardContent className="p-4 flex items-center justify-between text-left">
                    <div>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        Total Leads
                      </span>
                      <div className="text-xl font-bold font-display tracking-tight mt-1">
                        {totalLeadsCount}
                      </div>
                      <p className="text-[9px] text-muted-foreground mt-0.5">All Dossiers</p>
                    </div>
                    <div className="p-2 rounded bg-primary/10 text-primary">
                      <Users className="h-4 w-4" />
                    </div>
                  </CardContent>
                </Card>

                <Card 
                  onClick={() => setSelectedCardMetric({ id: "new_leads", title: "New Leads", description: "Uncontacted fresh prospects" })}
                  className="border-border/60 shadow-sm hover:shadow hover:border-blue-500/45 hover:bg-muted/10 transition-all select-none hover:-translate-y-0.5 duration-200 cursor-pointer text-left"
                >
                  <CardContent className="p-4 flex items-center justify-between text-left">
                    <div>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        New Leads
                      </span>
                      <div className="text-xl font-bold font-display tracking-tight mt-1">
                        {newLeadsCount}
                      </div>
                      <p className="text-[9px] text-muted-foreground mt-0.5">Uncontacted</p>
                    </div>
                    <div className="p-2 rounded bg-blue-500/10 text-blue-500">
                      <Clock className="h-4 w-4" />
                    </div>
                  </CardContent>
                </Card>

                <Card 
                  onClick={() => setSelectedCardMetric({ id: "active_leads", title: "Active Leads", description: "Leads currently in pipeline (unconverted and not closed/dropped)" })}
                  className="border-border/60 shadow-sm hover:shadow hover:border-emerald-500/45 hover:bg-muted/10 transition-all select-none hover:-translate-y-0.5 duration-200 cursor-pointer text-left"
                >
                  <CardContent className="p-4 flex items-center justify-between text-left">
                    <div>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        Active Leads
                      </span>
                      <div className="text-xl font-bold font-display tracking-tight mt-1">
                        {activeLeadsCount}
                      </div>
                      <p className="text-[9px] text-muted-foreground mt-0.5">In Pipeline</p>
                    </div>
                    <div className="p-2 rounded bg-emerald-500/10 text-emerald-500">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                  </CardContent>
                </Card>

                <Card 
                  onClick={() => setSelectedCardMetric({ id: "hot_leads", title: "Hot Leads", description: "High interest prospects tagged as hot temperature" })}
                  className="border-border/60 shadow-sm hover:shadow hover:border-rose-500/45 hover:bg-muted/10 transition-all select-none hover:-translate-y-0.5 duration-200 cursor-pointer text-left"
                >
                  <CardContent className="p-4 flex items-center justify-between text-left">
                    <div>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        Hot Leads
                      </span>
                      <div className="text-xl font-bold font-display tracking-tight mt-1">
                        {hotLeadsCount}
                      </div>
                      <p className="text-[9px] text-muted-foreground mt-0.5">High Interest</p>
                    </div>
                    <div className="p-2 rounded bg-rose-500/10 text-rose-500">
                      <Flame className="h-4 w-4" />
                    </div>
                  </CardContent>
                </Card>

                <Card 
                  onClick={() => setSelectedCardMetric({ id: "converted", title: "Converted Leads", description: "Successful won deals and closed-won customers" })}
                  className="border-border/60 shadow-sm hover:shadow hover:border-indigo-500/45 hover:bg-muted/10 transition-all select-none hover:-translate-y-0.5 duration-200 cursor-pointer text-left"
                >
                  <CardContent className="p-4 flex items-center justify-between text-left">
                    <div>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        Converted
                      </span>
                      <div className="text-xl font-bold font-display tracking-tight mt-1">
                        {convertedLeadsCount}
                      </div>
                      <p className="text-[9px] text-muted-foreground mt-0.5">Won Deals</p>
                    </div>
                    <div className="p-2 rounded bg-indigo-500/10 text-indigo-500">
                      <FileCheck className="h-4 w-4" />
                    </div>
                  </CardContent>
                </Card>

                <Card 
                  onClick={() => setSelectedCardMetric({ id: "lost_leads", title: "Lost Leads", description: "Closed-lost or dropped leads" })}
                  className="border-border/60 shadow-sm hover:shadow hover:border-slate-500/45 hover:bg-muted/10 transition-all select-none hover:-translate-y-0.5 duration-200 cursor-pointer text-left"
                >
                  <CardContent className="p-4 flex items-center justify-between text-left">
                    <div>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        Lost Leads
                      </span>
                      <div className="text-xl font-bold font-display tracking-tight mt-1">
                        {lostLeadsCount}
                      </div>
                      <p className="text-[9px] text-muted-foreground mt-0.5">Closed/Dropped</p>
                    </div>
                    <div className="p-2 rounded bg-slate-500/10 text-slate-500">
                      <TrendingDown className="h-4 w-4" />
                    </div>
                  </CardContent>
                </Card>

                <Card 
                  onClick={() => setSelectedCardMetric({ id: "visits_scheduled", title: "Visits Scheduled", description: "Leads with scheduled property site visits" })}
                  className="border-border/60 shadow-sm hover:shadow hover:border-amber-500/45 hover:bg-muted/10 transition-all select-none hover:-translate-y-0.5 duration-200 cursor-pointer text-left"
                >
                  <CardContent className="p-4 flex items-center justify-between text-left">
                    <div>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        Visits Scheduled
                      </span>
                      <div className="text-xl font-bold font-display tracking-tight mt-1">
                        {visitsScheduledCount}
                      </div>
                      <p className="text-[9px] text-muted-foreground mt-0.5">Upcoming Tours</p>
                    </div>
                    <div className="p-2 rounded bg-amber-500/10 text-amber-500">
                      <MapPin className="h-4 w-4" />
                    </div>
                  </CardContent>
                </Card>

                <Card 
                  onClick={() => setSelectedCardMetric({ id: "visits_completed", title: "Visits Completed", description: "Leads with successfully completed property site visits" })}
                  className="border-border/60 shadow-sm hover:shadow hover:border-emerald-500/45 hover:bg-muted/10 transition-all select-none hover:-translate-y-0.5 duration-200 cursor-pointer text-left"
                >
                  <CardContent className="p-4 flex items-center justify-between text-left">
                    <div>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        Visits Completed
                      </span>
                      <div className="text-xl font-bold font-display tracking-tight mt-1">
                        {visitsCompletedCount}
                      </div>
                      <p className="text-[9px] text-muted-foreground mt-0.5">Completed Tours</p>
                    </div>
                    <div className="p-2 rounded bg-emerald-500/10 text-emerald-500">
                      <MapPin className="h-4 w-4" />
                    </div>
                  </CardContent>
                </Card>

                <Card 
                  onClick={() => setSelectedCardMetric({ id: "revenue", title: "Revenue Bookings", description: "Bookings with completed payment status" })}
                  className="border-border/60 shadow-sm hover:shadow hover:border-primary/45 hover:bg-muted/10 transition-all select-none hover:-translate-y-0.5 duration-200 cursor-pointer text-left"
                >
                  <CardContent className="p-4 flex items-center justify-between text-left">
                    <div>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        Revenue
                      </span>
                      <div className="text-xl font-bold font-display tracking-tight mt-1">
                        {formatINR(totalRevenueVal)}
                      </div>
                      <p className="text-[9px] text-muted-foreground mt-0.5">Received Cash</p>
                    </div>
                    <div className="p-2 rounded bg-primary/10 text-primary">
                      <DollarSign className="h-4 w-4" />
                    </div>
                  </CardContent>
                </Card>

                <Card 
                  onClick={() => setSelectedCardMetric({ id: "conversion_pct", title: "Conversion Ratio Breakdown", description: "Win Ratio (Converted Leads / Total Leads)" })}
                  className="border-border/60 shadow-sm hover:shadow hover:border-pink-500/45 hover:bg-muted/10 transition-all select-none hover:-translate-y-0.5 duration-200 cursor-pointer text-left"
                >
                  <CardContent className="p-4 flex items-center justify-between text-left">
                    <div>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        Conversion %
                      </span>
                      <div className="text-xl font-bold font-display tracking-tight mt-1">
                        {conversionRatePct}
                      </div>
                      <p className="text-[9px] text-muted-foreground mt-0.5">Win Ratio</p>
                    </div>
                    <div className="p-2 rounded bg-pink-500/10 text-pink-500">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          }

          if (w.id === "funnel") {
            return (
              <div key="funnel" className={gridClass}>
                <Pipeline customers={customers} />
              </div>
            );
          }

          if (w.id === "recent_leads") {
            return (
              <div key="recent_leads" className={gridClass}>
                <RecentLeads customers={customers} />
              </div>
            );
          }

          if (w.id === "source_distribution") {
            return (
              <div key="source_distribution" className={gridClass}>
                <Card className="border-border/60 text-left h-full">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-semibold">
                      Lead Sources Distribution
                    </CardTitle>
                    {w.isFavorite && <Star className="h-4 w-4 text-amber-500 fill-amber-500" />}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {sourceStats.map((s) => (
                      <div key={s.name} className="space-y-1 text-xs">
                        <div className="flex items-center justify-between font-medium">
                          <span className="text-foreground">{s.name}</span>
                          <span className="text-muted-foreground">
                            {s.count} ({s.pct}%)
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${s.pct}%` }} />
                        </div>
                      </div>
                    ))}
                    {sourceStats.length === 0 && (
                      <p className="text-xs text-muted-foreground py-4 text-center">
                        No source logs available.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          }

          if (w.id === "top_projects") {
            return (
              <div key="top_projects" className={gridClass}>
                <TopProjects projects={projects} isFavorite={w.isFavorite} />
              </div>
            );
          }

          if (w.id === "audit_operations" && can(role).viewDashboardAuditWidget()) {
            return (
              <div key="audit_operations" className={gridClass}>
                <Card className="border-border/60 text-xs text-left h-full">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-semibold">
                      Recent Logged Operations
                    </CardTitle>
                    {w.isFavorite && <Star className="h-4 w-4 text-amber-500 fill-amber-500" />}
                  </CardHeader>
                  <CardContent className="space-y-3.5 pt-2">
                    {logs.slice(0, 4).map((l) => (
                      <div key={l.id} className="flex gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-foreground">{l.user}</span>
                          <span className="text-muted-foreground"> executed </span>
                          <span className="px-1.5 py-0.25 bg-muted rounded font-mono text-[9px] uppercase font-bold text-foreground">
                            {l.action}
                          </span>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {new Date(l.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            );
          }

          return null;
        })}
      </div>
      {/* Visual Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 col-span-12">
        <Card className="border-border/60 text-left">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Monthly Lead Ingestion Trend</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={leadTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary, #6366f1)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="var(--color-primary, #6366f1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="rgba(200,200,200,0.15)"
                />
                <XAxis dataKey="month" tickLine={false} tickMargin={8} style={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tickLine={false} tickMargin={8} style={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(0,0,0,0.8)",
                    border: "none",
                    borderRadius: 8,
                    color: "#fff",
                    fontSize: 11,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  name="Ingested Leads"
                  stroke="var(--color-primary, #6366f1)"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorLeads)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/60 text-left">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              Monthly Revenue Trend (in {unitLabel})
            </CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={revenueTrendData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="rgba(200,200,200,0.15)"
                />
                <XAxis dataKey="month" tickLine={false} tickMargin={8} style={{ fontSize: 10 }} />
                <YAxis
                  tickLine={false}
                  tickMargin={8}
                  style={{ fontSize: 10 }}
                  tickFormatter={(val) => `${val} ${suffix}`}
                />
                <Tooltip
                  contentStyle={{
                    background: "rgba(0,0,0,0.8)",
                    border: "none",
                    borderRadius: 8,
                    color: "#fff",
                    fontSize: 11,
                  }}
                  formatter={(value: any) => [`₹${Number(value).toFixed(2)} ${suffix}`, "Revenue"]}
                />
                <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={45} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Pipeline({ customers }: { customers: any[] }) {
  const counts = pipelineStages.map((s) => customers.filter((c) => c.stage === s).length);
  const max = Math.max(1, ...counts);
  return (
    <Card className="border-border/60 text-left h-full">
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Active Sales Funnel</CardTitle>
        <p className="text-[10px] text-muted-foreground mt-1">
          Lead progression across pipeline nodes
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 md:grid-cols-7 gap-3">
          {pipelineStages.map((s, i) => (
            <div
              key={s}
              className="rounded-xl bg-muted/40 p-3 flex flex-col justify-between border"
            >
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide truncate">
                {stageLabels[s]}
              </div>
              <div>
                <div className="mt-2 text-xl font-display font-extrabold text-foreground">
                  {counts[i]}
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-border overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${(counts[i] / max) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function RecentLeads({ customers }: { customers: any[] }) {
  return (
    <Card className="border-border/60 text-left h-full">
      <CardHeader className="flex flex-row items-center justify-between border-b py-4 px-5">
        <div>
          <CardTitle className="text-sm font-semibold">Active Enquiries Queue</CardTitle>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Showing recent active prospects
          </p>
        </div>
        <NewLeadDialog />
      </CardHeader>
      <CardContent className="p-0">
        {customers.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No active customers registered matching criteria.
          </div>
        ) : (
          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left">
              <thead>
                <tr className="text-muted-foreground uppercase tracking-wider border-b bg-muted/10 h-10 font-semibold">
                  <th className="px-6 py-2">Customer Details</th>
                  <th className="px-3 py-2">Project</th>
                  <th className="px-3 py-2">Budget</th>
                  <th className="px-3 py-2">Stage</th>
                  <th className="px-3 py-2">Temp</th>
                  <th className="px-6 py-2 text-right">Source</th>
                </tr>
              </thead>
              <tbody>
                {customers.slice(0, 6).map((c) => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-muted/20 h-14">
                    <td className="px-6 py-2">
                      <div className="font-semibold text-foreground">{c.name}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        <MaskedField value={c.phone} type="phone" />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-foreground font-medium">
                      {c.projects?.name ?? "—"}
                    </td>
                    <td className="px-3 py-2 font-bold text-foreground">
                      <MaskedField value={c.budget || ""} type="budget" />
                    </td>
                    <td className="px-3 py-2">
                      <StageBadge value={stageLabels[c.stage as Stage] ?? c.stage} />
                    </td>
                    <td className="px-3 py-2">
                      <TempBadge value={tempLabels[c.temperature as Temp] ?? c.temperature} />
                    </td>
                    <td className="px-6 py-2 text-right text-muted-foreground font-medium">
                      {c.source || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TopProjects({ projects, isFavorite }: { projects: any[]; isFavorite?: boolean }) {
  return (
    <Card className="border-border/60 text-left h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-semibold">Properties Listings Status</CardTitle>
        {isFavorite && <Star className="h-4 w-4 text-amber-500 fill-amber-500" />}
      </CardHeader>
      <CardContent className="space-y-3.5">
        {projects.length === 0 && (
          <p className="text-xs text-muted-foreground">No projects mapped yet.</p>
        )}
        {projects.slice(0, 4).map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-3 p-3 rounded-xl border hover:border-primary/45 transition-colors cursor-pointer bg-card"
          >
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary to-primary/80 text-primary-foreground grid place-items-center font-display font-extrabold text-sm uppercase shadow-sm">
              {p.name.slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0 text-xs">
              <div className="font-bold text-foreground truncate">{p.name}</div>
              <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                {p.location || "—"}
              </div>
            </div>
            <div className="text-right text-xs">
              <div className="font-bold text-foreground">{p.available_units ?? 0}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">available</div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
