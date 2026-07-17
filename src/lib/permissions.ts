import type { AppRole } from "@/hooks/use-auth";

/**
 * Central permission matrix for BLX Realty CRM.
 * All role-based access decisions should flow through this file.
 *
 * Usage:
 *   import { can } from "@/lib/permissions";
 *   if (can(role).deleteCustomer()) { ... }
 */
export function can(role: AppRole | null) {
  const isSuperAdmin = role === "super_admin";
  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const isSalesExec = role === "sales_executive";

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
    /** All roles can view their scoped leads */
    viewLeads: () => true,
    /** Only SA and Admin see ALL leads (Sales Exec filtered to own, Manager to team) */
    viewAllLeads: () => isAdminOrAbove,
    /** Manager and above can view all team leads */
    viewTeamLeads: () => isManagerOrAbove,
    /** Create a new customer record (Manager/Admin/SA, or Sales Exec self-assigned) */
    createCustomer: () => true,
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
    exportCustomers: () => true,
    /** Unmask sensitive client contact info (phone/email/budget) - triggers audit log for Sales Exec */
    unmaskContactData: () => true,

    // ─── FOLLOW-UPS ──────────────────────────────────────────────
    /** Admin/Manager see all team follow-ups; Sales Exec sees own */
    viewAllFollowups: () => isManagerOrAbove,
    /** Create follow-up (all roles can) */
    createFollowup: () => true,
    /** Complete a follow-up */
    completeFollowup: () => true,
    /** Reassign a follow-up to another person */
    reassignFollowup: () => isManagerOrAbove,

    // ─── CALENDAR ────────────────────────────────────────────────
    /** Create any event type */
    createCalendarEvent: () => true,
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
    deleteProject: () => false,
    /** Archive project record */
    archiveProject: () => isAdminOrAbove,
    /** Upload floor plans / docs to project */
    uploadProjectDocuments: () => isAdminOrAbove,

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
    initiateBooking: () => true,
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
    viewPersonalAnalytics: () => true,

    // ─── REPORTS ─────────────────────────────────────────────────
    /** Export company-wide reports */
    exportCompanyReports: () => isAdminOrAbove,
    /** Export team reports */
    exportTeamReports: () => isManagerOrAbove,
    /** Export personal reports */
    exportPersonalReports: () => true,

    // ─── AUDIT LOGS ──────────────────────────────────────────────
    /** View the audit log page (SA/Admin: all, Manager: team, Sales Exec: own action history) */
    viewAuditLogs: () => true,
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

    // ─── HELPERS & SCOPES ────────────────────────────────────────
    /** Returns the human-readable role label */
    roleLabel: (): string => {
      if (isSuperAdmin) return "Super Admin";
      if (isAdmin) return "Admin (Operations)";
      if (isManager) return "Manager";
      if (isSalesExec) return "Sales Executive";
      return "Unknown";
    },
    /** Returns the role emoji */
    roleEmoji: (): string => {
      if (isSuperAdmin) return "👑";
      if (isAdmin) return "🛠️";
      if (isManager) return "👨‍💼";
      if (isSalesExec) return "💼";
      return "❓";
    },
    /** Returns the scope label for dashboard context banners */
    dashboardScopeLabel: (): string => {
      if (isSuperAdmin || isAdmin) return "Company-Wide";
      if (isManager) return "Team Performance";
      return "My Performance";
    },
    /** Returns the enterprise title for the dashboard */
    dashboardTitle: (): string => {
      if (isSuperAdmin) return "Company Dashboard";
      if (isAdmin) return "Operations Dashboard";
      if (isManager) return "Team Dashboard";
      return "My Dashboard";
    },
  };
}

// Mock Team Members Mapping
const TEAM_MEMBERS: Record<string, string[]> = {
  "u-4": ["u-3", "u-4"], // Manager Priya (u-4) manages Sales Executive Arjun (u-3) and herself
  "84365b54-a003-4ac0-ac5b-fdec93ed7f0a": [
    "ea645e68-8109-45c9-9b77-313bc2297fe5", // Dev
    "249de63c-b3d9-4408-9410-346df90d35c5", // Vishal
    "a3a87233-6345-45a2-bee1-680babedd12b", // Manoj
    "84365b54-a003-4ac0-ac5b-fdec93ed7f0a", // Manager itself
  ],
};

/**
 * Resolves list of user IDs belonging to a manager's team.
 */
export function getTeamMembers(userId: string | null): string[] {
  if (!userId) return [];
  return TEAM_MEMBERS[userId] || [userId];
}

/**
 * Resolves whether a given owner_id belongs to the current user's scoped visibility.
 */
export function isLeadVisible(
  role: AppRole | null,
  currentUserId: string | null,
  ownerId: string | null,
): boolean {
  if (!role || !currentUserId) return false;
  if (role === "super_admin" || role === "admin") return true;
  if (role === "manager") {
    const team = getTeamMembers(currentUserId);
    return ownerId ? team.includes(ownerId) : false;
  }
  return ownerId === currentUserId;
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
