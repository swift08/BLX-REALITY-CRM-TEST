import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/finance-dashboard")({
  component: () => <Navigate to="/revenue-ops" replace />,
});


