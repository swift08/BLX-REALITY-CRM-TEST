import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/bookings")({
  component: () => <Navigate to="/revenue-ops" replace />,
});


