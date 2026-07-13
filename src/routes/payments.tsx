import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign } from "lucide-react";

export const Route = createFileRoute("/payments")({
  head: () => ({ meta: [{ title: "Payments · BLX Realty CRM" }] }),
  component: PaymentsPage,
});

function PaymentsPage() {
  return (
    <AppShell title="Payments" subtitle="Invoices, receipts & payment tracking">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Payment Records
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <DollarSign className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold text-foreground">Payment Ledger</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Payment tracking and invoice management will be available here. View booking payments,
              generate receipts, and track outstanding invoices.
            </p>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
