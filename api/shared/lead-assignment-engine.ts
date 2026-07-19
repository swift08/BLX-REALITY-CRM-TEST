// ============================================================
// Centralized Lead Assignment Engine & Strategy Pattern
// Filename: api/shared/lead-assignment-engine.ts
// ============================================================

import { getSupabaseClient } from "./lead-service.js";

export interface LeadAssignmentSettingsRow {
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

export interface EngineUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isDisabled: boolean;
  assignment_status: "available" | "paused" | "inactive";
  assigned_projects: string[];
}

export interface AssignmentContext {
  leadId: string;
  leadName: string;
  source: string;
  projectId?: string | null;
  previousOwner?: string;
  manualOwnerOverride?: string;
  actorName: string;
  settings: LeadAssignmentSettingsRow;
  eligibleUsers: EngineUser[];
}

export interface AssignmentResult {
  assignedOwner: string;
  assignedUserId?: string;
  strategyUsed: string;
  reason: string;
}

// ----------------------------------------------------
// Strategy Pattern Interfaces & Classes
// ----------------------------------------------------

export interface IAssignmentStrategy {
  name: string;
  assign(ctx: AssignmentContext): Promise<AssignmentResult>;
}

/**
 * 1. Default Round Robin Strategy
 * Sequentially rotates among active, available Sales Executives.
 */
export class RoundRobinStrategy implements IAssignmentStrategy {
  name = "round_robin";

  async assign(ctx: AssignmentContext): Promise<AssignmentResult> {
    const pool = filterEligibleUsers(ctx.eligibleUsers, ctx.settings);

    if (!pool.length) {
      return {
        assignedOwner: "Unassigned",
        strategyUsed: this.name,
        reason: "No available Sales Executives in pool (all paused, inactive, or unassigned)",
      };
    }

    const key = "global";
    const currentIndex = ctx.settings.last_assigned_index_map?.[key] ?? -1;
    const nextIndex = (currentIndex + 1) % pool.length;
    const selectedUser = pool[nextIndex];

    // Persist new index pointer
    await updateIndexPointer(ctx.settings.id, key, nextIndex, ctx.settings.last_assigned_index_map);

    return {
      assignedOwner: selectedUser.name,
      assignedUserId: selectedUser.id,
      strategyUsed: this.name,
      reason: `Fair sequential Round Robin distribution (Index ${nextIndex + 1}/${pool.length})`,
    };
  }
}

/**
 * 2. Project-Based Round Robin Strategy
 * Distributes leads strictly among executives assigned to the lead's project.
 */
export class ProjectBasedStrategy implements IAssignmentStrategy {
  name = "project_based";

  async assign(ctx: AssignmentContext): Promise<AssignmentResult> {
    let pool = filterEligibleUsers(ctx.eligibleUsers, ctx.settings);

    if (ctx.projectId && ctx.projectId !== "none") {
      const projectPool = pool.filter((u) => u.assigned_projects?.includes(ctx.projectId!));
      if (projectPool.length > 0) {
        pool = projectPool;
      }
    }

    if (!pool.length) {
      return {
        assignedOwner: "Unassigned",
        strategyUsed: this.name,
        reason: `No eligible Sales Executives assigned to project ${ctx.projectId || "unspecified"}`,
      };
    }

    const key = ctx.projectId ? `project_${ctx.projectId}` : "global";
    const currentIndex = ctx.settings.last_assigned_index_map?.[key] ?? -1;
    const nextIndex = (currentIndex + 1) % pool.length;
    const selectedUser = pool[nextIndex];

    await updateIndexPointer(ctx.settings.id, key, nextIndex, ctx.settings.last_assigned_index_map);

    return {
      assignedOwner: selectedUser.name,
      assignedUserId: selectedUser.id,
      strategyUsed: this.name,
      reason: `Project-based Round Robin distribution for project ${ctx.projectId || "default"}`,
    };
  }
}

/**
 * 3. Source-Based Routing Strategy
 * Distributes leads based on source mapping configuration.
 */
export class SourceBasedStrategy implements IAssignmentStrategy {
  name = "source_based";

  async assign(ctx: AssignmentContext): Promise<AssignmentResult> {
    const targetRole = ctx.settings.source_routes?.[ctx.source] || "sales_executive";
    let pool = filterEligibleUsers(ctx.eligibleUsers, ctx.settings);

    // If a specific target role mapping exists, filter pool by that role
    const roleFiltered = pool.filter(
      (u) =>
        u.role.toLowerCase().replace("_", " ") === targetRole.toLowerCase() ||
        u.role === targetRole,
    );
    if (roleFiltered.length > 0) {
      pool = roleFiltered;
    }

    if (!pool.length) {
      return {
        assignedOwner: "Unassigned",
        strategyUsed: this.name,
        reason: `No eligible users available for lead source ${ctx.source}`,
      };
    }

    const key = `source_${ctx.source.replace(/\s+/g, "_")}`;
    const currentIndex = ctx.settings.last_assigned_index_map?.[key] ?? -1;
    const nextIndex = (currentIndex + 1) % pool.length;
    const selectedUser = pool[nextIndex];

    await updateIndexPointer(ctx.settings.id, key, nextIndex, ctx.settings.last_assigned_index_map);

    return {
      assignedOwner: selectedUser.name,
      assignedUserId: selectedUser.id,
      strategyUsed: this.name,
      reason: `Source-based routing for ${ctx.source} leads (Target pool: ${targetRole})`,
    };
  }
}

/**
 * 4. Manual Assignment Strategy
 */
export class ManualStrategy implements IAssignmentStrategy {
  name = "manual";

  async assign(ctx: AssignmentContext): Promise<AssignmentResult> {
    const owner = ctx.manualOwnerOverride || "Unassigned";
    return {
      assignedOwner: owner,
      strategyUsed: this.name,
      reason:
        owner !== "Unassigned"
          ? "Manual assignment override by manager/admin"
          : "Manual assignment mode enabled (Left Unassigned)",
    };
  }
}

/**
 * 5. Capacity-Based Assignment Strategy (Future Extension Stub)
 * Evaluates current active lead workload per executive and assigns to lowest active workload.
 */
export class CapacityBasedStrategy implements IAssignmentStrategy {
  name = "capacity_based";

  async assign(ctx: AssignmentContext): Promise<AssignmentResult> {
    const pool = filterEligibleUsers(ctx.eligibleUsers, ctx.settings);
    if (!pool.length) {
      return {
        assignedOwner: "Unassigned",
        strategyUsed: this.name,
        reason: "No available Sales Executives for capacity-based distribution",
      };
    }

    const supabase = getSupabaseClient();

    // Fetch active opportunity count per executive
    const { data: opps } = await supabase
      .from("opportunities")
      .select("owner")
      .not("stage", "in", '("closed","lost","converted")');

    const workloadMap: Record<string, number> = {};
    pool.forEach((u) => {
      workloadMap[u.name] = 0;
    });

    (opps || []).forEach((o: any) => {
      if (workloadMap[o.owner] !== undefined) {
        workloadMap[o.owner] += 1;
      }
    });

    // Sort pool by active workload ascending
    const sortedPool = [...pool].sort(
      (a, b) => (workloadMap[a.name] || 0) - (workloadMap[b.name] || 0),
    );
    const selectedUser = sortedPool[0];

    return {
      assignedOwner: selectedUser.name,
      assignedUserId: selectedUser.id,
      strategyUsed: this.name,
      reason: `Capacity-based allocation assigned to ${selectedUser.name} (Active workload: ${workloadMap[selectedUser.name] || 0} leads)`,
    };
  }
}

// ----------------------------------------------------
// Helper Functions
// ----------------------------------------------------

export function filterEligibleUsers(
  users: EngineUser[],
  settings: LeadAssignmentSettingsRow,
): EngineUser[] {
  return users.filter((u) => {
    // Must be Sales Executive or Sales role
    const isSalesRole =
      u.role === "sales_executive" ||
      u.role === "sales" ||
      u.role === "admin" ||
      u.role === "super_admin";
    if (!isSalesRole) return false;

    // Check account disabled status
    if (settings.skip_inactive_users && u.isDisabled) return false;

    // Check assignment status (Available vs Paused vs Inactive)
    if (settings.skip_paused_users && u.assignment_status === "paused") return false;
    if (u.assignment_status === "inactive") return false;

    return true;
  });
}

async function updateIndexPointer(
  settingsId: string,
  key: string,
  nextIndex: number,
  currentMap: Record<string, number>,
) {
  const supabase = getSupabaseClient();
  const updatedMap = { ...(currentMap || {}), [key]: nextIndex };
  try {
    await supabase
      .from("lead_assignment_settings")
      .update({ last_assigned_index_map: updatedMap, updated_at: new Date().toISOString() })
      .eq("id", settingsId);
  } catch (err) {
    console.error("Failed to update lead assignment index pointer:", err);
  }
}

// Fetch settings from DB or default
export async function getLeadAssignmentSettingsInternal(): Promise<LeadAssignmentSettingsRow> {
  const supabase = getSupabaseClient();
  const defaultSettings: LeadAssignmentSettingsRow = {
    id: "default_assignment_settings",
    distribution_strategy: "round_robin",
    auto_assign_leads: true,
    skip_paused_users: true,
    skip_inactive_users: true,
    enable_project_routing: false,
    enable_source_routing: false,
    allow_manager_override: true,
    maintain_assignment_history: true,
    source_routes: {
      Facebook: "sales_executive",
      Instagram: "sales_executive",
      Website: "sales_executive",
      Referral: "sales_executive",
      "Walk-in": "sales_executive",
      "Landing Page": "sales_executive",
    },
    sla_first_contact_mins: 30,
    sla_manager_escalate_hours: 2,
    sla_auto_reassign_hours: 24,
    last_assigned_index_map: {},
  };

  try {
    const { data, error } = await supabase
      .from("lead_assignment_settings")
      .select("*")
      .eq("id", "default_assignment_settings")
      .single();

    if (error || !data) {
      return defaultSettings;
    }
    return { ...defaultSettings, ...data };
  } catch (err) {
    return defaultSettings;
  }
}

// Fetch all CRM users formatted for Assignment Engine
export async function getEngineUsersInternal(): Promise<EngineUser[]> {
  const supabase = getSupabaseClient();
  try {
    const { data, error } = await supabase.auth.admin.listUsers();
    if (error || !data) return [];
    return (data.users || []).map((u: any) => ({
      id: u.id,
      name: u.user_metadata?.full_name || u.email?.split("@")[0] || "User",
      email: u.email || "",
      role: u.user_metadata?.role || "sales_executive",
      isDisabled: !!u.user_metadata?.is_disabled,
      assignment_status:
        (u.user_metadata?.assignment_status as any) ||
        (u.user_metadata?.is_disabled ? "inactive" : "available"),
      assigned_projects: Array.isArray(u.user_metadata?.assigned_projects)
        ? u.user_metadata.assigned_projects
        : [],
    }));
  } catch (err) {
    console.error("Failed to fetch engine users:", err);
    return [];
  }
}

/**
 * Main Centralized Lead Assignment Dispatcher
 */
export async function executeLeadAssignmentEngine(params: {
  leadId: string;
  leadName: string;
  source: string;
  projectId?: string | null;
  previousOwner?: string;
  manualOwnerOverride?: string;
  actorName: string;
  overrideStrategy?: string;
  reassignmentReason?: string;
}): Promise<AssignmentResult> {
  const supabase = getSupabaseClient();
  const settings = await getLeadAssignmentSettingsInternal();
  const eligibleUsers = await getEngineUsersInternal();

  // If manual override passed
  if (params.manualOwnerOverride) {
    const result: AssignmentResult = {
      assignedOwner: params.manualOwnerOverride,
      strategyUsed: "manual_override",
      reason: params.reassignmentReason || `Manually assigned by ${params.actorName}`,
    };
    await recordAssignmentHistory(supabase, params, result);
    return result;
  }

  // Check if auto-assign is disabled
  if (!settings.auto_assign_leads) {
    const result: AssignmentResult = {
      assignedOwner: params.previousOwner || "Unassigned",
      strategyUsed: "manual",
      reason: "Auto lead assignment is disabled in system settings",
    };
    await recordAssignmentHistory(supabase, params, result);
    return result;
  }

  const context: AssignmentContext = {
    leadId: params.leadId,
    leadName: params.leadName,
    source: params.source,
    projectId: params.projectId,
    previousOwner: params.previousOwner || "Unassigned",
    actorName: params.actorName,
    settings,
    eligibleUsers,
  };

  const strategyType = params.overrideStrategy || settings.distribution_strategy || "round_robin";
  let strategy: IAssignmentStrategy;

  switch (strategyType) {
    case "project_based":
      strategy = new ProjectBasedStrategy();
      break;
    case "source_based":
      strategy = new SourceBasedStrategy();
      break;
    case "manual":
      strategy = new ManualStrategy();
      break;
    case "capacity_based":
      strategy = new CapacityBasedStrategy();
      break;
    case "round_robin":
    default:
      strategy = new RoundRobinStrategy();
      break;
  }

  const result = await strategy.assign(context);

  // Update lead opportunity owner in database
  if (result.assignedOwner && result.assignedOwner !== params.previousOwner) {
    const nextStage = result.assignedOwner !== "Unassigned" ? "assigned" : "new";
    await supabase
      .from("opportunities")
      .update({ owner: result.assignedOwner, stage: nextStage })
      .eq("customer_id", params.leadId);
  }

  // Record audit trail history
  if (settings.maintain_assignment_history) {
    await recordAssignmentHistory(supabase, params, result);
  }

  // Send in-app notification to executive
  if (result.assignedOwner && result.assignedOwner !== "Unassigned") {
    try {
      await supabase.from("notifications").insert({
        title: `⚡ New Lead Assigned: ${params.leadName}`,
        message: `Lead ${params.leadName} (${params.source}) has been assigned to you via ${result.strategyUsed}.`,
        lead_id: params.leadId,
        priority: "high",
        role: "sales_executive",
        assigned_to: result.assignedOwner,
      });
    } catch (e) {
      console.error("Failed to insert assignment notification:", e);
    }
  }

  return result;
}

async function recordAssignmentHistory(
  supabase: any,
  params: { leadId: string; previousOwner?: string; actorName: string },
  result: AssignmentResult,
) {
  try {
    await supabase.from("lead_assignment_history").insert({
      lead_id: params.leadId,
      previous_owner: params.previousOwner || "Unassigned",
      assigned_owner: result.assignedOwner,
      strategy_used: result.strategyUsed,
      reason: result.reason,
      assigned_by: params.actorName || "System",
    });
  } catch (err) {
    console.error("Failed to record lead assignment history:", err);
  }
}
