import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useFollowups, useLeads, useCalendarEvents } from "@/lib/queries";
import { useAuth } from "@/hooks/use-auth";
import {
  Calendar as CalendarIcon,
  Phone,
  Video,
  MapPin,
  Search,
  ChevronLeft,
  ChevronRight,
  Clock,
} from "lucide-react";

export const Route = createFileRoute("/sitevisits")({
  head: () => ({ meta: [{ title: "Site Visits & Calendar · BLX Realty CRM" }] }),
  component: CalendarPage,
});

type CalendarView = "month" | "week" | "agenda";

function CalendarPage() {
  const { user, role } = useAuth();
  const { data: followups = [], isLoading } = useFollowups();
  const { data: leads = [] } = useLeads();
  const { data: calendarEvents = [] } = useCalendarEvents();
  const [currentView, setCurrentView] = useState<CalendarView>("agenda");
  const [selectedDate, setSelectedDate] = useState(new Date());

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

  const userFullName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "";

  // Format followups site visits list
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
      project: lead?.projects?.name || "Koramangala Project",
      assigned_sales: f.assigned_sales || "Unassigned",
    };
  });

  // Format calendar site visits list (type: visit)
  const calVisits = calendarEvents
    .filter((e) => e.type === "visit")
    .map((e) => {
      const lead = leads.find((l) => l.id === e.customerId);
      return {
        id: e.id,
        leadId: e.customerId || "",
        customer: lead ? lead.name : "Unknown Customer",
        title: e.title,
        time: new Date(e.start),
        priority: "medium",
        status: "pending",
        project: lead?.projects?.name || "Koramangala Project",
        assigned_sales: e.salesPerson || "Unassigned",
      };
    });

  // Merge and filter by role assignment
  const allEvents = [...followupEvents, ...calVisits];
  const events = allEvents
    .filter((ev) => {
      if (role === "sales_executive") {
        return ev.assigned_sales?.toLowerCase() === userFullName?.toLowerCase();
      }
      return true;
    })
    .sort((a, b) => a.time.getTime() - b.time.getTime());

  // Filter events for selected month (simple visualization)
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
      {/* Calendar Header Controls */}
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
            {/* Simple Visual Monthly Grid representation */}
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
                const day = idx - 2; // offset to align days
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
                    No events scheduled for this month.
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
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </AppShell>
  );
}
