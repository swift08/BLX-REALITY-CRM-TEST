import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileBarChart2 } from "lucide-react";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Reports · BLX Realty CRM" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  return (
    <AppShell title="Reports" subtitle="Business intelligence & export center">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileBarChart2 className="h-5 w-5 text-primary" />
            Reports Center
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FileBarChart2 className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold text-foreground">Business Reports</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Export and schedule business reports here. Generate sales summaries, lead conversion
              reports, revenue breakdowns, and team performance exports.
            </p>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
