import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useCalendarEvents,
  addCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  useCustomers,
  useCRMUsers,
  addMockLead,
} from "@/lib/queries";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  Calendar as CalendarIcon,
  Plus,
  User,
  Clock,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  Search,
  SlidersHorizontal,
  MapPin,
  CheckCircle2,
  CalendarDays,
  List,
  Grid,
  Clock3,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      { title: "Your Calendar · BLX Realty CRM" },
      {
        name: "description",
        content:
          "Organize company holidays, sales leaves, client meetings, site visits, and availability slots.",
      },
    ],
  }),
  component: BusinessCalendar,
});

/* ═══════════════════════════════════════════════════════════════
   Event Style Configuration (Matching UI Image 1 & Image 2)
   ═══════════════════════════════════════════════════════════════ */
const EVENT_STYLES = {
  meeting: {
    label: "Meeting",
    tagPrefix: "Communication",
    emoji: "🤝",
    bgGradient: "from-purple-600 to-indigo-600",
    cardBg: "bg-purple-600/90 text-white",
    softBg: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    badgeBg: "bg-purple-400/25 text-purple-100",
    accentColor: "#9333ea",
  },
  visit: {
    label: "Site Visit",
    tagPrefix: "Property Tour",
    emoji: "📍",
    bgGradient: "from-rose-500 to-pink-600",
    cardBg: "bg-rose-500/90 text-white",
    softBg: "bg-rose-500/10 text-rose-600 border-rose-500/20",
    badgeBg: "bg-rose-400/25 text-rose-100",
    accentColor: "#f43f5e",
  },
  availability: {
    label: "Availability",
    tagPrefix: "Open Slot",
    emoji: "🟢",
    bgGradient: "from-teal-500 to-emerald-600",
    cardBg: "bg-teal-600/90 text-white",
    softBg: "bg-teal-500/10 text-teal-600 border-teal-500/20",
    badgeBg: "bg-teal-400/25 text-teal-100",
    accentColor: "#0d9488",
  },
  leave: {
    label: "Sales Leave",
    tagPrefix: "Leave Log",
    emoji: "🏖️",
    bgGradient: "from-amber-500 to-orange-600",
    cardBg: "bg-amber-600/90 text-white",
    softBg: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    badgeBg: "bg-amber-400/25 text-amber-100",
    accentColor: "#d97706",
  },
  holiday: {
    label: "Holiday",
    tagPrefix: "Company Event",
    emoji: "🎄",
    bgGradient: "from-slate-600 to-slate-700",
    cardBg: "bg-slate-700/90 text-white",
    softBg: "bg-slate-500/10 text-slate-600 border-slate-500/20",
    badgeBg: "bg-slate-400/25 text-slate-100",
    accentColor: "#475569",
  },
} as const;

type EvType = keyof typeof EVENT_STYLES;
type ViewMode = "weekly" | "monthly" | "daily" | "timeline";

// Time Slots from 8 AM to 8 PM
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const HOUR_SLOT_HEIGHT = 72; // height in pixels per 1-hour slot

function fmtTime12(dateObj: Date) {
  return dateObj.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function fmtDateISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/* ═══════════════════════════════════════════════════════════════
   Main Calendar Component
   ═══════════════════════════════════════════════════════════════ */
function BusinessCalendar() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const { data: events = [], isLoading } = useCalendarEvents();
  const { data: customers = [] } = useCustomers();
  const { data: crmUsers = [] } = useCRMUsers();
  const salesPeople = crmUsers.filter((u) => u.role === "sales_executive");
  const canManage = role === "super_admin" || role === "admin";

  // State
  const [viewMode, setViewMode] = useState<ViewMode>("weekly");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDayISO, setSelectedDayISO] = useState<string>(fmtDateISO(new Date()));
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Create / Edit Modal state
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<EvType>("meeting");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [salesPerson, setSalesPerson] = useState("");
  const [details, setDetails] = useState("");

  // View Modal state
  const [viewEv, setViewEv] = useState<any>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Today helpers
  const todayISO = fmtDateISO(new Date());

  // Week Days calculation (Sun to Sat around currentDate)
  const weekDays = useMemo(() => {
    const curr = new Date(currentDate);
    const dayOfWeek = curr.getDay(); // 0 = Sun
    const sun = new Date(curr);
    sun.setDate(curr.getDate() - dayOfWeek);

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(sun);
      d.setDate(sun.getDate() + i);
      const iso = fmtDateISO(d);
      return {
        date: d,
        iso,
        dayName: d.toLocaleDateString("en-US", { weekday: "short" }),
        dayNum: d.getDate(),
        isToday: iso === todayISO,
        isSelected: iso === selectedDayISO,
      };
    });
  }, [currentDate, selectedDayISO, todayISO]);

  // Date range label for header
  const rangeLabel = useMemo(() => {
    if (viewMode === "weekly") {
      const first = weekDays[0].date;
      const last = weekDays[6].date;
      const fStr = first.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const lStr = last.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      return `${fStr} – ${lStr}`;
    }
    if (viewMode === "monthly") {
      return currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }
    if (viewMode === "daily") {
      return new Date(selectedDayISO + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
    return "Agenda & Timeline";
  }, [viewMode, weekDays, currentDate, selectedDayISO]);

  // Navigation handlers
  const handlePrev = () => {
    const d = new Date(currentDate);
    if (viewMode === "weekly") d.setDate(d.getDate() - 7);
    else if (viewMode === "monthly") d.setMonth(d.getMonth() - 1);
    else d.setDate(d.getDate() - 1);
    setCurrentDate(d);
    setSelectedDayISO(fmtDateISO(d));
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (viewMode === "weekly") d.setDate(d.getDate() + 7);
    else if (viewMode === "monthly") d.setMonth(d.getMonth() + 1);
    else d.setDate(d.getDate() + 1);
    setCurrentDate(d);
    setSelectedDayISO(fmtDateISO(d));
  };

  const handleToday = () => {
    const d = new Date();
    setCurrentDate(d);
    setSelectedDayISO(fmtDateISO(d));
  };

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (typeFilter !== "all" && e.type !== typeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = e.title.toLowerCase().includes(q);
        const matchPerson = (e.salesPerson || "").toLowerCase().includes(q);
        const matchDetails = (e.details || "").toLowerCase().includes(q);
        return matchTitle || matchPerson || matchDetails;
      }
      return true;
    });
  }, [events, typeFilter, searchQuery]);

  // Map events by day ISO string
  const eventsByDayISO = useMemo(() => {
    const map: Record<string, typeof events> = {};
    for (const e of filteredEvents) {
      const iso = e.start ? e.start.slice(0, 10) : "";
      if (iso) {
        if (!map[iso]) map[iso] = [];
        map[iso].push(e);
      }
    }
    return map;
  }, [filteredEvents]);

  // Form actions
  const openNew = (prefillStart = "", prefillEnd = "") => {
    setEditingId(null);
    setTitle("");
    setType("meeting");
    setStart(prefillStart);
    setEnd(prefillEnd);
    setCustomerId("");
    setSalesPerson("");
    setDetails("");
    setIsOpen(true);
  };

  const openEdit = (ev: any) => {
    setEditingId(ev.id);
    setTitle(ev.title);
    setType(ev.type);
    setStart(ev.start ? ev.start.slice(0, 16) : "");
    setEnd(ev.end ? ev.end.slice(0, 16) : "");
    setCustomerId(ev.customerId || "");
    setSalesPerson(ev.salesPerson || "");
    setDetails(ev.details || "");
    setIsViewOpen(false);
    setIsOpen(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setStart("");
    setEnd("");
    setCustomerId("");
    setSalesPerson("");
    setDetails("");
    setIsOpen(false);
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !start || !end) {
      toast.error("Please fill in all mandatory fields.");
      return;
    }

    try {
      let finalCustomerId = customerId;
      if (customerId) {
        const exists = customers.some((c) => c.id === customerId);
        if (!exists) {
          const u = crmUsers.find((user) => user.id === customerId);
          const nm = u ? u.name : customerId;
          const em = u ? u.email : `${customerId.toLowerCase()}@blxreality.com`;
          const mc = customers.find(
            (c) =>
              c.name.toLowerCase() === nm.toLowerCase() ||
              c.email?.toLowerCase() === em.toLowerCase(),
          );
          if (mc) {
            finalCustomerId = mc.id;
          } else {
            const nc = await addMockLead({
              name: nm,
              phone: "0000000000",
              email: em,
              source: "System",
              project_id: "none",
            });
            finalCustomerId = nc.id;
          }
        }
      }

      const payload = {
        type,
        title,
        start,
        end,
        customerId: finalCustomerId || undefined,
        salesPerson: salesPerson || undefined,
        details: details || undefined,
      };

      if (editingId) {
        await updateCalendarEvent(editingId, payload);
        toast.success("Calendar event updated!");
      } else {
        await addCalendarEvent(payload);
        toast.success("Calendar event scheduled!");
      }

      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      resetForm();
    } catch (err: any) {
      toast.error(err.message || "Failed to save event.");
    }
  };

  const handleDeleteEvent = async (id: string) => {
    try {
      await deleteCalendarEvent(id);
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      toast.success("Event deleted.");
      setIsViewOpen(false);
      setDeletingId(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete event.");
    }
  };

  // Click on grid cell to create event at that day & hour
  const handleSlotClick = (dayISO: string, hourNum: number) => {
    if (!canManage) return;
    const hourStr = String(hourNum).padStart(2, "0");
    const endHourStr = String(hourNum + 1).padStart(2, "0");
    openNew(`${dayISO}T${hourStr}:00`, `${dayISO}T${endHourStr}:00`);
  };

  return (
    <AppShell
      title="Your Calendar"
      subtitle="Schedule meetings, property site visits, team availabilities and company events."
    >
      <div className="space-y-4">
        {/* ═══════════════════════════════════════════════════════
           Top Header & Control Bar (Matching Image 1 & Image 2)
           ═══════════════════════════════════════════════════════ */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-card p-4 rounded-2xl border border-border shadow-sm">
          {/* Left Title & View Selector */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <CalendarIcon className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground font-display">
                Your Calendar
              </h1>
              <p className="text-xs text-muted-foreground">
                {filteredEvents.length} event{filteredEvents.length !== 1 ? "s" : ""} scheduled
              </p>
            </div>
          </div>

          {/* Center: Search & Type Filter */}
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search events, clients, reps..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl bg-muted/30 border-border"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-9 px-3 rounded-xl border bg-card text-xs font-semibold text-foreground focus:outline-none"
            >
              <option value="all">All Types</option>
              <option value="meeting">🤝 Meetings</option>
              <option value="visit">📍 Site Visits</option>
              <option value="availability">🟢 Availabilities</option>
              <option value="leave">🏖️ Sales Leaves</option>
              <option value="holiday">🎄 Holidays</option>
            </select>
          </div>

          {/* Right Controls: View Switcher & Nav */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* View Mode Dropdown / Pills */}
            <div className="flex items-center rounded-xl bg-muted/40 p-1 border border-border">
              {(["weekly", "monthly", "daily", "timeline"] as ViewMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setViewMode(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                    viewMode === m
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* Date Range Navigator */}
            <div className="flex items-center gap-1 bg-card border rounded-xl p-1 shadow-xs">
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrev}
                className="h-7 w-7 rounded-lg"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <span className="text-xs font-bold px-2 text-foreground min-w-[120px] text-center">
                {rangeLabel}
              </span>

              <Button
                variant="ghost"
                size="icon"
                onClick={handleNext}
                className="h-7 w-7 rounded-lg"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleToday}
              className="h-9 px-3 text-xs font-semibold rounded-xl"
            >
              Today
            </Button>

            {canManage && (
              <Button
                onClick={() => openNew()}
                className="h-9 px-4 gap-1.5 text-xs font-bold rounded-xl bg-primary text-primary-foreground shadow-sm hover:shadow"
              >
                <Plus className="h-4 w-4" />
                <span>Event</span>
              </Button>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
           VIEW 1: WEEKLY TIMETABLE GRID (Image 1 Style)
           ═══════════════════════════════════════════════════════ */}
        {viewMode === "weekly" && (
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col">
            {/* Header Row: 7 Day Columns */}
            <div className="grid grid-cols-8 border-b border-border bg-muted/20 text-center text-xs font-semibold">
              {/* Time slot column header */}
              <div className="p-3 text-muted-foreground font-bold text-[10px] uppercase border-r border-border">
                GMT+5.5
              </div>

              {/* Day headers */}
              {weekDays.map((wd) => (
                <div
                  key={wd.iso}
                  onClick={() => setSelectedDayISO(wd.iso)}
                  className={`p-3 border-r last:border-r-0 cursor-pointer transition-all relative ${
                    wd.isSelected
                      ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold"
                      : "hover:bg-muted/40 text-foreground"
                  }`}
                >
                  {/* Top Purple Indicator Line for Selected/Today */}
                  {wd.isSelected && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-purple-600 rounded-b-sm" />
                  )}
                  <div className="text-[11px] uppercase tracking-wider opacity-75">
                    {wd.dayName}
                  </div>
                  <div className="text-lg font-extrabold font-display mt-0.5">{wd.dayNum}</div>
                </div>
              ))}
            </div>

            {/* Time Grid Scrollable Body */}
            <div className="overflow-y-auto max-h-[680px] relative">
              <div className="grid grid-cols-8 relative">
                {/* Y-Axis Hours Column */}
                <div className="border-r border-border bg-card">
                  {HOURS.map((h) => {
                    const label = h === 12 ? "12 PM" : h > 12 ? `${h - 12} PM` : `${h} AM`;
                    return (
                      <div
                        key={h}
                        style={{ height: HOUR_SLOT_HEIGHT }}
                        className="p-2 border-b border-border/40 text-[11px] font-bold text-muted-foreground text-right pr-3"
                      >
                        {label}
                      </div>
                    );
                  })}
                </div>

                {/* 7 Day Grid Columns */}
                {weekDays.map((wd) => {
                  const dayEvents = eventsByDayISO[wd.iso] || [];

                  return (
                    <div
                      key={wd.iso}
                      className={`border-r last:border-r-0 border-border/40 relative min-h-[936px] ${
                        wd.isSelected ? "bg-purple-500/[0.03]" : ""
                      }`}
                    >
                      {/* Empty Hour Slot Background Grid Lines */}
                      {HOURS.map((h) => (
                        <div
                          key={h}
                          style={{ height: HOUR_SLOT_HEIGHT }}
                          onClick={() => handleSlotClick(wd.iso, h)}
                          className="border-b border-border/30 hover:bg-purple-500/5 transition-colors cursor-pointer"
                        />
                      ))}

                      {/* Event Cards Positioned inside Grid */}
                      {dayEvents.map((ev) => {
                        const styleCfg = EVENT_STYLES[ev.type as EvType] || EVENT_STYLES.meeting;

                        // Calculate vertical position from start time
                        const startDate = new Date(ev.start);
                        const endDate = new Date(ev.end);
                        const startHour = startDate.getHours() + startDate.getMinutes() / 60;
                        const endHour = endDate.getHours() + endDate.getMinutes() / 60;
                        const duration = Math.max(0.5, endHour - startHour);

                        // Offset relative to 8 AM
                        const topPx = Math.max(0, (startHour - 8) * HOUR_SLOT_HEIGHT);
                        const heightPx = Math.max(52, duration * HOUR_SLOT_HEIGHT - 6);

                        return (
                          <div
                            key={ev.id}
                            style={{
                              top: `${topPx}px`,
                              height: `${heightPx}px`,
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewEv(ev);
                              setIsViewOpen(true);
                            }}
                            className={`absolute left-1 right-1 p-2.5 rounded-2xl shadow-md cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg flex flex-col justify-between overflow-hidden z-10 border border-white/20 bg-gradient-to-br ${styleCfg.bgGradient} text-white`}
                          >
                            {/* Abstract decorative diagonal stripes */}
                            <div className="absolute -right-4 -top-4 w-16 h-16 rounded-full bg-white/10 blur-xs pointer-events-none" />

                            <div>
                              {/* Top Tag & Time */}
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <span className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20 text-white backdrop-blur-xs truncate">
                                  {styleCfg.tagPrefix}
                                </span>
                                <span className="text-[9px] font-bold text-white/80 shrink-0">
                                  {fmtTime12(startDate)}
                                </span>
                              </div>

                              {/* Main Title */}
                              <h4 className="text-xs font-bold leading-tight font-display drop-shadow-xs line-clamp-2">
                                {ev.title}
                              </h4>
                            </div>

                            {/* Bottom Avatar & Name (Image 1 Style) */}
                            <div className="flex items-center gap-1.5 mt-2 pt-1.5 border-t border-white/20">
                              <div className="h-5 w-5 rounded-full bg-white/20 flex items-center justify-center text-[9px] font-bold shrink-0">
                                {ev.salesPerson ? ev.salesPerson.charAt(0) : "U"}
                              </div>
                              <span className="text-[10px] font-semibold truncate text-white/90">
                                {ev.salesPerson || "Unassigned"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
           VIEW 2: MONTHLY GRID
           ═══════════════════════════════════════════════════════ */}
        {viewMode === "monthly" && (
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="grid grid-cols-7 border-b border-border bg-muted/20 text-center text-xs font-bold text-muted-foreground">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="p-3">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {Array.from({ length: 35 }).map((_, idx) => {
                const year = currentDate.getFullYear();
                const month = currentDate.getMonth();
                const firstDayIndex = new Date(year, month, 1).getDay();
                const dayNum = idx - firstDayIndex + 1;
                const daysInMonth = new Date(year, month + 1, 0).getDate();

                if (dayNum < 1 || dayNum > daysInMonth) {
                  return (
                    <div key={idx} className="min-h-[110px] p-2 bg-muted/10 border-b border-r" />
                  );
                }

                const dateObj = new Date(year, month, dayNum);
                const dayISO = fmtDateISO(dateObj);
                const dayEvts = eventsByDayISO[dayISO] || [];
                const isToday = dayISO === todayISO;

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      setSelectedDayISO(dayISO);
                      setViewMode("daily");
                    }}
                    className={`min-h-[110px] p-2 border-b border-r border-border/40 hover:bg-muted/20 transition-all cursor-pointer ${
                      isToday ? "bg-purple-500/5" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-xs font-bold h-6 w-6 rounded-full flex items-center justify-center ${
                          isToday ? "bg-purple-600 text-white shadow-sm" : "text-foreground"
                        }`}
                      >
                        {dayNum}
                      </span>
                      {dayEvts.length > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                          {dayEvts.length}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      {dayEvts.slice(0, 3).map((ev) => {
                        const styleCfg = EVENT_STYLES[ev.type as EvType] || EVENT_STYLES.meeting;
                        return (
                          <div
                            key={ev.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewEv(ev);
                              setIsViewOpen(true);
                            }}
                            className={`text-[10px] p-1 rounded-lg font-semibold truncate border ${styleCfg.softBg}`}
                          >
                            {styleCfg.emoji} {ev.title}
                          </div>
                        );
                      })}
                      {dayEvts.length > 3 && (
                        <div className="text-[9px] font-bold text-muted-foreground pl-1">
                          +{dayEvts.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
           VIEW 3: DAILY TIMETABLE
           ═══════════════════════════════════════════════════════ */}
        {viewMode === "daily" && (
          <div className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  {new Date(selectedDayISO + "T00:00:00").toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {(eventsByDayISO[selectedDayISO] || []).length} scheduled items
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode("weekly")}
                className="text-xs rounded-xl"
              >
                Back to Weekly
              </Button>
            </div>

            <div className="space-y-3">
              {(eventsByDayISO[selectedDayISO] || []).length === 0 ? (
                <div className="text-center py-16 text-muted-foreground text-xs">
                  No events scheduled for this day. Click "+ Event" above to add one.
                </div>
              ) : (
                (eventsByDayISO[selectedDayISO] || []).map((ev) => {
                  const styleCfg = EVENT_STYLES[ev.type as EvType] || EVENT_STYLES.meeting;
                  return (
                    <div
                      key={ev.id}
                      onClick={() => {
                        setViewEv(ev);
                        setIsViewOpen(true);
                      }}
                      className={`p-4 rounded-2xl border flex items-start justify-between gap-4 cursor-pointer transition-all hover:shadow-md ${styleCfg.softBg}`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{styleCfg.emoji}</span>
                          <span className="text-xs font-bold uppercase tracking-wider">
                            {styleCfg.label}
                          </span>
                          <span className="text-xs font-semibold opacity-75">
                            • {fmtTime12(new Date(ev.start))} – {fmtTime12(new Date(ev.end))}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-foreground">{ev.title}</h3>
                        {ev.details && (
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {ev.details}
                          </p>
                        )}
                      </div>
                      <div className="text-right text-xs font-semibold">
                        <div className="text-foreground">{ev.salesPerson || "Unassigned"}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
           VIEW 4: TIMELINE / AGENDA (Image 2 Style)
           ═══════════════════════════════════════════════════════ */}
        {viewMode === "timeline" && (
          <div className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-6">
            <h2 className="text-base font-bold text-foreground border-b pb-3">
              Agenda & Timeline Feed
            </h2>

            <div className="space-y-6">
              {Object.keys(eventsByDayISO).length === 0 ? (
                <div className="text-center py-16 text-muted-foreground text-xs">
                  No events found in current selection.
                </div>
              ) : (
                Object.keys(eventsByDayISO)
                  .sort()
                  .map((dayISO) => {
                    const dayEvts = eventsByDayISO[dayISO];
                    const dateObj = new Date(dayISO + "T00:00:00");

                    return (
                      <div key={dayISO} className="space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-primary" />
                          <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground font-display">
                            {dateObj.toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                          <div className="h-px bg-border flex-1" />
                        </div>

                        <div className="space-y-2 pl-4">
                          {dayEvts.map((ev) => {
                            const styleCfg =
                              EVENT_STYLES[ev.type as EvType] || EVENT_STYLES.meeting;

                            return (
                              <div
                                key={ev.id}
                                onClick={() => {
                                  setViewEv(ev);
                                  setIsViewOpen(true);
                                }}
                                className={`p-3.5 rounded-2xl border flex items-center justify-between gap-4 cursor-pointer hover:shadow-md transition-all ${styleCfg.softBg}`}
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold uppercase tracking-wider">
                                      {styleCfg.emoji} {ev.title}
                                    </span>
                                  </div>
                                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                                    <Clock className="h-3 w-3" />
                                    <span>
                                      {fmtTime12(new Date(ev.start))} –{" "}
                                      {fmtTime12(new Date(ev.end))}
                                    </span>
                                  </div>
                                </div>
                                <div className="text-xs font-semibold text-foreground">
                                  {ev.salesPerson || "Unassigned"}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════
         CREATE / EDIT DIALOG
         ═══════════════════════════════════════════════════════ */}
      <Dialog
        open={isOpen}
        onOpenChange={(o) => {
          if (!o) resetForm();
          setIsOpen(o);
        }}
      >
        <DialogContent className="sm:max-w-[500px] bg-card border border-border shadow-2xl rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold font-display text-foreground">
              {editingId ? "Edit Calendar Event" : "Schedule Calendar Event"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Set event title, timing, category, and assigned sales owner.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEvent} className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase">
                Event Title *
              </label>
              <Input
                placeholder="e.g. Prestige Aurelia Site Tour"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-10 text-xs rounded-xl"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">
                  Event Type
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as EvType)}
                  className="w-full h-10 px-3 rounded-xl border bg-card text-xs font-semibold text-foreground focus:outline-none"
                >
                  <option value="meeting">🤝 Client Meeting</option>
                  <option value="visit">📍 Site Visit</option>
                  <option value="availability">🟢 Availability</option>
                  <option value="leave">🏖️ Sales Leave</option>
                  <option value="holiday">🎄 Holiday</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">
                  Sales Owner
                </label>
                <select
                  value={salesPerson}
                  onChange={(e) => setSalesPerson(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border bg-card text-xs font-semibold text-foreground focus:outline-none"
                >
                  <option value="">Select Rep</option>
                  {salesPeople.map((u) => (
                    <option key={u.id} value={u.name}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">
                  Start Time *
                </label>
                <Input
                  type="datetime-local"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="h-10 text-xs rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">
                  End Time *
                </label>
                <Input
                  type="datetime-local"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className="h-10 text-xs rounded-xl"
                  required
                />
              </div>
            </div>

            {type !== "holiday" && type !== "leave" && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">
                  Link Customer
                </label>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border bg-card text-xs font-semibold text-foreground focus:outline-none"
                >
                  <option value="">Optional Customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase">
                Notes & Instructions
              </label>
              <textarea
                rows={3}
                placeholder="Location, meeting agenda, or property notes..."
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className="w-full p-3 rounded-xl border bg-card text-xs focus:outline-none resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={resetForm}
                className="rounded-xl text-xs h-9"
              >
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl text-xs h-9 font-bold">
                {editingId ? "Save Changes" : "Schedule Event"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════
         VIEW / EDIT DETAILS DIALOG
         ═══════════════════════════════════════════════════════ */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="sm:max-w-[480px] bg-card border border-border shadow-2xl rounded-2xl p-6">
          {viewEv && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="text-lg font-bold font-display text-foreground flex items-center gap-2">
                  <span>{EVENT_STYLES[viewEv.type as EvType]?.emoji || "📅"}</span>
                  <span>{viewEv.title}</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {EVENT_STYLES[viewEv.type as EvType]?.label || viewEv.type} • Scheduled Event
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 text-xs text-foreground pt-1">
                <div className="p-3 rounded-xl bg-muted/30 border space-y-1">
                  <div className="font-semibold text-muted-foreground uppercase text-[10px]">
                    Timing Window
                  </div>
                  <div className="font-bold">
                    {new Date(viewEv.start).toLocaleString()} –{" "}
                    {new Date(viewEv.end).toLocaleTimeString()}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-muted/20 border">
                    <div className="font-semibold text-muted-foreground uppercase text-[10px]">
                      Sales Owner
                    </div>
                    <div className="font-bold mt-0.5">{viewEv.salesPerson || "Unassigned"}</div>
                  </div>

                  <div className="p-3 rounded-xl bg-muted/20 border">
                    <div className="font-semibold text-muted-foreground uppercase text-[10px]">
                      Linked Customer
                    </div>
                    <div className="font-bold mt-0.5">
                      {viewEv.customerId
                        ? (() => {
                            const c = customers.find((cust) => cust.id === viewEv.customerId);
                            return c ? c.name : `ID: ${viewEv.customerId}`;
                          })()
                        : "None"}
                    </div>
                  </div>
                </div>

                {viewEv.details && (
                  <div className="p-3 rounded-xl bg-muted/20 border space-y-1">
                    <div className="font-semibold text-muted-foreground uppercase text-[10px]">
                      Notes
                    </div>
                    <p className="leading-relaxed text-muted-foreground">{viewEv.details}</p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t">
                {canManage && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEdit(viewEv)}
                      className="text-xs h-8 rounded-xl"
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                    </Button>

                    {deletingId === viewEv.id ? (
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteEvent(viewEv.id)}
                          className="text-xs h-8 px-2 rounded-xl"
                        >
                          Confirm Delete
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeletingId(null)}
                          className="text-xs h-8 px-2 rounded-xl"
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDeletingId(viewEv.id)}
                        className="text-xs h-8 text-destructive border-destructive/30 rounded-xl"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                      </Button>
                    )}
                  </div>
                )}
                <Button
                  size="sm"
                  onClick={() => setIsViewOpen(false)}
                  className="text-xs h-8 rounded-xl ml-auto"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
