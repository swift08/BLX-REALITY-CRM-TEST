import "./shared/env-loader.js";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { addLeadInternal } from "./shared/lead-service.js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase credentials in process.env!");
}

function getSupabaseClient() {
  return createClient(supabaseUrl!, supabaseKey!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function getActorName(actorRole: string | undefined) {
  const userMap: Record<string, string> = {
    super_admin: "Super Admin",
    admin: "Admin",
    sales_executive: "Sales Executive",
    manager: "Manager",
  };
  return userMap[actorRole || "super_admin"] || actorRole || "System";
}

async function publishEvent(type: string, customerId: string, payload: any, actorName: string) {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();
  let timelineMsg = "";
  let auditAction = "";
  let auditOld = "None";
  let auditNew = "None";

  let normalizedType = type;
  if (type === "LEAD_CREATED") normalizedType = "CUSTOMER_CREATED";
  if (type === "LEAD_ASSIGNED") normalizedType = "OPPORTUNITY_ASSIGNED";
  if (type === "NOTE_ADDED") normalizedType = "CUSTOMER_UPDATED";
  if (type === "NOTE_EDITED") normalizedType = "CUSTOMER_UPDATED";
  if (type === "NOTE_DELETED") normalizedType = "CUSTOMER_UPDATED";
  if (type === "BOOKING_CANCELLED") normalizedType = "BOOKING_VOIDED";
  if (type === "PAYMENT_COMPLETED") normalizedType = "PAYMENT_RECEIVED";

  let customer: any = null;
  let hasTimeline = true;

  const { data: firstTry, error: firstErr } = await supabase
    .from("customers")
    .select("name, phone, source, timeline")
    .eq("id", customerId)
    .single();

  if (firstErr || !firstTry) {
    const { data: secondTry } = await supabase
      .from("customers")
      .select("name, phone, source")
      .eq("id", customerId)
      .single();
    customer = secondTry;
    hasTimeline = false;
  } else {
    customer = firstTry;
  }

  if (!customer) return;

  switch (normalizedType) {
    case "CUSTOMER_CREATED":
      timelineMsg = `Customer dossier profile created from ${payload.source || customer.source}`;
      auditAction = "CUSTOMER_CREATE";
      auditNew = `${customer.name} (${customer.phone})`;
      break;
    case "OPPORTUNITY_ASSIGNED":
      timelineMsg = `Opportunity owner assigned to ${payload.owner}`;
      auditAction = "OPPORTUNITY_ASSIGN";
      auditOld = payload.oldOwner || "Unassigned";
      auditNew = payload.owner;
      break;
    case "STAGE_CHANGED":
      timelineMsg = `Stage changed from ${payload.oldStage} to ${payload.newStage}`;
      if (payload.reason) timelineMsg += ` (Reason: ${payload.reason})`;
      auditAction = "OPPORTUNITY_STAGE_CHANGE";
      auditOld = payload.oldStage;
      auditNew = payload.newStage;
      break;
    case "CALL_LOGGED":
      timelineMsg = `Logged call: [${payload.outcome}] ${payload.summary}`;
      auditAction = "LOG_CALL";
      auditNew = payload.outcome;
      break;
    case "WHATSAPP_LOGGED":
      timelineMsg = `Logged WhatsApp conversation details: ${payload.summary}`;
      auditAction = "LOG_WHATSAPP";
      auditNew = payload.summary;
      break;
    case "FOLLOWUP_CREATED":
      timelineMsg = `Scheduled follow-up: "${payload.title}"`;
      auditAction = "FOLLOWUP_CREATE";
      auditNew = payload.title;
      break;
    case "FOLLOWUP_COMPLETED":
      timelineMsg = `Completed follow-up: "${payload.title}"`;
      auditAction = "FOLLOWUP_COMPLETE";
      auditOld = "Pending";
      auditNew = "Completed";
      break;
    case "UNIT_RESERVED":
      timelineMsg = `Reserved Unit ${payload.unitNumber} - Booking lock activated`;
      auditAction = "UNIT_RESERVE";
      auditNew = payload.unitNumber;
      break;
    case "BOOKING_VOIDED":
      timelineMsg = `Booking reservation voided on Unit ${payload.unitNumber}`;
      auditAction = "BOOKING_VOID";
      auditOld = "Reserved";
      auditNew = "Available";
      break;
    case "PAYMENT_RECEIVED":
      timelineMsg = `Instalment payment cleared. Unit sold!`;
      auditAction = "PAYMENT_CLEAR";
      auditOld = "Pending";
      auditNew = "Completed";
      break;
    case "CUSTOMER_UPDATED":
      timelineMsg = `Customer profile updated by ${actorName}`;
      auditAction = "CUSTOMER_UPDATE";
      auditNew = payload.content || "Profile fields updated";
      break;
  }

  const currentTimeline = hasTimeline ? customer.timeline || [] : [];
  if (timelineMsg && hasTimeline) {
    try {
      currentTimeline.push({ title: timelineMsg, time: now });
      await supabase.from("customers").update({ timeline: currentTimeline }).eq("id", customerId);
    } catch (e) {
      console.error("Failed to update customer timeline:", e);
    }
  }

  if (auditAction) {
    try {
      await supabase.from("audit_logs").insert({
        user: actorName,
        action: auditAction,
        timestamp: now,
        old_value: auditOld,
        new_value: auditNew,
      });
    } catch (e) {
      console.error("Failed to insert audit log:", e);
    }
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const { action, payload } = req.body || {};
    const supabase = getSupabaseClient();

    // ─── Public actions that don't require authentication ────────────────────
    const PUBLIC_ACTIONS = new Set(["signIn", "signUp", "refreshSession"]);

    // ─── Zero-Trust: Extract & verify identity from JWT only ─────────────────
    let actorRole: string = "sales_executive";
    let actorName: string = "Anonymous";
    let actorEmail: string = "";
    let actorId: string = "";
    let isAuthenticated = false;

    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (authHeader && typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser(token);
        if (!error && user) {
          // Role ALWAYS comes from verified JWT metadata — never from client body
          actorRole = user.user_metadata?.role || "sales_executive";
          actorName = user.user_metadata?.full_name || user.email?.split("@")[0] || "User";
          actorEmail = user.email || "";
          actorId = user.id || "";
          isAuthenticated = true;
        }
      } catch (_) {
        // Token verification failed — isAuthenticated stays false
      }
    }

    // ─── Enforce authentication for all non-public actions ───────────────────
    if (!PUBLIC_ACTIONS.has(action) && !isAuthenticated) {
      // Log the unauthorized access attempt
      try {
        await supabase.from("audit_logs").insert({
          user: "Unauthenticated",
          action: "SECURITY_VIOLATION:MISSING_AUTH_TOKEN",
          timestamp: new Date().toISOString(),
          old_value: action,
          new_value: "401 Unauthorized",
        });
      } catch (_) {
        /* best-effort */
      }
      return res.status(401).json({
        error: "Authentication required. Please provide a valid Bearer token.",
      });
    }

    // ─── Admin-only actions enforcement ──────────────────────────────────────
    const ADMIN_ONLY_ACTIONS = new Set([
      "saveCompanySettings",
      "addWorkflowRule",
      "toggleWorkflowRule",
      "addCRMUser",
      "updateCRMUserRole",
      "resetCRMUserPassword",
      "deleteCRMUser",
      "fixManagerRole",
      "toggleCRMUserStatus",
    ]);

    const SUPER_ADMIN_ONLY_ACTIONS = new Set([
      "fixManagerRole",
      "permanentlyDeleteLead",
      "deleteCRMUser",
    ]);

    if (ADMIN_ONLY_ACTIONS.has(action)) {
      if (actorRole !== "super_admin" && actorRole !== "admin") {
        await supabase.from("audit_logs").insert({
          user: actorName,
          action: "SECURITY_VIOLATION:UNAUTHORIZED_ADMIN_ACTION",
          timestamp: new Date().toISOString(),
          old_value: action,
          new_value: "403 Forbidden",
        });
        return res
          .status(403)
          .json({ error: "Security Exception: Unauthorized administrative action." });
      }
    }

    if (SUPER_ADMIN_ONLY_ACTIONS.has(action)) {
      if (actorRole !== "super_admin") {
        await supabase.from("audit_logs").insert({
          user: actorName,
          action: "SECURITY_VIOLATION:UNAUTHORIZED_SUPER_ADMIN_ACTION",
          timestamp: new Date().toISOString(),
          old_value: action,
          new_value: "403 Forbidden",
        });
        return res.status(403).json({ error: "Security Exception: Super Admin access required." });
      }
    }

    switch (action) {
      case "refreshSession": {
        const { refreshToken } = payload;
        if (!refreshToken) {
          return res.status(400).json({ error: "Missing refresh token" });
        }
        const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
        if (error) {
          return res.status(400).json({ error: error.message });
        }
        return res.status(200).json(data);
      }
      case "signIn": {
        const { email, password } = payload;
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          // Audit: login failure
          try {
            await supabase.from("audit_logs").insert({
              user: email || "unknown",
              action: "AUTH:LOGIN_FAILED",
              timestamp: new Date().toISOString(),
              old_value: "Attempt",
              new_value: error.message,
            });
          } catch (_) {
            /* best-effort */
          }
          return res.status(400).json({ error: error.message });
        }
        if (data.user?.user_metadata?.is_disabled) {
          return res.status(403).json({ error: "Your account is deactivated. Please contact an administrator." });
        }
        // Audit: login success
        try {
          const loginUser = data.user;
          const loginName =
            loginUser?.user_metadata?.full_name || loginUser?.email?.split("@")[0] || email;
          const loginRole = loginUser?.user_metadata?.role || "sales_executive";
          await supabase.from("audit_logs").insert({
            user: loginName,
            action: "AUTH:LOGIN_SUCCESS",
            timestamp: new Date().toISOString(),
            old_value: loginRole,
            new_value: loginUser?.email || email,
          });
        } catch (_) {
          /* best-effort */
        }
        return res.status(200).json(data);
      }
      case "signUp": {
        const { email, password, name, role } = payload;
        const { data, error } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            full_name: name,
            role,
          },
        });
        if (error) return res.status(400).json({ error: error.message });
        return res.status(200).json(data);
      }
      case "signOut": {
        // Audit: logout event (actorName is already set from JWT)
        try {
          await supabase.from("audit_logs").insert({
            user: actorName || "Unknown",
            action: "AUTH:LOGOUT",
            timestamp: new Date().toISOString(),
            old_value: actorRole || "unknown",
            new_value: actorEmail || "session ended",
          });
        } catch (_) {
          /* best-effort */
        }
        const { error } = await supabase.auth.signOut();
        if (error) return res.status(400).json({ error: error.message });
        return res.status(200).json({ success: true });
      }
      case "fixManagerRole": {
        // Super Admin only — fixes manager@blxreality.com metadata role from 'admin' to 'manager'
        const { userId } = payload;
        if (!userId) return res.status(400).json({ error: "userId is required" });
        const { data, error } = await supabase.auth.admin.updateUserById(userId, {
          user_metadata: { role: "manager" },
        });
        if (error) return res.status(400).json({ error: error.message });
        await supabase.from("audit_logs").insert({
          user: actorName,
          action: "ADMIN:FIX_MANAGER_ROLE",
          timestamp: new Date().toISOString(),
          old_value: "admin",
          new_value: `manager (user: ${userId})`,
        });
        return res.status(200).json({ success: true, user: data.user });
      }
      case "updateUserRole": {
        const { userId, role } = payload;
        const { data, error } = await supabase.auth.admin.updateUserById(userId, {
          user_metadata: { role },
        });
        if (error) return res.status(400).json({ error: error.message });
        return res.status(200).json(data);
      }
      case "changePassword": {
        const { currentPassword, newPassword } = payload;
        if (!currentPassword || !newPassword) {
          return res.status(400).json({ error: "Missing password fields" });
        }
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: actorEmail,
          password: currentPassword,
        });
        if (signInErr) {
          return res.status(400).json({ error: "Incorrect current password" });
        }
        const { error: updateErr } = await supabase.auth.admin.updateUserById(actorId, {
          password: newPassword,
        });
        if (updateErr) {
          return res.status(400).json({ error: updateErr.message });
        }
        await supabase.from("audit_logs").insert({
          user: actorName,
          action: "CHANGE_PASSWORD",
          old_value: "User initiated",
          new_value: "Password updated successfully",
        });
        return res.status(200).json({ success: true });
      }
      case "updateUserProfile": {
        const { name, phone } = payload;
        const { data, error } = await supabase.auth.admin.updateUserById(actorId, {
          user_metadata: {
            ...((await supabase.auth.admin.getUserById(actorId)).data.user?.user_metadata || {}),
            full_name: name,
            phone: phone,
          },
        });
        if (error) return res.status(400).json({ error: error.message });
        await supabase.from("audit_logs").insert({
          user: actorName,
          action: "UPDATE_PROFILE",
          old_value: actorEmail,
          new_value: `Name: ${name}, Phone: ${phone}`,
        });
        return res.status(200).json({ success: true, user: data.user });
      }

      // ----------------------------------------------------
      // Database Queries
      // ----------------------------------------------------
      case "getLeads": {
        const { data, error } = await supabase
          .from("customers")
          .select(
            "*, opportunities(*, bookings(*, invoices(*, payments(*)))), activities(*), communications(*), documents(*), notes(*)",
          )
          .order("created_at", { ascending: false });
        if (error) return res.status(400).json({ error: error.message });

        const mapped = (data || []).map((c: any) => ({
          ...c,
          opportunities: (c.opportunities || []).map((o: any) => {
            const bookingsMapped = (o.bookings || []).map((b: any) => ({
              ...b,
              payment_status: b.payment_status,
              invoices: (b.invoices || []).map((inv: any) => ({
                ...inv,
                dueDate: inv.due_date,
                payments: inv.payments || [],
              })),
            }));
            return {
              ...o,
              customerId: o.customer_id,
              projectId: o.project_id,
              bookings: bookingsMapped,
              booking: bookingsMapped[0] || null,
            };
          }),
        }));
        return res.status(200).json(mapped);
      }
      case "getProjects": {
        const { data, error } = await supabase.from("projects").select("*, developers(*)");
        if (error) return res.status(400).json({ error: error.message });
        return res.status(200).json(data || []);
      }
      case "getDevelopers": {
        const { data, error } = await supabase.from("developers").select("*");
        if (error) return res.status(400).json({ error: error.message });
        return res.status(200).json(data || []);
      }
      case "getInventory": {
        const { data, error } = await supabase.from("inventory").select("*");
        if (error) return res.status(400).json({ error: error.message });
        return res.status(200).json(data || []);
      }
      case "getBookings": {
        const { data, error } = await supabase
          .from("bookings")
          .select("*, invoices(*, payments(*))");
        if (error) return res.status(400).json({ error: error.message });
        return res.status(200).json(data || []);
      }
      case "getNotifications": {
        const { data, error } = await supabase
          .from("notifications")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) return res.status(400).json({ error: error.message });
        return res.status(200).json(data || []);
      }
      case "getFollowups": {
        const { data, error } = await supabase.from("followups").select("*");
        if (error) return res.status(400).json({ error: error.message });
        return res.status(200).json(data || []);
      }
      case "getAuditLogs": {
        const { data, error } = await supabase
          .from("audit_logs")
          .select("*")
          .order("timestamp", { ascending: false });
        if (error) return res.status(400).json({ error: error.message });
        return res.status(200).json(data || []);
      }
      case "getCalendarEvents": {
        const { data, error } = await supabase
          .from("calendar_events")
          .select("*")
          .order("start_time", { ascending: true });
        if (error) return res.status(400).json({ error: error.message });
        const mapped = (data || []).map((e: any) => ({
          id: e.id,
          type: e.type,
          title: e.title,
          start: e.start_time,
          end: e.end_time,
          customerId: e.customer_id,
          salesPerson: e.sales_person,
          details: e.details,
        }));
        return res.status(200).json(mapped);
      }
      case "getSettings": {
        const { data, error } = await supabase.from("settings").select("*").maybeSingle();
        if (error) return res.status(400).json({ error: error.message });
        if (data) return res.status(200).json(data);

        const defaultSettings = {
          id: 1,
          company_name: "BLX Realty",
          working_hours: "09:00 AM - 07:00 PM",
          reminder_time: 30,
          lead_sources: [
            "Website",
            "Instagram",
            "Facebook",
            "WhatsApp",
            "Walk-in",
            "Referral",
            "Landing Page",
          ],
          response_sla_mins: 30,
          escalation_sla_hours: 2,
        };
        const { data: seeded } = await supabase
          .from("settings")
          .insert(defaultSettings)
          .select()
          .single();
        return res.status(200).json(seeded || defaultSettings);
      }
      case "getWorkflowRules": {
        const { data, error } = await supabase.from("workflow_rules").select("*");
        if (error) return res.status(400).json({ error: error.message });
        return res.status(200).json(data || []);
      }
      case "getCRMUsers": {
        const { data, error } = await supabase.auth.admin.listUsers();
        if (error) return res.status(400).json({ error: error.message });
        const users = (data.users || []).map((u: any) => ({
          id: u.id,
          name: u.user_metadata?.full_name || u.email?.split("@")[0] || "User",
          email: u.email || "",
          role: u.user_metadata?.role || "sales_executive",
          isDisabled: !!u.user_metadata?.is_disabled,
        }));
        return res.status(200).json(users);
      }
      case "toggleCRMUserStatus": {
        const { id, isDisabled } = payload;
        const { data, error } = await supabase.auth.admin.updateUserById(id, {
          user_metadata: {
            ...((await supabase.auth.admin.getUserById(id)).data.user?.user_metadata || {}),
            is_disabled: isDisabled,
          },
        });
        if (error) return res.status(400).json({ error: error.message });
        await supabase.from("audit_logs").insert({
          user: actorName,
          action: isDisabled ? "DEACTIVATE_USER" : "ACTIVATE_USER",
          old_value: id,
          new_value: isDisabled ? "Deactivated" : "Activated",
        });
        return res.status(200).json({ success: true });
      }

      // ----------------------------------------------------
      // Database Mutators
      // ----------------------------------------------------
      case "addLead": {
        const { lead } = payload;
        const result = await addLeadInternal(lead, actorName);
        if (result.error) {
          return res.status(result.statusCode || 400).json({ error: result.error });
        }
        return res.status(200).json(result.data);
      }
      case "updateLead": {
        const { id, updates, stageChangeReason } = payload;
        const { data: dbCustomer } = await supabase
          .from("customers")
          .select("*, opportunities(*)")
          .eq("id", id)
          .single();

        if (!dbCustomer) return res.status(400).json({ error: "Customer profile not found" });

        const opps = dbCustomer.opportunities || [];
        const activeOppIdx =
          opps.findIndex((o: any) => o.id === dbCustomer.activeOpportunityId) !== -1
            ? opps.findIndex((o: any) => o.id === dbCustomer.activeOpportunityId)
            : 0;
        const oldOpp = opps[activeOppIdx];

        if (oldOpp && oldOpp.stage === "closed") {
          if (updates.stage && updates.stage !== "closed") {
            if (actorRole !== "super_admin" && actorRole !== "admin") {
              return res.status(400).json({
                error: "Business Rule: Only Admin or Super Admin can reopen a closed opportunity.",
              });
            }
            if (!stageChangeReason?.trim()) {
              return res.status(400).json({
                error:
                  "Business Rule: A mandatory reason is required to reopen a closed opportunity.",
              });
            }
          } else {
            return res.status(400).json({
              error: "Business Rule: Closed opportunities are read-only and cannot be modified.",
            });
          }
        }

        const custUpdates: any = {};
        if (updates.name !== undefined) custUpdates.name = updates.name;
        if (updates.phone !== undefined) custUpdates.phone = updates.phone;
        if (updates.email !== undefined) custUpdates.email = updates.email;
        if (updates.source !== undefined) custUpdates.source = updates.source;

        if (Object.keys(custUpdates).length > 0) {
          await supabase.from("customers").update(custUpdates).eq("id", id);
        }

        if (oldOpp) {
          const oppUpdates: any = {};
          if (updates.stage !== undefined) oppUpdates.stage = updates.stage;
          if (updates.temperature !== undefined) oppUpdates.temperature = updates.temperature;
          if (updates.owner !== undefined) oppUpdates.owner = updates.owner;
          if (updates.budget !== undefined) oppUpdates.budget = updates.budget;
          if (updates.project_id !== undefined)
            oppUpdates.project_id =
              updates.project_id === "none" || !updates.project_id ? null : updates.project_id;

          if (Object.keys(oppUpdates).length > 0) {
            await supabase.from("opportunities").update(oppUpdates).eq("id", oldOpp.id);
          }
          if (updates.owner !== undefined) {
            await supabase
              .from("followups")
              .update({ assigned_sales: updates.owner })
              .eq("lead_id", id)
              .eq("status", "pending");
          }
        }

        if (updates.stage && oldOpp && updates.stage !== oldOpp.stage) {
          await publishEvent(
            "STAGE_CHANGED",
            id,
            { oldStage: oldOpp.stage, newStage: updates.stage, reason: stageChangeReason },
            actorName,
          );
        }
        if (updates.owner && oldOpp && updates.owner !== oldOpp.owner) {
          await publishEvent(
            "OPPORTUNITY_ASSIGNED",
            id,
            { owner: updates.owner, oldOwner: oldOpp.owner },
            actorName,
          );
        }

        return res.status(200).json({ success: true });
      }
      case "softDeleteLead": {
        const { id } = payload;
        const { data: customer } = await supabase
          .from("customers")
          .select("*, opportunities(*)")
          .eq("id", id)
          .single();
        if (!customer) return res.status(400).json({ error: "Customer profile not found" });

        const hasConverted = (customer.opportunities || []).some(
          (o: any) => o.stage === "converted",
        );
        if (hasConverted) {
          return res
            .status(400)
            .json({ error: "A customer with converted opportunities cannot be deleted." });
        }

        await supabase.from("customers").update({ is_deleted: true }).eq("id", id);
        await publishEvent("CUSTOMER_UPDATED", id, { content: "Lead profile archived" }, actorName);

        await supabase.from("notifications").insert({
          title: "Customer Archived",
          message: `${customer.name} profile has been archived.`,
          priority: "low",
          role: "admin",
          lead_id: id,
        });

        return res.status(200).json({ success: true });
      }
      case "restoreLead": {
        const { id } = payload;
        await supabase.from("customers").update({ is_deleted: false }).eq("id", id);
        await publishEvent("CUSTOMER_UPDATED", id, { content: "Lead profile restored" }, actorName);
        return res.status(200).json({ success: true });
      }
      case "permanentlyDeleteLead": {
        const { id } = payload;
        await supabase.from("customers").delete().eq("id", id);
        return res.status(200).json({ success: true });
      }
      case "mergeLeads": {
        const { targetId, sourceId } = payload;
        const { data: target } = await supabase
          .from("customers")
          .select("*, notes(*), timeline")
          .eq("id", targetId)
          .single();
        const { data: source } = await supabase
          .from("customers")
          .select("*, notes(*), timeline")
          .eq("id", sourceId)
          .single();

        if (!target || !source)
          return res.status(400).json({ error: "Source or target profile missing." });

        if (source.notes && source.notes.length > 0) {
          for (const note of source.notes) {
            await supabase.from("notes").update({ customer_id: targetId }).eq("id", note.id);
          }
        }

        const mergedTimeline = [...(target.timeline || []), ...(source.timeline || [])];
        mergedTimeline.push({
          title: `Merged source profile ${source.name} (${source.phone}) info into this profile`,
          time: new Date().toISOString(),
        });

        await supabase.from("customers").update({ timeline: mergedTimeline }).eq("id", targetId);
        await supabase.from("customers").delete().eq("id", sourceId);

        return res.status(200).json({ success: true });
      }
      case "bulkAssignLeads": {
        const { leadIds, newOwner } = payload;
        for (const id of leadIds) {
          const { data: cust } = await supabase
            .from("customers")
            .select("*, opportunities(*)")
            .eq("id", id)
            .single();
          if (cust && cust.opportunities && cust.opportunities.length > 0) {
            const activeOpp =
              cust.opportunities.find((o: any) => o.id === cust.activeOpportunityId) ||
              cust.opportunities[0];
            const oldOwner = activeOpp.owner;
            await supabase.from("opportunities").update({ owner: newOwner }).eq("id", activeOpp.id);
            await supabase
              .from("followups")
              .update({ assigned_sales: newOwner })
              .eq("lead_id", id)
              .eq("status", "pending");
            await publishEvent(
              "OPPORTUNITY_ASSIGNED",
              id,
              { owner: newOwner, oldOwner },
              actorName,
            );
          }
        }
        return res.status(200).json({ success: true });
      }
      case "addLeadNote": {
        const { leadId, content, author } = payload;
        const { data, error } = await supabase
          .from("notes")
          .insert({
            customer_id: leadId,
            content,
            author,
          })
          .select()
          .single();
        if (error) return res.status(400).json({ error: error.message });

        await publishEvent(
          "CUSTOMER_UPDATED",
          leadId,
          { author, content: `Added note: "${content.substring(0, 30)}..."` },
          author,
        );
        return res.status(200).json(data);
      }
      case "editLeadNote": {
        const { leadId, noteId, content, author } = payload;
        const { data, error } = await supabase
          .from("notes")
          .update({ content })
          .eq("id", noteId)
          .select()
          .single();
        if (error) return res.status(400).json({ error: error.message });

        await publishEvent(
          "CUSTOMER_UPDATED",
          leadId,
          { author, content: `Edited note: "${content.substring(0, 30)}..."` },
          author,
        );
        return res.status(200).json(data);
      }
      case "deleteLeadNote": {
        const { leadId, noteId, author } = payload;
        await supabase.from("notes").delete().eq("id", noteId);
        await publishEvent("CUSTOMER_UPDATED", leadId, { author, content: "Deleted note" }, author);
        return res.status(200).json({ success: true });
      }
      case "togglePinNote": {
        const { noteId, pinned } = payload;
        await supabase.from("notes").update({ pinned }).eq("id", noteId);
        return res.status(200).json({ success: true });
      }
      case "addLeadActivity": {
        const { leadId, activity } = payload;
        await supabase.from("activities").insert({
          customer_id: leadId,
          type: activity.type,
          summary: activity.summary,
          next_followup: activity.next_followup || null,
        });

        const eventMap: Record<string, string> = {
          call: "CALL_LOGGED",
          meeting: "MEETING_CREATED",
          visit: "VISIT_COMPLETED",
          whatsapp: "WHATSAPP_LOGGED",
        };
        const eventType = eventMap[activity.type] || "CUSTOMER_UPDATED";
        await publishEvent(
          eventType,
          leadId,
          { summary: activity.summary, outcome: activity.outcome || "Completed" },
          actorName,
        );

        if (activity.next_followup) {
          const followupTitle =
            activity.followup_title || `Followup after ${activity.type}: ${activity.summary}`;

          // Get the owner from active opportunity
          const { data: opps } = await supabase
            .from("opportunities")
            .select("owner")
            .eq("customer_id", leadId);
          const assignedOwner =
            opps && opps[0] && opps[0].owner !== "Unassigned" ? opps[0].owner : actorName;

          await supabase.from("followups").insert({
            lead_id: leadId,
            title: followupTitle,
            time: activity.next_followup,
            priority: activity.followup_priority || "medium",
            status: "pending",
            assigned_sales: assignedOwner,
          });
          await publishEvent("FOLLOWUP_CREATED", leadId, { title: followupTitle }, actorName);
        }
        return res.status(200).json({ success: true });
      }
      case "addLeadCommunicationLog": {
        const { leadId, log } = payload;
        await supabase.from("communications").insert({
          customer_id: leadId,
          type: log.type,
          direction: log.direction,
          summary: log.summary,
          details: log.details || "",
        });

        const eventMap: Record<string, string> = {
          call: "CALL_LOGGED",
          whatsapp: "WHATSAPP_LOGGED",
        };
        const eventType = eventMap[log.type] || "CUSTOMER_UPDATED";
        await publishEvent(
          eventType,
          leadId,
          { summary: log.summary, outcome: log.details || "Inbound/Outbound" },
          actorName,
        );

        return res.status(200).json({ success: true });
      }
      case "completeFollowup": {
        const { followupId } = payload;
        const { data: f } = await supabase
          .from("followups")
          .select("*")
          .eq("id", followupId)
          .single();
        if (!f) return res.status(400).json({ error: "Follow-up task not found" });

        await supabase.from("followups").update({ status: "completed" }).eq("id", followupId);
        await publishEvent("FOLLOWUP_COMPLETED", f.lead_id, { title: f.title }, actorName);
        return res.status(200).json({ success: true });
      }
      case "addDeveloper": {
        const { dev } = payload;
        const { data, error } = await supabase
          .from("developers")
          .insert({
            name: dev.name,
            contact: dev.contact || "",
            location: dev.location || "",
          })
          .select()
          .single();

        if (error) return res.status(400).json({ error: error.message });
        await supabase.from("audit_logs").insert({
          user: actorName,
          action: "DEVELOPER_CREATE",
          old_value: "None",
          new_value: dev.name,
        });
        return res.status(200).json(data);
      }
      case "updateDeveloper": {
        const { id, updates } = payload;
        const { data, error } = await supabase
          .from("developers")
          .update(updates)
          .eq("id", id)
          .select()
          .single();
        if (error) return res.status(400).json({ error: error.message });
        await supabase.from("audit_logs").insert({
          user: actorName,
          action: "DEVELOPER_UPDATE",
          old_value: id,
          new_value: JSON.stringify(updates),
        });
        return res.status(200).json(data);
      }
      case "addProject": {
        const { proj } = payload;
        const { data, error } = await supabase
          .from("projects")
          .insert({
            name: proj.name,
            developer_id: proj.developer_id || null,
            location: proj.location || "",
            total_units: proj.total_units || 0,
            available_units: proj.available_units || 0,
            price_range: proj.price_range || "",
          })
          .select()
          .single();

        if (error) return res.status(400).json({ error: error.message });
        await supabase.from("audit_logs").insert({
          user: actorName,
          action: "PROJECT_CREATE",
          old_value: "None",
          new_value: proj.name,
        });
        return res.status(200).json(data);
      }
      case "updateProject": {
        const { id, updates } = payload;
        const { data, error } = await supabase
          .from("projects")
          .update(updates)
          .eq("id", id)
          .select()
          .single();
        if (error) return res.status(400).json({ error: error.message });
        await supabase.from("audit_logs").insert({
          user: actorName,
          action: "PROJECT_UPDATE",
          old_value: id,
          new_value: JSON.stringify(updates),
        });
        return res.status(200).json(data);
      }
      case "addUnit": {
        const { unit } = payload;
        const { data, error } = await supabase
          .from("inventory")
          .insert({
            project_id: unit.project_id,
            unit_number: unit.unit_number,
            configuration: unit.configuration || "",
            area: unit.area || 0,
            price: unit.price || 0,
            status: "available",
          })
          .select()
          .single();

        if (error) return res.status(400).json({ error: error.message });
        return res.status(200).json(data);
      }
      case "updateUnit": {
        const { id, updates } = payload;
        const { data, error } = await supabase
          .from("inventory")
          .update(updates)
          .eq("id", id)
          .select()
          .single();
        if (error) return res.status(400).json({ error: error.message });
        return res.status(200).json(data);
      }
      case "reserveUnit": {
        const { unitId, leadId } = payload;
        const { data: unit } = await supabase
          .from("inventory")
          .select("*")
          .eq("id", unitId)
          .single();
        if (!unit) return res.status(400).json({ error: "Unit not found." });

        await supabase
          .from("inventory")
          .update({ status: "reserved", reserved_by: leadId })
          .eq("id", unitId);

        const { data: cust } = await supabase
          .from("customers")
          .select("*, opportunities(*)")
          .eq("id", leadId)
          .single();
        if (cust && cust.opportunities && cust.opportunities.length > 0) {
          const activeOpp =
            cust.opportunities.find((o: any) => o.id === cust.activeOpportunityId) ||
            cust.opportunities[0];

          const { data: booking } = await supabase
            .from("bookings")
            .insert({
              opportunity_id: activeOpp.id,
              unit_id: unitId,
              amount: unit.price,
              payment_status: "pending",
            })
            .select()
            .single();

          await supabase.from("invoices").insert({
            booking_id: booking.id,
            amount: unit.price,
            status: "unpaid",
            due_date: new Date(Date.now() + 15 * 86400000).toISOString(),
          });

          await supabase
            .from("opportunities")
            .update({ stage: "booking_initiated" })
            .eq("id", activeOpp.id);
        }

        await publishEvent("UNIT_RESERVED", leadId, { unitNumber: unit.unit_number }, actorName);
        return res.status(200).json({ success: true });
      }
      case "cancelBooking": {
        const { leadId, bookingId } = payload;
        let unitId = "";
        let opportunityId = "";
        let actualBookingId = bookingId;

        if (actualBookingId) {
          const { data: b } = await supabase
            .from("bookings")
            .select("unit_id, opportunity_id")
            .eq("id", actualBookingId)
            .maybeSingle();
          if (b) {
            unitId = b.unit_id;
            opportunityId = b.opportunity_id;
          }
        }

        // Fallback if no bookingId is provided
        if (!unitId) {
          const { data: units } = await supabase
            .from("inventory")
            .select("id")
            .eq("reserved_by", leadId);
          if (units && units.length > 0) {
            unitId = units[0].id;
          }
        }

        if (unitId) {
          const { data: unit } = await supabase
            .from("inventory")
            .select("*")
            .eq("id", unitId)
            .maybeSingle();

          if (unit) {
            await supabase
              .from("inventory")
              .update({ status: "available", reserved_by: null })
              .eq("id", unit.id);

            // Fetch target opportunity and booking if not resolved yet
            if (!actualBookingId || !opportunityId) {
              const { data: cust } = await supabase
                .from("customers")
                .select("*, opportunities(*)")
                .eq("id", leadId)
                .maybeSingle();
              if (cust && cust.opportunities && cust.opportunities.length > 0) {
                const activeOpp =
                  cust.opportunities.find((o: any) => o.id === cust.activeOpportunityId) ||
                  cust.opportunities[0];
                opportunityId = activeOpp.id;

                const { data: b } = await supabase
                  .from("bookings")
                  .select("id")
                  .eq("opportunity_id", activeOpp.id)
                  .eq("unit_id", unit.id)
                  .maybeSingle();
                if (b) actualBookingId = b.id;
              }
            }

            if (actualBookingId) {
              await supabase
                .from("bookings")
                .update({ payment_status: "void" })
                .eq("id", actualBookingId);
            }
            if (opportunityId) {
              await supabase
                .from("opportunities")
                .update({ stage: "negotiation" })
                .eq("id", opportunityId);
            }

            await publishEvent(
              "BOOKING_VOIDED",
              leadId,
              { unitNumber: unit.unit_number },
              actorName,
            );
          }
        }
        return res.status(200).json({ success: true });
      }
      case "confirmBookingPayment": {
        const { leadId, bookingId } = payload;
        let unitId = "";
        let opportunityId = "";
        let actualBookingId = bookingId;
        let bookingAmount = 0;

        if (actualBookingId) {
          const { data: b } = await supabase
            .from("bookings")
            .select("unit_id, opportunity_id, amount")
            .eq("id", actualBookingId)
            .maybeSingle();
          if (b) {
            unitId = b.unit_id;
            opportunityId = b.opportunity_id;
            bookingAmount = b.amount;
          }
        }

        // Fallback if no bookingId is provided
        if (!unitId) {
          const { data: units } = await supabase
            .from("inventory")
            .select("id, price")
            .eq("reserved_by", leadId);
          if (units && units.length > 0) {
            unitId = units[0].id;
            bookingAmount = units[0].price;
          }
        }

        if (unitId) {
          const { data: unit } = await supabase
            .from("inventory")
            .select("*")
            .eq("id", unitId)
            .maybeSingle();

          if (unit) {
            await supabase.from("inventory").update({ status: "sold" }).eq("id", unit.id);

            // Fetch target opportunity and booking if not resolved yet
            if (!actualBookingId || !opportunityId) {
              const { data: cust } = await supabase
                .from("customers")
                .select("*, opportunities(*)")
                .eq("id", leadId)
                .maybeSingle();
              if (cust && cust.opportunities && cust.opportunities.length > 0) {
                const activeOpp =
                  cust.opportunities.find((o: any) => o.id === cust.activeOpportunityId) ||
                  cust.opportunities[0];
                opportunityId = activeOpp.id;

                const { data: b } = await supabase
                  .from("bookings")
                  .select("id, amount")
                  .eq("opportunity_id", activeOpp.id)
                  .eq("unit_id", unit.id)
                  .maybeSingle();
                if (b) {
                  actualBookingId = b.id;
                  bookingAmount = b.amount;
                }
              }
            }

            if (actualBookingId) {
              await supabase
                .from("bookings")
                .update({ payment_status: "completed" })
                .eq("id", actualBookingId);

              const { data: inv } = await supabase
                .from("invoices")
                .select("id")
                .eq("booking_id", actualBookingId)
                .maybeSingle();
              if (inv) {
                await supabase.from("invoices").update({ status: "paid" }).eq("id", inv.id);
                await supabase.from("payments").insert({
                  invoice_id: inv.id,
                  amount: bookingAmount,
                  reference: `TXN-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
                });
              }
            }

            if (opportunityId) {
              await supabase
                .from("opportunities")
                .update({ stage: "converted" })
                .eq("id", opportunityId);
            }

            await publishEvent(
              "PAYMENT_RECEIVED",
              leadId,
              { unitNumber: unit.unit_number },
              actorName,
            );
          }
        }
        return res.status(200).json({ success: true });
      }
      case "updateBookingStatus": {
        const { leadId, status } = payload;
        const { data: cust } = await supabase
          .from("customers")
          .select("*, opportunities(*)")
          .eq("id", leadId)
          .single();
        if (cust && cust.opportunities && cust.opportunities.length > 0) {
          const activeOpp =
            cust.opportunities.find((o: any) => o.id === cust.activeOpportunityId) ||
            cust.opportunities[0];
          const { data: bookingsList } = await supabase
            .from("bookings")
            .select("id")
            .eq("opportunity_id", activeOpp.id)
            .order("booking_date", { ascending: false });
          const b = bookingsList && bookingsList[0];
          if (b) {
            const { data, error } = await supabase
              .from("bookings")
              .update({ payment_status: status })
              .eq("id", b.id)
              .select()
              .single();
            if (error) return res.status(400).json({ error: error.message });
            return res.status(200).json(data);
          }
        }
        return res.status(200).json({ success: true });
      }
      case "addCustomerDocument": {
        const { leadId, doc } = payload;
        const { data, error } = await supabase
          .from("documents")
          .insert({
            customer_id: leadId,
            name: doc.name,
            url: doc.url,
            size: Math.round(doc.size || 0),
            category: doc.category || "Other",
            uploaded_by: actorName,
          })
          .select()
          .single();

        if (error) return res.status(400).json({ error: error.message });
        await publishEvent(
          "DOCUMENT_UPLOADED",
          leadId,
          { name: doc.name, category: doc.category },
          actorName,
        );
        return res.status(200).json(data);
      }
      case "addCustomerOpportunity": {
        const { customerId, budget, owner, projectId, temperature } = payload;
        const { data: dbOpportunity, error: oErr } = await supabase
          .from("opportunities")
          .insert({
            customer_id: customerId,
            project_id: projectId && projectId !== "none" ? projectId : null,
            budget,
            stage: owner && owner !== "Unassigned" ? "assigned" : "new",
            temperature: temperature || "warm",
            owner,
          })
          .select()
          .single();
        if (oErr) return res.status(400).json({ error: oErr.message });

        await supabase
          .from("customers")
          .update({ activeOpportunityId: dbOpportunity.id })
          .eq("id", customerId);
        await publishEvent("OPPORTUNITY_CREATED", customerId, { budget, owner }, actorName);
        return res.status(200).json(dbOpportunity);
      }
      case "uploadProjectFile": {
        const { fileData, fileName, mimeType, projectId } = payload;
        if (!fileData || !fileName) {
          return res.status(400).json({ error: "Missing fileData or fileName" });
        }

        // Ensure the storage bucket exists (public)
        const { data: buckets } = await supabase.storage.listBuckets();
        const bucketExists = (buckets || []).some((b: any) => b.name === "project-files");
        if (!bucketExists) {
          const { error: bucketErr } = await supabase.storage.createBucket("project-files", {
            public: true,
            fileSizeLimit: 52428800, // 50 MB
          });
          if (bucketErr && !bucketErr.message.includes("already exists")) {
            return res
              .status(400)
              .json({ error: "Failed to create storage bucket: " + bucketErr.message });
          }
        }

        // Convert base64 → Buffer
        const base64Clean = fileData.replace(/^data:[^;]+;base64,/, "");
        const fileBuffer = Buffer.from(base64Clean, "base64");

        // Generate unique storage path
        const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
        const storagePath = `${projectId || "general"}/${Date.now()}_${sanitizedName}`;

        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from("project-files")
          .upload(storagePath, fileBuffer, {
            contentType: mimeType || "application/octet-stream",
            upsert: true,
          });

        if (uploadErr) {
          return res.status(400).json({ error: "Storage upload failed: " + uploadErr.message });
        }

        // Get the permanent public URL
        const { data: urlData } = supabase.storage.from("project-files").getPublicUrl(storagePath);

        await supabase.from("audit_logs").insert({
          user: actorName,
          action: "PROJECT_FILE_UPLOAD",
          old_value: "None",
          new_value: fileName,
        });

        return res.status(200).json({ url: urlData.publicUrl, path: storagePath });
      }
      case "addCalendarEvent": {
        const { event } = payload;
        const { data, error } = await supabase
          .from("calendar_events")
          .insert({
            type: event.type,
            title: event.title,
            start_time: event.start,
            end_time: event.end,
            customer_id: event.customerId || null,
            sales_person: event.salesPerson || actorName,
            details: event.details || "",
          })
          .select()
          .single();

        if (error) return res.status(400).json({ error: error.message });
        await supabase.from("audit_logs").insert({
          user: actorName,
          action: "CALENDAR_EVENT_CREATE",
          old_value: "None",
          new_value: event.title,
        });
        return res.status(200).json(data);
      }
      case "updateCalendarEvent": {
        const { id: evId, event: evUpdate } = payload;
        if (!evId) return res.status(400).json({ error: "Missing event id" });
        const { data: existing } = await supabase
          .from("calendar_events")
          .select("title")
          .eq("id", evId)
          .single();
        const { data: updated, error: upErr } = await supabase
          .from("calendar_events")
          .update({
            type: evUpdate.type,
            title: evUpdate.title,
            start_time: evUpdate.start,
            end_time: evUpdate.end,
            customer_id: evUpdate.customerId || null,
            sales_person: evUpdate.salesPerson || null,
            details: evUpdate.details || "",
          })
          .eq("id", evId)
          .select()
          .single();
        if (upErr) return res.status(400).json({ error: upErr.message });
        await supabase.from("audit_logs").insert({
          user: actorName,
          action: "CALENDAR_EVENT_UPDATE",
          old_value: existing?.title || "N/A",
          new_value: evUpdate.title,
        });
        return res.status(200).json(updated);
      }
      case "deleteCalendarEvent": {
        const { id: delId } = payload;
        if (!delId) return res.status(400).json({ error: "Missing event id" });
        const { data: toDelete } = await supabase
          .from("calendar_events")
          .select("title")
          .eq("id", delId)
          .single();
        const { error: delErr } = await supabase.from("calendar_events").delete().eq("id", delId);
        if (delErr) return res.status(400).json({ error: delErr.message });
        await supabase.from("audit_logs").insert({
          user: actorName,
          action: "CALENDAR_EVENT_DELETE",
          old_value: toDelete?.title || "N/A",
          new_value: "Deleted",
        });
        return res.status(200).json({ success: true });
      }
      case "deleteOpportunity": {
        const { id: delId } = payload;
        if (!delId) return res.status(400).json({ error: "Missing opportunity id" });
        const { data: toDelete } = await supabase
          .from("opportunities")
          .select("customer_id, budget, stage")
          .eq("id", delId)
          .single();

        if (toDelete?.stage === "converted") {
          return res.status(400).json({ error: "Converted opportunities cannot be deleted." });
        }

        // Safe pointer cleanup: check if deleted opportunity was active
        if (toDelete?.customer_id) {
          const { data: customer } = await supabase
            .from("customers")
            .select("activeOpportunityId")
            .eq("id", toDelete.customer_id)
            .single();

          if (customer?.activeOpportunityId === delId) {
            const { data: otherOpps } = await supabase
              .from("opportunities")
              .select("id")
              .eq("customer_id", toDelete.customer_id)
              .neq("id", delId)
              .limit(1);

            const nextActiveId = otherOpps && otherOpps.length > 0 ? otherOpps[0].id : null;
            await supabase
              .from("customers")
              .update({ activeOpportunityId: nextActiveId })
              .eq("id", toDelete.customer_id);
          }
        }

        const { error: delErr } = await supabase.from("opportunities").delete().eq("id", delId);
        if (delErr) return res.status(400).json({ error: delErr.message });
        await supabase.from("audit_logs").insert({
          user: actorName,
          action: "OPPORTUNITY_DELETE",
          old_value: toDelete ? `Stage: ${toDelete.stage}, Budget: ${toDelete.budget}` : "N/A",
          new_value: "Deleted",
        });
        return res.status(200).json({ success: true });
      }
      case "addWorkflowRule": {
        const { rule } = payload;
        const { data, error } = await supabase
          .from("workflow_rules")
          .insert({
            name: rule.name,
            event: rule.event,
            conditions: rule.conditions,
            actions: rule.actions,
            is_active: rule.isActive ?? true,
          })
          .select()
          .single();

        if (error) return res.status(400).json({ error: error.message });
        await supabase.from("audit_logs").insert({
          user: actorName,
          action: "WORKFLOW_RULE_CREATE",
          old_value: "None",
          new_value: rule.name,
        });
        return res.status(200).json(data);
      }
      case "toggleWorkflowRule": {
        const { id, isActive } = payload;
        await supabase.from("workflow_rules").update({ is_active: isActive }).eq("id", id);
        return res.status(200).json({ success: true });
      }
      case "saveCompanySettings": {
        const { updates } = payload;
        const { data: check } = await supabase
          .from("settings")
          .select("id")
          .eq("id", 1)
          .maybeSingle();
        if (check) {
          await supabase.from("settings").update(updates).eq("id", 1);
        } else {
          await supabase.from("settings").insert({ id: 1, ...updates });
        }
        return res.status(200).json({ success: true });
      }
      case "addCRMUser": {
        const { user } = payload;
        const { data, error } = await supabase.auth.admin.createUser({
          email: user.email,
          password: user.password || "password123",
          email_confirm: true,
          user_metadata: {
            full_name: user.name,
            role: user.role,
          },
        });
        if (error) return res.status(400).json({ error: error.message });
        await supabase.from("audit_logs").insert({
          user: actorName,
          action: "CREATE_USER",
          old_value: "None",
          new_value: `${user.name} (${user.role})`,
        });
        return res.status(200).json({
          id: data.user?.id,
          name: user.name,
          email: user.email,
          role: user.role,
        });
      }
      case "updateCRMUserRole": {
        const { id, role } = payload;
        const { data, error } = await supabase.auth.admin.updateUserById(id, {
          user_metadata: { role },
        });
        if (error) return res.status(400).json({ error: error.message });
        await supabase.from("audit_logs").insert({
          user: actorName,
          action: "UPDATE_USER_ROLE",
          old_value: "Unknown",
          new_value: `${id} to ${role}`,
        });
        return res.status(200).json({ success: true });
      }
      case "resetCRMUserPassword": {
        const { id, password } = payload;
        const { error } = await supabase.auth.admin.updateUserById(id, {
          password: password,
        });
        if (error) return res.status(400).json({ error: error.message });
        await supabase.from("audit_logs").insert({
          user: actorName,
          action: "RESET_USER_PASSWORD",
          old_value: id,
          new_value: "Password reset completed",
        });
        return res.status(200).json({ success: true });
      }
      case "deleteCRMUser": {
        if (actorRole !== "super_admin") {
          return res.status(403).json({ error: "Only Super Admins can delete users." });
        }
        const { id } = payload;
        const { error } = await supabase.auth.admin.deleteUser(id);
        if (error) return res.status(400).json({ error: error.message });
        return res.status(200).json({ success: true });
      }
      case "markNotificationRead": {
        const { id } = payload;
        await supabase.from("notifications").update({ read: true }).eq("id", id);
        return res.status(200).json({ success: true });
      }
      case "markAllNotificationsRead": {
        await supabase.from("notifications").update({ read: true }).neq("id", "");
        return res.status(200).json({ success: true });
      }
      case "deleteNotification": {
        const { id } = payload;
        await supabase.from("notifications").delete().eq("id", id);
        return res.status(200).json({ success: true });
      }
      case "addAuditLog": {
        const { action, oldVal, newVal } = payload;
        await supabase.from("audit_logs").insert({
          user: actorName,
          action,
          timestamp: new Date().toISOString(),
          old_value: oldVal,
          new_value: newVal,
        });
        return res.status(200).json({ success: true });
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
