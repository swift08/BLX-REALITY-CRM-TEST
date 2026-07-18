// ============================================================
// Shared Lead Service
// Filename: api/shared/lead-service.ts
// Description: Core service for lead verification, deduplication, and DB insertion.
// ============================================================

import { createClient } from "@supabase/supabase-js";
import process from "node:process";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase credentials in process.env!");
}

export function getSupabaseClient() {
  return createClient(supabaseUrl!, supabaseKey!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// Replicated publishEvent helper to make lead-service.ts self-contained and identical to crm.ts behavior
export async function publishEvent(type: string, customerId: string, payload: any, actorName: string) {
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

export interface AddLeadOptions {
  isWebhook?: boolean;
  metaLeadId?: string;
  metaMetadata?: any;
}

export async function addLeadInternal(
  lead: {
    name: string;
    phone: string;
    email?: string;
    source: string;
    project_id?: string | null;
    budget?: string;
    owner?: string;
    temperature?: string;
    city?: string;
  },
  actorName: string,
  options?: AddLeadOptions
) {
  const supabase = getSupabaseClient();
  const digits = lead.phone.replace(/\D/g, "");

  // 1. Check duplicate lead by phone
  let { data: dupCheck } = await supabase
    .from("customers")
    .select("id, name, email")
    .eq("phone", digits)
    .eq("is_deleted", false)
    .maybeSingle();

  // 2. If phone duplicate not found, check duplicate by email (if email is provided)
  if (!dupCheck && lead.email) {
    const { data: emailDup } = await supabase
      .from("customers")
      .select("id, name, email")
      .eq("email", lead.email.trim())
      .eq("is_deleted", false)
      .maybeSingle();
    dupCheck = emailDup;
  }

  // 3. Handle duplicates
  if (dupCheck) {
    const { data: dbOpps } = await supabase
      .from("opportunities")
      .select("id, owner, project_id, budget, stage, temperature")
      .eq("customer_id", dupCheck.id);
    const opportunity = dbOpps && dbOpps[0] ? dbOpps[0] : null;
    const oppOwner = opportunity ? opportunity.owner : "Unassigned";

    if (!options?.isWebhook) {
      // Manual creation throws duplicate error (original behavior)
      return {
        error: `DUPLICATE_DETECTED:${dupCheck.id}:${dupCheck.name}:${oppOwner}`,
        statusCode: 400
      };
    } else {
      // Webhook ingestion resolves duplicates gracefully by updating timeline and meta information
      const updateData: any = {};
      if (options.metaLeadId) {
        updateData.meta_lead_id = options.metaLeadId;
      }
      if (options.metaMetadata) {
        updateData.meta_metadata = options.metaMetadata;
      }

      await supabase.from("customers").update(updateData).eq("id", dupCheck.id);

      // Log duplicate check activity
      await supabase.from("activities").insert({
        customer_id: dupCheck.id,
        type: "Meta Webhook Deduplication",
        summary: `Duplicate Meta Lead Ads submission mapped to existing contact. Platform: ${options.metaMetadata?.platform || "Meta"}. Form: ${options.metaMetadata?.form_name || "Unknown"}.`,
        time: new Date().toISOString(),
      });

      // Update customer timeline
      const currentTimeline = await supabase
        .from("customers")
        .select("timeline")
        .eq("id", dupCheck.id)
        .single();
      
      const timeline = currentTimeline.data?.timeline || [];
      timeline.push({
        title: `Duplicate Lead submission via Meta Lead Ads (Form: ${options.metaMetadata?.form_name || "Unknown"})`,
        time: new Date().toISOString()
      });

      await supabase.from("customers").update({ timeline }).eq("id", dupCheck.id);

      return {
        success: true,
        isDuplicate: true,
        customerId: dupCheck.id,
        opportunityId: opportunity?.id || null
      };
    }
  }

  // 4. Create new customer
  const customerInsertData: any = {
    name: lead.name,
    phone: digits,
    email: lead.email || null,
    source: lead.source,
    created_by: actorName,
    city: lead.city || null,
  };

  if (options?.metaLeadId) {
    customerInsertData.meta_lead_id = options.metaLeadId;
  }
  if (options?.metaMetadata) {
    customerInsertData.meta_metadata = options.metaMetadata;
  }

  const { data: dbCustomer, error: cErr } = await supabase
    .from("customers")
    .insert(customerInsertData)
    .select()
    .single();

  if (cErr) {
    return { error: cErr.message, statusCode: 400 };
  }

  // 5. Create new opportunity
  const { data: dbOpportunity, error: oErr } = await supabase
    .from("opportunities")
    .insert({
      customer_id: dbCustomer.id,
      project_id: lead.project_id === "none" || !lead.project_id ? null : lead.project_id,
      budget: lead.budget || "₹1.5 Cr",
      stage: lead.owner && lead.owner !== "Unassigned" ? "assigned" : "new",
      temperature: lead.temperature || "warm",
      owner: lead.owner || "Unassigned",
    })
    .select()
    .single();

  if (oErr) {
    return { error: oErr.message, statusCode: 400 };
  }

  // 6. Set active opportunity id on customer
  await supabase
    .from("customers")
    .update({ activeOpportunityId: dbOpportunity.id })
    .eq("id", dbCustomer.id);

  // 7. Publish creation event
  await publishEvent(
    "CUSTOMER_CREATED",
    dbCustomer.id,
    { source: dbCustomer.source },
    actorName
  );

  // 8. Publish assignment event if owner is assigned
  if (dbOpportunity.owner !== "Unassigned") {
    await publishEvent(
      "OPPORTUNITY_ASSIGNED",
      dbCustomer.id,
      { owner: dbOpportunity.owner, oldOwner: "Unassigned" },
      actorName
    );
  }

  return {
    success: true,
    isDuplicate: false,
    customerId: dbCustomer.id,
    opportunityId: dbOpportunity.id,
    data: {
      ...dbCustomer,
      opportunities: [
        {
          ...dbOpportunity,
          customerId: dbOpportunity.customer_id,
          projectId: dbOpportunity.project_id,
        },
      ],
    }
  };
}
