import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useFollowups, completeFollowup, useSettings, addAuditLog } from "@/lib/queries";
import { useAuth } from "@/hooks/use-auth";
import { can } from "@/lib/permissions";
import { toast } from "sonner";
import {
  Check,
  Clock,
  AlertTriangle,
  CheckCircle,
  Search,
  HelpCircle,
  Phone,
  Video,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/followups")({
  head: () => ({ meta: [{ title: "Follow-ups · BLX Realty CRM" }] }),
  component: FollowupsPage,
});

function FollowupsPage() {
  const qc = useQueryClient();
  const { data: tasks = [], isLoading } = useFollowups();
  const { data: settings } = useSettings();
  const { role } = useAuth();
  const [q, setQ] = useState("");

  const [completingTask, setCompletingTask] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [completeNotes, setCompleteNotes] = useState({
    discussionSummary: "",
    nextAction: "",
    customerFeedback: "",
    internalRemarks: "",
  });

  const openCompleteModal = (task: any) => {
    setCompletingTask(task);
    setCompleteNotes({
      discussionSummary: task.title || "",
      nextAction: "",
      customerFeedback: "",
      internalRemarks: "",
    });
  };

  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingTask) return;
    setBusy(true);
    try {
      await completeFollowup(completingTask.id);
      toast.success(`Follow-up completed! Notes saved for ${completingTask.customer_name}.`);
      setCompletingTask(null);
      qc.invalidateQueries({ queryKey: ["followups"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to complete task");
    } finally {
      setBusy(false);
    }
  };

  const filteredTasks = tasks.filter(
    (t) =>
      !q ||
      t.customer_name.toLowerCase().includes(q.toLowerCase()) ||
      t.title.toLowerCase().includes(q.toLowerCase()),
  );

  const now = new Date();
  const overdue = filteredTasks.filter(
    (t) => t.status === "overdue" || (t.status === "pending" && new Date(t.time) < now),
  );
  const pending = filteredTasks.filter((t) => t.status === "pending" && new Date(t.time) >= now);
  const completed = filteredTasks.filter((t) => t.status === "completed");

  const isScheduledTodayBeforeTime = (t: any) => {
    const scheduledDate = new Date(t.time);
    const now = new Date();
    const isSameDay =
      scheduledDate.getFullYear() === now.getFullYear() &&
      scheduledDate.getMonth() === now.getMonth() &&
      scheduledDate.getDate() === now.getDate();
    return isSameDay && now < scheduledDate;
  };

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-rose-500/10 text-rose-500 border-rose-500/20";
      case "medium":
        return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case "low":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const getStatusIcon = (status: string) => {
    if (status === "completed") return <CheckCircle className="h-4 w-4 text-emerald-500" />;
    if (status === "overdue") return <AlertTriangle className="h-4 w-4 text-rose-500" />;
    return <Clock className="h-4 w-4 text-muted-foreground animate-pulse" />;
  };

  return (
    <AppShell
      title="Follow-up Reminders"
      subtitle="Maintain contact velocity with scheduled activities"
    >
      {/* Role-Scope Context Banner */}
      {!can(role).viewAllFollowups() && (
        <div className="mb-4 flex items-center gap-3 px-4 py-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 text-xs text-amber-700 dark:text-amber-400">
          <span className="text-base">💼</span>
          <span>
            <span className="font-bold">My Tasks view:</span> Showing only your assigned follow-up
            tasks.
          </span>
        </div>
      )}
      {/* Search Header */}
      <div className="flex flex-row items-center justify-between gap-4 flex-wrap pb-2">
        <div className="flex items-center gap-2 h-9 px-3 rounded-lg bg-muted border flex-1 max-w-sm">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="bg-transparent outline-none text-xs flex-1"
            placeholder="Search by customer name, title..."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* OVERDUE LIST */}
        <Card className="border-rose-500/20 bg-rose-500/[0.01]">
          <CardHeader className="border-b bg-rose-500/[0.02] py-4 px-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-rose-600 font-semibold text-sm">
                <AlertTriangle className="h-4.5 w-4.5" />
                Overdue Reminders
              </div>
              <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                {overdue.length}
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {isLoading ? (
              <p className="text-xs text-muted-foreground text-center py-4">Loading...</p>
            ) : overdue.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                No overdue followups! Great job.
              </p>
            ) : (
              overdue.map((t) => (
                <div
                  key={t.id}
                  className="p-3 bg-card border border-rose-500/20 rounded-xl space-y-2 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground text-xs">{t.customer_name}</span>
                    <span
                      className={`text-[9px] uppercase font-bold px-2 py-0.5 border rounded-full ${getPriorityStyle(t.priority)}`}
                    >
                      {t.priority}
                    </span>
                  </div>
                  <h4 className="font-medium text-xs text-foreground leading-normal">{t.title}</h4>
                  <div className="text-[10px] text-rose-500 font-semibold flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Scheduled: {new Date(t.time).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Assigned: {t.assigned_sales}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => openCompleteModal(t)}
                    className="w-full text-[10px] h-8 bg-rose-600 hover:bg-rose-500 text-white gap-1 mt-1 font-semibold"
                  >
                    <Check className="h-3.5 w-3.5" /> Mark Completed
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* PENDING LIST */}
        <Card className="border-border/60">
          <CardHeader className="border-b bg-muted/10 py-4 px-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-foreground font-semibold text-sm">
                <Clock className="h-4.5 w-4.5 text-muted-foreground" />
                Upcoming / Pending
              </div>
              <span className="bg-muted-foreground text-background text-[10px] font-bold px-2 py-0.5 rounded-full">
                {pending.length}
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {isLoading ? (
              <p className="text-xs text-muted-foreground text-center py-4">Loading...</p>
            ) : pending.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                All clear. No pending tasks.
              </p>
            ) : (
              pending.map((t) => {
                const isReminder = isScheduledTodayBeforeTime(t);
                return (
                  <div
                    key={t.id}
                    className="p-3 bg-card border rounded-xl space-y-2 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground text-xs">
                        {t.customer_name}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {isReminder && (
                          <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[9px] uppercase font-bold px-2 py-0.5 rounded-full">
                            ⏰ Reminder
                          </span>
                        )}
                        <span
                          className={`text-[9px] uppercase font-bold px-2 py-0.5 border rounded-full ${getPriorityStyle(t.priority)}`}
                        >
                          {t.priority}
                        </span>
                      </div>
                    </div>
                    <h4 className="font-medium text-xs text-foreground leading-normal">
                      {t.title}
                    </h4>
                    <div className="text-[10px] text-primary font-semibold flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Scheduled: {new Date(t.time).toLocaleString()}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Assigned: {t.assigned_sales}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => openCompleteModal(t)}
                      className="w-full text-[10px] h-8 bg-primary text-primary-foreground hover:bg-primary/90 gap-1 mt-1 font-semibold"
                    >
                      <Check className="h-3.5 w-3.5" /> Mark Completed
                    </Button>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* COMPLETED LIST */}
        <Card className="border-border/60 bg-muted/5 opacity-80">
          <CardHeader className="border-b bg-muted/10 py-4 px-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-emerald-600 font-semibold text-sm">
                <CheckCircle className="h-4.5 w-4.5" />
                Completed
              </div>
              <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                {completed.length}
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {isLoading ? (
              <p className="text-xs text-muted-foreground text-center py-4">Loading...</p>
            ) : completed.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                No completed tasks logged today.
              </p>
            ) : (
              completed.map((t) => (
                <div
                  key={t.id}
                  className="p-3 bg-card border rounded-xl space-y-2 border-emerald-500/10"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-muted-foreground text-xs line-through">
                      {t.customer_name}
                    </span>
                    <span className="text-[9px] uppercase font-bold px-2 py-0.5 bg-emerald-500/10 text-emerald-500 rounded-full">
                      Done
                    </span>
                  </div>
                  <h4 className="font-medium text-xs text-muted-foreground line-through leading-normal">
                    {t.title}
                  </h4>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Scheduled: {new Date(t.time).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Assigned: {t.assigned_sales}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Structured Follow-Up Notes Dialog (Module 4.4) */}
      <Dialog open={!!completingTask} onOpenChange={(open) => !open && setCompletingTask(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-500" /> Record Follow-up Outcome & Notes
            </DialogTitle>
          </DialogHeader>

          {completingTask && (
            <form onSubmit={handleCompleteSubmit} className="space-y-4 pt-2">
              <div className="p-3 rounded-lg bg-muted/40 text-xs space-y-1">
                <div className="font-semibold text-foreground">{completingTask.customer_name}</div>
                <div className="text-[11px] text-muted-foreground">{completingTask.title}</div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="disc-summary" className="text-xs">
                  Discussion Summary *
                </Label>
                <textarea
                  id="disc-summary"
                  rows={2}
                  required
                  value={completeNotes.discussionSummary}
                  onChange={(e) =>
                    setCompleteNotes((p) => ({ ...p, discussionSummary: e.target.value }))
                  }
                  placeholder="Key topics discussed during call/meeting..."
                  className="w-full text-xs p-2.5 rounded-lg border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="next-action" className="text-xs">
                  Next Action Item
                </Label>
                <Input
                  id="next-action"
                  value={completeNotes.nextAction}
                  onChange={(e) => setCompleteNotes((p) => ({ ...p, nextAction: e.target.value }))}
                  placeholder="e.g. Schedule site visit on Saturday 3 PM"
                  className="h-8.5 text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cust-feedback" className="text-xs">
                    Customer Feedback
                  </Label>
                  <Input
                    id="cust-feedback"
                    value={completeNotes.customerFeedback}
                    onChange={(e) =>
                      setCompleteNotes((p) => ({ ...p, customerFeedback: e.target.value }))
                    }
                    placeholder="Positive / Interested in 3BHK"
                    className="h-8.5 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="int-remarks" className="text-xs">
                    Internal Remarks
                  </Label>
                  <Input
                    id="int-remarks"
                    value={completeNotes.internalRemarks}
                    onChange={(e) =>
                      setCompleteNotes((p) => ({ ...p, internalRemarks: e.target.value }))
                    }
                    placeholder="For team reference"
                    className="h-8.5 text-xs"
                  />
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCompletingTask(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={busy} className="gap-1 font-semibold">
                  {busy ? "Saving..." : "Save Notes & Complete"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

export function Stub({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <AppShell title={title} subtitle={subtitle}>
      <Card>
        <CardContent className="p-12 text-center">
          <h3 className="font-display font-bold text-lg">Coming up next</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            This module is part of the BLX Realty CRM roadmap. We'll wire it up to the live database
            in the next iteration.
          </p>
        </CardContent>
      </Card>
    </AppShell>
  );
}
