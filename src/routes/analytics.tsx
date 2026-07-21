import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLeads, useCRMUsers } from "@/lib/queries";
import { useAuth } from "@/hooks/use-auth";
import { can } from "@/lib/permissions";
import { TrendingUp, Users, Target, IndianRupee, MapPin, BarChart2 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

export const Route = createFileRoute("/analytics")({
  head: () => ({ meta: [{ title: "Analytics · BLX Realty CRM" }] }),
  component: AnalyticsPage,
});

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6"];

function AnalyticsPage() {
  const { role, user } = useAuth();
  const { data: customers = [], isLoading: leadsLoading } = useLeads();
  const { data: crmUsers = [], isLoading: usersLoading } = useCRMUsers();

  const isLoading = leadsLoading || usersLoading;

  const activeCustomers = customers.filter((c) => !c.is_deleted);

  // Per-executive stats computed from live data
  const salesUsers = crmUsers.filter((u) => u.role === "sales_executive");

  const execStats = salesUsers.map((exec) => {
    const myLeads = activeCustomers.filter((c) =>
      c.opportunities?.some((o: any) => o.owner === exec.name),
    );
    const converted = myLeads.filter((c) =>
      c.opportunities?.some((o: any) => o.stage === "converted"),
    ).length;
    const visits = myLeads.filter((c) =>
      c.opportunities?.some(
        (o: any) => o.stage === "site_visit_completed" || o.stage === "site_visit_scheduled",
      ),
    ).length;
    const bookings = myLeads.filter((c) =>
      c.opportunities?.some(
        (o: any) =>
          o.stage === "booking_initiated" ||
          o.stage === "payment_pending" ||
          o.stage === "payment_completed",
      ),
    ).length;
    let revenue = 0;
    myLeads.forEach((c) => {
      c.opportunities?.forEach((o: any) => {
        if (o.booking?.payment_status === "completed") {
          revenue += o.booking.amount || 0;
        }
      });
    });
    const convRate = myLeads.length ? ((converted / myLeads.length) * 100).toFixed(1) : "0.0";

    return {
      name: exec.name,
      role: "Sales Executive",
      leads: myLeads.length,
      visits,
      bookings,
      converted,
      convRate,
      revenue:
        revenue > 0
          ? revenue >= 10000000
            ? `₹${(revenue / 10000000).toFixed(2).replace(/\.00$/, "")} Cr`
            : `₹${(revenue / 100000).toFixed(1).replace(/\.0$/, "")} L`
          : "₹0",
    };
  });

  // Company-wide funnel data
  const stageMap: Record<string, number> = {};
  activeCustomers.forEach((c) => {
    const stage = c.opportunities?.[0]?.stage || "new";
    stageMap[stage] = (stageMap[stage] || 0) + 1;
  });

  const funnelData = [
    { name: "New", count: stageMap["new"] || 0 },
    { name: "Connected", count: stageMap["connected"] || 0 },
    { name: "Interested", count: stageMap["interested"] || 0 },
    {
      name: "Site Visit",
      count: (stageMap["site_visit_scheduled"] || 0) + (stageMap["site_visit_completed"] || 0),
    },
    { name: "Negotiation", count: stageMap["negotiation"] || 0 },
    {
      name: "Booking",
      count: (stageMap["booking_initiated"] || 0) + (stageMap["payment_pending"] || 0),
    },
    { name: "Converted", count: stageMap["converted"] || 0 },
  ].filter((s) => s.count > 0);

  // Source distribution
  const sourceMap: Record<string, number> = {};
  activeCustomers.forEach((c) => {
    const src = c.source || "Unknown";
    sourceMap[src] = (sourceMap[src] || 0) + 1;
  });
  const sourceData = Object.entries(sourceMap).map(([name, value]) => ({ name, value }));

  // Totals
  const totalLeads = activeCustomers.length;
  const totalConverted = activeCustomers.filter((c) =>
    c.opportunities?.some((o: any) => o.stage === "converted"),
  ).length;
  const totalRevenue = activeCustomers.reduce((sum, c) => {
    return (
      sum +
      (c.opportunities?.reduce((s: number, o: any) => {
        return s + (o.booking?.payment_status === "completed" ? o.booking.amount || 0 : 0);
      }, 0) || 0)
    );
  }, 0);
  const totalVisits = activeCustomers.filter((c) =>
    c.opportunities?.some(
      (o: any) => o.stage === "site_visit_scheduled" || o.stage === "site_visit_completed",
    ),
  ).length;

  const conversionRate = totalLeads ? ((totalConverted / totalLeads) * 100).toFixed(1) : "0.0";

  // Show only personal analytics for Sales Exec
  const isSalesExec = role === "sales_executive";
  const userName = user?.user_metadata?.full_name || "";
  const myStats = isSalesExec ? execStats.find((e) => e.name === userName) : null;

  if (isLoading) {
    return (
      <AppShell title="Analytics" subtitle="Sales productivity & business performance">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Analytics" subtitle="Sales productivity & business performance">
      <div className="space-y-6">
        {/* KPI Cards */}
        {can(role).viewCompanyAnalytics() && (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-indigo-500/10 grid place-items-center flex-shrink-0">
                    <Users className="h-5 w-5 text-indigo-500" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{totalLeads}</div>
                    <div className="text-xs text-muted-foreground">Total Leads</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/10 grid place-items-center flex-shrink-0">
                    <Target className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{conversionRate}%</div>
                    <div className="text-xs text-muted-foreground">Conversion Rate</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-500/10 grid place-items-center flex-shrink-0">
                    <MapPin className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{totalVisits}</div>
                    <div className="text-xs text-muted-foreground">Site Visits</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-purple-500/10 grid place-items-center flex-shrink-0">
                    <IndianRupee className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">
                      {totalRevenue > 0
                        ? totalRevenue >= 10000000
                          ? `₹${(totalRevenue / 10000000).toFixed(2).replace(/\.00$/, "")} Cr`
                          : `₹${(totalRevenue / 100000).toFixed(1).replace(/\.0$/, "")} L`
                        : "₹0"}
                    </div>
                    <div className="text-xs text-muted-foreground">Revenue Collected</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Sales Executive personal view */}
        {isSalesExec && myStats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "My Leads", val: myStats.leads, icon: Users, color: "indigo" },
              { label: "Site Visits", val: myStats.visits, icon: MapPin, color: "amber" },
              { label: "Bookings", val: myStats.bookings, icon: BarChart2, color: "purple" },
              { label: "Conversions", val: myStats.converted, icon: Target, color: "emerald" },
            ].map((item) => (
              <Card key={item.label}>
                <CardContent className="p-4">
                  <div className="text-xl font-bold">{item.val}</div>
                  <div className="text-xs text-muted-foreground">{item.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Lead Funnel */}
          {funnelData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Sales Pipeline Funnel
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={funnelData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} name="Leads" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Source Distribution */}
          {sourceData.length > 0 && can(role).viewCompanyAnalytics() && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart2 className="h-4 w-4 text-primary" />
                  Lead Source Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={sourceData}
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {sourceData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sales Team Performance Table (Admin/Manager only) */}
        {can(role).viewTeamAnalytics() && execStats.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4 text-primary" />
                Sales Team Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-y bg-muted/30">
                    <th className="px-6 py-3 font-medium">Executive</th>
                    <th className="px-3 py-3 font-medium">Leads</th>
                    <th className="px-3 py-3 font-medium">Site Visits</th>
                    <th className="px-3 py-3 font-medium">Bookings</th>
                    <th className="px-3 py-3 font-medium">Converted</th>
                    <th className="px-3 py-3 font-medium">Conv. Rate</th>
                    <th className="px-6 py-3 font-medium text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {execStats.map((s) => (
                    <tr key={s.name} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground grid place-items-center text-xs font-semibold flex-shrink-0">
                            {s.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()
                              .slice(0, 2)}
                          </div>
                          <div>
                            <div className="font-medium">{s.name}</div>
                            <div className="text-xs text-muted-foreground">{s.role}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 font-medium">{s.leads}</td>
                      <td className="px-3 py-3">{s.visits}</td>
                      <td className="px-3 py-3">{s.bookings}</td>
                      <td className="px-3 py-3">{s.converted}</td>
                      <td className="px-3 py-3">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">
                          {s.convRate}%
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right font-semibold">{s.revenue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* No data state */}
        {totalLeads === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-20 text-center">
              <TrendingUp className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="font-semibold text-foreground">No Analytics Data Yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Add leads and close deals to see performance analytics here.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
