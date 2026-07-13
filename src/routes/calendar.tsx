import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCalendarEvents, addCalendarEvent, useCustomers, useFollowups } from "@/lib/queries";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  Calendar as CalendarIcon,
  Plus,
  MapPin,
  User,
  Clock,
  Bookmark,
  Smile,
  PlaneTakeoff,
  Coffee,
  Briefcase,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      { title: "Business Calendar · BLX Realty CRM" },
      {
        name: "description",
        content:
          "Organize company holidays, sales leaves, client meetings, site visits, and availability slots.",
      },
    ],
  }),
  component: BusinessCalendar,
});

function BusinessCalendar() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const { data: events = [], isLoading } = useCalendarEvents();
  const { data: customers = [] } = useCustomers();

  // Dialog & Form State
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"holiday" | "leave" | "meeting" | "visit" | "availability">(
    "meeting",
  );
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [salesPerson, setSalesPerson] = useState("");
  const [details, setDetails] = useState("");

  // Filters State
  const [filterType, setFilterType] = useState<string>("all");

  // Quick navigation calendar grid mock
  const [currentDate, setCurrentDate] = useState(new Date());

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month, 1).getDay();
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDayIndex = getFirstDayOfMonth(currentDate);
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !start || !end) {
      toast.error("Please fill in all mandatory fields.");
      return;
    }

    try {
      await addCalendarEvent({
        type,
        title,
        start,
        end,
        customerId: customerId || undefined,
        salesPerson: salesPerson || undefined,
        details: details || undefined,
      });

      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      toast.success("Calendar Event successfully scheduled!");
      setIsOpen(false);

      // Reset
      setTitle("");
      setStart("");
      setEnd("");
      setCustomerId("");
      setSalesPerson("");
      setDetails("");
    } catch (err: any) {
      toast.error(err.message || "Failed to add event.");
    }
  };

  const filteredEvents = events.filter((e) => filterType === "all" || e.type === filterType);

  const getEventBadgeColor = (type: string) => {
    switch (type) {
      case "holiday":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      case "leave":
        return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      case "meeting":
        return "bg-indigo-500/10 text-indigo-500 border-indigo-500/20";
      case "visit":
        return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case "availability":
        return "bg-cyan-500/10 text-cyan-500 border-cyan-500/20";
      default:
        return "bg-slate-500/10 text-slate-500 border-slate-500/20";
    }
  };

  return (
    <AppShell
      title="Business Calendar"
      subtitle="Organize company events, meetings, customer site visits, and team availabilities in one unified place."
    >
      <div className="flex flex-col md:flex-row gap-6">
        {/* Left Side: Calendar Grid Display */}
        <Card className="flex-1 border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" />
              <CardTitle className="font-display font-semibold text-lg text-foreground">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </CardTitle>
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="icon" onClick={handlePrevMonth} className="h-8 w-8">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={handleNextMonth} className="h-8 w-8">
                <ChevronRight className="h-4 w-4" />
              </Button>

              <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogTrigger asChild>
                  <Button className="h-8 gap-1.5 ml-2">
                    <Plus className="h-4 w-4" />
                    <span>Create Event</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[480px]">
                  <DialogHeader>
                    <DialogTitle>Schedule Calendar Event</DialogTitle>
                    <DialogDescription>
                      Add meetings, holidays, leaves, or availability windows.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddEvent} className="space-y-4 pt-2">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">
                        Event Title *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Prestige Aurelia Visit with Priyanka"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">
                          Event Type
                        </label>
                        <select
                          value={type}
                          onChange={(e) => setType(e.target.value as any)}
                          className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          <option value="meeting">Client Meeting</option>
                          <option value="visit">Site Visit</option>
                          <option value="holiday">Company Holiday</option>
                          <option value="leave">Sales Leave</option>
                          <option value="availability">Availability Slot</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">
                          Sales Owner
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Arjun K"
                          value={salesPerson}
                          onChange={(e) => setSalesPerson(e.target.value)}
                          className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">
                          Start Time *
                        </label>
                        <input
                          type="datetime-local"
                          value={start}
                          onChange={(e) => setStart(e.target.value)}
                          className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">
                          End Time *
                        </label>
                        <input
                          type="datetime-local"
                          value={end}
                          onChange={(e) => setEnd(e.target.value)}
                          className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none"
                          required
                        />
                      </div>
                    </div>

                    {type !== "holiday" && type !== "leave" && (
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">
                          Link Customer
                        </label>
                        <select
                          value={customerId}
                          onChange={(e) => setCustomerId(e.target.value)}
                          className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none"
                        >
                          <option value="">-- Optional --</option>
                          {customers.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({c.phone})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">
                        Additional Notes
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Add location details, agenda or instruction links..."
                        value={details}
                        onChange={(e) => setDetails(e.target.value)}
                        className="w-full p-3 rounded-lg border border-input bg-background text-sm focus:outline-none"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">Schedule Event</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {/* Days header */}
            <div className="grid grid-cols-7 gap-1 text-center font-semibold text-xs text-muted-foreground mb-2">
              <div>Sun</div>
              <div>Mon</div>
              <div>Tue</div>
              <div>Wed</div>
              <div>Thu</div>
              <div>Fri</div>
              <div>Sat</div>
            </div>

            {/* Calendar grid dates */}
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDayIndex }).map((_, idx) => (
                <div
                  key={`empty-${idx}`}
                  className="h-20 bg-muted/20 border border-border/30 rounded-lg opacity-40"
                ></div>
              ))}
              {Array.from({ length: daysInMonth }).map((_, idx) => {
                const dayNum = idx + 1;
                const currentDateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;

                const dayEvents = events.filter((e) => e.start.startsWith(currentDateStr));

                return (
                  <div
                    key={`day-${dayNum}`}
                    className="h-20 p-1 bg-background/50 border border-border/60 hover:bg-muted/30 rounded-lg flex flex-col justify-between transition-colors"
                  >
                    <span className="text-xs font-semibold text-foreground/80 self-start">
                      {dayNum}
                    </span>
                    <div className="flex flex-col gap-0.5 overflow-hidden max-h-12">
                      {dayEvents.slice(0, 3).map((e) => (
                        <div
                          key={e.id}
                          className="text-[9px] px-1 rounded truncate leading-tight font-medium bg-primary/10 text-primary border border-primary/20"
                        >
                          {e.title}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <span className="text-[8px] text-muted-foreground pl-1 font-medium">
                          +{dayEvents.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Right Side: Filters & Agenda Feed list */}
        <div className="w-full md:w-80 flex flex-col gap-4">
          <Card className="border-border bg-card">
            <CardHeader className="pb-3 flex flex-row items-center justify-between border-b">
              <CardTitle className="font-display font-semibold text-sm text-foreground flex items-center gap-1.5">
                <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                Filters
              </CardTitle>
              {filterType !== "all" && (
                <Button
                  variant="ghost"
                  className="h-6 px-2 text-[10px]"
                  onClick={() => setFilterType("all")}
                >
                  Clear filters
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-3 space-y-1">
              {[
                { type: "all", label: "🗓️ All Events" },
                { type: "meeting", label: "🤝 Client Meetings" },
                { type: "visit", label: "🏢 Site Visits" },
                { type: "holiday", label: "🎈 Company Holidays" },
                { type: "leave", label: "✈️ Sales Leaves" },
                { type: "availability", label: "⏰ Availabilities" },
              ].map((opt) => (
                <button
                  key={opt.type}
                  onClick={() => setFilterType(opt.type)}
                  className={`w-full text-left px-3 py-2 text-xs font-medium rounded-lg transition-all flex items-center justify-between ${
                    filterType === opt.type
                      ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                      : "text-foreground/80 hover:bg-muted/80"
                  }`}
                >
                  <span>{opt.label}</span>
                  {opt.type !== "all" && (
                    <span className="text-[10px] px-1.5 rounded-full bg-background/20 font-bold">
                      {events.filter((e) => e.type === opt.type).length}
                    </span>
                  )}
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border bg-card flex-1">
            <CardHeader className="pb-2 border-b">
              <CardTitle className="font-display font-semibold text-sm text-foreground">
                Agenda Feed ({filteredEvents.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-3 overflow-y-auto max-h-[350px]">
              {isLoading ? (
                <div className="text-center text-xs text-muted-foreground py-6 animate-pulse">
                  Loading Agenda...
                </div>
              ) : filteredEvents.length === 0 ? (
                <div className="text-center text-xs text-muted-foreground py-10">
                  No events scheduled.
                </div>
              ) : (
                filteredEvents.map((e) => (
                  <div
                    key={e.id}
                    className="p-3 rounded-lg border bg-background/40 hover:bg-background/80 transition-all flex flex-col gap-1.5 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider border ${getEventBadgeColor(e.type)}`}
                      >
                        {e.type}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-0.5">
                        <Clock className="h-3 w-3" />
                        {new Date(e.start).toLocaleDateString("en-IN", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-foreground leading-snug">{e.title}</h4>
                    {e.salesPerson && (
                      <span className="text-[10px] text-muted-foreground/80 flex items-center gap-1 font-medium">
                        <User className="h-3 w-3" /> {e.salesPerson}
                      </span>
                    )}
                    {e.details && (
                      <p className="text-[10px] text-muted-foreground leading-normal mt-1 border-t border-border/40 pt-1.5 italic">
                        {e.details}
                      </p>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
