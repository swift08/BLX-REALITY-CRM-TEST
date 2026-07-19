import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { isLeadVisible, isInvoiceEligibleStage } from "@/lib/permissions";
import type { AppRole } from "@/hooks/use-auth";

// ----------------------------------------------------
// TypeScript Type Definitions
// ----------------------------------------------------
export type Stage =
  | "new"
  | "assigned"
  | "contact_attempted"
  | "connected"
  | "interested"
  | "meeting_scheduled"
  | "meeting_completed"
  | "site_visit_scheduled"
  | "site_visit_completed"
  | "negotiation"
  | "booking_initiated"
  | "payment_pending"
  | "payment_completed"
  | "converted"
  | "closed"
  | "lost";

export type Temp = "hot" | "warm" | "cold";

export type BusinessEventType =
  | "CUSTOMER_CREATED"
  | "CUSTOMER_UPDATED"
  | "OPPORTUNITY_CREATED"
  | "OPPORTUNITY_STAGE_CHANGED"
  | "OPPORTUNITY_ASSIGNED"
  | "CALL_LOGGED"
  | "WHATSAPP_LOGGED"
  | "EMAIL_LOGGED"
  | "SMS_LOGGED"
  | "FOLLOWUP_CREATED"
  | "FOLLOWUP_COMPLETED"
  | "MEETING_CREATED"
  | "MEETING_COMPLETED"
  | "VISIT_COMPLETED"
  | "NEGOTIATION_STARTED"
  | "BOOKING_CREATED"
  | "BOOKING_VOIDED"
  | "PAYMENT_RECEIVED"
  | "INVOICE_GENERATED"
  | "DOCUMENT_UPLOADED"
  | "PROJECT_UPDATED"
  | "UNIT_RESERVED"
  | "UNIT_RELEASED"
  | "UNIT_SOLD"
  | "STAGE_CHANGED"
  | "LEAD_CREATED"
  | "LEAD_ASSIGNED"
  | "CALL_LOGGED"
  | "MEETING_LOGGED"
  | "VISIT_LOGGED"
  | "NOTE_ADDED"
  | "NOTE_EDITED"
  | "NOTE_DELETED"
  | "BOOKING_CANCELLED"
  | "PAYMENT_COMPLETED";

export interface NoteHistoryItem {
  content: string;
  edited_at: string;
  edited_by: string;
}

export interface Note {
  id: string;
  content: string;
  author: string;
  created_at: string;
  pinned?: boolean;
  history?: NoteHistoryItem[];
}

export interface Payment {
  id: string;
  amount: number;
  date: string;
  reference: string;
}

export interface Invoice {
  id: string;
  amount: number;
  status: "unpaid" | "paid" | "void";
  dueDate: string;
  payments?: Payment[];
}

export interface Booking {
  id: string;
  unit_id: string;
  opportunity_id: string;
  amount: number;
  payment_status:
    | "pending"
    | "completed"
    | "void"
    | "booking_initiated"
    | "initiated"
    | "payment_completed"
    | "payment_pending"
    | "closed";

  booking_date: string;
  status?: string;
  invoices?: Invoice[];
}

export interface Opportunity {
  id: string;
  customerId: string;
  projectId: string | null;
  budget: string | null;
  stage: Stage;
  temperature: Temp;
  owner: string;
  owner_id?: string;
  created_at: string;
  lost_reason?: string;
  booking?: Booking | null;
  bookings?: Booking[];
}

export interface Activity {
  id: string;
  type: "call" | "meeting" | "visit" | "whatsapp";
  summary: string;
  time: string;
  next_followup?: string | null;
}

export interface CommunicationLog {
  id: string;
  customerId: string;
  type: "call" | "whatsapp" | "email" | "sms";
  summary: string;
  details?: string;
  direction: "inbound" | "outbound";
  time: string;
  attachments?: { name: string; url: string; size: number }[];
}

export interface InteractionLog {
  id: string;
  customer_id: string;
  type: string;
  direction: "inbound" | "outbound";
  summary: string;
  details?: string;
  time: string;
  next_followup?: string | null;
  created_by?: string;
}

export interface Document {
  id: string;
  customerId: string;
  name: string;
  url: string;
  size: number;
  uploaded_by: string;
  created_at: string;
  category?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  source: string;
  created_at: string;
  created_by?: string;
  is_deleted?: boolean;
  city?: string | null;

  opportunities: Opportunity[];
  activities: Activity[];
  communications: CommunicationLog[];
  interactions: InteractionLog[];
  documents: Document[];
  notes: Note[];
  timeline: { title: string; time: string; description?: string }[];

  health_score?: number;
  priority_score?: number;

  // Active Opportunity Flattened Mappings (For Backwards Compatibility)
  activeOpportunityId?: string;
  stage: Stage;
  temperature: Temp;
  owner: string;
  owner_id?: string;
  budget?: string | null;
  project_id: string | null;
  projects?: { name: string } | null;
  booking?: Booking | null;
  bookings?: Booking[];
  lost_reason?: string;
}

export interface NotificationRow {
  id: string;
  title: string;
  message: string;
  lead_id?: string | null;
  priority: "critical" | "high" | "medium" | "low";
  created_at: string;
  read: boolean;
  role: "super_admin" | "admin" | "sales_executive" | "all";
  assigned_to?: string | null;
}

export interface ProjectRow {
  id: string;
  name: string;
  developer_id: string | null;
  location: string | null;
  total_units: number | null;
  available_units: number | null;
  price_range: string | null;
  created_at: string;
  developers?: { name: string } | null;
  brochures?: string[];
  floor_plans?: string[];
  documents?: string[];
  gallery_images?: string[];
}

export interface DeveloperRow {
  id: string;
  name: string;
  contact: string;
  location: string;
  created_at: string;
  brochures?: string[];
  agreements?: string[];
  pricelists?: string[];
  documents?: string[];
}

export interface UnitRow {
  id: string;
  project_id: string;
  unit_number: string;
  configuration: string;
  area: number;
  price: number;
  status: "available" | "pending_reserve" | "reserved" | "sold";
  reserved_by?: string | null;
}

export interface FollowupRow {
  id: string;
  lead_id: string;
  customer_name: string;
  title: string;
  time: string;
  priority: "high" | "medium" | "low";
  status: "pending" | "completed" | "overdue";
  assigned_sales: string;
}

export interface AuditLogRow {
  id: string;
  user: string;
  action: string;
  timestamp: string;
  old_value: string;
  new_value: string;
  ip?: string;
}

export interface CalendarEvent {
  id: string;
  type: "holiday" | "leave" | "meeting" | "visit" | "availability";
  title: string;
  start: string;
  end: string;
  customerId?: string;
  opportunityId?: string;
  salesPerson?: string;
  details?: string;
  status?: string;
}

export interface WorkflowRule {
  id: string;
  name: string;
  event: BusinessEventType;
  conditions: {
    field: string;
    operator: "equals" | "greater_than" | "less_than" | "contains";
    value: string;
  }[];
  actions: {
    type: "assign" | "notify" | "create_followup" | "send_whatsapp";
    target: string;
    template?: string;
  }[];
  isActive: boolean;
}

export interface SettingsRow {
  company_name: string;
  working_hours: string;
  reminder_time: number;
  lead_sources: string[];
  response_sla_mins: number;
  escalation_sla_hours: number;
}

export interface CRMUser {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  isDisabled?: boolean;
  assignment_status?: "available" | "paused" | "inactive";
  assigned_projects?: string[];
}

// ----------------------------------------------------
// Secure API Request Helper
// ----------------------------------------------------
async function callApi(action: string, payload: any = {}): Promise<any> {
  const activeRole =
    typeof window !== "undefined"
      ? localStorage.getItem("blx-realty-active-role") || "super_admin"
      : "super_admin";

  let sessionName = "";
  let token = "";
  let refreshToken = "";
  if (typeof window !== "undefined") {
    const rawSession = localStorage.getItem("blx-realty-session");
    if (rawSession) {
      try {
        const session = JSON.parse(rawSession);
        token = session.access_token || "";
        refreshToken = session.refresh_token || "";
        const u = session.user;
        if (u) {
          sessionName = u.user_metadata?.full_name || u.email?.split("@")[0] || "";
        }
      } catch (e) {
        // Ignore session parse errors
      }
    }
  }

  let res = await fetch("/api/crm", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      action,
      payload: { ...payload, actorRole: activeRole, actorName: sessionName },
    }),
  });

  // Handle Token Expiration
  if (res.status === 401 && action !== "refreshSession") {
    if (refreshToken && typeof window !== "undefined") {
      try {
        const refreshRes = await fetch("/api/crm", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "refreshSession",
            payload: { refreshToken },
          }),
        });

        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          if (refreshData.session) {
            localStorage.setItem("blx-realty-session", JSON.stringify(refreshData.session));
            const newToken = refreshData.session.access_token;

            // Retry the original request
            res = await fetch("/api/crm", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${newToken}`,
              },
              body: JSON.stringify({
                action,
                payload: { ...payload, actorRole: activeRole, actorName: sessionName },
              }),
            });
          }
        }
      } catch (err) {
        console.error("Token refresh failed:", err);
      }
    }

    // If still 401, redirect to login
    if (res.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("blx-realty-session");
      localStorage.removeItem("blx-realty-active-role");
      window.location.href = "/auth";
      throw new Error("Authentication expired. Please sign in again.");
    }
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "API request failed");
  }
  return res.json();
}

// ----------------------------------------------------
// React Query Integration Hooks
// ----------------------------------------------------

export function useLeads() {
  const activeRole =
    typeof window !== "undefined"
      ? localStorage.getItem("blx-realty-active-role") || "super_admin"
      : "super_admin";
  return useQuery({
    queryKey: ["leads"],
    queryFn: async (): Promise<Customer[]> => {
      const mapped = (await callApi("getLeads")) as Customer[];

      let currentUserId = "u-1";
      const sessionStr =
        typeof window !== "undefined" ? localStorage.getItem("blx-realty-session") : null;
      if (sessionStr) {
        try {
          const parsed = JSON.parse(sessionStr);
          if (parsed.user?.id) currentUserId = parsed.user.id;
        } catch (e) {
          // Ignore JSON parse errors for invalid sessions
        }
      }

      let crmUsers: CRMUser[] = [];
      try {
        crmUsers = (await callApi("getCRMUsers")) as CRMUser[];
      } catch (e) {
        console.error("Error fetching CRM users in useLeads:", e);
      }

      const filtered = mapped.filter((c) => !c.is_deleted);

      const resolved = filtered.map((c) => {
        const opps = c.opportunities || [];
        const activeOpp = opps.find((o: any) => o.id === c.activeOpportunityId) || opps[0];

        const health = 50;
        const priority = 30;

        const ownerName = activeOpp ? activeOpp.owner : "Unassigned";
        let ownerId = "unassigned";

        const matched = crmUsers.find(
          (u) =>
            u.name.toLowerCase() === ownerName.toLowerCase() ||
            ownerName.toLowerCase().includes(u.name.toLowerCase()) ||
            u.name.toLowerCase().includes(ownerName.toLowerCase()),
        );
        if (matched) {
          ownerId = matched.id;
        } else {
          if (ownerName.toLowerCase().includes("arjun")) ownerId = "u-3";
          else if (ownerName.toLowerCase().includes("priya")) ownerId = "u-4";
          else if (ownerName.toLowerCase().includes("admin")) ownerId = "u-2";
          else if (ownerName.toLowerCase().includes("harshith")) ownerId = "u-1";
        }

        return {
          ...c,
          health_score: health,
          priority_score: priority,
          stage: activeOpp ? activeOpp.stage : "new",
          temperature: activeOpp ? activeOpp.temperature : "warm",
          owner: ownerName,
          owner_id: ownerId,
          budget: activeOpp ? activeOpp.budget : null,
          project_id: activeOpp ? activeOpp.projectId : null,
          projects: null,
          booking: activeOpp ? activeOpp.booking : null,
          bookings: activeOpp ? activeOpp.bookings || [] : [],
          lost_reason: activeOpp ? activeOpp.lost_reason : undefined,
        };
      });

      const userFullName = getCurrentUserFullName();
      return resolved.filter((c) => {
        const isVisible = isLeadVisible(
          activeRole as AppRole,
          currentUserId,
          c.owner_id || "unassigned",
        );
        const isNameMatch =
          activeRole === "sales_executive" &&
          c.owner &&
          userFullName &&
          c.owner.toLowerCase() === userFullName.toLowerCase();
        return isVisible || isNameMatch;
      });
    },
  });
}

export const useCustomers = useLeads;

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      return callApi("getProjects") as Promise<ProjectRow[]>;
    },
  });
}

export function useDevelopers() {
  return useQuery({
    queryKey: ["developers"],
    queryFn: async () => {
      return callApi("getDevelopers") as Promise<DeveloperRow[]>;
    },
  });
}

export function useInventory(projectId?: string) {
  return useQuery({
    queryKey: ["inventory", projectId],
    queryFn: async () => {
      const units = (await callApi("getInventory")) as UnitRow[];
      if (projectId) return units.filter((u) => u.project_id === projectId);
      return units;
    },
  });
}

export interface InvoiceRecord {
  id: string;
  booking_id: string;
  invoice_number?: string;
  status: "draft" | "pending_approval" | "issued" | "partially_paid" | "paid" | "cancelled";
  amount: number;
  amount_paid: number;
  outstanding_amount: number;
  due_date?: string;
  issued_at?: string;
  issued_by?: string;
  snapshot?: any;
  payments?: PaymentRecord[];
}

export interface PaymentRecord {
  id: string;
  invoice_id: string;
  booking_id?: string;
  amount: number;
  payment_method: string;
  reference: string;
  receipt_number?: string;
  date: string;
  created_by?: string;
  notes?: string;
}

export interface RichBooking {
  id: string;
  lead_id: string;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  customer_stage?: string;
  owner_id?: string;
  project_name: string;
  unit_number: string;
  amount: number;
  booking_date?: string;
  is_locked?: boolean;
  primary_invoice_id?: string;
  invoice?: InvoiceRecord;
  booking: Booking;
}

export function useBookings() {
  return useQuery({
    queryKey: ["bookings"],
    queryFn: async (): Promise<RichBooking[]> => {
      const rawBookings = (await callApi("getBookings")) as any[];
      const customers = (await callApi("getLeads")) as Customer[];
      const projects = (await callApi("getProjects")) as ProjectRow[];
      const inventory = (await callApi("getInventory")) as UnitRow[];

      return rawBookings.map((bk) => {
        let customerName = "Unknown Customer";
        let leadId = "";
        let projectName = "Unknown Project";
        let unitNumber = "Unknown Unit";

        let foundCust: Customer | undefined;
        let foundOpp: Opportunity | undefined;
        for (const cust of customers) {
          const opp = (cust.opportunities || []).find((o) => o.id === bk.opportunity_id);
          if (opp) {
            foundCust = cust;
            foundOpp = opp;
            break;
          }
        }

        if (foundCust) {
          customerName = foundCust.name;
          leadId = foundCust.id;
        }

        if (foundOpp) {
          const proj = projects.find((p) => p.id === foundOpp?.projectId);
          if (proj) projectName = proj.name;
        }

        const unit = inventory.find((u) => u.id === bk.unit_id);
        if (unit) unitNumber = unit.unit_number;

        const invoicesList: any[] = bk.invoices || [];
        const primaryInv =
          invoicesList.find((i: any) => i.status !== "cancelled") || invoicesList[0] || null;

        const isLocked = Boolean(
          bk.is_locked ||
          (primaryInv &&
            (primaryInv.status === "issued" ||
              primaryInv.status === "paid" ||
              primaryInv.status === "partially_paid")),
        );

        return {
          id: bk.id,
          lead_id: leadId,
          customer_name: customerName,
          customer_phone: foundCust?.phone || "",
          customer_email: foundCust?.email || "",
          customer_stage: foundOpp?.stage || "booking_initiated",
          owner_id: foundOpp?.owner || "Unassigned",
          project_name: projectName,
          unit_number: unitNumber,
          amount: bk.amount || 0,
          booking_date: bk.booking_date,
          is_locked: isLocked,
          primary_invoice_id: bk.primary_invoice_id || primaryInv?.id,
          invoice: primaryInv
            ? {
                id: primaryInv.id,
                booking_id: primaryInv.booking_id || bk.id,
                invoice_number:
                  primaryInv.invoice_number ||
                  `INV-2026-${primaryInv.id.slice(-4).toUpperCase()}/BLX`,
                status: primaryInv.status || "issued",
                amount: Number(primaryInv.amount || bk.amount || 0),
                amount_paid: Number(
                  primaryInv.amount_paid || (primaryInv.status === "paid" ? bk.amount : 0),
                ),
                outstanding_amount: Number(
                  primaryInv.outstanding_amount || (primaryInv.status === "paid" ? 0 : bk.amount),
                ),
                due_date: primaryInv.due_date,
                issued_at: primaryInv.issued_at,
                issued_by: primaryInv.issued_by,
                snapshot: primaryInv.snapshot,
                payments: primaryInv.payments || [],
              }
            : undefined,
          booking: {
            ...bk,
            status: bk.payment_status,
          },
        };
      });
    },
  });
}

/**
 * Mutation hook to issue an official tax invoice bound to a specific booking.
 */
export function useCreateBookingInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { bookingId: string; dueDate?: string; snapshot?: any }) => {
      return callApi("createBookingInvoice", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}

/**
 * Mutation hook to record a received payment against an issued tax invoice.
 */
export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      invoiceId: string;
      amount: number;
      paymentMethod?: string;
      reference?: string;
      notes?: string;
    }) => {
      return callApi("recordInvoicePayment", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}

/**
 * Mutation hook to cancel an issued invoice.
 */
export function useCancelInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { invoiceId: string; reason?: string }) => {
      return callApi("cancelInvoice", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}

/**
 * Custom hook returning ONLY invoice-eligible bookings scoped to the current user's role and assigned leads.
 * Enforces ownership access rules and sales funnel stage criteria.
 */
export function useEligibleInvoiceBookings(role: AppRole | null, userId: string | null) {
  const { data: bookings = [], isLoading } = useBookings();
  const eligibleBookings = useMemo(() => {
    if (!role || !userId) return [];
    return bookings.filter((b) => {
      // 1. Role-scoped ownership check
      const isVisible = isLeadVisible(role, userId, b.owner_id || null);
      // 2. Funnel stage eligibility check
      const isEligible =
        isInvoiceEligibleStage(b.customer_stage) ||
        b.booking?.payment_status === "completed" ||
        b.booking?.payment_status === "pending";
      return isVisible && isEligible;
    });
  }, [bookings, role, userId]);

  return { data: eligibleBookings, isLoading };
}

function getCurrentUserFullName() {
  if (typeof window === "undefined") return "Arjun";
  const sessionStr = localStorage.getItem("blx-realty-session");
  if (!sessionStr) return "Arjun";
  try {
    const parsed = JSON.parse(sessionStr);
    return parsed?.user?.user_metadata?.full_name || parsed?.user?.email?.split("@")[0] || "Arjun";
  } catch (e) {
    return "Arjun";
  }
}

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    refetchInterval: 10000,
    queryFn: async (): Promise<NotificationRow[]> => {
      const list = (await callApi("getNotifications")) as NotificationRow[];
      const activeRole =
        typeof window !== "undefined"
          ? localStorage.getItem("blx-realty-active-role") || "super_admin"
          : "super_admin";
      const userFullName = getCurrentUserFullName();

      return list.filter((n) => {
        if (n.assigned_to && n.assigned_to === userFullName) return true;
        if (n.role === "all") return true;
        if (n.role === activeRole) {
          if (activeRole === "sales_executive" && n.assigned_to && n.assigned_to !== userFullName) {
            return false;
          }
          return true;
        }
        if (activeRole === "super_admin" && n.role === "admin") return true;
        return false;
      });
    },
  });
}

export function useFollowups() {
  return useQuery({
    queryKey: ["followups"],
    refetchInterval: 10000,
    queryFn: async (): Promise<FollowupRow[]> => {
      const list = (await callApi("getFollowups")) as any[];
      const customers = (await callApi("getLeads")) as Customer[];

      return list.map((f) => {
        const c = customers.find((cust) => cust.id === f.lead_id);
        return {
          ...f,
          customer_name: c ? c.name : "Unknown",
        };
      }) as FollowupRow[];
    },
  });
}

export function useAuditLogs() {
  return useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      return callApi("getAuditLogs") as Promise<AuditLogRow[]>;
    },
  });
}

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      return callApi("getSettings") as Promise<SettingsRow>;
    },
  });
}

export function useWorkflowRules() {
  return useQuery({
    queryKey: ["workflows"],
    queryFn: async () => {
      return callApi("getWorkflowRules") as Promise<WorkflowRule[]>;
    },
  });
}

export function useCalendarEvents() {
  return useQuery({
    queryKey: ["calendar-events"],
    queryFn: async () => {
      return callApi("getCalendarEvents") as Promise<CalendarEvent[]>;
    },
  });
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const customers = (await callApi("getLeads")) as Customer[];
      const projects = (await callApi("getProjects")) as ProjectRow[];
      const activeRole =
        typeof window !== "undefined"
          ? localStorage.getItem("blx-realty-active-role") || "super_admin"
          : "super_admin";

      const filtered = customers.filter((c) => !c.is_deleted);
      const userFullName = getCurrentUserFullName();
      const targetList =
        activeRole === "sales_executive"
          ? filtered.filter((c) => c.opportunities.some((o: any) => o.owner === userFullName))
          : filtered;

      const hotCount = targetList.filter((c) =>
        c.opportunities.some((o: any) => o.temperature === "hot"),
      ).length;

      let revenue = 0;
      targetList.forEach((c) => {
        c.opportunities.forEach((o: any) => {
          if (o.booking && o.booking.payment_status === "completed") {
            revenue += o.booking.amount;
          }
        });
      });

      const visits = targetList.filter((c) =>
        c.opportunities.some(
          (o: any) =>
            o.stage === "site_visit_completed" ||
            o.stage === "site_visit_scheduled" ||
            c.timeline?.some((t: any) => t.title.toLowerCase().includes("visit")),
        ),
      ).length;

      const conversions = targetList.filter((c) =>
        c.opportunities.some((o: any) => o.stage === "converted"),
      ).length;

      return {
        leads: targetList.length,
        hot: hotCount,
        projects: projects.length,
        revenue,
        visits,
        conversions,
        conversionRate: targetList.length
          ? ((conversions / targetList.length) * 100).toFixed(1) + "%"
          : "0.0%",
      };
    },
  });
}

export function useCRMUsers() {
  return useQuery({
    queryKey: ["crm-users"],
    queryFn: async () => {
      return callApi("getCRMUsers") as Promise<CRMUser[]>;
    },
  });
}

/**
 * For manager-role users: fetches the IDs of all CRM users whose
 * manager_id metadata matches the given managerId.
 *
 * Pass the result as `teamMemberIds` to isLeadVisible() to replace the
 * old hardcoded TEAM_MEMBERS map.
 *
 * Always includes the manager's own ID in the result (managers can see their own leads).
 */
export function useTeamMemberIds(managerId: string | null) {
  return useQuery({
    queryKey: ["team-member-ids", managerId],
    enabled: !!managerId,
    staleTime: 5 * 60 * 1000, // 5 min — team composition doesn't change often
    queryFn: async () => {
      if (!managerId) return [managerId];
      const users = (await callApi("getCRMUsers")) as CRMUser[];
      // Filter sales executives whose manager_id matches this manager
      const teamIds = users
        .filter((u) => (u as any).manager_id === managerId || u.role === "sales_executive")
        .map((u) => u.id);
      // Always include the manager themselves
      const all = new Set([managerId, ...teamIds]);
      return Array.from(all);
    },
  });
}

export function useArchivedLeads() {
  return useQuery({
    queryKey: ["archived-leads"],
    queryFn: async () => {
      const all = (await callApi("getLeads")) as Customer[];
      return all.filter((c) => c.is_deleted) as Customer[];
    },
  });
}

// ----------------------------------------------------
// Database Mutation Functions
// ----------------------------------------------------

export async function addMockLead(lead: any, bypassDuplicateCheck = false) {
  return callApi("addLead", { lead });
}

export async function updateLead(id: string, updates: any, stageChangeReason?: string) {
  return callApi("updateLead", { id, updates, stageChangeReason });
}

export async function softDeleteLead(id: string) {
  return callApi("softDeleteLead", { id });
}

export async function restoreLead(id: string) {
  return callApi("restoreLead", { id });
}

export async function permanentlyDeleteLead(id: string) {
  return callApi("permanentlyDeleteLead", { id });
}

export async function mergeLeads(targetId: string, sourceId: string) {
  return callApi("mergeLeads", { targetId, sourceId });
}

export async function bulkAssignLeads(leadIds: string[], newOwner: string) {
  return callApi("bulkAssignLeads", { leadIds, newOwner });
}

export async function addLeadNote(leadId: string, content: string, author: string) {
  return callApi("addLeadNote", { leadId, content, author });
}

export async function editLeadNote(
  leadId: string,
  noteId: string,
  content: string,
  author: string,
) {
  return callApi("editLeadNote", { leadId, noteId, content, author });
}

export async function deleteLeadNote(leadId: string, noteId: string, author: string, role: string) {
  return callApi("deleteLeadNote", { leadId, noteId, author });
}

export async function togglePinNote(leadId: string, noteId: string) {
  return callApi("togglePinNote", { noteId, pinned: true });
}

export async function addLeadActivity(
  leadId: string,
  type: any,
  summary: string,
  followupTitle: string | null,
  nextFollowup: string | null,
  followupPriority: string | null,
  outcome: string | undefined,
) {
  return callApi("addLeadActivity", {
    leadId,
    activity: {
      type,
      summary,
      followup_title: followupTitle,
      next_followup: nextFollowup,
      followup_priority: followupPriority,
      outcome,
    },
  });
}

export async function addLeadCommunicationLog(
  leadId: string,
  type: any,
  direction: any,
  summary: string,
  details?: string,
) {
  return callApi("addLeadCommunicationLog", { leadId, log: { type, direction, summary, details } });
}

export async function completeFollowup(followupId: string) {
  return callApi("completeFollowup", { followupId });
}

export async function addDeveloper(dev: any) {
  return callApi("addDeveloper", { dev });
}

export async function updateDeveloper(id: string, updates: any) {
  return callApi("updateDeveloper", { id, updates });
}

export async function addProject(proj: any) {
  return callApi("addProject", { proj });
}

export async function updateProject(id: string, updates: any) {
  return callApi("updateProject", { id, updates });
}

export async function addUnit(unit: any) {
  return callApi("addUnit", { unit });
}

export async function updateUnit(id: string, updates: any) {
  return callApi("updateUnit", { id, updates });
}

export async function reserveUnit(unitId: string, leadId: string) {
  return callApi("reserveUnit", { unitId, leadId });
}

export async function cancelBooking(leadId: string, bookingId?: string) {
  return callApi("cancelBooking", { leadId, bookingId });
}

export async function confirmBookingPayment(leadId: string, bookingId?: string) {
  return callApi("confirmBookingPayment", { leadId, bookingId });
}

export async function updateBookingStatus(leadId: string, status: any) {
  return callApi("updateBookingStatus", { leadId, status });
}

export async function addCustomerDocument(
  leadId: string,
  name: string,
  url: string,
  size: number,
  category?: string,
) {
  return callApi("addCustomerDocument", { leadId, doc: { name, url, size, category } });
}

export async function addCustomerOpportunity(
  customerId: string,
  projectId: string | null,
  budget: string | null,
  temperature: Temp,
  owner: string,
) {
  return callApi("addCustomerOpportunity", { customerId, projectId, budget, temperature, owner });
}

export async function deleteOpportunity(oppId: string) {
  return callApi("deleteOpportunity", { id: oppId });
}

export async function addCalendarEvent(event: any) {
  return callApi("addCalendarEvent", { event });
}

export async function uploadProjectFile(
  fileData: string,
  fileName: string,
  mimeType: string,
  projectId: string,
): Promise<{ url: string; path: string }> {
  return callApi("uploadProjectFile", { fileData, fileName, mimeType, projectId });
}

export async function updateCalendarEvent(id: string, event: any) {
  return callApi("updateCalendarEvent", { id, event });
}

export async function deleteCalendarEvent(id: string) {
  return callApi("deleteCalendarEvent", { id });
}

export async function addWorkflowRule(rule: any) {
  return callApi("addWorkflowRule", { rule });
}

export async function toggleWorkflowRule(id: string) {
  return callApi("toggleWorkflowRule", { id, isActive: true });
}

export async function saveCompanySettings(updates: any) {
  return callApi("saveCompanySettings", { updates });
}

export async function addCRMUser(user: any) {
  return callApi("addCRMUser", { user });
}

export async function updateCRMUserRole(id: string, role: string) {
  return callApi("updateCRMUserRole", { id, role });
}

export async function resetCRMUserPassword(id: string, password: string) {
  return callApi("resetCRMUserPassword", { id, password });
}

export async function deleteCRMUser(id: string) {
  return callApi("deleteCRMUser", { id });
}

export async function toggleCRMUserStatus(id: string, isDisabled: boolean) {
  return callApi("toggleCRMUserStatus", { id, isDisabled });
}

export async function markNotificationRead(id: string) {
  return callApi("markNotificationRead", { id });
}

export async function markAllNotificationsRead() {
  return callApi("markAllNotificationsRead");
}

export async function deleteNotification(id: string) {
  return callApi("deleteNotification", { id });
}

export async function addAuditLog(action: string, oldVal: string, newVal: string) {
  return callApi("addAuditLog", { action, oldVal, newVal });
}

export async function serverSignIn(payload: any) {
  return callApi("signIn", payload);
}

export async function fixManagerRole(userId: string) {
  return callApi("fixManagerRole", { userId });
}

export async function changePassword(currentPassword: string, newPassword: string) {
  return callApi("changePassword", { currentPassword, newPassword });
}

export async function updateUserProfile(name: string, phone: string) {
  return callApi("updateUserProfile", { name, phone });
}

export function useProjectConfigurations(projectId: string) {
  return useQuery({
    queryKey: ["project-configurations", projectId],
    queryFn: async (): Promise<any[]> => {
      if (!projectId) return [];
      return callApi("getProjectConfigurations", { projectId });
    },
    enabled: !!projectId,
  });
}

export async function addProjectConfiguration(projectId: string, name: string) {
  return callApi("addProjectConfiguration", { projectId, name });
}

export async function deleteProjectConfiguration(id: string, force?: boolean) {
  return callApi("deleteProjectConfiguration", { id, force });
}

export async function addLeadInteraction(
  leadId: string,
  interaction: {
    type: string;
    direction?: string;
    summary: string;
    details?: string;
    next_followup?: string | null;
    followup_title?: string | null;
    followup_priority?: string;
    outcome?: string;
  },
) {
  return callApi("addLeadInteraction", { leadId, interaction });
}

// ----------------------------------------------------
// INVOICE CMS TYPES & REACT QUERY HOOKS
// ----------------------------------------------------
export interface InvoiceCompanyInfo {
  company_name: string;
  logo_url: string;
  registered_address: string;
  branch_address: string;
  phone: string;
  email: string;
  website: string;
  gst_number: string;
  pan_number: string;
  cin: string;
  rera_number: string;
  address?: string;
  gstin?: string;
}

export interface InvoiceBankingDetails {
  bank_name: string;
  account_holder: string;
  account_number: string;
  ifsc_code: string;
  branch_name: string;
  upi_id: string;
  qr_code_url: string;
}

export interface InvoiceTaxStatutory {
  gst_enabled: boolean;
  cgst_rate: number;
  sgst_rate: number;
  igst_rate: number;
  tds_enabled: boolean;
  tds_rate: number;
  pf_enabled: boolean;
  pf_code: string;
  esi_enabled: boolean;
  esi_code: string;
  statutory_notes: string;
}

export interface InvoiceNotes {
  payment_instructions: string;
  terms_and_conditions: string;
  cancellation_policy: string;
  refund_policy: string;
  late_payment_policy: string;
  legal_disclaimer: string;
  thank_you_message: string;
  customer_support: string;
}

export interface InvoiceBranding {
  logo_url: string;
  header_style: "modern" | "classic" | "minimalist" | "luxury";
  footer_info: string;
  signature_title: string;
  signatory_name: string;
  signature_image_url: string;
  seal_image_url: string;
  primary_color: string;
  secondary_color: string;
  text_color: string;
  authorized_signatory?: string;
  company_seal_url?: string;
}

export interface InvoiceNumbering {
  prefix: string;
  suffix: string;
  start_sequence: number;
  padding: number;
  auto_increment: boolean;
}

export interface InvoicePaymentInfo {
  accepted_methods: string[];
  payment_due_instructions: string;
  offline_instructions: string;
  qr_instructions: string;
}

export interface InvoiceSettings {
  id: string;
  company_info: InvoiceCompanyInfo;
  banking_details: InvoiceBankingDetails;
  tax_statutory: InvoiceTaxStatutory;
  invoice_notes: InvoiceNotes;
  branding: InvoiceBranding;
  numbering: InvoiceNumbering;
  payment_info: InvoicePaymentInfo;
  default_template_id: string;
  updated_at?: string;
  updated_by?: string;
}

export interface InvoiceRolePermission {
  role: AppRole;
  can_view_cms: boolean;
  can_edit_company_info: boolean;
  can_update_banking: boolean;
  can_modify_tax: boolean;
  can_edit_terms: boolean;
  can_change_branding: boolean;
  can_manage_templates: boolean;
  can_generate_invoices: boolean;
  can_regenerate_invoices: boolean;
  updated_at?: string;
  updated_by?: string;
}

export function useInvoiceSettings() {
  return useQuery({
    queryKey: ["invoice-settings"],
    queryFn: async (): Promise<InvoiceSettings> => {
      return callApi("getInvoiceSettings");
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useUpdateInvoiceSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      settings,
      sectionName,
    }: {
      settings: InvoiceSettings;
      sectionName?: string;
    }) => {
      return callApi("updateInvoiceSettings", { settings, sectionName });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice-settings"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
  });
}

export function useInvoicePermissions() {
  return useQuery({
    queryKey: ["invoice-permissions"],
    queryFn: async (): Promise<InvoiceRolePermission[]> => {
      return callApi("getInvoicePermissions");
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useUpdateInvoicePermissions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (matrix: InvoiceRolePermission[]) => {
      return callApi("updateInvoicePermissions", { matrix });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice-permissions"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
  });
}

export function usePostSalesOperations() {
  return useQuery({
    queryKey: ["post-sales-ops"],
    queryFn: async () => {
      return callApi("getPostSalesOperations");
    },
    staleTime: 1000 * 30,
  });
}

export function useUpdateRegistration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      return callApi("updateRegistration", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["post-sales-ops"] });
      qc.invalidateQueries({ queryKey: ["bookings"] });
    },
  });
}

export function useUpdatePossession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      return callApi("updatePossession", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["post-sales-ops"] });
      qc.invalidateQueries({ queryKey: ["bookings"] });
    },
  });
}

export function useSavePaymentSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { bookingId: string; milestones: any[] }) => {
      return callApi("savePaymentSchedule", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["post-sales-ops"] });
      qc.invalidateQueries({ queryKey: ["bookings"] });
    },
  });
}

export function useProcessRefund() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      return callApi("processRefund", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["post-sales-ops"] });
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}

export interface UserInvoicePermission {
  user_id: string;
  user_name: string;
  role: AppRole;
  can_view_cms: boolean;
  can_edit_company_info: boolean;
  can_update_banking: boolean;
  can_modify_tax: boolean;
  can_edit_terms: boolean;
  can_change_branding: boolean;
  can_manage_templates: boolean;
  can_generate_invoices: boolean;
  can_regenerate_invoices: boolean;
}

export function useUserInvoicePermissions() {
  return useQuery({
    queryKey: ["user-invoice-permissions"],
    queryFn: async (): Promise<UserInvoicePermission[]> => {
      return callApi("getUserInvoicePermissions");
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useUpdateUserInvoicePermissions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userPermissions: UserInvoicePermission[]) => {
      return callApi("updateUserInvoicePermissions", { userPermissions });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-invoice-permissions"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
  });
}

// ----------------------------------------------------
// Lead Assignment Engine Interfaces & React Query Hooks
// ----------------------------------------------------

export interface LeadAssignmentSettings {
  id: string;
  distribution_strategy:
    | "round_robin"
    | "project_based"
    | "source_based"
    | "manual"
    | "capacity_based";
  auto_assign_leads: boolean;
  skip_paused_users: boolean;
  skip_inactive_users: boolean;
  enable_project_routing: boolean;
  enable_source_routing: boolean;
  allow_manager_override: boolean;
  maintain_assignment_history: boolean;
  source_routes: Record<string, string>;
  sla_first_contact_mins: number;
  sla_manager_escalate_hours: number;
  sla_auto_reassign_hours: number;
  last_assigned_index_map: Record<string, number>;
  updated_at?: string;
  updated_by?: string;
}

export interface LeadAssignmentHistory {
  id: string;
  lead_id: string;
  previous_owner: string;
  assigned_owner: string;
  strategy_used: string;
  reason: string;
  assigned_by: string;
  created_at: string;
}

export function useLeadAssignmentSettings() {
  return useQuery({
    queryKey: ["lead-assignment-settings"],
    queryFn: async (): Promise<LeadAssignmentSettings> => {
      return callApi("getLeadAssignmentSettings");
    },
  });
}

export function useUpdateLeadAssignmentSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (updates: Partial<LeadAssignmentSettings>) => {
      return callApi("updateLeadAssignmentSettings", { updates });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-assignment-settings"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
  });
}

export function useLeadAssignmentHistory(leadId: string) {
  return useQuery({
    queryKey: ["lead-assignment-history", leadId],
    queryFn: async (): Promise<LeadAssignmentHistory[]> => {
      if (!leadId) return [];
      const res = await callApi("getLeadAssignmentHistory", { leadId });
      return Array.isArray(res) ? res : [];
    },
    enabled: !!leadId,
  });
}

export function useUpdateUserAssignmentStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      assignment_status,
      assigned_projects,
    }: {
      id: string;
      assignment_status?: "available" | "paused" | "inactive";
      assigned_projects?: string[];
    }) => {
      return callApi("updateUserAssignmentStatus", { id, assignment_status, assigned_projects });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-users"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
  });
}

export function useReassignLeadWithEngine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      leadId,
      newOwner,
      reason,
      strategy,
    }: {
      leadId: string;
      newOwner?: string;
      reason?: string;
      strategy?: string;
    }) => {
      return callApi("reassignLeadWithEngine", { leadId, newOwner, reason, strategy });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead-assignment-history", variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
  });
}

// ── Negotiation API Wrappers & Hooks ─────────────────────────
export async function getNegotiation(opportunityId: string) {
  return callApi("getNegotiation", { opportunityId });
}

export async function updateNegotiation(opportunityId: string, updates: any, newRound?: any) {
  return callApi("updateNegotiation", { opportunityId, updates, newRound });
}

export async function addNegotiationRound(opportunityId: string, round: any) {
  return callApi("addNegotiationRound", { opportunityId, round });
}

export async function respondManagerApproval(
  opportunityId: string,
  decision: string,
  suggestedAmount?: number,
  notes?: string,
) {
  return callApi("respondManagerApproval", { opportunityId, decision, suggestedAmount, notes });
}

export function useNegotiation(opportunityId?: string) {
  return useQuery({
    queryKey: ["negotiation", opportunityId],
    queryFn: async () => {
      if (!opportunityId) return null;
      return callApi("getNegotiation", { opportunityId }) as Promise<any>;
    },
    enabled: !!opportunityId,
  });
}

export function useUpdateNegotiation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      opportunityId,
      updates,
      newRound,
    }: {
      opportunityId: string;
      updates: any;
      newRound?: any;
    }) => {
      return updateNegotiation(opportunityId, updates, newRound);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["negotiation", variables.opportunityId] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
  });
}

export function useAddNegotiationRound() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ opportunityId, round }: { opportunityId: string; round: any }) => {
      return addNegotiationRound(opportunityId, round);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["negotiation", variables.opportunityId] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}

export function useRespondManagerApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      opportunityId,
      decision,
      suggestedAmount,
      notes,
    }: {
      opportunityId: string;
      decision: string;
      suggestedAmount?: number;
      notes?: string;
    }) => {
      return respondManagerApproval(opportunityId, decision, suggestedAmount, notes);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["negotiation", variables.opportunityId] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
  });
}
