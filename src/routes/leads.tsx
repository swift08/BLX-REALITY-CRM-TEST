import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TempBadge, StageBadge } from "@/components/temp-badge";
import { NewLeadDialog } from "@/components/new-lead-dialog";
import {
  useCustomers,
  useProjects,
  useInventory,
  useFollowups,
  useAuditLogs,
  useCalendarEvents,
  useCRMUsers,
  updateLead,
  softDeleteLead,
  addLeadNote,
  editLeadNote,
  deleteLeadNote,
  togglePinNote,
  addLeadActivity,
  reserveUnit,
  cancelBooking,
  confirmBookingPayment,
  completeFollowup,
  addCustomerOpportunity,
  addCustomerDocument,
  uploadProjectFile,
  addLeadCommunicationLog,
  bulkAssignLeads,
  Customer,
  Stage,
  Temp,
} from "@/lib/queries";
import { downloadPdfInvoice } from "@/lib/pdf-generator";
import { useAuth, AppRole } from "@/hooks/use-auth";
import { can, isLeadVisible } from "@/lib/permissions";
import { toast } from "sonner";
import { MaskedField } from "@/components/data-masking";
import {
  Search,
  Filter,
  ArrowUpDown,
  Trash2,
  Clock,
  Phone,
  MessageSquare,
  Calendar,
  FileText,
  Tag,
  User,
  Users,
  Pin,
  Plus,
  Check,
  X,
  DollarSign,
  Paperclip,
  Sparkles,
  ChevronRight,
  TrendingUp,
  Pencil,
  AlertCircle,
  Briefcase,
  Layers,
  MapPin,
  FileCheck,
  ArrowRight,
  Info,
  PhoneCall,
  MessageCircle,
  Handshake,
  FileSignature,
  Compass,
  UserCheck,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

const tempLabels: Record<Temp, string> = { hot: "Hot", warm: "Warm", cold: "Cold" };

export const Route = createFileRoute("/leads")({
  head: () => ({ meta: [{ title: "Customer Directory · BLX Realty CRM" }] }),
  component: CustomersPage,
});

type SortField =
  | "newest"
  | "oldest"
  | "budget_high"
  | "budget_low"
  | "name"
  | "last_contact"
  | "priority";

function CustomersPage() {
  const qc = useQueryClient();
  const { data: customers = [], isLoading } = useCustomers();
  const { data: projects = [] } = useProjects();
  const { data: crmUsers = [] } = useCRMUsers();
  const { role, user, userId } = useAuth();

  // Scoped leads visibility filtering (uses the central, UUID-based permission helper)
  const visibleCustomers = customers.filter((c) =>
    isLeadVisible(role, userId, c.owner_id || "unassigned"),
  );

  // Search & Filter state
  const [q, setQ] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [tempFilter, setTempFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [budgetMin, setBudgetMin] = useState<string>("0");
  const [budgetMax, setBudgetMax] = useState<string>("99Cr");
  const [dateMin, setDateMin] = useState<string>("");
  const [dateMax, setDateMax] = useState<string>("");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("newest");
  const [showFilters, setShowFilters] = useState(false);

  // Saved presets states
  const [presets, setPresets] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("blx_lead_filter_presets");
      if (saved) return JSON.parse(saved);
    }
    return [
      { name: "🔥 Hot Facebook Enquiries", temp: "hot", source: "Facebook" },
      { name: "🏢 Premium Range Budget", budgetMin: "2Cr", budgetMax: "99Cr" },
    ];
  });
  const [newPresetName, setNewPresetName] = useState("");

  const applyPreset = (p: any) => {
    if (p.stage) setStageFilter(p.stage);
    else setStageFilter("all");
    if (p.temp) setTempFilter(p.temp);
    else setTempFilter("all");
    if (p.source) setSourceFilter(p.source);
    else setSourceFilter("all");
    if (p.proj) setProjectFilter(p.proj);
    else setProjectFilter("all");
    if (p.budgetMin) setBudgetMin(p.budgetMin);
    else setBudgetMin("0");
    if (p.budgetMax) setBudgetMax(p.budgetMax);
    else setBudgetMax("99Cr");
    if (p.owner) setOwnerFilter(p.owner);
    else setOwnerFilter("all");
    if (p.city) setCityFilter(p.city);
    else setCityFilter("all");
    toast.success(`Preset "${p.name}" applied successfully!`);
  };

  const handleSavePreset = () => {
    if (!newPresetName.trim()) {
      toast.error("Please enter a name for your filter preset.");
      return;
    }
    const newP = {
      name: newPresetName.trim(),
      stage: stageFilter,
      temp: tempFilter,
      source: sourceFilter,
      proj: projectFilter,
      budgetMin,
      budgetMax,
      owner: ownerFilter,
      city: cityFilter,
    };
    const updated = [...presets, newP];
    setPresets(updated);
    localStorage.setItem("blx_lead_filter_presets", JSON.stringify(updated));
    setNewPresetName("");
    toast.success(`Filter configuration "${newP.name}" saved!`);
  };

  // Dashboard Card Drill-down params check
  useEffect(() => {
    const checkDrillDownParams = () => {
      const hash = window.location.hash;
      const params = new URLSearchParams(hash.split("?")[1]);
      const drillFilter = params.get("filter");
      if (drillFilter) {
        if (drillFilter === "hot") {
          setTempFilter("hot");
        } else if (drillFilter === "new") {
          setStageFilter("new");
        } else if (drillFilter === "active") {
          setStageFilter("assigned");
        } else if (drillFilter === "converted") {
          setStageFilter("converted");
        } else if (drillFilter === "site_visits") {
          setStageFilter("site_visit_completed");
        }
      }
    };
    checkDrillDownParams();
    window.addEventListener("hashchange", checkDrillDownParams);
    return () => window.removeEventListener("hashchange", checkDrillDownParams);
  }, []);

  // Selected customer workspace
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  // Bulk Assignment States
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [bulkOwner, setBulkOwner] = useState("");

  const handleToggleLead = (id: string) => {
    setSelectedLeads((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleToggleAllLeads = () => {
    if (selectedLeads.length === filteredCustomers.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(filteredCustomers.map((c) => c.id));
    }
  };

  const handleBulkAssign = async () => {
    if (!bulkOwner) return;
    try {
      await bulkAssignLeads(selectedLeads, bulkOwner);
      toast.success(`Successfully assigned ${selectedLeads.length} leads to ${bulkOwner}.`);
      setSelectedLeads([]);
      setBulkOwner("");
      qc.invalidateQueries({ queryKey: ["leads"] });
    } catch (err: any) {
      toast.error(err.message || "Bulk assignment failed");
    }
  };

  useEffect(() => {
    setSelectedLeads([]);
  }, [q, stageFilter, tempFilter, sourceFilter, projectFilter]);

  // Synchronize customer ID from URL parameter (e.g. for notifications link navigation)
  useEffect(() => {
    const handleUrlCheck = () => {
      const hash = window.location.hash;
      const match = hash.match(/[?&]id=([^&]+)/);
      if (match && match[1]) {
        setSelectedCustomerId(match[1]);
      }
    };
    handleUrlCheck();
    window.addEventListener("hashchange", handleUrlCheck);
    return () => window.removeEventListener("hashchange", handleUrlCheck);
  }, []);

  const getBudgetVal = (budgetStr: string | null | undefined): number => {
    if (!budgetStr) return 0;
    const num = parseFloat(budgetStr.replace(/[^0-9.]/g, "")) || 0;
    if (budgetStr.toLowerCase().includes("cr")) return num * 10000000;
    if (budgetStr.toLowerCase().includes("l")) return num * 100000;
    return num;
  };

  const filteredCustomers = visibleCustomers
    .filter((c) => {
      const matchSearch =
        !q ||
        c.name.toLowerCase().includes(q.toLowerCase()) ||
        c.phone.includes(q) ||
        (c.email ?? "").toLowerCase().includes(q.toLowerCase());

      const matchStage = stageFilter === "all" || c.stage === stageFilter;
      const matchTemp = tempFilter === "all" || c.temperature === tempFilter;
      const matchSource = sourceFilter === "all" || c.source === sourceFilter;
      const matchProject = projectFilter === "all" || c.project_id === projectFilter;

      // Budget check
      const custBudget = getBudgetVal(c.budget);
      const minVal = getBudgetVal(budgetMin);
      const maxVal = budgetMax === "99Cr" ? Infinity : getBudgetVal(budgetMax);
      const matchBudgetRange = custBudget >= minVal && custBudget <= maxVal;

      // Date range check
      const regTime = new Date(c.created_at).getTime();
      const matchDateRange =
        (!dateMin || regTime >= new Date(dateMin).getTime()) &&
        (!dateMax || regTime <= new Date(dateMax + "T23:59:59").getTime());

      // Owner check
      const matchOwner = ownerFilter === "all" || c.owner === ownerFilter;

      // City filter fallback
      const projectDetails = projects.find((p) => p.id === c.project_id);
      const cityVal = c.city || projectDetails?.location || "";
      const matchCity =
        cityFilter === "all" || cityVal.toLowerCase().includes(cityFilter.toLowerCase());

      return (
        matchSearch &&
        matchStage &&
        matchTemp &&
        matchSource &&
        matchProject &&
        matchBudgetRange &&
        matchDateRange &&
        matchOwner &&
        matchCity
      );
    })
    .sort((a, b) => {
      if (sortField === "newest")
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortField === "oldest")
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortField === "budget_high") return getBudgetVal(b.budget) - getBudgetVal(a.budget);
      if (sortField === "budget_low") return getBudgetVal(a.budget) - getBudgetVal(b.budget);
      if (sortField === "name") return a.name.localeCompare(b.name);
      if (sortField === "priority") return (b.priority_score ?? 0) - (a.priority_score ?? 0);
      if (sortField === "last_contact") {
        const lastA = a.activities[0]?.time ? new Date(a.activities[0].time).getTime() : 0;
        const lastB = b.activities[0]?.time ? new Date(b.activities[0].time).getTime() : 0;
        return lastB - lastA;
      }
      return 0;
    });

  const handleCloseWorkspace = () => {
    setSelectedCustomerId(null);
    qc.invalidateQueries({ queryKey: ["leads"] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
  };

  return (
    <AppShell
      title="Customer Directory"
      subtitle="Unified Sales Opportunities Ledger & Customer 360 Workspace"
    >
      {/* Role-Scope Context Banner */}
      {!can(role).viewTeamLeads() && (
        <div className="mb-4 flex items-center gap-3 px-4 py-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 text-xs text-amber-700 dark:text-amber-400">
          <span className="text-base">💼</span>
          <span>
            <span className="font-bold">My Leads view:</span> You are seeing only customers assigned
            to you. Contact your Manager to view or reassign other leads.
          </span>
        </div>
      )}
      {can(role).viewTeamLeads() && !can(role).viewAllLeads() && (
        <div className="mb-4 flex items-center gap-3 px-4 py-2.5 rounded-xl border border-blue-500/20 bg-blue-500/5 text-xs text-blue-700 dark:text-blue-400">
          <span className="text-base">👨‍💼</span>
          <span>
            <span className="font-bold">Team view:</span> Showing all leads in the system. You can
            reassign leads but cannot permanently delete customer records.
          </span>
        </div>
      )}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="flex flex-col gap-4 border-b bg-muted/20 p-5">
          <div className="flex flex-row items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2 h-10 px-3 rounded-lg bg-muted flex-1 max-w-md min-w-[280px] border">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                id="customer-search-input"
                name="customer-search"
                aria-label="Search Customers"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="bg-transparent outline-none text-xs flex-1 placeholder:text-muted-foreground/80"
                placeholder="Search by name, 10-digit phone, email..."
              />
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className={`gap-1.5 h-9 text-xs ${showFilters ? "bg-primary/5 border-primary text-primary" : ""}`}
              >
                <Filter className="h-3.5 w-3.5" /> Filters
              </Button>
              <NewLeadDialog />
            </div>
          </div>

          {showFilters && (
            <div className="space-y-4 pt-3 border-t border-dashed animate-in slide-in-from-top-2 duration-200">
              {/* Presets Toolbar */}
              <div className="flex flex-row items-center justify-between flex-wrap gap-3 p-2.5 rounded-lg bg-muted/30 border">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">
                    Load Preset:
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {presets.map((p, idx) => (
                      <button
                        key={idx}
                        onClick={() => applyPreset(p)}
                        className="text-[10px] px-2.5 py-1 rounded bg-card hover:bg-muted border font-semibold text-foreground"
                      >
                        {p.name}
                      </button>
                    ))}
                    {presets.length === 0 && (
                      <span className="text-[10px] text-muted-foreground">No presets saved.</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="preset-name-input"
                    name="preset-name"
                    aria-label="New Preset Label"
                    type="text"
                    placeholder="New Preset Label"
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    className="h-7 px-2 border rounded text-[10px] bg-background focus:outline-none"
                  />
                  <Button
                    size="sm"
                    className="h-7 text-[10px] font-bold"
                    onClick={handleSavePreset}
                  >
                    Save Config
                  </Button>
                </div>
              </div>

              {/* Filters selectors grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                    Stage
                  </label>
                  <Select value={stageFilter} onValueChange={setStageFilter}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Stages</SelectItem>
                      {Object.entries(stageLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                    Temperature
                  </label>
                  <Select value={tempFilter} onValueChange={setTempFilter}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Temps</SelectItem>
                      <SelectItem value="hot">🔥 Hot</SelectItem>
                      <SelectItem value="warm">⚡ Warm</SelectItem>
                      <SelectItem value="cold">❄️ Cold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                    Project
                  </label>
                  <Select value={projectFilter} onValueChange={setProjectFilter}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
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
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                    Source
                  </label>
                  <Select value={sourceFilter} onValueChange={setSourceFilter}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sources</SelectItem>
                      {[
                        "Website",
                        "Instagram",
                        "Facebook",
                        "WhatsApp",
                        "Walk-in",
                        "Referral",
                        "Landing Page",
                      ].map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                    Sort By
                  </label>
                  <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="priority">Priority Rank</SelectItem>
                      <SelectItem value="newest">Newest Added</SelectItem>
                      <SelectItem value="oldest">Oldest Added</SelectItem>
                      <SelectItem value="budget_high">Budget: High to Low</SelectItem>
                      <SelectItem value="budget_low">Budget: Low to High</SelectItem>
                      <SelectItem value="name">Name (A-Z)</SelectItem>
                      <SelectItem value="last_contact">Last Contact</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Second row of filter widgets */}
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                    Sales Owner
                  </label>
                  <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Owners</SelectItem>
                      {[...Array.from(new Set(crmUsers.map((u) => u.name))), "Unassigned"].map(
                        (o) => (
                          <SelectItem key={o} value={o}>
                            {o}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                    City/Location
                  </label>
                  <Select value={cityFilter} onValueChange={setCityFilter}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Cities</SelectItem>
                      {["Bengaluru", "Mumbai", "Pune", "Delhi"].map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="budget-min-input"
                    className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider"
                  >
                    Min Budget
                  </label>
                  <input
                    id="budget-min-input"
                    name="budget-min"
                    type="text"
                    value={budgetMin}
                    onChange={(e) => setBudgetMin(e.target.value)}
                    placeholder="e.g. 50L"
                    className="w-full h-8 px-2.5 rounded-lg border text-xs bg-background focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="budget-max-input"
                    className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider"
                  >
                    Max Budget
                  </label>
                  <input
                    id="budget-max-input"
                    name="budget-max"
                    type="text"
                    value={budgetMax}
                    onChange={(e) => setBudgetMax(e.target.value)}
                    placeholder="e.g. 2Cr"
                    className="w-full h-8 px-2.5 rounded-lg border text-xs bg-background focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="date-min-input"
                    className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider"
                  >
                    Registration Date Range
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      id="date-min-input"
                      name="date-min"
                      type="date"
                      value={dateMin}
                      onChange={(e) => setDateMin(e.target.value)}
                      className="w-full h-8 px-1.5 rounded-lg border text-[10px] bg-background focus:outline-none"
                    />
                    <span className="text-muted-foreground">-</span>
                    <input
                      id="date-max-input"
                      name="date-max"
                      type="date"
                      value={dateMax}
                      onChange={(e) => setDateMax(e.target.value)}
                      className="w-full h-8 px-1.5 rounded-lg border text-[10px] bg-background focus:outline-none"
                      aria-label="Max Registration Date"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-sm text-muted-foreground animate-pulse">
              Loading Customers database…
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="p-16 text-center">
              <Users className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
              <h3 className="font-semibold text-foreground text-sm">No Customers Found</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                No active records match the criteria. Refine filters or ingest a new customer
                dossier.
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setQ("");
                    setStageFilter("all");
                    setTempFilter("all");
                    setSourceFilter("all");
                    setProjectFilter("all");
                  }}
                  variant="outline"
                >
                  Clear Filters
                </Button>
                <NewLeadDialog />
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="text-muted-foreground uppercase tracking-wider border-b bg-muted/10 h-10 font-semibold">
                    {can(role).assignLead() && (
                      <th className="w-10 px-4 py-2 text-center">
                        <input
                          id="toggle-all-leads-checkbox"
                          name="toggle-all-leads"
                          aria-label="Select all customers"
                          type="checkbox"
                          checked={
                            selectedLeads.length === filteredCustomers.length &&
                            filteredCustomers.length > 0
                          }
                          onChange={handleToggleAllLeads}
                          className="h-4 w-4 rounded border-gray-300 accent-primary"
                        />
                      </th>
                    )}
                    <th className="px-6 py-2">Customer Profile</th>
                    <th className="px-4 py-2">Active Project</th>
                    <th className="px-4 py-2">Source</th>
                    <th className="px-4 py-2">Budget</th>
                    <th className="px-4 py-2">Sales Owner</th>
                    <th className="px-4 py-2">Priority Rank</th>
                    <th className="px-4 py-2">Health Score</th>
                    <th className="px-4 py-2">Active Stage</th>
                    <th className="px-6 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b last:border-0 hover:bg-muted/30 transition-colors h-14"
                    >
                      {can(role).assignLead() && (
                        <td className="px-4 py-2 text-center">
                          <input
                            id={`toggle-lead-${c.id}`}
                            name={`toggle-lead-${c.id}`}
                            aria-label={`Select customer ${c.name}`}
                            type="checkbox"
                            checked={selectedLeads.includes(c.id)}
                            onChange={() => handleToggleLead(c.id)}
                            className="h-4 w-4 rounded border-gray-300 accent-primary"
                          />
                        </td>
                      )}
                      <td className="px-6 py-2">
                        <div className="font-semibold text-foreground">{c.name}</div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Phone className="h-2.5 w-2.5" />{" "}
                          <MaskedField value={c.phone} type="phone" />{" "}
                          {c.email && (
                            <>
                              | <MaskedField value={c.email} type="email" />
                            </>
                          )}
                        </div>
                        {c.created_by && (
                          <div className="text-[9px] text-muted-foreground/80 mt-0.5">
                            Created by:{" "}
                            <span className="font-semibold text-foreground/80">{c.created_by}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2 font-medium text-foreground">
                        {c.projects?.name ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground font-medium">
                        {c.source ?? "—"}
                      </td>
                      <td className="px-4 py-2 font-bold text-foreground">
                        <MaskedField value={c.budget ?? ""} type="budget" />
                      </td>
                      <td className="px-4 py-2 text-muted-foreground font-medium">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3 text-muted-foreground/60" />
                          {c.owner}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`font-bold font-mono text-xs px-2 py-0.5 rounded-full ${
                            (c.priority_score ?? 50) > 70
                              ? "bg-red-500/10 text-red-500"
                              : "bg-slate-500/10 text-muted-foreground"
                          }`}
                        >
                          {c.priority_score ?? 50}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-bold text-xs ${
                              (c.health_score ?? 80) > 75
                                ? "text-emerald-500"
                                : (c.health_score ?? 80) > 45
                                  ? "text-amber-500"
                                  : "text-red-500"
                            }`}
                          >
                            {c.health_score ?? 80}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <StageBadge value={stageLabels[c.stage as Stage] ?? c.stage} />
                      </td>
                      <td className="px-6 py-2 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedCustomerId(c.id)}
                          className="h-8 text-xs font-semibold gap-1 text-primary hover:text-primary hover:bg-primary/5"
                        >
                          Workspace <ChevronRight className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk Action floating toolbar */}
      {selectedLeads.length > 0 && can(role).assignLead() && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card border border-primary/25 rounded-full shadow-2xl px-6 py-3 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-5 duration-200">
          <span className="text-xs font-bold text-foreground">
            Selected <span className="text-primary">{selectedLeads.length}</span> leads
          </span>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-muted-foreground">
              Assign Owner:
            </span>
            <select
              value={bulkOwner}
              onChange={(e) => setBulkOwner(e.target.value)}
              className="h-8 px-2 rounded border bg-background text-xs font-semibold focus:outline-none"
            >
              <option value="">-- Select Agent --</option>
              {crmUsers.map((u) => (
                <option key={u.id} value={u.name}>
                  {u.name}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              disabled={!bulkOwner}
              onClick={handleBulkAssign}
              className="h-8 text-xs font-semibold rounded-full"
            >
              Confirm Assignment
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedLeads([])}
            className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Customer 360 Workspace Drawer */}
      <Dialog open={selectedCustomerId !== null} onOpenChange={(o) => !o && handleCloseWorkspace()}>
        <DialogContent className="max-w-5xl h-[92vh] flex flex-col p-0 overflow-hidden border border-border shadow-2xl rounded-xl">
          {selectedCustomer && (
            <Customer360Workspace
              customer={selectedCustomer}
              onClose={handleCloseWorkspace}
              role={role}
              projects={projects}
            />
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

const parseBudget = (budgetStr: string | null | undefined) => {
  if (!budgetStr) return { num: "", unit: "Lakhs" };
  const clean = budgetStr.replace(/[₹\s]/g, "");
  const numMatch = clean.match(/^[0-9.]+/);
  const num = numMatch ? numMatch[0] : "";
  const isCr = clean.toLowerCase().includes("cr");
  return {
    num,
    unit: isCr ? "Cr" : "Lakhs",
  };
};

// Enterprise Customer 360 Workspace
function Customer360Workspace({
  customer,
  onClose,
  role,
  projects,
}: {
  customer: Customer;
  onClose: () => void;
  role: AppRole | null;
  projects: any[];
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: followups = [] } = useFollowups();
  const { data: auditLogs = [] } = useAuditLogs();
  const { data: calendarEvents = [] } = useCalendarEvents();
  const { data: crmUsers = [] } = useCRMUsers();
  const [activeTab, setActiveTab] = useState("overview");

  // Overview edit fields
  const [editName, setEditName] = useState(customer.name);
  const [editPhone, setEditPhone] = useState(customer.phone);
  const [editEmail, setEditEmail] = useState(customer.email || "");
  const [editSource, setEditSource] = useState(customer.source || "Website");

  const handleSendWhatsAppTemplate = async (templateText: string) => {
    const digits = customer.phone.replace(/\D/g, "");
    const waUrl = `https://wa.me/91${digits}?text=${encodeURIComponent(templateText)}`;
    window.open(waUrl, "_blank");

    try {
      await addLeadCommunicationLog(
        customer.id,
        "whatsapp",
        "outbound",
        "Sent WhatsApp Approved Template",
        templateText,
      );
      qc.invalidateQueries({ queryKey: ["leads"] });
      toast.success("WhatsApp template triggered and communication logged!");
    } catch (err: any) {
      console.error(err);
    }
  };

  // Active Opportunity Editing state
  const activeOpp =
    customer.opportunities.find((o) => o.id === customer.activeOpportunityId) ||
    customer.opportunities[0];
  const initialBudget = parseBudget(activeOpp?.budget);
  const [editBudgetNum, setEditBudgetNum] = useState(initialBudget.num);
  const [editBudgetUnit, setEditBudgetUnit] = useState(initialBudget.unit);
  const [editTemp, setEditTemp] = useState<Temp>(activeOpp?.temperature || "warm");
  const [editStage, setEditStage] = useState<Stage>(activeOpp?.stage || "new");
  const [editOwner, setEditOwner] = useState(activeOpp?.owner || "Unassigned");
  const [editProj, setEditProj] = useState(activeOpp?.projectId || "none");

  // Note states
  const [noteContent, setNoteContent] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState("");

  // New Opportunity fields state
  const [newProjId, setNewProjId] = useState("none");
  const [newBudgetNum, setNewBudgetNum] = useState("2.0");
  const [newBudgetUnit, setNewBudgetUnit] = useState("Cr");
  const [newTemp, setNewTemp] = useState<Temp>("warm");
  const [newOwner, setNewOwner] = useState("Unassigned");

  // Activity fields state
  const [actType, setActType] = useState<"call" | "meeting" | "visit" | "whatsapp">("call");
  const [callOutcome, setCallOutcome] = useState("Answered");
  const [discussSummary, setDiscussSummary] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [custFeedback, setCustFeedback] = useState("");
  const [internalRemarks, setInternalRemarks] = useState("");
  const [fupTitle, setFupTitle] = useState("");
  const [fupTime, setFupTime] = useState("");
  const [fupPriority, setFupPriority] = useState<"high" | "medium" | "low">("medium");

  // Communication fields state
  const [commType, setCommType] = useState<"call" | "whatsapp" | "email" | "sms">("whatsapp");
  const [commDirection, setCommDirection] = useState<"inbound" | "outbound">("outbound");
  const [commSummary, setCommSummary] = useState("");
  const [commDetails, setCommDetails] = useState("");

  // Document states
  const [docCategory, setDocCategory] = useState("KYC Document");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState("2.5 MB");
  const [selectedDocFile, setSelectedDocFile] = useState<File | null>(null);

  // Booking Unit Reservation State
  const [selectedProjForBooking, setSelectedProjForBooking] = useState(
    activeOpp?.projectId || "none",
  );
  const { data: projUnits = [] } = useInventory(selectedProjForBooking);
  const { data: allUnits = [] } = useInventory();
  const [selectedUnitId, setSelectedUnitId] = useState("");

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    let reason: string | undefined = undefined;
    const STAGE_ORDER: Stage[] = [
      "new",
      "assigned",
      "contact_attempted",
      "connected",
      "interested",
      "meeting_scheduled",
      "meeting_completed",
      "site_visit_scheduled",
      "site_visit_completed",
      "negotiation",
      "booking_initiated",
      "payment_pending",
      "payment_completed",
      "converted",
      "closed",
    ];

    const oldIdx = activeOpp ? STAGE_ORDER.indexOf(activeOpp.stage) : 0;
    const newIdx = STAGE_ORDER.indexOf(editStage);

    if (activeOpp && activeOpp.stage === "closed" && editStage !== "closed") {
      const res = window.prompt(
        "Business Rule: Reopening a closed opportunity requires approval. Enter reason:",
      );
      if (!res || !res.trim()) {
        toast.error("Reopening cancelled.");
        return;
      }
      reason = res;
    } else if (newIdx !== -1 && oldIdx !== -1 && newIdx < oldIdx) {
      const res = window.prompt(
        "Business Rule: Reverting stages requires justification. Enter reason:",
      );
      if (!res || !res.trim()) {
        toast.error("Status update cancelled.");
        return;
      }
      reason = res;
    }

    try {
      await updateLead(
        customer.id,
        {
          name: editName,
          phone: editPhone,
          email: editEmail || null,
          source: editSource,
          budget: editBudgetNum ? `₹${editBudgetNum} ${editBudgetUnit}` : null,
          temperature: editTemp,
          stage: editStage,
          owner: editOwner,
          project_id: editProj,
        },
        reason,
      );

      toast.success("Profile updates saved successfully!");
      qc.invalidateQueries({ queryKey: ["leads"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to save profile");
    }
  };

  const handleArchive = async () => {
    if (
      confirm(
        "Archive this customer file? All opportunities and timeline history will be preserved.",
      )
    ) {
      try {
        await softDeleteLead(customer.id);
        toast.success("Customer profile archived.");
        onClose();
      } catch (err: any) {
        toast.error(err.message || "Archive operation blocked.");
      }
    }
  };

  const handleAddNewOpp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addCustomerOpportunity(
        customer.id,
        newProjId,
        newBudgetNum ? `₹${newBudgetNum} ${newBudgetUnit}` : "",
        newTemp,
        newOwner,
      );
      toast.success("New opportunity spawned successfully!");
      qc.invalidateQueries({ queryKey: ["leads"] });
      setActiveTab("overview");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) return;
    try {
      const author = user?.user_metadata?.full_name || "Harshith V Malipatil";
      await addLeadNote(customer.id, noteContent, author);
      setNoteContent("");
      toast.success("Note posted.");
      qc.invalidateQueries({ queryKey: ["leads"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteNote = async (noteId: string, author: string) => {
    try {
      const activeUser = user?.user_metadata?.full_name || "Harshith V Malipatil";
      await deleteLeadNote(customer.id, noteId, activeUser, role || "sales_executive");
      toast.success("Note removed.");
      qc.invalidateQueries({ queryKey: ["leads"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!discussSummary.trim() || !nextAction.trim()) {
      toast.error("Please add Discussion Summary and Next Action details.");
      return;
    }
    if (!fupTime) {
      toast.error("Business Rule: An interaction log requires a mandatory scheduled follow-up.");
      return;
    }
    const combinedSummary = `[Summary] ${discussSummary} | [Next Action] ${nextAction}${custFeedback.trim() ? ` | [Feedback] ${custFeedback}` : ""}${internalRemarks.trim() ? ` | [Remarks] ${internalRemarks}` : ""}`;
    try {
      await addLeadActivity(
        customer.id,
        actType,
        combinedSummary,
        fupTitle || `Follow-up callback: ${nextAction.slice(0, 30)}`,
        fupTime,
        fupPriority,
        actType === "call" ? callOutcome : undefined,
      );
      toast.success("Activity logged and follow-up scheduled!");
      setDiscussSummary("");
      setNextAction("");
      setCustFeedback("");
      setInternalRemarks("");
      setFupTitle("");
      setFupTime("");
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["followups"] });
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleLogComm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commSummary.trim()) return;
    try {
      await addLeadCommunicationLog(
        customer.id,
        commType,
        commDirection,
        commSummary,
        commDetails || undefined,
      );
      toast.success("Communication logged!");
      setCommSummary("");
      setCommDetails("");
      qc.invalidateQueries({ queryKey: ["leads"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleReserve = async () => {
    if (!selectedUnitId) {
      toast.error("Please select an available inventory unit.");
      return;
    }
    try {
      await reserveUnit(selectedUnitId, customer.id);
      toast.success("Unit reserved and holding lock activated!");
      setSelectedUnitId("");
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleCancelReserve = async () => {
    if (confirm("Cancel this booking holding lock and release the unit back to inventory?")) {
      try {
        const activeBookingId = activeOpp?.booking?.id;
        await cancelBooking(customer.id, activeBookingId);
        toast.success("Reservation voided.");
        qc.invalidateQueries({ queryKey: ["leads"] });
        qc.invalidateQueries({ queryKey: ["inventory"] });
      } catch (err: any) {
        toast.error(err.message);
      }
    }
  };

  const handleVerifyPayment = async (bookingId?: string) => {
    try {
      const activeBookingId = bookingId || activeOpp?.booking?.id;
      await confirmBookingPayment(customer.id, activeBookingId);
      toast.success("Invoice cleared and Unit sold! Opportunity converted.");
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleUploadDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileName.trim() || !selectedDocFile) {
      toast.error("Please select a file to upload.");
      return;
    }
    const fileExt = fileName.split(".").pop()?.toLowerCase();
    const validExts = ["pdf", "docx", "png", "jpg", "jpeg", "mp3", "m4a", "wav"];
    if (!fileExt || !validExts.includes(fileExt)) {
      toast.error("Unsupported file type. Allowed: PDF, DOCX, PNG, JPG, voice records.");
      return;
    }
    const sizeNum = selectedDocFile.size / (1024 * 1024);
    if (sizeNum > 10) {
      toast.error("File size cannot exceed 10 MB limit.");
      return;
    }

    try {
      toast.loading("Uploading document...", { id: "doc-upload" });

      // Read file as Base64 Data URL
      const base64Data: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(selectedDocFile);
      });

      let finalUrl = base64Data;
      try {
        const res = await uploadProjectFile(
          base64Data,
          selectedDocFile.name,
          selectedDocFile.type || "application/octet-stream",
          customer.id,
        );
        if (res && res.url) {
          finalUrl = res.url;
        }
      } catch (uploadErr) {
        // Fall back to data URL
      }

      await addCustomerDocument(
        customer.id,
        selectedDocFile.name,
        finalUrl,
        selectedDocFile.size,
        docCategory,
      );

      setFileName("");
      setSelectedDocFile(null);
      toast.success("Document attached to profile folder.", { id: "doc-upload" });
      qc.invalidateQueries({ queryKey: ["leads"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to attach document", { id: "doc-upload" });
    }
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Header Panel */}
      <div className="px-6 py-4 bg-muted/40 border-b flex flex-row items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold font-display text-foreground">{customer.name}</h2>
            <div className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border bg-card text-foreground">
              Customer ID: {customer.id}
            </div>
            {customer.created_by && (
              <div className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border bg-primary/5 text-primary border-primary/20">
                Created By: {customer.created_by}
              </div>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3" /> {customer.phone}{" "}
              {customer.email && `| ${customer.email}`}
            </span>
            <span className="inline-flex items-center gap-2 border-l pl-3">
              <a
                href={`tel:${customer.phone}`}
                className="inline-flex items-center gap-1 text-[10px] font-bold text-primary hover:bg-primary/5 px-2 py-0.5 rounded border border-primary/20"
              >
                📞 Call
              </a>
              <Select onValueChange={(val) => handleSendWhatsAppTemplate(val)}>
                <SelectTrigger className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-600/20 h-6 bg-transparent">
                  <SelectValue placeholder="💬 Send Template" />
                </SelectTrigger>
                <SelectContent>
                  {[
                    {
                      id: "intro",
                      label: "👋 Introduction",
                      text: `Hi ${customer.name}, thank you for registering interest in ${customer.projects?.name || "our project"}. I'm your assigned executive, how can I help you today?`,
                    },
                    {
                      id: "followup",
                      label: "📞 Follow-up Chat",
                      text: `Hi ${customer.name}, following up regarding our conversation. Please let me know a convenient time to discuss.`,
                    },
                    {
                      id: "site_visit",
                      label: "📍 Site Visit Confirmation",
                      text: `Hi ${customer.name}, confirming our site visit scheduled for ${customer.projects?.name || "the project"}. Looking forward to showing you the property!`,
                    },
                  ].map((t) => (
                    <SelectItem key={t.id} value={t.text}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StageBadge value={stageLabels[customer.stage as Stage] ?? customer.stage} />
          <TempBadge value={tempLabels[customer.temperature as Temp] ?? customer.temperature} />
          {can(role).deleteCustomer() && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleArchive}
              className="text-muted-foreground hover:text-destructive h-9 w-9"
            >
              <Trash2 className="h-4.5 w-4.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Visual Chevron Stage Progress Tracker */}
      <div className="px-6 py-2.5 bg-muted/20 border-b overflow-x-auto flex items-center gap-1.5 scrollbar-none text-left">
        {[
          { key: "new", label: "New" },
          { key: "assigned", label: "Assigned" },
          { key: "connected", label: "Connected" },
          { key: "interested", label: "Interested" },
          { key: "visit", label: "Visit" },
          { key: "negotiation", label: "Negotiation" },
          { key: "booking", label: "Booking" },
          { key: "converted", label: "Converted" },
        ].map((step, sIdx, stepsArr) => {
          const getStageStepIndex = (st: string) => {
            if (st === "new") return 0;
            if (st === "assigned") return 1;
            if (st === "connected" || st === "contact_attempted") return 2;
            if (st === "interested") return 3;
            if (st.includes("visit") || st.includes("meeting")) return 4;
            if (st === "negotiation") return 5;
            if (st.includes("booking") || st === "payment_pending") return 6;
            if (st === "converted" || st === "payment_completed") return 7;
            return 0;
          };

          const currentStepIdx = getStageStepIndex(customer.stage);
          const isCompleted = sIdx < currentStepIdx;
          const isActive = sIdx === currentStepIdx;

          // Creative Color Progression:
          // Steps 0..5 (New, Assigned, Connected, Interested, Visit, Negotiation): NEVER GREEN!
          // Steps 6 & 7 (Booking, Converted): GREEN ONLY HERE!
          let badgeStyle = "bg-card text-muted-foreground/80 border-border/80 font-medium";

          if (isActive) {
            if (sIdx >= 6) {
              badgeStyle =
                "bg-emerald-600 text-white border-emerald-600 font-bold shadow-md shadow-emerald-500/25 ring-2 ring-emerald-500/30";
            } else if (sIdx === 5) {
              badgeStyle =
                "bg-amber-600 text-white border-amber-600 font-bold shadow-sm shadow-amber-500/20";
            } else if (sIdx === 3 || sIdx === 4) {
              badgeStyle =
                "bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 font-bold shadow-sm";
            } else {
              badgeStyle =
                "bg-blue-600 text-white border-blue-600 font-bold shadow-sm shadow-blue-500/20";
            }
          } else if (isCompleted) {
            if (sIdx >= 6) {
              badgeStyle =
                "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-bold shadow-xs";
            } else if (sIdx === 5) {
              badgeStyle =
                "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25 font-semibold";
            } else if (sIdx === 3 || sIdx === 4) {
              badgeStyle =
                "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/25 font-semibold";
            } else {
              badgeStyle =
                "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25 font-semibold";
            }
          }

          return (
            <div key={step.key} className="flex items-center gap-1.5 whitespace-nowrap">
              <span className={`text-[10px] px-2.5 py-1 rounded-full border transition-all ${badgeStyle}`}>
                {step.label}
              </span>
              {sIdx < stepsArr.length - 1 && (
                <span className="text-muted-foreground/40 text-[10px]">→</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Main Workspace Split */}
      <div className="flex-1 grid grid-cols-12 overflow-hidden bg-muted/5">
        {/* Left Sidebar Info panel */}
        <div className="col-span-12 lg:col-span-3 border-r bg-card p-4 space-y-5 overflow-y-auto text-left">
          {/* Customer Scores */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider font-display">
              Dynamic Analytics
            </h3>
            <div className="p-3.5 border border-border/80 rounded-xl bg-muted/20 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-semibold">
                  Priority Rank Score
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    (customer.priority_score ?? 50) > 70
                      ? "bg-red-500/10 text-red-500 border border-red-500/20"
                      : (customer.priority_score ?? 50) > 40
                        ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                        : "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                  }`}
                >
                  {customer.priority_score ?? 50}/100
                </span>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="space-y-2.5">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider font-display">
              Active Opportunity
            </h3>
            <div className="space-y-1.5 text-xs border rounded-xl p-3 bg-muted/10">
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground">Budget Weight</span>
                <span className="font-bold text-foreground">
                  <MaskedField value={activeOpp?.budget || ""} type="budget" />
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground">Active Stage</span>
                <span className="font-bold text-primary">
                  {stageLabels[customer.stage as Stage] ?? customer.stage}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground">Sales Owner</span>
                <span className="font-semibold text-foreground">{customer.owner}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Created Date</span>
                <span className="text-muted-foreground font-mono">
                  {new Date(customer.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* SLA Alerter */}
          <div className="space-y-2">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider font-display">
              Response SLA
            </h3>
            {customer.stage === "new" ? (
              <div className="p-3 border border-red-500/20 bg-red-500/5 text-red-600 rounded-xl text-xs flex gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <div className="leading-tight">
                  <span className="font-bold">SLA Violation Alert</span>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-normal">
                    Untouched contact profile. SLA action required within 30 mins.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3 border border-emerald-500/20 bg-emerald-500/5 text-emerald-600 rounded-xl text-xs flex gap-2">
                <Check className="h-4 w-4 shrink-0" />
                <div className="leading-tight">
                  <span className="font-bold">SLA Compliant</span>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-normal">
                    Active interactions logged on schedule.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Presets templates */}
          <div className="space-y-2">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider font-display">
              Quick templates
            </h3>
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-left justify-start text-[11px] h-8.5 font-medium hover:bg-muted"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `Hi ${customer.name}, following up regarding Aurelia Heights. Let me know a good time to connect!`,
                  );
                  toast.success("Follow-up template copied!");
                }}
              >
                📋 Copy Followup Msg
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-left justify-start text-[11px] h-8.5 font-medium hover:bg-muted"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `Hi ${customer.name}, confirming our site visit scheduled for Sky Meadows on Saturday.`,
                  );
                  toast.success("Site Visit template copied!");
                }}
              >
                📋 Copy Visit Confirmation
              </Button>
            </div>
          </div>
        </div>

        {/* Right 13-Tab Workspaces */}
        <div className="col-span-12 lg:col-span-9 flex flex-col overflow-hidden bg-card/40">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <div className="px-4 border-b bg-card overflow-x-auto">
              <TabsList className="h-12 w-max justify-start bg-transparent p-0 gap-5 border-b-0">
                <TabsTrigger
                  value="overview"
                  className="h-12 border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-0 text-xs font-semibold bg-transparent data-[state=active]:bg-transparent"
                >
                  Overview
                </TabsTrigger>
                <TabsTrigger
                  value="opportunities"
                  className="h-12 border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-0 text-xs font-semibold bg-transparent data-[state=active]:bg-transparent"
                >
                  Opportunities ({customer.opportunities.length})
                </TabsTrigger>
                <TabsTrigger
                  value="timeline"
                  className="h-12 border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-0 text-xs font-semibold bg-transparent data-[state=active]:bg-transparent"
                >
                  Timeline
                </TabsTrigger>
                <TabsTrigger
                  value="activities"
                  className="h-12 border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-0 text-xs font-semibold bg-transparent data-[state=active]:bg-transparent"
                >
                  Activities
                </TabsTrigger>
                <TabsTrigger
                  value="communication"
                  className="h-12 border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-0 text-xs font-semibold bg-transparent data-[state=active]:bg-transparent"
                >
                  Communication
                </TabsTrigger>
                <TabsTrigger
                  value="followups"
                  className="h-12 border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-0 text-xs font-semibold bg-transparent data-[state=active]:bg-transparent"
                >
                  Followups
                </TabsTrigger>
                <TabsTrigger
                  value="meetings"
                  className="h-12 border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-0 text-xs font-semibold bg-transparent data-[state=active]:bg-transparent"
                >
                  Meetings
                </TabsTrigger>
                <TabsTrigger
                  value="visits"
                  className="h-12 border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-0 text-xs font-semibold bg-transparent data-[state=active]:bg-transparent"
                >
                  Visits
                </TabsTrigger>
                <TabsTrigger
                  value="bookings"
                  className="h-12 border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-0 text-xs font-semibold bg-transparent data-[state=active]:bg-transparent"
                >
                  Bookings
                </TabsTrigger>
                <TabsTrigger
                  value="invoices"
                  className="h-12 border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-0 text-xs font-semibold bg-transparent data-[state=active]:bg-transparent"
                >
                  Invoices
                </TabsTrigger>
                <TabsTrigger
                  value="payments"
                  className="h-12 border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-0 text-xs font-semibold bg-transparent data-[state=active]:bg-transparent"
                >
                  Payments
                </TabsTrigger>
                <TabsTrigger
                  value="documents"
                  className="h-12 border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-0 text-xs font-semibold bg-transparent data-[state=active]:bg-transparent"
                >
                  Documents
                </TabsTrigger>
                <TabsTrigger
                  value="audit"
                  className="h-12 border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-0 text-xs font-semibold bg-transparent data-[state=active]:bg-transparent"
                >
                  Audit Trail
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto p-5 bg-muted/10 text-left">
              {/* TAB 1: OVERVIEW */}
              <TabsContent value="overview" className="m-0 space-y-4">
                <form onSubmit={handleSaveProfile} className="space-y-4 max-w-xl">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Customer Name</Label>
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Phone Number</Label>
                      <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Email</Label>
                      <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Dossier Ingest Source</Label>
                      <Input value={editSource} onChange={(e) => setEditSource(e.target.value)} />
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="text-xs font-bold text-foreground mb-3 flex items-center gap-1.5">
                      <Layers className="h-4 w-4 text-primary" /> Active Opportunity Controls
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>Budget Description</Label>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            step="any"
                            placeholder="e.g. 2.5 or 80"
                            value={editBudgetNum}
                            onChange={(e) => setEditBudgetNum(e.target.value)}
                            className="flex-1"
                          />
                          <Select value={editBudgetUnit} onValueChange={setEditBudgetUnit}>
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
                      <div className="space-y-1.5">
                        <Label>Interested Project</Label>
                        <Select value={editProj} onValueChange={setEditProj}>
                          <SelectTrigger>
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
                    </div>

                    <div className="grid grid-cols-3 gap-4 mt-4">
                      <div className="space-y-1.5">
                        <Label>Temperature</Label>
                        <Select value={editTemp} onValueChange={(v) => setEditTemp(v as Temp)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="hot">🔥 Hot</SelectItem>
                            <SelectItem value="warm">⚡ Warm</SelectItem>
                            <SelectItem value="cold">❄️ Cold</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Stage</Label>
                        <Select
                          value={editStage}
                          onValueChange={(v) => setEditStage(v as Stage)}
                          disabled={
                            customer.stage === "converted" ||
                            customer.stage === "booking_initiated" ||
                            customer.stage === "payment_pending" ||
                            customer.stage === "payment_completed" ||
                            customer.stage === "closed"
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(stageLabels).map(([k, v]) => (
                              <SelectItem key={k} value={k}>
                                {v}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Executive Owner</Label>
                        <Select
                          value={editOwner}
                          onValueChange={setEditOwner}
                          disabled={!can(role).reassignLead()}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Unassigned">Unassigned</SelectItem>
                            {crmUsers.map((u) => (
                              <SelectItem key={u.id} value={u.name}>
                                {u.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <Button type="submit" size="sm" className="mt-4">
                    Save Customer Dossier Updates
                  </Button>
                </form>

                {/* Notes section embedded in overview for convenience */}
                <div className="border-t pt-5 mt-5 max-w-xl">
                  <h4 className="text-xs font-bold text-foreground mb-3 flex items-center gap-1.5">
                    <Pin className="h-4 w-4 text-muted-foreground" /> Customer Notes Pinboard
                  </h4>
                  <form onSubmit={handleAddNote} className="space-y-2">
                    <textarea
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      className="w-full h-16 p-3 rounded-lg border text-xs focus:ring-1 focus:ring-primary outline-none bg-card"
                      placeholder="Pin a quick note to this file..."
                    />
                    <Button type="submit" size="sm">
                      <Plus className="h-3.5 w-3.5 mr-1" /> Post Note
                    </Button>
                  </form>

                  <div className="space-y-2.5 mt-4">
                    {customer.notes.map((n) => (
                      <div
                        key={n.id}
                        className={`p-3 rounded-lg border text-xs relative bg-card ${n.pinned ? "border-amber-400/40 bg-amber-500/[0.01]" : "border-border/60"}`}
                      >
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="font-bold text-[10px] text-muted-foreground">
                            {n.author} · {new Date(n.created_at).toLocaleDateString()}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteNote(n.id, n.author)}
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className="text-foreground leading-relaxed">{n.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* TAB 2: OPPORTUNITIES (MULTI-DEAL LEDGER) */}
              <TabsContent value="opportunities" className="m-0 space-y-5">
                <div className="flex justify-between items-center flex-wrap gap-2 border-b pb-3">
                  <div>
                    <h3 className="font-semibold text-sm text-foreground">Sales Opportunities</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      A history of real estate purchases or bookings initiated by this client.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {customer.opportunities.map((opp, idx) => {
                    const proj = projects.find((p) => p.id === opp.projectId);
                    const isActive = opp.id === customer.activeOpportunityId;
                    return (
                      <Card
                        key={opp.id}
                        className={`border-border/80 shadow-sm relative ${isActive ? "ring-1 ring-primary border-primary/40" : ""}`}
                      >
                        {isActive && (
                          <span className="absolute top-3 right-3 text-[9px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20">
                            Active deal
                          </span>
                        )}
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
                            Opportunity #{idx + 1}
                          </CardTitle>
                          <h4 className="text-sm font-bold text-foreground mt-1">
                            {proj?.name || "Unknown Project"}
                          </h4>
                        </CardHeader>
                        <CardContent className="text-xs space-y-2 pb-4">
                          <div className="grid grid-cols-2 gap-y-1 gap-x-2 text-[11px]">
                            <span className="text-muted-foreground">Budget:</span>
                            <span className="font-semibold text-foreground">{opp.budget}</span>
                            <span className="text-muted-foreground">Stage:</span>
                            <span className="font-semibold text-foreground capitalize">
                              {opp.stage}
                            </span>
                            <span className="text-muted-foreground">Temp:</span>
                            <span className="font-semibold text-foreground capitalize">
                              {opp.temperature}
                            </span>
                            <span className="text-muted-foreground">Owner:</span>
                            <span className="font-semibold text-foreground">{opp.owner}</span>
                            <span className="text-muted-foreground">Started:</span>
                            <span className="text-muted-foreground font-mono">
                              {new Date(opp.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                <form
                  onSubmit={handleAddNewOpp}
                  className="max-w-xl p-4 border rounded-xl bg-card space-y-4 mt-4"
                >
                  <h4 className="font-bold text-xs uppercase tracking-wider text-foreground">
                    Launch New Sales Opportunity
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Target Project</Label>
                      <Select value={newProjId} onValueChange={setNewProjId}>
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
                      <Label>Opportunity Budget</Label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          step="any"
                          placeholder="e.g. 2.0"
                          value={newBudgetNum}
                          onChange={(e) => setNewBudgetNum(e.target.value)}
                          className="flex-1"
                        />
                        <Select value={newBudgetUnit} onValueChange={setNewBudgetUnit}>
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
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Lead Temperature</Label>
                      <Select value={newTemp} onValueChange={(v) => setNewTemp(v as Temp)}>
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
                    <div className="space-y-1.5">
                      <Label>Sales Executive</Label>
                      <Select value={newOwner} onValueChange={setNewOwner}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Unassigned">Unassigned</SelectItem>
                          {crmUsers.map((u) => (
                            <SelectItem key={u.id} value={u.name}>
                              {u.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button type="submit" size="sm">
                    <Plus className="h-3.5 w-3.5 mr-1" /> Open Opportunity
                  </Button>
                </form>
              </TabsContent>

              {/* TAB 3: TIMELINE */}
              <TabsContent value="timeline" className="m-0">
                <div className="relative pl-8 border-l border-border space-y-6 max-w-lg py-2 text-left">
                  {(customer.timeline || []).map((evt, i) => {
                    const getTimelineIconConfig = (titleStr: string) => {
                      const t = titleStr.toLowerCase();
                      if (t.includes("call")) {
                        return {
                          icon: <PhoneCall className="h-3.5 w-3.5" />,
                          bgClass:
                            "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400",
                        };
                      }
                      if (t.includes("meeting")) {
                        return {
                          icon: <Handshake className="h-3.5 w-3.5" />,
                          bgClass:
                            "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400",
                        };
                      }
                      if (t.includes("visit")) {
                        return {
                          icon: <Compass className="h-3.5 w-3.5" />,
                          bgClass:
                            "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
                        };
                      }
                      if (t.includes("whatsapp")) {
                        return {
                          icon: <MessageCircle className="h-3.5 w-3.5" />,
                          bgClass:
                            "bg-teal-500/10 border-teal-500/30 text-teal-600 dark:text-teal-400",
                        };
                      }
                      if (t.includes("note")) {
                        return {
                          icon: <FileSignature className="h-3.5 w-3.5" />,
                          bgClass:
                            "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400",
                        };
                      }
                      if (t.includes("stage") || t.includes("status")) {
                        return {
                          icon: <TrendingUp className="h-3.5 w-3.5" />,
                          bgClass:
                            "bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400",
                        };
                      }
                      if (t.includes("assign") || t.includes("owner")) {
                        return {
                          icon: <UserCheck className="h-3.5 w-3.5" />,
                          bgClass: "bg-sky-500/10 border-sky-500/30 text-sky-600 dark:text-sky-400",
                        };
                      }
                      return {
                        icon: <Info className="h-3.5 w-3.5" />,
                        bgClass: "bg-muted border-border text-muted-foreground",
                      };
                    };

                    const { icon, bgClass } = getTimelineIconConfig(evt.title);

                    return (
                      <div key={i} className="relative flex gap-3.5 items-start group">
                        <div
                          className={`absolute -left-[46px] top-0.5 h-8 w-8 rounded-full border flex items-center justify-center shadow-md transition-all duration-300 group-hover:scale-110 ${bgClass}`}
                        >
                          {icon}
                        </div>
                        <div className="flex-1 min-w-0 bg-card border border-border rounded-lg p-3 text-left">
                          <div className="text-xs font-bold text-foreground leading-snug">
                            {evt.title}
                          </div>
                          {evt.description && (
                            <p className="text-[11px] text-muted-foreground mt-1 leading-normal font-normal">
                              {evt.description}
                            </p>
                          )}
                          <div className="text-[9px] text-muted-foreground/60 flex items-center gap-1 mt-2 font-medium tracking-wide">
                            <Clock className="h-2.5 w-2.5" />{" "}
                            {new Date(evt.time).toLocaleString("en-IN", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {(!customer.timeline || customer.timeline.length === 0) && (
                    <p className="text-xs text-muted-foreground">
                      No operations logged on timeline.
                    </p>
                  )}
                </div>
              </TabsContent>

              {/* TAB 4: ACTIVITIES (INTERACTION LOGGER) */}
              <TabsContent value="activities" className="m-0 space-y-6">
                <form
                  onSubmit={handleAddActivity}
                  className="space-y-4 max-w-xl p-4 border rounded-xl bg-card"
                >
                  <h3 className="font-semibold text-xs text-foreground uppercase tracking-wider">
                    Log Interaction Outcome
                  </h3>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label>Type</Label>
                      <Select value={actType} onValueChange={(v: any) => setActType(v)}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="call">📞 Call Outcome</SelectItem>
                          <SelectItem value="meeting">🤝 Meeting Held</SelectItem>
                          <SelectItem value="visit">📍 Site Visit completed</SelectItem>
                          <SelectItem value="whatsapp">💬 WhatsApp Message sent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {actType === "call" && (
                      <div className="space-y-1.5">
                        <Label>Call Outcome *</Label>
                        <Select value={callOutcome} onValueChange={setCallOutcome}>
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Answered">✅ Answered</SelectItem>
                            <SelectItem value="No Answer">❌ No Answer</SelectItem>
                            <SelectItem value="Busy">📵 Busy</SelectItem>
                            <SelectItem value="Switched Off">📴 Switched Off</SelectItem>
                            <SelectItem value="Callback Requested">
                              📞 Callback Requested
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-1.5 col-span-2 sm:col-span-1">
                      <Label>Follow-up priority</Label>
                      <Select value={fupPriority} onValueChange={(v: any) => setFupPriority(v)}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="high">🚨 High Priority</SelectItem>
                          <SelectItem value="medium">⚡ Medium Priority</SelectItem>
                          <SelectItem value="low">❄️ Low Priority</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5 text-xs font-semibold">
                      <Label>Discussion Summary *</Label>
                      <textarea
                        value={discussSummary}
                        onChange={(e) => setDiscussSummary(e.target.value)}
                        className="w-full h-20 p-3 rounded-lg border text-xs focus:ring-1 focus:ring-primary outline-none"
                        placeholder="Details discussed..."
                        required
                      />
                    </div>
                    <div className="space-y-1.5 text-xs font-semibold">
                      <Label>Next Action *</Label>
                      <textarea
                        value={nextAction}
                        onChange={(e) => setNextAction(e.target.value)}
                        className="w-full h-20 p-3 rounded-lg border text-xs focus:ring-1 focus:ring-primary outline-none"
                        placeholder="Next steps..."
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5 text-xs font-semibold">
                      <Label>Customer Feedback</Label>
                      <textarea
                        value={custFeedback}
                        onChange={(e) => setCustFeedback(e.target.value)}
                        className="w-full h-20 p-3 rounded-lg border text-xs focus:ring-1 focus:ring-primary outline-none"
                        placeholder="Customer response..."
                      />
                    </div>
                    <div className="space-y-1.5 text-xs font-semibold">
                      <Label>Internal Remarks</Label>
                      <textarea
                        value={internalRemarks}
                        onChange={(e) => setInternalRemarks(e.target.value)}
                        className="w-full h-20 p-3 rounded-lg border text-xs focus:ring-1 focus:ring-primary outline-none"
                        placeholder="Internal notes..."
                      />
                    </div>
                  </div>

                  <div className="border-t border-dashed my-4 pt-4 space-y-3">
                    <h4 className="font-semibold text-[11px] text-primary flex items-center gap-1 uppercase tracking-wider">
                      <Clock className="h-3.5 w-3.5" /> Next Scheduled Follow-up (Mandatory Rule)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="fup-title-input">Follow-up Title</Label>
                        <Input
                          id="fup-title-input"
                          name="fup-title"
                          placeholder="e.g. Discuss 3BHK Quote details"
                          value={fupTitle}
                          onChange={(e) => setFupTitle(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="fup-time-input">Scheduled Date & Time *</Label>
                        <input
                          id="fup-time-input"
                          name="fup-time"
                          type="datetime-local"
                          required
                          value={fupTime}
                          onChange={(e) => setFupTime(e.target.value)}
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                      </div>
                    </div>
                  </div>

                  <Button type="submit" size="sm" className="w-full sm:w-auto">
                    Log Interaction & Queue Follow-up
                  </Button>
                </form>

                <div className="space-y-3 max-w-xl">
                  <h3 className="font-semibold text-xs text-foreground uppercase tracking-wider">
                    Historical Logs
                  </h3>
                  {customer.activities.map((a) => (
                    <div
                      key={a.id}
                      className="p-3 border border-border/50 rounded-lg bg-card text-xs flex flex-row items-start gap-3"
                    >
                      <div className="p-2 rounded bg-muted">
                        {a.type === "call" && "📞"}
                        {a.type === "meeting" && "🤝"}
                        {a.type === "visit" && "📍"}
                        {a.type === "whatsapp" && "💬"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">
                            {a.type} interaction
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {new Date(a.time).toLocaleString()}
                          </span>
                        </div>
                        <p className="mt-1 text-foreground font-medium leading-normal">
                          {a.summary}
                        </p>
                        {a.next_followup && (
                          <div className="mt-2 text-[10px] font-semibold text-primary flex items-center gap-1 bg-primary/5 px-2 py-0.5 w-max rounded">
                            Next Callback: {new Date(a.next_followup).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              {/* TAB 5: COMMUNICATION */}
              <TabsContent value="communication" className="m-0 space-y-6">
                <form
                  onSubmit={handleLogComm}
                  className="space-y-4 max-w-xl p-4 border rounded-xl bg-card"
                >
                  <h4 className="font-bold text-xs uppercase tracking-wider text-foreground">
                    Log Customer Communication Record
                  </h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label>Channel</Label>
                      <Select value={commType} onValueChange={(v: any) => setCommType(v)}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="whatsapp">💬 WhatsApp</SelectItem>
                          <SelectItem value="call">📞 Call</SelectItem>
                          <SelectItem value="email">✉️ Email</SelectItem>
                          <SelectItem value="sms">📱 SMS</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Direction</Label>
                      <Select value={commDirection} onValueChange={(v: any) => setCommDirection(v)}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="outbound">Outbound (Sent)</SelectItem>
                          <SelectItem value="inbound">Inbound (Received)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Summary/Subject</Label>
                      <Input
                        value={commSummary}
                        onChange={(e) => setCommSummary(e.target.value)}
                        placeholder="e.g. Price quote shared"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Message Content / Transcripts</Label>
                    <textarea
                      value={commDetails}
                      onChange={(e) => setCommDetails(e.target.value)}
                      className="w-full h-16 p-3 rounded-lg border text-xs focus:ring-1"
                      placeholder="Copy WhatsApp chat transcript or email body..."
                    />
                  </div>

                  <Button type="submit" size="sm">
                    Log Communication
                  </Button>
                </form>

                <div className="space-y-3 max-w-xl">
                  <h3 className="font-semibold text-xs text-foreground uppercase tracking-wider">
                    Communication Logs
                  </h3>
                  {customer.communications.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 border border-border/60 rounded-xl bg-card text-xs"
                    >
                      <div className="flex justify-between items-center">
                        <span
                          className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            log.direction === "inbound"
                              ? "bg-cyan-500/10 text-cyan-500"
                              : "bg-indigo-500/10 text-indigo-500"
                          }`}
                        >
                          {log.direction} {log.type}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {new Date(log.time).toLocaleString()}
                        </span>
                      </div>
                      <h5 className="font-bold text-foreground mt-2">{log.summary}</h5>
                      {log.details && (
                        <p className="text-[11px] text-muted-foreground leading-normal mt-1 italic border-l-2 pl-2">
                          {log.details}
                        </p>
                      )}
                    </div>
                  ))}
                  {customer.communications.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No communication records logged.
                    </p>
                  )}
                </div>
              </TabsContent>

              {/* TAB 6: FOLLOWUPS */}
              <TabsContent value="followups" className="m-0 space-y-4">
                <div className="space-y-3 max-w-xl">
                  <h3 className="font-semibold text-xs text-foreground uppercase tracking-wider">
                    Followup Actions Checklist
                  </h3>
                  <div className="space-y-2">
                    {followups
                      .filter((f: any) => f.lead_id === customer.id)
                      .map((f: any) => (
                        <div
                          key={f.id}
                          className="p-3 border rounded-xl bg-card text-xs flex items-center justify-between gap-3 border-border/80 shadow-sm"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-foreground">{f.title}</span>
                              {f.status === "completed" && (
                                <span className="text-[9px] font-bold bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded uppercase">
                                  Completed
                                </span>
                              )}
                              {f.status === "overdue" && (
                                <span className="text-[9px] font-bold bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded uppercase">
                                  Overdue
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-1">
                              Due: {new Date(f.time).toLocaleString()} · Owner: {f.assigned_sales}
                            </div>
                          </div>
                          {f.status === "pending" && (
                            <Button
                              size="sm"
                              onClick={async () => {
                                await completeFollowup(f.id);
                                qc.invalidateQueries({ queryKey: ["leads"] });
                                qc.invalidateQueries({ queryKey: ["followups"] });
                                toast.success("Task completed!");
                              }}
                              className="h-7 text-[10px]"
                            >
                              Mark Done
                            </Button>
                          )}
                        </div>
                      ))}
                    {followups.filter((f: any) => f.lead_id === customer.id).length === 0 && (
                      <p className="text-xs text-muted-foreground">No followups scheduled.</p>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* TAB 7: MEETINGS */}
              <TabsContent value="meetings" className="m-0 space-y-4">
                <div className="space-y-3 max-w-xl">
                  <h3 className="font-semibold text-xs text-foreground uppercase tracking-wider">
                    Scheduled Client Meetings
                  </h3>
                  <div className="space-y-2">
                    {calendarEvents
                      .filter((e) => e.customerId === customer.id && e.type === "meeting")
                      .map((e) => (
                        <div
                          key={e.id}
                          className="p-3 border rounded-xl bg-card text-xs flex flex-col gap-1.5"
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-primary flex items-center gap-1">
                              <Briefcase className="h-3.5 w-3.5" /> Meeting
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {new Date(e.start).toLocaleString()}
                            </span>
                          </div>
                          <h4 className="font-bold text-foreground text-sm">{e.title}</h4>
                          {e.details && (
                            <p className="text-[11px] text-muted-foreground mt-1">{e.details}</p>
                          )}
                        </div>
                      ))}
                    {calendarEvents.filter(
                      (e) => e.customerId === customer.id && e.type === "meeting",
                    ).length === 0 && (
                      <p className="text-xs text-muted-foreground">No meetings scheduled.</p>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* TAB 8: VISITS */}
              <TabsContent value="visits" className="m-0 space-y-4">
                <div className="space-y-3 max-w-xl">
                  <h3 className="font-semibold text-xs text-foreground uppercase tracking-wider">
                    Property Site Visits
                  </h3>
                  <div className="space-y-2">
                    {calendarEvents
                      .filter((e) => e.customerId === customer.id && e.type === "visit")
                      .map((e) => (
                        <div
                          key={e.id}
                          className="p-3 border rounded-xl bg-card text-xs flex flex-col gap-1.5"
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-emerald-600 flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" /> Site Visit
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {new Date(e.start).toLocaleString()}
                            </span>
                          </div>
                          <h4 className="font-bold text-foreground text-sm">{e.title}</h4>
                          {e.details && (
                            <p className="text-[11px] text-muted-foreground mt-1">{e.details}</p>
                          )}
                        </div>
                      ))}
                    {calendarEvents.filter(
                      (e) => e.customerId === customer.id && e.type === "visit",
                    ).length === 0 && (
                      <p className="text-xs text-muted-foreground">No site visits logged.</p>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* TAB 9: BOOKINGS */}
              <TabsContent value="bookings" className="m-0 space-y-4">
                {(!activeOpp?.bookings || activeOpp.bookings.length === 0) ? (
                  <div className="max-w-xl p-4 border rounded-xl bg-card space-y-4">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-primary flex items-center gap-1">
                      <DollarSign className="h-4 w-4" /> Reserve Property Unit holding
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Locks inventory availability status from double sales blocks. Generates a
                      holding invoice automatically.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>Select Project</Label>
                        <Select
                          value={selectedProjForBooking}
                          onValueChange={(v) => {
                            setSelectedProjForBooking(v);
                            setSelectedUnitId("");
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
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
                        <Label>Select Available Unit *</Label>
                        <Select value={selectedUnitId} onValueChange={setSelectedUnitId}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {projUnits.filter((u) => u.status === "available").length === 0 ? (
                              <SelectItem value="no_units" disabled>
                                No available units found
                              </SelectItem>
                            ) : (
                              projUnits
                                .filter((u) => u.status === "available")
                                .map((u) => (
                                  <SelectItem key={u.id} value={u.id}>
                                    {u.unit_number} ({u.configuration} -{" "}
                                    {(u.price / 10000000).toFixed(2)} Cr)
                                  </SelectItem>
                                ))
                            )}
                          </SelectContent>
                        </Select>
                        {projUnits.length === 0 && (
                          <p className="text-[10px] text-amber-500 mt-1 font-medium">
                            ⚠️ No units found. Add units in the Inventory tab.
                          </p>
                        )}
                      </div>
                    </div>
                    <Button onClick={handleReserve} disabled={!selectedUnitId} className="mt-2">
                      Confirm Unit Holding Lock
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center max-w-xl pb-2">
                      <h3 className="font-semibold text-xs text-foreground uppercase tracking-wider">
                        Active Unit Hold Bookings ({activeOpp.bookings.length})
                      </h3>
                    </div>

                    {activeOpp.bookings.map((booking: any) => {
                      const resolvedUnitNumber = allUnits.find((u) => u.id === booking.unit_id)?.unit_number || booking.unit_id;
                      return (
                        <div
                          key={booking.id}
                          className="max-w-xl p-4 border border-amber-500/20 bg-amber-500/[0.01] rounded-xl space-y-3 shadow-xs"
                        >
                          <h4 className="font-bold text-xs text-amber-500 uppercase tracking-wider flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                            Unit Hold Booking Active: #BK-{booking.id.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase()}
                          </h4>
                          <div className="text-xs grid grid-cols-2 gap-y-1.5 max-w-xs text-left">
                            <span className="font-medium text-muted-foreground">Allocated Unit:</span>
                            <span className="font-bold font-mono text-foreground">{resolvedUnitNumber}</span>
                            <span className="font-medium text-muted-foreground">Holding Amount:</span>
                            <span className="font-bold text-foreground">
                              ₹{booking.amount.toLocaleString("en-IN")}
                            </span>
                            <span className="font-medium text-muted-foreground">Hold Status:</span>
                            <span className="font-bold text-amber-600 capitalize">
                              {booking.payment_status}
                            </span>
                          </div>
                          <div className="flex gap-2 pt-2">
                            {booking.payment_status === "pending" && (
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                                onClick={() => handleVerifyPayment(booking.id)}
                              >
                                Confirm & Verify Payment
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive hover:bg-destructive/5"
                              onClick={async () => {
                                if (confirm(`Cancel booking for Unit ${resolvedUnitNumber} and release back to available?`)) {
                                  try {
                                    await cancelBooking(customer.id, booking.id);
                                    toast.success(`Booking voided for Unit ${resolvedUnitNumber}.`);
                                    qc.invalidateQueries({ queryKey: ["leads"] });
                                    qc.invalidateQueries({ queryKey: ["inventory"] });
                                  } catch (err: any) {
                                    toast.error(err.message);
                                  }
                                }
                              }}
                            >
                              Release Holding
                            </Button>
                          </div>
                        </div>
                      );
                    })}

                    {/* Reserve another unit dialog option */}
                    <div className="mt-4 pt-4 border-t max-w-xl">
                      <details className="group border rounded-xl bg-card">
                        <summary className="p-3 text-xs font-bold text-muted-foreground cursor-pointer flex justify-between items-center uppercase tracking-wider select-none">
                          ➕ Reserve Another Unit holding
                        </summary>
                        <div className="p-4 border-t space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5 text-left">
                              <Label>Select Project</Label>
                              <Select
                                value={selectedProjForBooking}
                                onValueChange={(v) => {
                                  setSelectedProjForBooking(v);
                                  setSelectedUnitId("");
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue />
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
                            <div className="space-y-1.5 text-left">
                              <Label>Select Available Unit *</Label>
                              <Select value={selectedUnitId} onValueChange={setSelectedUnitId}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {projUnits.filter((u) => u.status === "available").length === 0 ? (
                                    <SelectItem value="no_units" disabled>
                                      No available units found
                                    </SelectItem>
                                  ) : (
                                    projUnits
                                      .filter((u) => u.status === "available")
                                      .map((u) => (
                                        <SelectItem key={u.id} value={u.id}>
                                          {u.unit_number} ({u.configuration} -{" "}
                                          {(u.price / 10000000).toFixed(2)} Cr)
                                        </SelectItem>
                                      ))
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <Button onClick={handleReserve} disabled={!selectedUnitId}>
                            Confirm Additional Unit Holding
                          </Button>
                        </div>
                      </details>
                    </div>

                  </div>
                )}
              </TabsContent>

              {/* TAB 10: INVOICES */}
              <TabsContent value="invoices" className="m-0 space-y-4">
                <div className="space-y-3 max-w-xl text-left">
                  <h3 className="font-semibold text-xs text-foreground uppercase tracking-wider">
                    Billing Statements & Invoices
                  </h3>
                  {activeOpp?.bookings?.flatMap((b: any) => (b.invoices || []).map((inv: any) => ({ ...inv, unit_id: b.unit_id }))).map((inv: any) => {
                    const resolvedUnitNum = allUnits.find((u) => u.id === inv.unit_id)?.unit_number || "Unit";
                    return (
                      <div
                        key={inv.id}
                        className="p-4 border rounded-xl bg-card text-xs flex justify-between items-center shadow-sm"
                      >
                        <div className="space-y-1">
                          <div className="font-bold text-foreground flex items-center gap-2">
                            <span>Invoice #{inv.id.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase()}</span>
                            <span className="text-[10px] text-muted-foreground font-semibold">
                              (Unit: {resolvedUnitNum})
                            </span>
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase ${
                                inv.status === "paid"
                                  ? "bg-emerald-500/10 text-emerald-500"
                                  : "bg-amber-500/10 text-amber-500"
                              }`}
                            >
                              {inv.status}
                            </span>
                          </div>
                          <p className="text-muted-foreground">
                            Due: {new Date(inv.dueDate).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-foreground text-sm">
                            ₹{inv.amount.toLocaleString("en-IN")}
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[10px] gap-1 font-semibold"
                              onClick={async () => {
                                try {
                                  toast.loading("Generating PDF Tax Invoice...", { id: "pdf-gen" });
                                  await downloadPdfInvoice({
                                    bookingId: inv.booking_id,
                                    leadId: customer.id,
                                    customerName: customer.name,
                                    customerPhone: customer.phone,
                                    customerEmail: customer.email || undefined,
                                    projectName: activeOpp?.projectId || "BLX Realty Project",
                                    unitNumber: resolvedUnitNum,
                                    amount: inv.amount,
                                    paymentStatus: inv.status,
                                    bookingDate: new Date().toISOString(),
                                  });
                                  toast.success("Official PDF Tax Invoice downloaded!", { id: "pdf-gen" });
                                } catch (err: any) {
                                  toast.error(err.message || "Failed to generate PDF", { id: "pdf-gen" });
                                }
                              }}
                            >
                              <FileText className="h-3 w-3" /> Download PDF
                            </Button>
                            {inv.status === "unpaid" && can(role).approveBookingRequest() && (
                              <Button
                                size="sm"
                                className="h-7 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                                onClick={() => handleVerifyPayment(inv.booking_id)}
                              >
                                Clear invoice
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {(!activeOpp?.bookings || activeOpp.bookings.flatMap((b: any) => b.invoices || []).length === 0) && (
                    <p className="text-xs text-muted-foreground">
                      No invoices issued. Reserve a unit first.
                    </p>
                  )}
                </div>
              </TabsContent>

              {/* TAB 11: PAYMENTS */}
              <TabsContent value="payments" className="m-0 space-y-4">
                <div className="space-y-3 max-w-xl">
                  <h3 className="font-semibold text-xs text-foreground uppercase tracking-wider">
                    Settled Payments Ledger
                  </h3>
                  {activeOpp?.bookings
                    ?.flatMap((b: any) => 
                      (b.invoices || []).flatMap((inv: any) => 
                        (inv.payments || []).map((pay: any) => ({ ...pay, unit_id: b.unit_id }))
                      )
                    )
                    ?.map((pay: any) => {
                      const resolvedUnitNum = allUnits.find((u) => u.id === pay.unit_id)?.unit_number || "Unit";
                      return (
                        <div
                          key={pay.id}
                          className="p-3 border border-emerald-500/10 bg-emerald-500/[0.01] rounded-xl text-xs flex justify-between items-center"
                        >
                          <div>
                            <div className="font-bold text-foreground">Ref: {pay.reference}</div>
                            <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                              <span>Unit: {resolvedUnitNum}</span>
                              <span>•</span>
                              <span>Date: {new Date(pay.date).toLocaleString()}</span>
                            </div>
                          </div>
                          <div className="font-bold text-emerald-600">
                            +₹{pay.amount.toLocaleString("en-IN")}
                          </div>
                        </div>
                      );
                    })}
                  {(!activeOpp?.bookings ||
                    !activeOpp.bookings.some((b: any) => 
                      b.invoices?.some((inv: any) => inv.payments && inv.payments.length > 0)
                    )) && <p className="text-xs text-muted-foreground">No payments cleared yet.</p>}
                </div>
              </TabsContent>

              {/* TAB 12: DOCUMENTS */}
              <TabsContent value="documents" className="m-0 space-y-6">
                <form
                  onSubmit={handleUploadDoc}
                  className="space-y-4 max-w-xl p-4 border rounded-xl bg-card"
                >
                  <h3 className="font-semibold text-xs text-foreground uppercase tracking-wider">
                    Simulate Document Attachment
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label>Attachment Category</Label>
                      <Select value={docCategory} onValueChange={setDocCategory}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="KYC Document">📄 KYC Document</SelectItem>
                          <SelectItem value="Sale Agreement">📄 Sale Agreement</SelectItem>
                          <SelectItem value="Project Brochure">📕 Project Brochure</SelectItem>
                          <SelectItem value="Payment Proof">💵 Payment Proof</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 col-span-2">
                      <Label>Select File</Label>
                      <Input
                        type="file"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setSelectedDocFile(file);
                            setFileName(file.name);
                            setFileSize(`${(file.size / (1024 * 1024)).toFixed(2)} MB`);
                          } else {
                            setSelectedDocFile(null);
                            setFileName("");
                            setFileSize("0 MB");
                          }
                        }}
                      />
                    </div>
                  </div>
                  <Button type="submit" size="sm" className="gap-1.5">
                    <Paperclip className="h-3.5 w-3.5" /> Upload Document
                  </Button>
                </form>

                <div className="space-y-3 max-w-xl">
                  <h3 className="font-semibold text-xs text-foreground uppercase tracking-wider">
                    Customer Attachments Registry
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {customer.documents.map((doc, idx) => (
                      <div
                        key={idx}
                        className="p-3 border border-border/60 rounded-xl bg-card flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-4.5 w-4.5 text-primary shrink-0" />
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-foreground truncate">
                              {doc.name}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {(doc.size / (1024 * 1024)).toFixed(2)} MB ·{" "}
                              {doc.category || "General"}
                            </div>
                          </div>
                        </div>
                        <a
                          href={doc.url}
                          download={doc.name}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-primary font-bold hover:underline"
                        >
                          Download
                        </a>
                      </div>
                    ))}
                    {customer.documents.length === 0 && (
                      <p className="text-xs text-muted-foreground">No files uploaded.</p>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* TAB 13: AUDIT */}
              <TabsContent value="audit" className="m-0 space-y-4">
                <div className="space-y-3 max-w-2xl text-left">
                  <h3 className="font-semibold text-xs text-foreground uppercase tracking-wider">
                    Dossier Change Ledger
                  </h3>
                  <div className="border rounded-xl overflow-hidden bg-card border-border/80">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-muted/40 border-b border-border/60">
                          <th className="p-2.5 font-bold text-muted-foreground uppercase text-[10px]">
                            Timestamp
                          </th>
                          <th className="p-2.5 font-bold text-muted-foreground uppercase text-[10px]">
                            Actor
                          </th>
                          <th className="p-2.5 font-bold text-muted-foreground uppercase text-[10px]">
                            Action
                          </th>
                          <th className="p-2.5 font-bold text-muted-foreground uppercase text-[10px]">
                            Details
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {auditLogs
                          .filter(
                            (log) =>
                              log.new_value.includes(customer.name) ||
                              log.old_value.includes(customer.name) ||
                              log.new_value.includes(customer.id) ||
                              log.action.includes(customer.id),
                          )
                          .map((log) => (
                            <tr key={log.id}>
                              <td className="p-2.5 font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                                {new Date(log.timestamp).toLocaleString()}
                              </td>
                              <td className="p-2.5 font-semibold text-foreground">{log.user}</td>
                              <td className="p-2.5">
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-muted uppercase tracking-wider text-muted-foreground border">
                                  {log.action}
                                </span>
                              </td>
                              <td className="p-2.5 text-muted-foreground max-w-xs truncate">
                                {log.old_value !== "None" ? `${log.old_value} ➔ ` : ""}
                                {log.new_value}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
