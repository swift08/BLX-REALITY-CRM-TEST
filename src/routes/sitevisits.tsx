import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  useFollowups,
  useLeads,
  useCalendarEvents,
  useCRMUsers,
  updateCalendarEvent,
  completeFollowup,
} from "@/lib/queries";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  Calendar as CalendarIcon,
  Phone,
  Video,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Badge,
  Check,
} from "lucide-react";

export const Route = createFileRoute("/sitevisits")({
  head: () => ({ meta: [{ title: "Site Visits & Calendar · BLX Realty CRM" }] }),
  component: CalendarPage,
});

type CalendarView = "month" | "week" | "agenda";

function CalendarPage() {
  const queryClient = useQueryClient();
  const { user, role } = useAuth();
  const { data: followups = [], isLoading } = useFollowups();
  const { data: leads = [] } = useLeads();
  const { data: calendarEvents = [] } = useCalendarEvents();
  const { data: crmUsers = [] } = useCRMUsers();
  const [currentView, setCurrentView] = useState<CalendarView>("agenda");
  const [selectedDate, setSelectedDate] = useState(new Date());

  const handleMarkDone = async (ev: any) => {
    try {
      if (ev.source === "followup") {
        await completeFollowup(ev.id);
        toast.success("Follow-up marked as completed!");
      } else {
        await updateCalendarEvent(ev.id, {
          type: ev.type || "visit",
          title: ev.title,
          start: ev.time.toISOString(),
          end: new Date(ev.time.getTime() + 60 * 60 * 1000).toISOString(),
          customerId: ev.leadId || null,
          salesPerson: ev.assigned_sales === "unassigned" ? null : ev.assigned_sales,
          details: ev.details || "",
          status: "completed",
        });
        toast.success("Site visit marked as completed!");
      }
      queryClient.invalidateQueries({ queryKey: ["followups"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to mark as done");
    }
  };

  const [simulateSalesPerson, setSimulateSalesPerson] = useState<string>("all");
  const salesPeople = crmUsers.filter((u) => u.role === "sales_executive");
  const originalRole = user?.user_metadata?.role || "sales_executive";
  const isSimulating = role === "sales_executive" && originalRole !== "sales_executive";

  // Full name of the currently logged-in user
  const userFullName = (user?.user_metadata?.full_name || user?.email?.split("@")[0] || "")
    .toLowerCase()
    .trim();

  const getEventIcon = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes("call") || t.includes("phone"))
      return <Phone className="h-4 w-4 text-blue-500" />;
    if (t.includes("visit") || t.includes("site"))
      return <MapPin className="h-4 w-4 text-emerald-500" />;
    return <Video className="h-4 w-4 text-amber-500" />;
  };

  const getEventTagColor = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes("call") || t.includes("phone"))
      return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    if (t.includes("visit") || t.includes("site"))
      return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
    return "bg-amber-500/10 text-amber-500 border-amber-500/20";
  };

  // ── Format followup-based events ───────────────────────────
  const followupEvents = followups.map((f) => {
    const lead = leads.find((l) => l.id === f.lead_id);
    return {
      id: f.id,
      leadId: f.lead_id,
      customer: f.customer_name,
      title: f.title,
      time: new Date(f.time),
      priority: f.priority,
      status: f.status,
      project: lead?.projects?.name || "No Project",
      assigned_sales: (f.assigned_sales || "Unassigned").toLowerCase().trim(),
      source: "followup" as const,
    };
  });

  // ── Format calendar-based events (visit / meeting) ────────
  const calVisits = calendarEvents
    .filter((e) => e.type === "visit" || e.type === "meeting")
    .map((e) => {
      const lead = leads.find((l) => l.id === e.customerId);
      return {
        id: e.id,
        leadId: e.customerId || "",
        customer: lead ? lead.name : "Unknown Customer",
        title: e.title,
        time: new Date(e.start),
        priority: "medium" as const,
        status: e.status || "pending",
        project: lead?.projects?.name || "No Project",
        // Normalise to lowercase for consistent comparison
        assigned_sales: (e.salesPerson || "Unassigned").toLowerCase().trim(),
        source: "calendar" as const,
      };
    });

  // ── Merge & filter by role ─────────────────────────────────
  const allEvents = [...followupEvents, ...calVisits];
  const events = allEvents
    .filter((ev) => {
      if (role === "sales_executive") {
        if (isSimulating) {
          if (simulateSalesPerson === "all") return true;
          return ev.assigned_sales === simulateSalesPerson.toLowerCase().trim();
        }
        // Real sales person: show only events assigned to them
        return ev.assigned_sales === userFullName;
      }
      // Admin / super_admin: see everything
      return true;
    })
    .sort((a, b) => a.time.getTime() - b.time.getTime());

  // ── Month filter ───────────────────────────────────────────
  const monthEvents = events.filter(
    (e) =>
      e.time.getMonth() === selectedDate.getMonth() &&
      e.time.getFullYear() === selectedDate.getFullYear(),
  );

  const nextMonth = () => {
    setSelectedDate(new Date(selectedDate.setMonth(selectedDate.getMonth() + 1)));
  };

  const prevMonth = () => {
    setSelectedDate(new Date(selectedDate.setMonth(selectedDate.getMonth() - 1)));
  };

  return (
    <AppShell
      title="Site Visits & Meetings Calendar"
      subtitle="Synchronized schedules for leads visits, callbacks and virtual tours"
    >
      {isSimulating && (
        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-lg text-xs text-amber-500 font-semibold mb-4 text-left">
          <span>Simulating Sales Executive Perspective. Filter by Sales Owner:</span>
          <select
            value={simulateSalesPerson}
            onChange={(e) => setSimulateSalesPerson(e.target.value)}
            className="bg-card text-foreground border border-border rounded px-2 py-1 font-bold focus:outline-none text-[11px]"
          >
            <option value="all">-- Show All Sales Owners --</option>
            {salesPeople.map((u) => (
              <option key={u.id} value={u.name}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Sales executive notice — events assigned to them */}
      {role === "sales_executive" && !isSimulating && (
        <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 p-2.5 rounded-lg text-xs text-primary font-semibold mb-4">
          <User className="h-4 w-4" />
          Showing events assigned to you ({monthEvents.length} this month)
        </div>
      )}

      {/* ── Calendar Header Controls ── */}
      <div className="flex items-center justify-between flex-wrap gap-4 pb-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={prevMonth} className="h-8 w-8 p-0">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-sm font-semibold font-display px-2 text-foreground uppercase tracking-wide">
            {selectedDate.toLocaleString("default", { month: "long", year: "numeric" })}
          </h3>
          <Button variant="outline" size="sm" onClick={nextMonth} className="h-8 w-8 p-0">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1 border rounded-lg bg-card p-0.5">
          <Button
            variant={currentView === "agenda" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setCurrentView("agenda")}
            className="h-7 text-xs px-3"
          >
            Agenda List
          </Button>
          <Button
            variant={currentView === "month" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setCurrentView("month")}
            className="h-7 text-xs px-3"
          >
            Monthly Calendar
          </Button>
        </div>
      </div>

      {currentView === "month" ? (
        <Card className="border-border/60">
          <CardContent className="p-6">
            {/* Month grid header */}
            <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b pb-2">
              <div>Sun</div>
              <div>Mon</div>
              <div>Tue</div>
              <div>Wed</div>
              <div>Thu</div>
              <div>Fri</div>
              <div>Sat</div>
            </div>
            <div className="grid grid-cols-7 gap-2 mt-3 min-h-[300px]">
              {Array.from({ length: 35 }).map((_, idx) => {
                const day = idx - 2; // rough offset
                const isValidDay = day > 0 && day <= 31;
                const dayDate = isValidDay
                  ? new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day)
                  : null;
                const dayEvents = dayDate
                  ? monthEvents.filter((e) => e.time.getDate() === day)
                  : [];

                return (
                  <div
                    key={idx}
                    className={`p-2 border rounded-lg flex flex-col justify-between bg-card text-left min-h-[70px] ${isValidDay ? "hover:border-primary/40" : "opacity-25 bg-muted/40"}`}
                  >
                    <span className="text-[10px] font-bold text-muted-foreground">
                      {isValidDay ? day : ""}
                    </span>
                    <div className="space-y-1 mt-1">
                      {dayEvents.slice(0, 2).map((ev) => (
                        <div
                          key={ev.id}
                          className="px-1 py-0.5 rounded text-[8px] font-semibold truncate border bg-primary/5 text-primary border-primary/10"
                        >
                          {ev.title.slice(0, 10)}...
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <span className="text-[8px] font-bold text-muted-foreground block text-center">
                          +{dayEvents.length - 2} more
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2 border-border/60">
            <CardHeader className="border-b py-4 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CalendarIcon className="h-4.5 w-4.5 text-muted-foreground" />
                Schedule List Agenda
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
              ) : monthEvents.length === 0 ? (
                <div className="p-16 text-center">
                  <CalendarIcon className="h-10 w-10 text-muted-foreground/35 mx-auto mb-3" />
                  <p className="text-xs text-muted-foreground">
                    {role === "sales_executive"
                      ? "No events assigned to you this month."
                      : "No events scheduled for this month."}
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {monthEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="p-4 flex items-start gap-4 hover:bg-muted/10 transition-colors"
                    >
                      <div className="p-2.5 rounded bg-muted">{getEventIcon(ev.title)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-foreground text-xs">
                            {ev.customer}
                          </span>
                          <span
                            className={`text-[9px] font-bold uppercase px-2 py-0.25 border rounded-full ${getEventTagColor(ev.title)}`}
                          >
                            {ev.title.toLowerCase().includes("visit")
                              ? "Site Visit"
                              : ev.title.toLowerCase().includes("call")
                                ? "Callback"
                                : "Meeting"}
                          </span>
                          {/* "Assigned to you" badge for admin/superadmin view */}
                          {role !== "sales_executive" && ev.assigned_sales !== "unassigned" && (
                            <span className="text-[9px] font-semibold bg-muted text-muted-foreground border border-border/60 px-2 py-0.25 rounded-full flex items-center gap-1">
                              <User className="h-2.5 w-2.5" />
                              {ev.assigned_sales}
                            </span>
                          )}
                          {ev.status === "completed" && (
                            <span className="text-[9px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-2 py-0.25 rounded-full uppercase">
                              Done
                            </span>
                          )}
                        </div>
                        <h4 className="font-medium text-xs text-foreground mt-1 leading-normal">
                          {ev.title}
                        </h4>
                        <div className="text-[10px] text-muted-foreground mt-2 flex items-center gap-3">
                          <span className="flex items-center gap-1 font-semibold text-primary">
                            <Clock className="h-3 w-3" />
                            {ev.time.toLocaleDateString()} at{" "}
                            {ev.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          <span>Project: {ev.project}</span>
                        </div>
                      </div>
                      {ev.status !== "completed" && (
                        <Button
                          size="sm"
                          onClick={() => handleMarkDone(ev)}
                          className="h-8 text-[10px] gap-1 font-semibold self-center"
                        >
                          <Check className="h-3.5 w-3.5" /> Mark Completed
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats Panel */}
          <div className="space-y-4">
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Agenda Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-xl border bg-muted/20 space-y-1">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    Total Scheduled Site Visits
                  </div>
                  <div className="text-xl font-bold text-foreground">
                    {monthEvents.filter((e) => e.title.toLowerCase().includes("visit")).length}
                  </div>
                </div>
                <div className="p-4 rounded-xl border bg-muted/20 space-y-1">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    Pending Callbacks
                  </div>
                  <div className="text-xl font-bold text-foreground">
                    {
                      monthEvents.filter(
                        (e) => e.status === "pending" && e.title.toLowerCase().includes("call"),
                      ).length
                    }
                  </div>
                </div>
                <div className="p-4 rounded-xl border bg-muted/20 space-y-1">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    Total This Month
                  </div>
                  <div className="text-xl font-bold text-foreground">{monthEvents.length}</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </AppShell>
  );
}
