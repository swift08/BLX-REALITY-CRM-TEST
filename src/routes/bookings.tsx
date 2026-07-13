import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  useBookings,
  confirmBookingPayment,
  cancelBooking,
  updateBookingStatus,
} from "@/lib/queries";
import { useAuth } from "@/hooks/use-auth";
import { can } from "@/lib/permissions";
import { toast } from "sonner";
import { Receipt, FileText, Check, X, DollarSign } from "lucide-react";

export const Route = createFileRoute("/bookings")({
  head: () => ({ meta: [{ title: "Bookings · BLX Realty CRM" }] }),
  component: BookingsPage,
});

function BookingsPage() {
  const qc = useQueryClient();
  const { data: bookings = [], isLoading } = useBookings();
  const { role } = useAuth();

  const handleConfirmPayment = async (leadId: string) => {
    try {
      await confirmBookingPayment(leadId);
      toast.success("Payment verified! Booking completed successfully.");
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleCancelBooking = async (leadId: string) => {
    if (
      confirm(
        "Are you sure you want to cancel this booking and release the unit back to available inventory?",
      )
    ) {
      try {
        await cancelBooking(leadId);
        toast.success("Booking cancelled.");
        qc.invalidateQueries({ queryKey: ["bookings"] });
        qc.invalidateQueries({ queryKey: ["leads"] });
      } catch (err: any) {
        toast.error(err.message);
      }
    }
  };

  const handleStatusChange = async (leadId: string, status: any) => {
    try {
      await updateBookingStatus(leadId, status);
      toast.success("Booking status updated!");
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const downloadMockInvoice = (b: any) => {
    const content = `
========================================
             BLX REALTY CRM             
            BOOKING INVOICE             
========================================
Booking Ref: BK-${b.lead_id.toUpperCase()}
Date: ${new Date(b.booking.booking_date).toLocaleDateString()}
Client: ${b.customer_name}
Project: ${b.project_name}
Unit Number: ${b.unit_number}
----------------------------------------
Holding Amount Received: ₹${b.booking.amount.toLocaleString("en-IN")}
Status: ${(b.booking.status || b.booking.payment_status).toUpperCase()}
----------------------------------------
System generated invoice. Confirmed.
========================================
    `;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Booking_Invoice_${b.customer_name.replace(/\s+/g, "_")}.txt`;
    link.click();
    toast.success("Invoice downloaded!");
  };

  return (
    <AppShell
      title="Bookings Registry"
      subtitle="Log of holding reservations, invoices and payment clearances"
    >
      <Card className="border-border/60">
        <CardHeader className="border-b py-4 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Receipt className="h-4.5 w-4.5 text-muted-foreground" />
            Active Bookings List
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-xs text-muted-foreground text-center py-6">Loading bookings...</p>
          ) : bookings.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-12">
              No active bookings recorded in the system.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="text-muted-foreground uppercase tracking-wider border-b bg-muted/10 h-10 font-semibold">
                    <th className="px-6 py-2">Booking ID</th>
                    <th className="px-4 py-2">Customer</th>
                    <th className="px-4 py-2">Property Project</th>
                    <th className="px-4 py-2">Unit Allocated</th>
                    <th className="px-4 py-2">Holding Amount</th>
                    <th className="px-4 py-2">Booking Status</th>
                    <th className="px-6 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr key={b.id} className="border-b last:border-0 hover:bg-muted/20 h-14">
                      <td className="px-6 py-2 font-mono font-bold text-foreground">
                        BK-{b.lead_id.toUpperCase().slice(0, 8)}
                      </td>
                      <td className="px-4 py-2 font-semibold text-foreground">{b.customer_name}</td>
                      <td className="px-4 py-2 font-medium text-foreground">{b.project_name}</td>
                      <td className="px-4 py-2 font-mono text-foreground font-semibold">
                        {b.unit_number}
                      </td>
                      <td className="px-4 py-2 font-bold text-primary">
                        ₹{b.booking.amount.toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-2">
                        {can(role).changeBookingStatus() ? (
                          <select
                            value={b.booking.status || "initiated"}
                            onChange={(e) => handleStatusChange(b.lead_id, e.target.value)}
                            className="h-8 px-2 rounded border bg-background text-[11px] font-bold focus:outline-none"
                            disabled={!can(role).changeBookingStatus()}
                          >
                            <option value="initiated">Booking Request (Awaiting Manager)</option>
                            <option value="pending">Manager Approved (Awaiting Admin)</option>
                            <option value="completed" disabled={!can(role).finalApproveBooking()}>
                              Booking Confirmed (Admin Verified)
                            </option>
                            <option value="closed">Closed / Cancelled</option>
                          </select>
                        ) : (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              (b.booking.status || b.booking.payment_status) === "completed"
                                ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                : (b.booking.status || b.booking.payment_status) === "closed"
                                  ? "bg-slate-500/10 text-slate-500 border border-slate-500/20"
                                  : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                            }`}
                          >
                            {b.booking.status === "initiated"
                              ? "Awaiting Manager"
                              : b.booking.status === "pending"
                                ? "Awaiting Admin"
                                : b.booking.status || b.booking.payment_status}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-2 text-right flex flex-row items-center justify-end gap-2 h-14">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadMockInvoice(b)}
                          className="h-8 text-xs font-semibold gap-1"
                        >
                          <FileText className="h-3.5 w-3.5" /> Invoice
                        </Button>
                        {b.booking.status === "initiated" && can(role).approveBookingRequest() && (
                          <Button
                            size="sm"
                            onClick={() => handleStatusChange(b.lead_id, "pending")}
                            className="h-8 text-xs bg-amber-600 hover:bg-amber-500 text-white font-semibold gap-1"
                          >
                            <Check className="h-3.5 w-3.5" /> Approve Request
                          </Button>
                        )}
                        {b.booking.status === "pending" && can(role).finalApproveBooking() && (
                          <Button
                            size="sm"
                            onClick={() => handleConfirmPayment(b.lead_id)}
                            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold gap-1"
                          >
                            <Check className="h-3.5 w-3.5" /> Final Verify
                          </Button>
                        )}
                        {b.booking.status !== "completed" &&
                          b.booking.status !== "closed" &&
                          can(role).cancelBooking() && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCancelBooking(b.lead_id)}
                              className="h-8 text-xs text-destructive hover:bg-destructive/5 hover:text-destructive font-semibold"
                            >
                              Release
                            </Button>
                          )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
