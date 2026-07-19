import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { can, isLeadVisible } from "@/lib/permissions";
import { useBookings, useProjects, useCRMUsers } from "@/lib/queries";
import {
  DollarSign,
  TrendingUp,
  Receipt,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building,
  Users,
  Award,
  ArrowUpRight,
  PieChart,
  Calendar,
  CreditCard,
  FileText,
} from "lucide-react";

export const Route = createFileRoute("/finance-dashboard")({
  head: () => ({ meta: [{ title: "Executive Finance & Collections Dashboard · BLX Realty CRM" }] }),
  component: FinanceDashboardPage,
});

function FinanceDashboardPage() {
  const { role, userId } = useAuth();
  const userCan = can(role);

  const { data: bookings = [] } = useBookings();
  const { data: projects = [] } = useProjects();
  const { data: crmUsers = [] } = useCRMUsers();

  const scopedBookings = useMemo(() => {
    return bookings.filter((b) => isLeadVisible(role, userId, b.owner_id || null));
  }, [bookings, role, userId]);

  // Overall Financial KPIs
  const financialKpis = useMemo(() => {
    const totalBilled = scopedBookings.reduce((sum, b) => sum + (b.amount || 0), 0);
    const totalCollected = scopedBookings.reduce((sum, b) => {
      const isPaid = b.invoice?.status === "paid" || b.booking?.payment_status === "completed";
      return sum + (b.invoice?.amount_paid || (isPaid ? b.amount : 0));
    }, 0);
    const outstanding = Math.max(0, totalBilled - totalCollected);
    const collectionRate =
      totalBilled > 0 ? ((totalCollected / totalBilled) * 100).toFixed(1) : "100.0";

    const todayStr = new Date().toISOString().split("T")[0];
    const todayCollections = scopedBookings
      .filter((b) => b.booking_date?.startsWith(todayStr))
      .reduce((sum, b) => sum + (b.amount || 0), 0);

    const overdueCollections = scopedBookings
      .filter((b) => b.booking?.payment_status === "pending" && b.invoice?.status !== "paid")
      .reduce((sum, b) => sum + (b.amount || 0), 0);

    return {
      totalSales: totalBilled,
      totalCollected,
      outstanding,
      collectionRate,
      todayCollections,
      overdueCollections,
      bookingCount: scopedBookings.length,
    };
  }, [scopedBookings]);

  // Project Revenue Analytics
  const projectRevenue = useMemo(() => {
    return projects.map((p) => {
      const pBookings = scopedBookings.filter((b) => b.project_name === p.name);
      const unitsSold = pBookings.length;
      const totalRev = pBookings.reduce((sum, b) => sum + (b.amount || 0), 0);
      const collected = pBookings.reduce((sum, b) => {
        const isPaid = b.invoice?.status === "paid" || b.booking?.payment_status === "completed";
        return sum + (b.invoice?.amount_paid || (isPaid ? b.amount : 0));
      }, 0);
      const pending = Math.max(0, totalRev - collected);

      return {
        id: p.id,
        name: p.name,
        unitsSold,
        totalUnits: p.total_units || 50,
        totalRev,
        collected,
        pending,
      };
    });
  }, [projects, scopedBookings]);

  // Executive Collection Performance Leaderboard
  const executivePerformance = useMemo(() => {
    const salesExecs = crmUsers.filter(
      (u) => u.role === "sales_executive" || u.role === "manager" || u.role === "super_admin",
    );
    return salesExecs
      .map((exec) => {
        const eBookings = scopedBookings.filter(
          (b) => b.owner_id === exec.name || b.owner_id === exec.id,
        );
        const salesVal = eBookings.reduce((sum, b) => sum + (b.amount || 0), 0);
        const collectedVal = eBookings.reduce((sum, b) => {
          const isPaid = b.invoice?.status === "paid" || b.booking?.payment_status === "completed";
          return sum + (b.invoice?.amount_paid || (isPaid ? b.amount : 0));
        }, 0);
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
      .sort((a, b) => b.collectedVal - a.collectedVal);
  }, [crmUsers, scopedBookings]);

  return (
    <AppShell
      title="Executive Finance Dashboard"
      subtitle="Real-time revenue analytics, collection rates, project health & executive collection performance"
    >
      <div className="space-y-6 pb-12">
        {/* Top Header Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-5 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-brand font-bold text-base text-foreground">
                  Financial Intelligence Operations Hub
                </h2>
                <Badge
                  variant="outline"
                  className="text-[10px] bg-primary/5 text-primary border-primary/20"
                >
                  Role Scoped ({userCan.roleLabel()})
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Comprehensive financial control center for finance officers, sales directors, and
                executive management.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/payments">
              <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                <CreditCard className="h-3.5 w-3.5" /> Payments Ledger
              </Button>
            </Link>
            <Link to="/bookings">
              <Button size="sm" className="gap-1.5 text-xs">
                <Building className="h-3.5 w-3.5" /> Bookings Workspace
              </Button>
            </Link>
          </div>
        </div>

        {/* Financial KPI Summary Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card border shadow-xs">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider">
                Total Sales Invoiced
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-foreground">
                ₹{financialKpis.totalSales.toLocaleString("en-IN")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium">
                <Receipt className="h-3.5 w-3.5 text-primary" /> {financialKpis.bookingCount} Active
                Property Contracts
              </div>
            </CardContent>
          </Card>

          <Card className="bg-emerald-500/[0.03] border-emerald-500/20 shadow-xs">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                Total Collections Received
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                ₹{financialKpis.totalCollected.toLocaleString("en-IN")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Collection Efficiency:{" "}
                {financialKpis.collectionRate}%
              </div>
            </CardContent>
          </Card>

          <Card className="bg-amber-500/[0.03] border-amber-500/20 shadow-xs">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                Outstanding Balance Due
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                ₹{financialKpis.outstanding.toLocaleString("en-IN")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-[11px] text-amber-600 font-semibold flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> Pending Collection Clearance
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/20 shadow-xs">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold text-primary uppercase tracking-wider">
                Today's Collections
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-foreground">
                ₹{financialKpis.todayCollections.toLocaleString("en-IN")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium">
                <Calendar className="h-3.5 w-3.5 text-primary" /> Today's Escrow Activity
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Project Revenue Analytics & Executive Leaderboard */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Project Revenue Dashboard */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building className="h-4 w-4 text-primary" /> Project Revenue & Collection Analytics
              </CardTitle>
              <CardDescription className="text-xs">
                Financial performance, gross revenue, and collection clearance rates broken down by
                property project.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {projectRevenue.map((p) => {
                  const pct = p.totalRev > 0 ? Math.round((p.collected / p.totalRev) * 100) : 100;
                  return (
                    <div key={p.id} className="p-4 rounded-xl border bg-card space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-xs text-foreground flex items-center gap-1.5">
                          <span>{p.name}</span>
                          <Badge
                            variant="outline"
                            className="text-[9px] bg-primary/5 text-primary border-primary/20"
                          >
                            {p.unitsSold} Units Booked
                          </Badge>
                        </div>
                        <div className="font-mono text-xs font-bold text-foreground">
                          ₹{(p.totalRev / 100000).toFixed(1)} Lakhs
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-600 h-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono pt-1">
                        <span className="text-emerald-600 font-bold">
                          Collected: ₹{(p.collected / 100000).toFixed(1)} L ({pct}%)
                        </span>
                        <span className="text-amber-600 font-bold">
                          Outstanding: ₹{(p.pending / 100000).toFixed(1)} L
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Executive Collection Performance Leaderboard */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="h-4 w-4 text-amber-500" /> Executive Collection Performance
                Leaderboard
              </CardTitle>
              <CardDescription className="text-xs">
                Measures total sales volume, actual collections cleared, outstanding balances, and
                collection rates per executive.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto border rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 border-b font-semibold text-muted-foreground uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Executive</th>
                      <th className="p-3 font-mono">Deals</th>
                      <th className="p-3 font-mono">Total Sales</th>
                      <th className="p-3 font-mono">Collections</th>
                      <th className="p-3">Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {executivePerformance.map((exec, index) => (
                      <tr key={exec.id} className="hover:bg-muted/20 transition-colors">
                        <td className="p-3 font-bold text-foreground flex items-center gap-2">
                          <span
                            className={`h-5 w-5 rounded-full text-[10px] font-bold flex items-center justify-center ${index === 0 ? "bg-amber-500 text-white" : index === 1 ? "bg-slate-400 text-white" : "bg-muted text-muted-foreground"}`}
                          >
                            {index + 1}
                          </span>
                          <span>{exec.name}</span>
                        </td>
                        <td className="p-3 font-mono text-muted-foreground">{exec.dealsCount}</td>
                        <td className="p-3 font-mono font-bold text-foreground">
                          ₹{(exec.salesVal / 100000).toFixed(1)} L
                        </td>
                        <td className="p-3 font-mono font-bold text-emerald-600">
                          ₹{(exec.collectedVal / 100000).toFixed(1)} L
                        </td>
                        <td className="p-3">
                          <Badge
                            className={`text-[10px] ${exec.rate >= 80 ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" : "bg-amber-500/10 text-amber-600 border-amber-500/30"}`}
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
    </AppShell>
  );
}
