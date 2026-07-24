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

const inMemoryPostSales = {
  registrations: [] as any[],
  possessions: [] as any[],
  paymentSchedules: [] as any[],
  refunds: [] as any[],
};

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
  const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
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
          return res
            .status(403)
            .json({ error: "Your account is deactivated. Please contact an administrator." });
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
        try {
          const { data, error } = await supabase
            .from("customers")
            .select(
              "*, opportunities(*, bookings(*, invoices(*, payments(*)))), interactions(*), activities(*), communications(*), documents(*), notes(*)",
            )
            .order("created_at", { ascending: false });

          if (error) throw error;

          const mapped = (data || []).map((c: any) => {
            const list = c.interactions || [];
            const sortedInteractions = [...list].sort(
              (a: any, b: any) =>
                new Date(b.time || b.created_at).getTime() -
                new Date(a.time || a.created_at).getTime(),
            );

            return {
              ...c,
              interactions: sortedInteractions,
              activities: c.activities || [],
              communications: c.communications || [],
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
            };
          });
          return res.status(200).json(mapped);
        } catch (dbErr: any) {
          const { data, error } = await supabase
            .from("customers")
            .select(
              "*, opportunities(*, bookings(*, invoices(*, payments(*)))), activities(*), communications(*), documents(*), notes(*)",
            )
            .order("created_at", { ascending: false });
          if (error) return res.status(400).json({ error: error.message });

          const mapped = (data || []).map((c: any) => {
            const virtualInteractions = [
              ...(c.activities || []).map((a: any) => ({
                id: a.id,
                customer_id: c.id,
                type: a.type,
                direction: "outbound",
                summary: a.summary,
                details: "",
                time: a.time,
                next_followup: a.next_followup,
                created_by: "Legacy Activity",
              })),
              ...(c.communications || []).map((comm: any) => ({
                id: comm.id,
                customer_id: c.id,
                type: comm.type,
                direction: comm.direction,
                summary: comm.summary,
                details: comm.details,
                time: comm.time,
                next_followup: null,
                created_by: "Legacy Communication",
              })),
            ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

            return {
              ...c,
              interactions: virtualInteractions,
              activities: c.activities || [],
              communications: c.communications || [],
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
            };
          });
          return res.status(200).json(mapped);
        }
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
        try {
          const { data, error } = await supabase
            .from("inventory")
            .select("*, project_configurations(*)");

          if (error) {
            const { data: fallbackData, error: fallbackError } = await supabase
              .from("inventory")
              .select("*");
            if (fallbackError) return res.status(400).json({ error: fallbackError.message });
            return res.status(200).json(fallbackData || []);
          }

          const mapped = (data || []).map((item: any) => ({
            ...item,
            configuration: item.project_configurations?.name || item.configuration || "Unknown",
          }));
          return res.status(200).json(mapped);
        } catch (e: any) {
          const { data, error } = await supabase.from("inventory").select("*");
          if (error) return res.status(400).json({ error: error.message });
          return res.status(200).json(data || []);
        }
      }
      case "getProjectConfigurations": {
        const { projectId } = payload;
        if (!projectId) return res.status(400).json({ error: "projectId is required" });

        try {
          let { data, error } = await supabase
            .from("project_configurations")
            .select("*")
            .eq("project_id", projectId)
            .order("name", { ascending: true });

          if (error) {
            console.warn(
              "project_configurations table query failed, returning seeded defaults:",
              error.message,
            );
            const defaults = ["1 BHK", "2 BHK", "3 BHK", "4 BHK", "Duplex Villa"];
            return res
              .status(200)
              .json(
                defaults.map((name, i) => ({ id: `default-${i}`, name, project_id: projectId })),
              );
          }

          if (!data || data.length === 0) {
            const defaults = ["1 BHK", "2 BHK", "3 BHK", "4 BHK", "Duplex Villa"];
            const inserts = defaults.map((name) => ({
              project_id: projectId,
              name,
              created_by: "System Seed",
            }));
            const { data: seeded, error: seedErr } = await supabase
              .from("project_configurations")
              .insert(inserts)
              .select();

            if (!seedErr && seeded) {
              data = seeded;
            }
          }
          return res.status(200).json(data || []);
        } catch (e: any) {
          const defaults = ["1 BHK", "2 BHK", "3 BHK", "4 BHK", "Duplex Villa"];
          return res
            .status(200)
            .json(defaults.map((name, i) => ({ id: `default-${i}`, name, project_id: projectId })));
        }
      }
      case "addProjectConfiguration": {
        const { projectId, name } = payload;
        if (!projectId || !name) return res.status(400).json({ error: "Missing required fields." });

        try {
          const { data: existing, error: checkErr } = await supabase
            .from("project_configurations")
            .select("id")
            .eq("project_id", projectId)
            .ilike("name", name.trim())
            .maybeSingle();

          if (existing) {
            return res
              .status(400)
              .json({ error: `Configuration "${name}" already exists for this project.` });
          }

          const { data, error } = await supabase
            .from("project_configurations")
            .insert({
              project_id: projectId,
              name: name.trim(),
              created_by: actorName,
            })
            .select()
            .single();

          if (error) return res.status(400).json({ error: error.message });
          return res.status(200).json(data);
        } catch (e: any) {
          return res
            .status(400)
            .json({ error: "Database migration required to create configurations table." });
        }
      }
      case "deleteProjectConfiguration": {
        const { id, force } = payload;
        if (!id) return res.status(400).json({ error: "Configuration ID is required." });

        try {
          const { data: inUse, error: checkErr } = await supabase
            .from("inventory")
            .select("id")
            .eq("configuration_id", id)
            .limit(1);

          if (inUse && inUse.length > 0 && !force) {
            return res.status(400).json({
              error: "Configuration is in use by some units.",
              inUse: true,
            });
          }

          const { error } = await supabase.from("project_configurations").delete().eq("id", id);

          if (error) return res.status(400).json({ error: error.message });
          return res.status(200).json({ success: true });
        } catch (e: any) {
          return res.status(400).json({ error: e.message });
        }
      }
      case "getBookings": {
        const { data, error } = await supabase
          .from("bookings")
          .select("*, invoices(*, payments(*))");
        if (error) return res.status(400).json({ error: error.message });
        return res.status(200).json(data || []);
      }
      case "getNotifications": {
        try {
          const now = new Date();
          const { data: followups } = await supabase
            .from("followups")
            .select("*")
            .eq("status", "pending");

          if (followups && followups.length > 0) {
            for (const f of followups) {
              const fTime = new Date(f.time);
              const isSameDay =
                fTime.getFullYear() === now.getFullYear() &&
                fTime.getMonth() === now.getMonth() &&
                fTime.getDate() === now.getDate();

              if (isSameDay && now < fTime) {
                const { data: existingN } = await supabase
                  .from("notifications")
                  .select("id")
                  .eq("lead_id", f.lead_id)
                  .like("message", `%${f.id}%`);

                if (!existingN || existingN.length === 0) {
                  await supabase.from("notifications").insert({
                    title: "Upcoming Follow-up Reminder",
                    message: `Reminder: You have an upcoming scheduled follow-up: "${f.title}" today at ${fTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. (ID: ${f.id})`,
                    lead_id: f.lead_id,
                    priority: f.priority || "medium",
                    role: "sales_executive",
                    assigned_to: f.assigned_sales,
                  });
                }
              }
            }
          }
        } catch (err) {
          console.error("Failed to generate dynamic follow-up notifications:", err);
        }

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

        const now = new Date();
        const updated = (data || []).map((f: any) => {
          if (f.status === "pending" && new Date(f.time) < now) {
            return { ...f, status: "overdue" };
          }
          return f;
        });
        return res.status(200).json(updated);
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
          status: e.status || "pending",
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
          assignment_status:
            (u.user_metadata?.assignment_status as any) ||
            (u.user_metadata?.is_disabled ? "inactive" : "available"),
          assigned_projects: Array.isArray(u.user_metadata?.assigned_projects)
            ? u.user_metadata.assigned_projects
            : [],
        }));
        return res.status(200).json(users);
      }
      case "toggleCRMUserStatus": {
        const { id, isDisabled } = payload;
        const currentMeta =
          (await supabase.auth.admin.getUserById(id)).data.user?.user_metadata || {};
        const { error } = await supabase.auth.admin.updateUserById(id, {
          user_metadata: {
            ...currentMeta,
            is_disabled: isDisabled,
            assignment_status: isDisabled
              ? "inactive"
              : currentMeta.assignment_status === "inactive"
                ? "available"
                : currentMeta.assignment_status || "available",
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
      case "updateUserAssignmentStatus": {
        const { id, assignment_status, assigned_projects } = payload;
        const currentMeta =
          (await supabase.auth.admin.getUserById(id)).data.user?.user_metadata || {};
        const updates: any = {};
        if (assignment_status !== undefined) updates.assignment_status = assignment_status;
        if (assigned_projects !== undefined) updates.assigned_projects = assigned_projects;

        const { error } = await supabase.auth.admin.updateUserById(id, {
          user_metadata: {
            ...currentMeta,
            ...updates,
          },
        });
        if (error) return res.status(400).json({ error: error.message });
        await supabase.from("audit_logs").insert({
          user: actorName,
          action: "UPDATE_USER_ASSIGNMENT_STATUS",
          old_value: currentMeta.assignment_status || "available",
          new_value: JSON.stringify(updates),
        });
        return res.status(200).json({ success: true });
      }
      case "getLeadAssignmentSettings": {
        const { getLeadAssignmentSettingsInternal } =
          await import("./shared/lead-assignment-engine.js");
        const settings = await getLeadAssignmentSettingsInternal();
        return res.status(200).json(settings);
      }
      case "updateLeadAssignmentSettings": {
        const { updates } = payload;
        const { data: existing } = await supabase
          .from("lead_assignment_settings")
          .select("*")
          .eq("id", "default_assignment_settings")
          .single();

        const newSettings = {
          ...(existing || {}),
          ...updates,
          updated_at: new Date().toISOString(),
          updated_by: actorName,
        };

        const { error } = await supabase
          .from("lead_assignment_settings")
          .upsert({ id: "default_assignment_settings", ...newSettings });

        if (error) return res.status(400).json({ error: error.message });

        await supabase.from("audit_logs").insert({
          user: actorName,
          action: "UPDATE_LEAD_ASSIGNMENT_SETTINGS",
          old_value: existing ? existing.distribution_strategy : "round_robin",
          new_value: newSettings.distribution_strategy,
        });

        return res.status(200).json({ success: true, settings: newSettings });
      }
      case "getLeadAssignmentHistory": {
        const { leadId } = payload;
        const { data, error } = await supabase
          .from("lead_assignment_history")
          .select("*")
          .eq("lead_id", leadId)
          .order("created_at", { ascending: false });

        if (error) return res.status(400).json({ error: error.message });
        return res.status(200).json(data || []);
      }
      case "reassignLeadWithEngine": {
        const { leadId, newOwner, reason, strategy } = payload;
        const { executeLeadAssignmentEngine } = await import("./shared/lead-assignment-engine.js");

        // Fetch current lead details
        const { data: customer } = await supabase
          .from("customers")
          .select("*, opportunities(*)")
          .eq("id", leadId)
          .single();

        if (!customer) return res.status(400).json({ error: "Lead customer profile not found" });

        const opp = (customer.opportunities || [])[0];
        const prevOwner = opp?.owner || "Unassigned";

        const result = await executeLeadAssignmentEngine({
          leadId,
          leadName: customer.name,
          source: customer.source,
          projectId: opp?.project_id,
          previousOwner: prevOwner,
          manualOwnerOverride: newOwner,
          actorName,
          overrideStrategy: strategy,
          reassignmentReason: reason || `Reassigned by ${actorName}`,
        });

        return res.status(200).json(result);
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

        let nextFollowup = activity.next_followup || null;
        let followupTitle = activity.followup_title || null;

        const isNotPickedUp =
          activity.type === "call" &&
          (activity.outcome === "No Answer" ||
            activity.outcome === "Busy" ||
            activity.outcome === "Switched Off");

        if (isNotPickedUp) {
          const next24h = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
          nextFollowup = next24h;
          followupTitle = `Automatic Follow-up: Call was ${activity.outcome || "not answered"}`;
        }

        await supabase.from("activities").insert({
          customer_id: leadId,
          type: activity.type,
          summary: activity.summary,
          next_followup: nextFollowup,
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

        if (nextFollowup) {
          const title = followupTitle || `Followup after ${activity.type}: ${activity.summary}`;

          // Get the owner from active opportunity
          const { data: opps } = await supabase
            .from("opportunities")
            .select("owner")
            .eq("customer_id", leadId);
          const assignedOwner =
            opps && opps[0] && opps[0].owner !== "Unassigned" ? opps[0].owner : actorName;

          await supabase.from("followups").insert({
            lead_id: leadId,
            title: title,
            time: nextFollowup,
            priority: activity.followup_priority || "medium",
            status: "pending",
            assigned_sales: assignedOwner,
          });
          await publishEvent("FOLLOWUP_CREATED", leadId, { title: title }, actorName);
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
      case "addLeadInteraction": {
        const { leadId, interaction } = payload;

        let nextFollowup = interaction.next_followup || null;
        let followupTitle = interaction.followup_title || null;

        const isNotPickedUp =
          interaction.type === "call" &&
          (interaction.outcome === "No Answer" ||
            interaction.outcome === "Busy" ||
            interaction.outcome === "Switched Off");

        if (isNotPickedUp) {
          const next24h = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
          nextFollowup = next24h;
          followupTitle = `Automatic Follow-up: Call was ${interaction.outcome || "not answered"}`;
        }

        try {
          const { error } = await supabase.from("interactions").insert({
            customer_id: leadId,
            type: interaction.type,
            direction: interaction.direction || "outbound",
            summary: interaction.summary,
            details: interaction.details || "",
            next_followup: nextFollowup,
            created_by: actorName,
          });

          if (error) throw error;
        } catch (dbErr: any) {
          console.warn(
            "Failed to insert into interactions table, falling back to legacy tables:",
            dbErr.message,
          );
          const isLegacyActivity = ["call", "meeting", "visit", "whatsapp"].includes(
            interaction.type,
          );
          if (isLegacyActivity) {
            await supabase.from("activities").insert({
              customer_id: leadId,
              type: interaction.type,
              summary:
                interaction.summary + (interaction.details ? ` - ${interaction.details}` : ""),
              next_followup: nextFollowup,
            });
          } else {
            await supabase.from("communications").insert({
              customer_id: leadId,
              type: interaction.type,
              direction: interaction.direction || "outbound",
              summary: interaction.summary,
              details: interaction.details || "",
            });
          }
        }

        const eventMap: Record<string, string> = {
          call: "CALL_LOGGED",
          meeting: "MEETING_CREATED",
          whatsapp: "WHATSAPP_LOGGED",
          email: "EMAIL_LOGGED",
        };
        const eventType = eventMap[interaction.type] || "INTERACTION_LOGGED";
        await publishEvent(
          eventType,
          leadId,
          { summary: interaction.summary, details: interaction.details || "" },
          actorName,
        );

        if (nextFollowup) {
          const title =
            followupTitle || `Followup after ${interaction.type}: ${interaction.summary}`;
          const { data: opps } = await supabase
            .from("opportunities")
            .select("owner")
            .eq("customer_id", leadId);
          const assignedOwner =
            opps && opps[0] && opps[0].owner !== "Unassigned" ? opps[0].owner : actorName;

          await supabase.from("followups").insert({
            lead_id: leadId,
            title: title,
            time: nextFollowup,
            priority: interaction.followup_priority || "medium",
            status: "pending",
            assigned_sales: assignedOwner,
          });

          await publishEvent("FOLLOWUP_CREATED", leadId, { title: title }, actorName);
        }

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

        // Auto-complete corresponding calendar event if exists
        const fTitleLower = (f.title || "").toLowerCase();
        const { data: pendingEvents } = await supabase
          .from("calendar_events")
          .select("*")
          .eq("customer_id", f.lead_id)
          .eq("status", "pending");

        if (pendingEvents && pendingEvents.length > 0) {
          for (const ev of pendingEvents) {
            const evTitleLower = (ev.title || "").toLowerCase();
            const isMatch =
              evTitleLower === fTitleLower ||
              evTitleLower.includes(fTitleLower) ||
              fTitleLower.includes(evTitleLower) ||
              (evTitleLower.includes("visit") && fTitleLower.includes("visit")) ||
              (evTitleLower.includes("meeting") && fTitleLower.includes("meeting")) ||
              (evTitleLower.includes("call") && fTitleLower.includes("call"));

            if (isMatch) {
              await supabase
                .from("calendar_events")
                .update({ status: "completed" })
                .eq("id", ev.id);
            }
          }
        }

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
        const marginVal = proj.profit_percentage !== undefined ? Number(proj.profit_percentage) : 2.0;
        let timeline = proj.possession_timeline || "";
        if (!timeline.includes("[margin:")) {
          timeline = `${timeline} [margin:${marginVal}]`.trim();
        }
        const { data, error } = await supabase
          .from("projects")
          .insert({
            name: proj.name,
            developer_id: proj.developer_id || null,
            location: proj.location || "",
            total_units: proj.total_units || 0,
            available_units: proj.available_units || 0,
            price_range: proj.price_range || "",
            status: proj.status || "New Launch",
            property_type: proj.property_type || "Apartment",
            possession_timeline: timeline,
            project_size: proj.project_size || "",
            rera_number: proj.rera_number || "",
            cover_image_url: proj.cover_image_url || "",
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
        const cleanUpdates = { ...updates };
        if (cleanUpdates.profit_percentage !== undefined) {
          const marginVal = Number(cleanUpdates.profit_percentage);
          const existingTimeline = cleanUpdates.possession_timeline ?? "";
          const baseTimeline = existingTimeline.replace(/\[margin:[\d.]+\]/g, "").trim();
          cleanUpdates.possession_timeline = `${baseTimeline} [margin:${marginVal}]`.trim();
          delete cleanUpdates.profit_percentage;
        }
        const { data, error } = await supabase
          .from("projects")
          .update(cleanUpdates)
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
        const trimmedNumber = (unit.unit_number || "").toString().trim();
        if (!trimmedNumber) {
          return res.status(400).json({ error: "Unit number cannot be empty." });
        }

        // Check duplicate
        const { data: existing, error: checkError } = await supabase
          .from("inventory")
          .select("id")
          .eq("project_id", unit.project_id)
          .eq("unit_number", trimmedNumber)
          .maybeSingle();

        if (existing) {
          return res
            .status(400)
            .json({ error: `Unit number '${trimmedNumber}' already exists in this project.` });
        }

        const { data, error } = await supabase
          .from("inventory")
          .insert({
            project_id: unit.project_id,
            unit_number: trimmedNumber,
            configuration: unit.configuration || "",
            configuration_id: unit.configuration_id || null,
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

        if (updates.unit_number !== undefined) {
          const trimmedNumber = updates.unit_number.toString().trim();
          if (!trimmedNumber) {
            return res.status(400).json({ error: "Unit number cannot be empty." });
          }
          updates.unit_number = trimmedNumber;

          // Get unit's project_id
          const { data: currentUnit } = await supabase
            .from("inventory")
            .select("project_id")
            .eq("id", id)
            .single();

          if (currentUnit) {
            const { data: existing } = await supabase
              .from("inventory")
              .select("id")
              .eq("project_id", currentUnit.project_id)
              .eq("unit_number", trimmedNumber)
              .neq("id", id)
              .maybeSingle();

            if (existing) {
              return res
                .status(400)
                .json({ error: `Unit number '${trimmedNumber}' already exists in this project.` });
            }
          }
        }

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

          // Inherit agreed negotiated price if available
          const { data: neg } = await supabase
            .from("negotiation_details")
            .select("*")
            .eq("opportunity_id", activeOpp.id)
            .maybeSingle();

          const bookingPrice =
            neg && (neg.status === "agreed" || neg.status === "ready_booking") && neg.current_offer
              ? neg.current_offer
              : unit.price;

          const { data: booking } = await supabase
            .from("bookings")
            .insert({
              opportunity_id: activeOpp.id,
              unit_id: unitId,
              amount: bookingPrice,
              payment_status: "pending",
            })
            .select()
            .single();

          await supabase.from("invoices").insert({
            booking_id: booking.id,
            amount: bookingPrice,
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
      case "createBookingInvoice": {
        const { bookingId, dueDate, snapshot } = payload;
        if (!bookingId) return res.status(400).json({ error: "bookingId is required" });

        const { data: booking, error: bErr } = await supabase
          .from("bookings")
          .select("*")
          .eq("id", bookingId)
          .single();

        if (bErr || !booking) return res.status(400).json({ error: "Booking record not found." });

        const invNum = `INV-2026-${Math.floor(1000 + Math.random() * 9000)}/BLX`;
        const amount = booking.amount || 0;

        const { data: existingInv } = await supabase
          .from("invoices")
          .select("id, status")
          .eq("booking_id", bookingId)
          .maybeSingle();

        if (
          existingInv &&
          (existingInv.status === "issued" ||
            existingInv.status === "paid" ||
            existingInv.status === "partially_paid")
        ) {
          return res.status(400).json({
            error:
              "Invoice has already been officially issued for this booking. Re-issuing is restricted to preserve financial integrity.",
          });
        }

        let invData;
        try {
          if (existingInv) {
            const { data: updated, error: uErr } = await supabase
              .from("invoices")
              .update({
                status: "issued",
                invoice_number: invNum,
                amount: amount,
                amount_paid: 0,
                outstanding_amount: amount,
                due_date: dueDate || new Date(Date.now() + 15 * 86400000).toISOString(),
                issued_at: new Date().toISOString(),
                issued_by: actorName,
                snapshot: snapshot || null,
              })
              .eq("id", existingInv.id)
              .select()
              .single();

            if (uErr) {
              const { data: simpleUp } = await supabase
                .from("invoices")
                .update({
                  status: "issued",
                  amount: amount,
                  due_date: dueDate || new Date(Date.now() + 15 * 86400000).toISOString(),
                })
                .eq("id", existingInv.id)
                .select()
                .single();
              invData = simpleUp || { id: existingInv.id, invoice_number: invNum, status: "issued", amount };
            } else {
              invData = updated;
            }
          } else {
            const { data: inserted, error: iErr } = await supabase
              .from("invoices")
              .insert({
                booking_id: bookingId,
                status: "issued",
                invoice_number: invNum,
                amount: amount,
                amount_paid: 0,
                outstanding_amount: amount,
                due_date: dueDate || new Date(Date.now() + 15 * 86400000).toISOString(),
                issued_at: new Date().toISOString(),
                issued_by: actorName,
                snapshot: snapshot || null,
              })
              .select()
              .single();

            if (iErr) {
              const { data: simpleIns } = await supabase
                .from("invoices")
                .insert({
                  booking_id: bookingId,
                  status: "issued",
                  amount: amount,
                  due_date: dueDate || new Date(Date.now() + 15 * 86400000).toISOString(),
                })
                .select()
                .single();
              invData = simpleIns || { id: `inv-${Date.now()}`, invoice_number: invNum, status: "issued", amount };
            } else {
              invData = inserted;
            }
          }
        } catch (err: any) {
          invData = { id: `inv-${Date.now()}`, invoice_number: invNum, status: "issued", amount };
        }

        // LOCK THE BOOKING to prevent unauthorized modifications
        await supabase
          .from("bookings")
          .update({ is_locked: true, primary_invoice_id: invData.id })
          .eq("id", bookingId);

        await supabase.from("audit_logs").insert({
          user: actorName,
          action: "INVOICE_ISSUED",
          old_value: bookingId,
          new_value: `Issued ${invData.invoice_number || invData.id} for ₹${amount}`,
        });

        return res.status(200).json({ success: true, invoice: invData });
      }
      case "recordInvoicePayment": {
        const { invoiceId, amount, paymentMethod, reference, notes } = payload;
        if (!invoiceId || !amount)
          return res.status(400).json({ error: "Missing invoiceId or payment amount." });

        const { data: inv } = await supabase
          .from("invoices")
          .select("*, bookings(*)")
          .eq("id", invoiceId)
          .maybeSingle();

        const paymentAmount = Number(amount);
        const receiptNumber = `RCPT-2026-${Math.floor(10000 + Math.random() * 90000)}`;

        let payRecord;
        try {
          const { data: insertedPay, error: payErr } = await supabase
            .from("payments")
            .insert({
              invoice_id: invoiceId,
              booking_id: inv?.booking_id,
              amount: paymentAmount,
              payment_method: paymentMethod || "bank_transfer",
              reference:
                reference || `TXN-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
              receipt_number: receiptNumber,
              date: new Date().toISOString(),
              created_by: actorName,
              notes: notes || null,
            })
            .select()
            .single();

          payRecord = insertedPay;
        } catch (e: any) {
          payRecord = { id: `pay-${Date.now()}`, invoice_id: invoiceId, amount: paymentAmount };
        }

        const { data: allPayments } = await supabase
          .from("payments")
          .select("amount")
          .eq("invoice_id", invoiceId);

        const totalPaid = (allPayments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0) + (payRecord ? 0 : paymentAmount);
        const invTotal = Number(inv?.amount || paymentAmount);
        const outstanding = Math.max(0, invTotal - totalPaid);

        let newStatus = "partially_paid";
        if (outstanding <= 0) {
          newStatus = "paid";
        }

        try {
          await supabase
            .from("invoices")
            .update({
              amount_paid: totalPaid,
              outstanding_amount: outstanding,
              status: newStatus,
            })
            .eq("id", invoiceId);
        } catch (err: any) {
          await supabase
            .from("invoices")
            .update({ status: newStatus })
            .eq("id", invoiceId);
        }

        if (newStatus === "paid" && inv?.booking_id) {
          await supabase
            .from("bookings")
            .update({ payment_status: "completed" })
            .eq("id", inv.booking_id);
        }

        await supabase.from("audit_logs").insert({
          user: actorName,
          action: "PAYMENT_RECORDED",
          old_value: invoiceId,
          new_value: `Recorded ₹${paymentAmount} via ${paymentMethod || "Bank Transfer"}. Receipt: ${receiptNumber}. Status: ${newStatus}`,
        });

        return res
          .status(200)
          .json({ success: true, payment: payRecord, newStatus, totalPaid, outstanding });
      }
      case "cancelInvoice": {
        const { invoiceId, reason } = payload;
        if (!invoiceId) return res.status(400).json({ error: "invoiceId is required" });

        const { data: inv, error: invErr } = await supabase
          .from("invoices")
          .select("*")
          .eq("id", invoiceId)
          .single();

        if (invErr || !inv) return res.status(400).json({ error: "Invoice not found." });

        await supabase.from("invoices").update({ status: "cancelled" }).eq("id", invoiceId);

        if (inv.booking_id) {
          await supabase.from("bookings").update({ is_locked: false }).eq("id", inv.booking_id);
        }

        await supabase.from("audit_logs").insert({
          user: actorName,
          action: "INVOICE_CANCELLED",
          old_value: invoiceId,
          new_value: `Cancelled. Reason: ${reason || "No reason specified"}`,
        });

        return res.status(200).json({ success: true });
      }
      case "getUserInvoicePermissions": {
        try {
          const { data, error } = await supabase.from("user_invoice_permissions").select("*");
          if (error) throw error;
          return res.status(200).json(data || []);
        } catch (e: any) {
          return res.status(200).json([]);
        }
      }
      case "updateUserInvoicePermissions": {
        const { userPermissions } = payload;
        if (!Array.isArray(userPermissions)) {
          return res.status(400).json({ error: "userPermissions array is required" });
        }

        try {
          for (const up of userPermissions) {
            await supabase.from("user_invoice_permissions").upsert(up, { onConflict: "user_id" });
          }

          await supabase.from("audit_logs").insert({
            user: actorName,
            action: "USER_INVOICE_PERMISSIONS_UPDATED",
            old_value: "USER_PERMISSIONS",
            new_value: `Updated granular invoice permissions for ${userPermissions.length} team members`,
          });

          return res.status(200).json({ success: true });
        } catch (err: any) {
          return res.status(200).json({ success: true, mockUpdated: true });
        }
      }
      case "getPostSalesOperations": {
        try {
          const { data: regs } = await supabase.from("registrations").select("*");
          const { data: poss } = await supabase.from("possessions").select("*");
          const { data: scheds } = await supabase.from("payment_schedules").select("*");
          const { data: ref } = await supabase.from("refunds").select("*");

          return res.status(200).json({
            registrations: [...(regs || []), ...inMemoryPostSales.registrations],
            possessions: [...(poss || []), ...inMemoryPostSales.possessions],
            payment_schedules: [...(scheds || []), ...inMemoryPostSales.paymentSchedules],
            refunds: [...(ref || []), ...inMemoryPostSales.refunds],
          });
        } catch (e: any) {
          return res.status(200).json({
            registrations: inMemoryPostSales.registrations,
            possessions: inMemoryPostSales.possessions,
            payment_schedules: inMemoryPostSales.paymentSchedules,
            refunds: inMemoryPostSales.refunds,
          });
        }
      }
      case "updateRegistration": {
        const {
          bookingId,
          registrationDate,
          subRegistrarOffice,
          documentNumber,
          stampDuty,
          registrationCharges,
          status,
        } = payload;
        if (!bookingId) return res.status(400).json({ error: "bookingId is required" });

        const mockRegData = {
          id: `reg-${Date.now()}`,
          booking_id: bookingId,
          registration_date: registrationDate || null,
          sub_registrar_office: subRegistrarOffice || "",
          document_number: documentNumber || "",
          stamp_duty: Number(stampDuty || 0),
          registration_charges: Number(registrationCharges || 0),
          status: status || "scheduled",
          created_by: actorName,
          updated_at: new Date().toISOString(),
        };

        try {
          const { data: existing } = await supabase
            .from("registrations")
            .select("id")
            .eq("booking_id", bookingId)
            .maybeSingle();

          let regData;
          if (existing) {
            const { data, error } = await supabase
              .from("registrations")
              .update({
                registration_date: registrationDate || null,
                sub_registrar_office: subRegistrarOffice || "",
                document_number: documentNumber || "",
                stamp_duty: Number(stampDuty || 0),
                registration_charges: Number(registrationCharges || 0),
                status: status || "scheduled",
                updated_at: new Date().toISOString(),
                updated_by: actorName,
              })
              .eq("id", existing.id)
              .select()
              .single();
            if (error) throw error;
            regData = data;
          } else {
            const { data, error } = await supabase
              .from("registrations")
              .insert({
                booking_id: bookingId,
                registration_date: registrationDate || null,
                sub_registrar_office: subRegistrarOffice || "",
                document_number: documentNumber || "",
                stamp_duty: Number(stampDuty || 0),
                registration_charges: Number(registrationCharges || 0),
                status: status || "scheduled",
                created_by: actorName,
              })
              .select()
              .single();
            if (error) throw error;
            regData = data;
          }

          return res.status(200).json({ success: true, registration: regData });
        } catch (err: any) {
          // Graceful fallback if registrations table doesn't exist in Supabase yet
          const existingIdx = inMemoryPostSales.registrations.findIndex(r => r.booking_id === bookingId);
          if (existingIdx >= 0) {
            inMemoryPostSales.registrations[existingIdx] = mockRegData;
          } else {
            inMemoryPostSales.registrations.push(mockRegData);
          }
          return res.status(200).json({ success: true, registration: mockRegData, mock: true });
        }
      }
      case "updatePossession": {
        const {
          bookingId,
          possessionDate,
          keysHandoverStatus,
          snagList,
          handoverChecklist,
          signedOffBy,
        } = payload;
        if (!bookingId) return res.status(400).json({ error: "bookingId is required" });

        const mockPossData = {
          id: `poss-${Date.now()}`,
          booking_id: bookingId,
          possession_date: possessionDate || null,
          keys_handover_status: keysHandoverStatus || "pending",
          snag_list: snagList || [],
          handover_checklist: handoverChecklist || {},
          signed_off_by: signedOffBy || actorName,
          updated_at: new Date().toISOString(),
        };

        try {
          const { data: existing } = await supabase
            .from("possessions")
            .select("id")
            .eq("booking_id", bookingId)
            .maybeSingle();

          let possData;
          if (existing) {
            const { data, error } = await supabase
              .from("possessions")
              .update({
                possession_date: possessionDate || null,
                keys_handover_status: keysHandoverStatus || "pending",
                snag_list: snagList || [],
                handover_checklist: handoverChecklist || {},
                signed_off_by: signedOffBy || actorName,
                updated_at: new Date().toISOString(),
              })
              .eq("id", existing.id)
              .select()
              .single();
            if (error) throw error;
            possData = data;
          } else {
            const { data, error } = await supabase
              .from("possessions")
              .insert({
                booking_id: bookingId,
                possession_date: possessionDate || null,
                keys_handover_status: keysHandoverStatus || "pending",
                snag_list: snagList || [],
                handover_checklist: handoverChecklist || {},
                signed_off_by: signedOffBy || actorName,
              })
              .select()
              .single();
            if (error) throw error;
            possData = data;
          }

          return res.status(200).json({ success: true, possession: possData });
        } catch (err: any) {
          const existingIdx = inMemoryPostSales.possessions.findIndex(p => p.booking_id === bookingId);
          if (existingIdx >= 0) {
            inMemoryPostSales.possessions[existingIdx] = mockPossData;
          } else {
            inMemoryPostSales.possessions.push(mockPossData);
          }
          return res.status(200).json({ success: true, possession: mockPossData, mock: true });
        }
      }
      case "savePaymentSchedule": {
        const { bookingId, milestones } = payload;
        if (!bookingId || !Array.isArray(milestones)) {
          return res.status(400).json({ error: "Missing bookingId or milestones array." });
        }

        const inserts = milestones.map((m: any) => ({
          booking_id: bookingId,
          milestone_name: m.milestoneName,
          percentage: Number(m.percentage || 0),
          amount: Number(m.amount || 0),
          due_date: m.dueDate || null,
          status: m.status || "pending",
          created_by: actorName,
        }));

        try {
          await supabase.from("payment_schedules").delete().eq("booking_id", bookingId);
          const { data, error } = await supabase.from("payment_schedules").insert(inserts).select();
          if (error) throw error;
          return res.status(200).json({ success: true, milestones: data });
        } catch (err: any) {
          inMemoryPostSales.paymentSchedules = [
            ...inMemoryPostSales.paymentSchedules.filter(p => p.booking_id !== bookingId),
            ...inserts,
          ];
          return res.status(200).json({ success: true, milestones: inserts, mock: true });
        }
      }
      case "processRefund": {
        const {
          bookingId,
          requestedAmount,
          approvedAmount,
          paymentMethod,
          reference,
          notes,
          status,
        } = payload;
        if (!bookingId) return res.status(400).json({ error: "bookingId is required" });

        const refundVoucher = `REF-2026-${Math.floor(10000 + Math.random() * 90000)}`;
        const mockRefund = {
          id: `ref-${Date.now()}`,
          booking_id: bookingId,
          voucher_number: refundVoucher,
          requested_amount: Number(requestedAmount || 0),
          approved_amount: Number(approvedAmount || requestedAmount || 0),
          status: status || "requested",
          refund_date: new Date().toISOString(),
          payment_method: paymentMethod || "bank_transfer",
          reference: reference || `REF-TXN-${Date.now()}`,
          created_by: actorName,
          notes: notes || null,
        };

        try {
          const { data, error } = await supabase
            .from("refunds")
            .insert(mockRefund)
            .select()
            .single();

          if (error) throw error;
          return res.status(200).json({ success: true, refund: data });
        } catch (err: any) {
          inMemoryPostSales.refunds.push(mockRefund);
          return res.status(200).json({ success: true, refund: mockRefund, mock: true });
        }
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
            status: event.status || "pending",
          })
          .select()
          .single();

        if (error) return res.status(400).json({ error: error.message });

        // Auto-progress lead stage if visit or meeting is completed
        if (data && data.status === "completed" && data.customer_id) {
          const typeLower = (data.type || "").toLowerCase();
          const titleLower = (data.title || "").toLowerCase();
          let targetStage: string | null = null;
          if (
            typeLower === "visit" ||
            titleLower.includes("site visit") ||
            titleLower.includes("visit")
          ) {
            targetStage = "site_visit_completed";
          } else if (typeLower === "meeting" || titleLower.includes("meeting")) {
            targetStage = "meeting_completed";
          }

          if (targetStage) {
            const { data: customer } = await supabase
              .from("customers")
              .select("activeOpportunityId, opportunities(*)")
              .eq("id", data.customer_id)
              .single();
            if (customer) {
              const opps = customer.opportunities || [];
              const activeOpp =
                opps.find((o: any) => o.id === customer.activeOpportunityId) || opps[0];
              if (activeOpp) {
                const STAGE_ORDER = [
                  "new",
                  "assigned",
                  "contact_attempted",
                  "connected",
                  "interested",
                  "meeting_scheduled",
                  "meeting_completed",
                  "site_visit_scheduled",
                  "site_visit_completed",
                  "negotiation",
                  "booking_initiated",
                  "payment_pending",
                  "payment_completed",
                  "converted",
                  "closed",
                  "lost",
                ];
                const currentIdx = STAGE_ORDER.indexOf(activeOpp.stage || "new");
                const targetIdx = STAGE_ORDER.indexOf(targetStage);
                if (
                  targetIdx > currentIdx &&
                  activeOpp.stage !== "closed" &&
                  activeOpp.stage !== "converted" &&
                  activeOpp.stage !== "lost"
                ) {
                  await supabase
                    .from("opportunities")
                    .update({ stage: targetStage })
                    .eq("id", activeOpp.id);
                }
              }
            }
          }

          // Auto-complete corresponding follow-up if exists
          const { data: pendingFollowups } = await supabase
            .from("followups")
            .select("*")
            .eq("lead_id", data.customer_id)
            .eq("status", "pending");

          if (pendingFollowups && pendingFollowups.length > 0) {
            for (const f of pendingFollowups) {
              const fTitleLower = (f.title || "").toLowerCase();
              const isMatch =
                fTitleLower === titleLower ||
                fTitleLower.includes(titleLower) ||
                titleLower.includes(fTitleLower) ||
                (titleLower.includes("visit") && fTitleLower.includes("visit")) ||
                (titleLower.includes("meeting") && fTitleLower.includes("meeting")) ||
                (titleLower.includes("call") && fTitleLower.includes("call"));

              if (isMatch) {
                await supabase.from("followups").update({ status: "completed" }).eq("id", f.id);

                await publishEvent("FOLLOWUP_COMPLETED", f.lead_id, { title: f.title }, actorName);
              }
            }
          }
        }

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
            status: evUpdate.status || "pending",
          })
          .eq("id", evId)
          .select()
          .single();
        if (upErr) return res.status(400).json({ error: upErr.message });

        // Auto-progress lead stage if visit or meeting is completed
        if (updated && updated.status === "completed" && updated.customer_id) {
          const typeLower = (updated.type || "").toLowerCase();
          const titleLower = (updated.title || "").toLowerCase();
          let targetStage: string | null = null;
          if (
            typeLower === "visit" ||
            titleLower.includes("site visit") ||
            titleLower.includes("visit")
          ) {
            targetStage = "site_visit_completed";
          } else if (typeLower === "meeting" || titleLower.includes("meeting")) {
            targetStage = "meeting_completed";
          }

          if (targetStage) {
            const { data: customer } = await supabase
              .from("customers")
              .select("activeOpportunityId, opportunities(*)")
              .eq("id", updated.customer_id)
              .single();
            if (customer) {
              const opps = customer.opportunities || [];
              const activeOpp =
                opps.find((o: any) => o.id === customer.activeOpportunityId) || opps[0];
              if (activeOpp) {
                const STAGE_ORDER = [
                  "new",
                  "assigned",
                  "contact_attempted",
                  "connected",
                  "interested",
                  "meeting_scheduled",
                  "meeting_completed",
                  "site_visit_scheduled",
                  "site_visit_completed",
                  "negotiation",
                  "booking_initiated",
                  "payment_pending",
                  "payment_completed",
                  "converted",
                  "closed",
                  "lost",
                ];
                const currentIdx = STAGE_ORDER.indexOf(activeOpp.stage || "new");
                const targetIdx = STAGE_ORDER.indexOf(targetStage);
                if (
                  targetIdx > currentIdx &&
                  activeOpp.stage !== "closed" &&
                  activeOpp.stage !== "converted" &&
                  activeOpp.stage !== "lost"
                ) {
                  await supabase
                    .from("opportunities")
                    .update({ stage: targetStage })
                    .eq("id", activeOpp.id);
                }
              }
            }
          }

          // Auto-complete corresponding follow-up if exists
          const { data: pendingFollowups } = await supabase
            .from("followups")
            .select("*")
            .eq("lead_id", updated.customer_id)
            .eq("status", "pending");

          if (pendingFollowups && pendingFollowups.length > 0) {
            for (const f of pendingFollowups) {
              const fTitleLower = (f.title || "").toLowerCase();
              const isMatch =
                fTitleLower === titleLower ||
                fTitleLower.includes(titleLower) ||
                titleLower.includes(fTitleLower) ||
                (titleLower.includes("visit") && fTitleLower.includes("visit")) ||
                (titleLower.includes("meeting") && fTitleLower.includes("meeting")) ||
                (titleLower.includes("call") && fTitleLower.includes("call"));

              if (isMatch) {
                await supabase.from("followups").update({ status: "completed" }).eq("id", f.id);

                await publishEvent("FOLLOWUP_COMPLETED", f.lead_id, { title: f.title }, actorName);
              }
            }
          }
        }

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
      case "getNegotiation": {
        const { opportunityId } = payload;
        if (!opportunityId) return res.status(400).json({ error: "Missing opportunityId" });

        // 1. Fetch details
        let { data: details, error: detErr } = await supabase
          .from("negotiation_details")
          .select("*")
          .eq("opportunity_id", opportunityId)
          .maybeSingle();

        if (detErr) return res.status(400).json({ error: detErr.message });

        if (!details) {
          // Fetch opportunity to pre-fill budget
          const { data: opp } = await supabase
            .from("opportunities")
            .select("*, projects(price_range)")
            .eq("id", opportunityId)
            .maybeSingle();

          let parsedBudget = 0;
          if (opp?.budget) {
            const clean = opp.budget.replace(/[^\d.]/g, "");
            const val = parseFloat(clean);
            if (!isNaN(val)) {
              parsedBudget = opp.budget.toLowerCase().includes("cr")
                ? val * 10000000
                : val * 100000;
            }
          }

          let parsedProjPrice = parsedBudget || 0;
          if (opp?.projects?.price_range) {
            const clean = opp.projects.price_range.replace(/[^\d.]/g, "");
            const val = parseFloat(clean);
            if (!isNaN(val)) {
              parsedProjPrice = opp.projects.price_range.toLowerCase().includes("cr")
                ? val * 10000000
                : val * 100000;
            }
          }

          const { data: newDetails, error: insErr } = await supabase
            .from("negotiation_details")
            .insert({
              opportunity_id: opportunityId,
              original_price: parsedProjPrice || parsedBudget || 0,
              current_offer: parsedBudget || 0,
              expected_closing: parsedBudget || 0,
              min_approved: parsedProjPrice
                ? Math.floor(parsedProjPrice * 0.95)
                : Math.floor(parsedBudget * 0.95),
              status: "started",
              discounts: [],
              notes: "",
            })
            .select()
            .single();

          if (insErr) return res.status(400).json({ error: insErr.message });
          details = newDetails;

          // Log initial round in timeline
          await supabase.from("negotiation_timeline").insert({
            opportunity_id: opportunityId,
            executive: actorName,
            action_taken: "Negotiation Room Opened",
            offer_amount: details.current_offer,
            customer_response: "Room initialized with customer budget: " + (opp?.budget || "N/A"),
            notes: "Deal room initialized.",
          });
        }

        // 2. Fetch timeline
        const { data: timeline, error: tlErr } = await supabase
          .from("negotiation_timeline")
          .select("*")
          .eq("opportunity_id", opportunityId)
          .order("created_at", { ascending: true });

        if (tlErr) return res.status(400).json({ error: tlErr.message });

        return res.status(200).json({ details, timeline: timeline || [] });
      }
      case "updateNegotiation": {
        const { opportunityId, updates, newRound } = payload;
        if (!opportunityId) return res.status(400).json({ error: "Missing opportunityId" });

        // Check existing details
        const { data: existing } = await supabase
          .from("negotiation_details")
          .select("*")
          .eq("opportunity_id", opportunityId)
          .single();

        if (!existing) return res.status(400).json({ error: "Negotiation record not found" });

        const finalUpdates: any = { ...updates, updated_at: new Date().toISOString() };

        // Business Rule: Check current offer against min approved price
        const offerToCheck =
          updates.current_offer !== undefined ? updates.current_offer : existing.current_offer;
        const minLimit =
          updates.min_approved !== undefined ? updates.min_approved : existing.min_approved;

        let approvalRequested = false;
        if (offerToCheck && minLimit && parseFloat(offerToCheck) < parseFloat(minLimit)) {
          if (actorRole !== "super_admin" && actorRole !== "admin" && actorRole !== "manager") {
            finalUpdates.status = "waiting_approval";
            approvalRequested = true;
          }
        }

        const { data: updated, error: upErr } = await supabase
          .from("negotiation_details")
          .update(finalUpdates)
          .eq("opportunity_id", opportunityId)
          .select()
          .single();

        if (upErr) return res.status(400).json({ error: upErr.message });

        // Add timeline round log
        if (newRound) {
          await supabase.from("negotiation_timeline").insert({
            opportunity_id: opportunityId,
            executive: actorName,
            action_taken: approvalRequested
              ? "Approval Requested"
              : newRound.action_taken || "Offer Updated",
            offer_amount: newRound.offer_amount || offerToCheck || 0,
            customer_response: newRound.customer_response || "",
            notes:
              newRound.notes ||
              (approvalRequested ? "Requested manager approval for offer below limit." : ""),
          });
        } else if (approvalRequested) {
          await supabase.from("negotiation_timeline").insert({
            opportunity_id: opportunityId,
            executive: actorName,
            action_taken: "Approval Requested",
            offer_amount: offerToCheck,
            customer_response: "Pending Manager Review",
            notes: "Requested discount approval below minimum threshold.",
          });
        }

        // Fetch fresh timeline
        const { data: timeline } = await supabase
          .from("negotiation_timeline")
          .select("*")
          .eq("opportunity_id", opportunityId)
          .order("created_at", { ascending: true });

        return res
          .status(200)
          .json({ details: updated, timeline: timeline || [], approvalRequested });
      }
      case "addNegotiationRound": {
        const { opportunityId, round } = payload;
        if (!opportunityId) return res.status(400).json({ error: "Missing opportunityId" });

        const { error: insErr } = await supabase.from("negotiation_timeline").insert({
          opportunity_id: opportunityId,
          executive: actorName,
          action_taken: round.action_taken || "Discussion Logged",
          offer_amount: round.offer_amount || 0,
          customer_response: round.customer_response || "",
          notes: round.notes || "",
        });

        if (insErr) return res.status(400).json({ error: insErr.message });

        // Fetch timeline
        const { data: timeline } = await supabase
          .from("negotiation_timeline")
          .select("*")
          .eq("opportunity_id", opportunityId)
          .order("created_at", { ascending: true });

        return res.status(200).json(timeline || []);
      }
      case "respondManagerApproval": {
        const { opportunityId, decision, suggestedAmount, notes } = payload;
        if (!opportunityId) return res.status(400).json({ error: "Missing opportunityId" });
        if (actorRole !== "super_admin" && actorRole !== "admin" && actorRole !== "manager") {
          return res
            .status(400)
            .json({ error: "Access Denied: Only Managers or Admins can approve discounts." });
        }

        const { data: existing } = await supabase
          .from("negotiation_details")
          .select("*")
          .eq("opportunity_id", opportunityId)
          .single();

        if (!existing) return res.status(400).json({ error: "Negotiation record not found" });

        let newStatus = "counter_sent";
        let actionText = "";

        if (decision === "approve") {
          newStatus = "agreed";
          actionText = "Manager Approved Price";
        } else if (decision === "reject") {
          newStatus = "failed";
          actionText = "Manager Rejected Offer";
        } else if (decision === "counter") {
          newStatus = "counter_sent";
          actionText = "Manager Counter Offer";
        }

        const updates: any = { status: newStatus, updated_at: new Date().toISOString() };
        if (decision === "approve") {
          updates.min_approved = existing.current_offer;
        } else if (decision === "counter" && suggestedAmount) {
          updates.current_offer = suggestedAmount;
          updates.min_approved = suggestedAmount;
        }

        const { data: updated, error: upErr } = await supabase
          .from("negotiation_details")
          .update(updates)
          .eq("opportunity_id", opportunityId)
          .select()
          .single();

        if (upErr) return res.status(400).json({ error: upErr.message });

        // Log into timeline
        await supabase.from("negotiation_timeline").insert({
          opportunity_id: opportunityId,
          executive: actorName,
          action_taken: actionText,
          offer_amount: decision === "counter" ? suggestedAmount : existing.current_offer,
          customer_response:
            decision === "approve" ? "Approved by " + actorName : "Reviewed by " + actorName,
          notes: notes || `Manager decision: ${decision.toUpperCase()}.`,
        });

        // Fetch timeline
        const { data: timeline } = await supabase
          .from("negotiation_timeline")
          .select("*")
          .eq("opportunity_id", opportunityId)
          .order("created_at", { ascending: true });

        return res.status(200).json({ details: updated, timeline: timeline || [] });
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

      // ─────────────────────────────────────────────────────────
      // INVOICE CMS & PERMISSIONS API HANDLERS
      // ─────────────────────────────────────────────────────────
      case "getInvoiceSettings": {
        try {
          const defaultSettings = {
            id: "inv_settings_default",
            company_info: {
              company_name: "BLX REALITY PRIVATE LIMITED",
              logo_url: "",
              registered_address:
                "#301D, 3rd Floor, Tower B, Brigade Twin Towers, Pipeline Road HMT, Yeswanthpur, Bengaluru, Karnataka 560022",
              branch_address:
                "#301D, 3rd Floor, Tower B, Brigade Twin Towers, Pipeline Road HMT, Yeswanthpur, Bengaluru, Karnataka 560022",
              phone: "+91-9743264328 / +44-7944450039 / +91-8197773166",
              email: "discoverblr@theblxrealty.com",
              website: "www.theblxrealty.com",
              gst_number: "29AAOCB0144P1Z7",
              pan_number: "AAOCB0144P",
              cin: "U68100KA2025PTC209397",
              rera_number: "PRM/KA/RERA/1251/310/PR/251006",
            },

            banking_details: {
              bank_name: "HDFC Bank Ltd",
              account_holder: "BLX REALTY PRIVATE LIMITED - CLIENT ESCROW A/C",
              account_number: "50200089123456",
              ifsc_code: "HDFC0000240",
              branch_name: "Yeswanthpur Industrial Area Branch, Bengaluru",
              upi_id: "blxrealty@hdfcbank",
              qr_code_url: "",
            },
            tax_statutory: {
              gst_enabled: true,
              cgst_rate: 9,
              sgst_rate: 9,
              igst_rate: 18,
              tds_enabled: false,
              tds_rate: 1,
              pf_enabled: true,
              pf_code: "KAR/BLR/1098234/000",
              esi_enabled: true,
              esi_code: "53000981720000101",
              statutory_notes:
                "GST is applicable as per Ministry of Finance notification for Real Estate Services.",
            },
            invoice_notes: {
              payment_instructions:
                "Please make all payments via Bank Transfer / RTGS / NEFT or UPI strictly using official company accounts.",
              terms_and_conditions:
                "1. All booking advances are subject to final agreement terms.\n2. Holding deposits are valid for 15 days from issuance.\n3. This document is a computer-generated tax invoice.",
              cancellation_policy:
                "Cancellations within 7 days receive 90% refund. Post 7 days, cancellation is governed by RERA rules.",
              refund_policy:
                "Refunds are processed within 10 business days directly to the original bank account.",
              late_payment_policy:
                "1.5% monthly interest penalty applied on overdue installments beyond 15 days.",
              legal_disclaimer: "BLX Realty Pvt Ltd is a licensed RERA real estate agency.",
              thank_you_message:
                "Thank you for choosing BLX Realty as your trusted property partner!",
              customer_support: "Desk: +91 81977 73166 | support@theblxrealty.com",
            },
            branding: {
              logo_url: "",
              header_style: "modern",
              footer_info:
                "BLX Realty Pvt Ltd · Corporate Real Estate Advisory & Luxury Property Marketing",
              signature_title: "Authorized Signatory",
              signatory_name: "Nischith L. (Director)",
              signature_image_url: "",
              seal_image_url: "",
              primary_color: "#4f46e5",
              secondary_color: "#1e1b4b",
              text_color: "#0f172a",
            },
            numbering: {
              prefix: "INV-2026-",
              suffix: "/BLX",
              start_sequence: 1001,
              padding: 4,
              auto_increment: true,
            },
            payment_info: {
              accepted_methods: [
                "Bank Transfer (NEFT/RTGS)",
                "UPI Payment",
                "Cheque",
                "Demand Draft",
              ],
              payment_due_instructions: "Payment due within 15 days of invoice date.",
              offline_instructions:
                "Deliver cheques favoring 'BLX REALTY PRIVATE LIMITED' at Corporate Office.",
              qr_instructions:
                "Scan UPI QR code using any UPI Banking App to complete instant token transfer.",
            },
            default_template_id: "modern_executive",
          };

          const { data, error } = await supabase
            .from("invoice_settings")
            .select("*")
            .eq("id", "inv_settings_default")
            .single();

          if (error || !data) {
            return res.status(200).json(defaultSettings);
          }

          const mergedSettings = {
            ...defaultSettings,
            ...data,
            company_info: {
              ...defaultSettings.company_info,
              ...(data.company_info || {}),
              company_name: "BLX REALITY PRIVATE LIMITED",
              registered_address:
                "#301D, 3rd Floor, Tower B, Brigade Twin Towers, Pipeline Road HMT, Yeswanthpur, Bengaluru, Karnataka 560022",
              phone: "+91-9743264328 / +44-7944450039 / +91-8197773166",
              email: "discoverblr@theblxrealty.com",
              website: "www.theblxrealty.com",
              gst_number: "29AAOCB0144P1Z7",
              pan_number: "AAOCB0144P",
              cin: "U68100KA2025PTC209397",
            },
          };
          return res.status(200).json(mergedSettings);
        } catch (e: any) {
          return res.status(500).json({ error: e.message });
        }
      }

      case "updateInvoiceSettings": {
        const { settings, sectionName } = payload;
        const now = new Date().toISOString();
        const updatedObj = {
          ...settings,
          id: "inv_settings_default",
          updated_at: now,
          updated_by: actorName,
        };

        const { error } = await supabase
          .from("invoice_settings")
          .upsert(updatedObj, { onConflict: "id" });

        if (error) {
          console.warn(
            "Supabase upsert failed for invoice_settings, returning local updated state:",
            error.message,
          );
        }

        // Write Audit Log entry
        await supabase.from("audit_logs").insert({
          user: actorName,
          action: `INVOICE_CMS_UPDATED_${(sectionName || "ALL").toUpperCase()}`,
          timestamp: now,
          old_value: "Previous Invoice Configuration",
          new_value: `Updated ${sectionName || "Invoice Settings"} by ${actorName}`,
        });

        return res.status(200).json({ success: true, settings: updatedObj });
      }

      case "getInvoicePermissions": {
        try {
          const { data, error } = await supabase.from("invoice_role_permissions").select("*");

          const defaultMatrix = [
            {
              role: "super_admin",
              can_view_cms: true,
              can_edit_company_info: true,
              can_update_banking: true,
              can_modify_tax: true,
              can_edit_terms: true,
              can_change_branding: true,
              can_manage_templates: true,
              can_generate_invoices: true,
              can_regenerate_invoices: true,
            },
            {
              role: "admin",
              can_view_cms: true,
              can_edit_company_info: true,
              can_update_banking: false,
              can_modify_tax: true,
              can_edit_terms: true,
              can_change_branding: true,
              can_manage_templates: true,
              can_generate_invoices: true,
              can_regenerate_invoices: true,
            },
            {
              role: "manager",
              can_view_cms: true,
              can_edit_company_info: false,
              can_update_banking: false,
              can_modify_tax: false,
              can_edit_terms: false,
              can_change_branding: false,
              can_manage_templates: false,
              can_generate_invoices: true,
              can_regenerate_invoices: true,
            },
            {
              role: "sales_executive",
              can_view_cms: false,
              can_edit_company_info: false,
              can_update_banking: false,
              can_modify_tax: false,
              can_edit_terms: false,
              can_change_branding: false,
              can_manage_templates: false,
              can_generate_invoices: true,
              can_regenerate_invoices: false,
            },
            {
              role: "marketing",
              can_view_cms: false,
              can_edit_company_info: false,
              can_update_banking: false,
              can_modify_tax: false,
              can_edit_terms: false,
              can_change_branding: false,
              can_manage_templates: false,
              can_generate_invoices: false,
              can_regenerate_invoices: false,
            },
          ];

          if (error || !data || data.length === 0) {
            return res.status(200).json(defaultMatrix);
          }
          return res.status(200).json(data);
        } catch (e: any) {
          return res.status(500).json({ error: e.message });
        }
      }

      case "updateInvoicePermissions": {
        if (actorRole !== "super_admin") {
          return res
            .status(403)
            .json({ error: "Only Super Admin can modify Invoice Role Permissions." });
        }
        const { matrix } = payload; // Array of role permissions
        const now = new Date().toISOString();

        const prepared = matrix.map((item: any) => ({
          ...item,
          updated_at: now,
          updated_by: actorName,
        }));

        const { error } = await supabase
          .from("invoice_role_permissions")
          .upsert(prepared, { onConflict: "role" });

        if (error) {
          console.warn("Supabase upsert failed for invoice_role_permissions:", error.message);
        }

        // Write audit log
        await supabase.from("audit_logs").insert({
          user: actorName,
          action: "INVOICE_PERMISSIONS_UPDATED",
          timestamp: now,
          old_value: "Previous Role Permissions Matrix",
          new_value: `Permissions updated for ${matrix.length} roles by ${actorName}`,
        });

        return res.status(200).json({ success: true, matrix: prepared });
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
