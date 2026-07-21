import { createFileRoute } from "@tanstack/react-router";
import { RevenueOpsWorkspace } from "@/components/revenue-ops-workspace";

export const Route = createFileRoute("/revenue-ops")({
  head: () => ({ meta: [{ title: "Revenue Operations Command Center · BLX Realty CRM" }] }),
  component: RevenueOpsPage,
});

function RevenueOpsPage() {
  return <RevenueOpsWorkspace />;
}
