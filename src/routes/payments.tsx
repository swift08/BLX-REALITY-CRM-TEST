import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/payments")({
  component: () => <Navigate to="/revenue-ops" replace />,
});


