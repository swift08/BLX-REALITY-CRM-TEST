import type { AppRole } from "@/hooks/use-auth";

/**
 * Central permission matrix for BLX Realty CRM.
 * All role-based access decisions should flow through this file.
 *
 * Usage:
 *   import { can } from "@/lib/permissions";
 *   if (can(role).deleteCustomer()) { ... }
 */

export type InvoicePermissionFlags = {
  can_view_cms: boolean;
  can_edit_company_info: boolean;
  can_update_banking: boolean;
  can_modify_tax: boolean;
  can_edit_terms: boolean;
  can_change_branding: boolean;
  can_manage_templates: boolean;
  can_generate_invoices: boolean;
  can_regenerate_invoices: boolean;
};

type RuntimeInvoicePermissionState = {
  roleMatrix: Record<string, InvoicePermissionFlags>;
  userOverrides: Record<string, InvoicePermissionFlags>;
  currentUserId: string | null;
};

let runtimeInvoicePermissions: RuntimeInvoicePermissionState | null = null;

/** Hydrate Invoice CMS permission matrix + per-user overrides used by `can()`. */
export function setRuntimeInvoicePermissions(input: {
  roleMatrix?: Array<{ role: string } & Partial<InvoicePermissionFlags>> | null;
  userOverrides?: Array<{ user_id: string } & Partial<InvoicePermissionFlags>> | null;
  currentUserId?: string | null;
}) {
  const roleMatrix: Record<string, InvoicePermissionFlags> = {};
  for (const row of input.roleMatrix || []) {
    if (!row?.role) continue;
    roleMatrix[row.role] = {
      can_view_cms: !!row.can_view_cms,
      can_edit_company_info: !!row.can_edit_company_info,
      can_update_banking: !!row.can_update_banking,
      can_modify_tax: !!row.can_modify_tax,
      can_edit_terms: !!row.can_edit_terms,
      can_change_branding: !!row.can_change_branding,
      can_manage_templates: !!row.can_manage_templates,
      can_generate_invoices: !!row.can_generate_invoices,
      can_regenerate_invoices: !!row.can_regenerate_invoices,
    };
  }

  const userOverrides: Record<string, InvoicePermissionFlags> = {};
  for (const row of input.userOverrides || []) {
    if (!row?.user_id) continue;
    userOverrides[row.user_id] = {
      can_view_cms: !!row.can_view_cms,
      can_edit_company_info: !!row.can_edit_company_info,
      can_update_banking: !!row.can_update_banking,
      can_modify_tax: !!row.can_modify_tax,
      can_edit_terms: !!row.can_edit_terms,
      can_change_branding: !!row.can_change_branding,
      can_manage_templates: !!row.can_manage_templates,
      can_generate_invoices: !!row.can_generate_invoices,
      can_regenerate_invoices: !!row.can_regenerate_invoices,
    };
  }

  runtimeInvoicePermissions = {
    roleMatrix,
    userOverrides,
    currentUserId: input.currentUserId ?? runtimeInvoicePermissions?.currentUserId ?? null,
  };
}

function resolveInvoiceFlag(
  role: AppRole | null,
  key: keyof InvoicePermissionFlags,
  hardcodedFallback: boolean,
): boolean {
  // Super Admin always retains full Invoice CMS control
  if (role === "super_admin") return true;

  const state = runtimeInvoicePermissions;
  if (!state) return hardcodedFallback;

  const userId = state.currentUserId;
  if (userId && state.userOverrides[userId] && key in state.userOverrides[userId]) {
    return !!state.userOverrides[userId][key];
  }

  if (role && state.roleMatrix[role] && key in state.roleMatrix[role]) {
    return !!state.roleMatrix[role][key];
  }

  return hardcodedFallback;
}

export function can(role: AppRole | null) {
  const isSuperAdmin = role === "super_admin";
  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const isSalesExec = role === "sales_executive";
  const isMarketing = role === "marketing";

  // Shorthand groups
  const isAdminOrAbove = isSuperAdmin || isAdmin;
  const isManagerOrAbove = isSuperAdmin || isAdmin || isManager;

  return {
    // ─── DASHBOARD ───────────────────────────────────────────────
    /** Super Admin & Admin see full company dashboard */
    viewCompanyDashboard: () => isAdminOrAbove,
    /** Manager sees team-scoped dashboard */
    viewTeamDashboard: () => isManager,
    /** Sales Exec sees own-only dashboard */
    viewPersonalDashboard: () => isSalesExec,
    /** Only admins see the audit activity widget on dashboard */
    viewDashboardAuditWidget: () => isAdminOrAbove,

    // ─── CUSTOMERS / LEADS ───────────────────────────────────────
    /** All roles can view their scoped leads (marketing cannot) */
    viewLeads: () => !isMarketing,
    /** Only SA and Admin see ALL leads (Sales Exec filtered to own, Manager to team) */
    viewAllLeads: () => isAdminOrAbove,
    /** Manager and above can view all team leads */
    viewTeamLeads: () => isManagerOrAbove,
    /** Create a new customer record (Manager/Admin/SA, or Sales Exec self-assigned) */
    createCustomer: () => !isMarketing,
    /** Edit any customer details */
    editCustomer: () => isManagerOrAbove || isSalesExec,
    /** Soft-delete (archive) a customer (Super Admin and Admin only) */
    deleteCustomer: () => isAdminOrAbove,
    archiveCustomer: () => isAdminOrAbove,
    /** Permanent hard-delete is NOT a UI action for ANY role */
    permanentlyDeleteCustomer: () => false,
    /** Restore from recycle bin (Super Admin and Admin only) */
    restoreCustomer: () => isAdminOrAbove,
    /** Assign a lead to a sales executive */
    assignLead: () => isManagerOrAbove,
    /** Reassign a lead (change current owner - Manager team-scoped, Admin company-wide) */
    reassignLead: () => isManagerOrAbove,
    /** Bulk assign multiple leads at once */
    bulkAssignLeads: () => isAdminOrAbove,
    /** Merge two duplicate customer records */
    mergeDuplicateCustomer: () => isAdminOrAbove,
    /** Export customer list (Manager: team, Admin/SA: company, Sales Exec: personal) */
    exportCustomers: () => !isMarketing,
    /** Unmask sensitive client contact info (phone/email/budget) - triggers audit log for Sales Exec */
    unmaskContactData: () => !isMarketing,

    // ─── FOLLOW-UPS ──────────────────────────────────────────────
    /** Admin/Manager see all team follow-ups; Sales Exec sees own */
    viewAllFollowups: () => isManagerOrAbove,
    /** Create follow-up (all roles can, except marketing) */
    createFollowup: () => !isMarketing,
    /** Complete a follow-up */
    completeFollowup: () => !isMarketing,
    /** Reassign a follow-up to another person */
    reassignFollowup: () => isManagerOrAbove,

    // ─── CALENDAR ────────────────────────────────────────────────
    /** Create any event type */
    createCalendarEvent: () => !isMarketing,
    /** Create/manage company holidays (admin-only) */
    manageCompanyHolidays: () => isAdminOrAbove,
    /** Edit or delete any event (not just own) */
    editAnyCalendarEvent: () => isManagerOrAbove,
    /** Delete any calendar event */
    deleteAnyCalendarEvent: () => isAdminOrAbove,

    // ─── SITE VISITS ─────────────────────────────────────────────
    /** View all site visits */
    viewAllSiteVisits: () => isManagerOrAbove,
    /** Approve a site visit */
    approveSiteVisit: () => isManagerOrAbove,
    /** Cancel a site visit */
    cancelSiteVisit: () => isManagerOrAbove,
    /** Reassign site visit to different executive */
    reassignSiteVisit: () => isManagerOrAbove,

    // ─── DEVELOPERS ──────────────────────────────────────────────
    /** View developer catalog (all roles) */
    viewDevelopers: () => true,
    /** Add a new developer */
    createDeveloper: () => isAdminOrAbove,
    /** Edit developer details */
    editDeveloper: () => isAdminOrAbove,
    /** Hard-delete developer record - NOT a UI action for ANY role */
    deleteDeveloper: () => false,
    /** Archive developer record */
    archiveDeveloper: () => isAdminOrAbove,
    /** Upload brochures / documents to developer */
    uploadDeveloperDocuments: () => isAdminOrAbove,

    // ─── PROJECTS ────────────────────────────────────────────────
    /** View projects (all roles) */
    viewProjects: () => true,
    /** Create a project */
    createProject: () => isAdminOrAbove,
    /** Edit project details */
    editProject: () => isAdminOrAbove,
    /** Hard-delete project - NOT a UI action for ANY role */
    deleteProject: () => isAdminOrAbove,
    /** Archive project record */
    archiveProject: () => isAdminOrAbove,
    /** Upload floor plans / docs to project (marketing can also upload) */
    uploadProjectDocuments: () => isAdminOrAbove || isMarketing,

    // ─── INVENTORY ───────────────────────────────────────────────
    /** View inventory (all roles) */
    viewInventory: () => true,
    /** Add a new unit (Admin/SA only) */
    createUnit: () => isAdminOrAbove,
    /** Edit unit details (config, area, pricing) (Admin/SA only) */
    editUnit: () => isAdminOrAbove,
    /** Hard-delete unit - NOT a UI action for ANY role */
    deleteUnit: () => false,
    /** Archive unit record */
    archiveUnit: () => isAdminOrAbove,
    /** Reserve / hold a unit for a customer (Manager and above can approve hold; Sales Exec can request) */
    reserveUnit: () => isManagerOrAbove,
    requestUnitHold: () => isSalesExec,
    /** Release a reserved unit back to available */
    releaseUnit: () => isManagerOrAbove,
    /** Mark a unit as sold */
    markUnitSold: () => isAdminOrAbove,
    /** Change unit price */
    changeUnitPrice: () => isAdminOrAbove,

    // ─── BOOKINGS ────────────────────────────────────────────────
    /** Initiate a booking request (all roles) */
    initiateBooking: () => !isMarketing,
    /** Approve/confirm a booking request (Manager level review) */
    approveBookingRequest: () => isManagerOrAbove,
    /** Final verify/confirm booking (Admin/Super Admin level) */
    finalApproveBooking: () => isAdminOrAbove,
    /** Override approval decisions on holds, discounts, bookings (Super Admin only) */
    overrideApproval: () => isSuperAdmin,
    /** Cancel an active booking */
    cancelBooking: () => isAdminOrAbove,
    /** Close/finalize a booking */
    closeBooking: () => isAdminOrAbove,
    /** Change booking status via dropdown */
    changeBookingStatus: () => isManagerOrAbove,
    /** View all bookings (Sales Exec sees own only) */
    viewAllBookings: () => isManagerOrAbove,

    // ─── RESERVATIONS & DISCOUNTS ───────────────────────────────
    /** Request reservation (Sales Exec) */
    requestReservation: () => isSalesExec,
    /** Approve/confirm reservation (Manager or above) */
    approveReservation: () => isManagerOrAbove,
    /** Request discount on bookings (Sales Exec) */
    requestDiscount: () => isSalesExec,
    /** Approve discount request (Manager for own team, Admin final sign-off, Super Admin override) */
    approveDiscount: () => isManagerOrAbove,

    // ─── ANALYTICS ───────────────────────────────────────────────
    /** View full company-wide analytics */
    viewCompanyAnalytics: () => isAdminOrAbove,
    /** View team analytics */
    viewTeamAnalytics: () => isManagerOrAbove,
    /** View personal analytics (all can, but Sales Exec sees only personal) */
    viewPersonalAnalytics: () => !isMarketing,

    // ─── REPORTS ─────────────────────────────────────────────────
    /** Export company-wide reports */
    exportCompanyReports: () => isAdminOrAbove,
    /** Export team reports */
    exportTeamReports: () => isManagerOrAbove,
    /** Export personal reports */
    exportPersonalReports: () => !isMarketing,

    // ─── AUDIT LOGS ──────────────────────────────────────────────
    /** View the audit log page (SA/Admin: all, Manager: team, Sales Exec: own action history) */
    viewAuditLogs: () => !isMarketing,
    /** Edit audit logs - IMMUTABLE AT DATA LAYER FOR ALL ROLES */
    editAuditLogs: () => false,
    /** Delete audit log entries - IMMUTABLE AT DATA LAYER FOR ALL ROLES */
    deleteAuditLogs: () => false,
    /** View team/operational logs (Managers see team, Admins see all) */
    viewTeamLogs: () => isManagerOrAbove,

    // ─── USER MANAGEMENT ─────────────────────────────────────────
    /** Create a Super Admin account (Super Admin only) */
    createSuperAdmin: () => isSuperAdmin,
    /** Create an Admin account (Super Admin only) */
    createAdmin: () => isSuperAdmin,
    /** Create a Manager account (Admin and Super Admin only) */
    createManager: () => isAdminOrAbove,
    /** Create a Sales Executive account (Manager scoped to own team, Admin/SA company-wide) */
    createSalesExecutive: () => isManagerOrAbove,
    /** Reset another user's password (Super Admin: anyone; Admin: Manager/Sales Exec; Manager: own team Sales Execs) */
    resetUserPassword: () => isManagerOrAbove,
    /** Request role promotion (Admin requesting promotion to Admin for user, needs SA approval) */
    requestRolePromotion: () => isAdmin,
    /** Change a user's role directly (Super Admin only) */
    changeUserRole: () => isSuperAdmin,
    /** Hard-delete any user account - Super Admin only */
    deleteUser: () => isSuperAdmin,
    /** Disable/deactivate a user account (SA: all, Admin: Manager & Sales Exec only) */
    deactivateUser: () => isAdminOrAbove,
    /** Enable/reactivate a user account */
    reactivateUser: () => isAdminOrAbove,
    /** Set/assign team KPIs or performance targets */
    setTeamTargets: () => isManagerOrAbove,

    // ─── SETTINGS ────────────────────────────────────────────────
    /** Access company configuration settings */
    accessCompanySettings: () => isAdminOrAbove,
    /** Manage workflow automation rules (Admin and Super Admin) */
    manageWorkflowRules: () => isAdminOrAbove,
    /** Configure SLA targets (Admin and Super Admin) */
    configureSLA: () => isAdminOrAbove,
    /** Manage the Team (add/edit/remove users) */
    accessTeamManagement: () => isManagerOrAbove,
    /** Access recycle bin (Super Admin and Admin only, Managers and Sales Execs blocked) */
    accessRecycleBin: () => isAdminOrAbove,
    /** Backup / restore the database (Super Admin / Infra owner only) */
    backupDatabase: () => isSuperAdmin,
    /** Change global system security configuration (Super Admin only) */
    changeSecurityConfig: () => isSuperAdmin,
    /** Role simulation mode (view-as-lower-role) (Super Admin only) */
    simulateRole: () => isSuperAdmin,

    // ─── INVOICE CMS & PERMISSIONS ───────────────────────────────
    /** Access / view the Invoice CMS module */
    viewInvoiceCMS: () =>
      resolveInvoiceFlag(role, "can_view_cms", isSuperAdmin || isAdmin || isManager),
    /** Edit business company details on invoices */
    editInvoiceCompanyInfo: () =>
      resolveInvoiceFlag(role, "can_edit_company_info", isSuperAdmin || isAdmin),
    /** Update bank accounts and payment details */
    updateInvoiceBankingDetails: () =>
      resolveInvoiceFlag(role, "can_update_banking", isSuperAdmin),
    /** Modify GST, TDS, PF, and statutory tax parameters */
    modifyInvoiceTaxInfo: () =>
      resolveInvoiceFlag(role, "can_modify_tax", isSuperAdmin || isAdmin),
    /** Edit payment notes, terms & conditions */
    editInvoiceTerms: () =>
      resolveInvoiceFlag(role, "can_edit_terms", isSuperAdmin || isAdmin),
    /** Change company logo, seal, branding colors & signatory */
    changeInvoiceBranding: () =>
      resolveInvoiceFlag(role, "can_change_branding", isSuperAdmin || isAdmin),
    /** Select default invoice template */
    manageInvoiceTemplates: () =>
      resolveInvoiceFlag(role, "can_manage_templates", isSuperAdmin || isAdmin),
    /** Generate new tax invoices */
    generateInvoices: () => resolveInvoiceFlag(role, "can_generate_invoices", !isMarketing),
    /** Regenerate existing invoices with updated CMS rules */
    regenerateInvoices: () =>
      resolveInvoiceFlag(
        role,
        "can_regenerate_invoices",
        isSuperAdmin || isAdmin || isManager,
      ),
    /** Approve invoices in Pending Approval state */
    approveInvoices: () => isSuperAdmin || isAdmin || isManager,
    /** Cancel issued invoices */
    cancelInvoices: () => isSuperAdmin || isAdmin,
    /** Record collections & payments against invoices */
    recordPayments: () => !isMarketing,
    /** Override / modify core contract details of locked bookings */
    modifyLockedBookings: () => isSuperAdmin,

    // ─── HELPERS & SCOPES ────────────────────────────────────────
    /** Returns the human-readable role label */
    roleLabel: (): string => {
      if (isSuperAdmin) return "Super Admin";
      if (isAdmin) return "Admin (Operations)";
      if (isManager) return "Manager";
      if (isSalesExec) return "Sales Executive";
      if (isMarketing) return "Marketing";
      return "Unknown";
    },
    /** Returns the role emoji */
    roleEmoji: (): string => {
      if (isSuperAdmin) return "👑";
      if (isAdmin) return "🛠️";
      if (isManager) return "👨‍💼";
      if (isSalesExec) return "💼";
      if (isMarketing) return "📢";
      return "❓";
    },
    /** Returns the scope label for dashboard context banners */
    dashboardScopeLabel: (): string => {
      if (isSuperAdmin || isAdmin) return "Company-Wide";
      if (isManager) return "Team Performance";
      if (isMarketing) return "Marketing";
      return "My Performance";
    },
    /** Returns the enterprise title for the dashboard */
    dashboardTitle: (): string => {
      if (isSuperAdmin) return "Company Dashboard";
      if (isAdmin) return "Operations Dashboard";
      if (isManager) return "Team Dashboard";
      if (isMarketing) return "Documents Portal";
      return "My Dashboard";
    },
  };
}

/**
 * Resolves list of user IDs belonging to a manager's team.
 *
 * IMPORTANT: This function no longer uses a hardcoded map.
 * Instead, pass a pre-fetched list of team member IDs from the server.
 *
 * How to fetch team members dynamically:
 *   1. Call getCRMUsers action on the server.
 *   2. Filter users where user_metadata.manager_id === currentUserId.
 *   3. Pass the resulting id[] as the `knownTeamIds` argument.
 *
 * If no list is provided, falls back to manager seeing only their own records.
 * This is safe — it never silently expands scope.
 */
export function getTeamMembers(userId: string | null, knownTeamIds: string[] = []): string[] {
  if (!userId) return [];
  // Always include the manager's own ID in their scope
  const ids = new Set([userId, ...knownTeamIds]);
  return Array.from(ids);
}

/**
 * Resolves whether a given owner_id belongs to the current user's scoped visibility.
 *
 * @param teamMemberIds - Pre-fetched list of team member IDs for manager scoping.
 *   Required for managers. If omitted, managers see only their own leads (safe default).
 */
export function isLeadVisible(
  role: AppRole | null,
  currentUserId: string | null,
  ownerId: string | null,
  teamMemberIds: string[] = [],
  ownerName?: string | null,
  userFullName?: string | null,
): boolean {
  if (!role || role === "super_admin" || role === "admin") return true;

  if (role === "manager") {
    if (teamMemberIds.length > 0) {
      if (ownerId && teamMemberIds.includes(ownerId)) return true;
      if (ownerName) {
        const o = ownerName.toLowerCase().trim();
        if (o !== "unassigned") return true;
      }
      return false;
    }
    return true;
  }

  if (role === "sales_executive") {
    if (!currentUserId && !userFullName) return false;
    if (ownerId && currentUserId && ownerId === currentUserId) return true;
    if (ownerName && userFullName) {
      const o = ownerName.toLowerCase().trim();
      const u = userFullName.toLowerCase().trim();
      if (o !== "unassigned" && (o === u || o.includes(u) || u.includes(o))) return true;
    }
    return false;
  }
  return true;
}

/**
 * Resolves whether a user's password reset is allowed based on hierarchy.
 */
export function canResetPasswordFor(
  role: AppRole | null,
  currentUserId: string | null,
  targetUser: { id: string; role: AppRole },
) {
  if (!role || !currentUserId) return false;
  if (role === "super_admin") return true;
  if (role === "admin") return targetUser.role !== "super_admin";
  if (role === "manager") {
    return (
      targetUser.role === "sales_executive" && getTeamMembers(currentUserId).includes(targetUser.id)
    );
  }
  return false;
}

/**
 * Checks whether a customer stage is eligible for invoice generation.
 * Invoices can ONLY be generated after reaching Booking Confirmed / Converted stage.
 */
export function isInvoiceEligibleStage(stage: string | null | undefined): boolean {
  if (!stage) return false;
  const eligibleStages = [
    "booking_initiated",
    "payment_pending",
    "payment_completed",
    "converted",
    "closed",
  ];
  return eligibleStages.includes(stage.toLowerCase());
}

/**
 * Validates whether a given user can generate an invoice for a specific customer.
 * Enforces role access, customer ownership scoping, and stage eligibility.
 */
export function canGenerateInvoiceForCustomer(
  role: AppRole | null,
  currentUserId: string | null,
  customerOwnerId: string | null,
  customerStage: string | null | undefined,
): { allowed: boolean; reason?: string } {
  if (!can(role).generateInvoices()) {
    return {
      allowed: false,
      reason: `Role (${role || "User"}) is not authorized to generate invoices.`,
    };
  }

  if (!isLeadVisible(role, currentUserId, customerOwnerId)) {
    return { allowed: false, reason: "Customer is assigned to another sales executive." };
  }

  if (!isInvoiceEligibleStage(customerStage)) {
    const formattedStage = (customerStage || "Early Funnel Stage")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
    return {
      allowed: false,
      reason: `Customer is currently in '${formattedStage}' stage. Invoices require 'Booking Confirmed' or 'Converted' stage.`,
    };
  }

  return { allowed: true };
}
