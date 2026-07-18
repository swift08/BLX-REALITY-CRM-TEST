// ============================================================
// Meta Lead Ads Webhook Endpoint
// Filename: api/meta/webhook.ts
// Description: Receives lead events from Facebook/Instagram Lead Ads.
// ============================================================

import crypto from "node:crypto";
import { getSupabaseClient, addLeadInternal } from "../shared/lead-service";
import { metaLeadFieldMapping } from "../../src/config/metaLeadFieldMapping";

// Disable automatic body parsing so we can compute correct HMAC SHA-256 signatures
export const config = {
  api: {
    bodyParser: false,
  },
};

// Utility to read the raw request stream
async function getRawBody(req: any): Promise<string> {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

// Exponential backoff fetch helper for Meta Graph API calls
async function fetchWithRetry(url: string, maxAttempts = 5): Promise<any> {
  let attempt = 1;
  let delay = 1000;
  
  while (attempt <= maxAttempts) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return await response.json();
      }
      
      const errorText = await response.text();
      console.error(`Attempt ${attempt} failed with status ${response.status}: ${errorText}`);
      
      if (response.status !== 429 && response.status < 500) {
        throw new Error(`Graph API error: ${response.status} - ${errorText}`);
      }
    } catch (err: any) {
      if (attempt === maxAttempts) {
        throw err;
      }
      console.warn(`Attempt ${attempt} error: ${err.message}. Retrying in ${delay}ms...`);
    }
    
    await new Promise((resolve) => setTimeout(resolve, delay));
    attempt++;
    delay *= 2;
  }
}

export default async function handler(req: any, res: any) {
  // Fast-fail env checks on startup
  const appSecret = process.env.META_APP_SECRET;
  const verifyToken = process.env.META_VERIFY_TOKEN;
  const accessToken = process.env.META_ACCESS_TOKEN;
  const graphVersion = process.env.META_GRAPH_VERSION || "v23.0";

  if (!appSecret || !verifyToken || !accessToken) {
    console.error("Missing required Meta environment variables on startup.");
    return res.status(500).json({
      error: "Configuration Error: Missing required environment variables on startup (META_APP_SECRET, META_VERIFY_TOKEN, META_ACCESS_TOKEN).",
    });
  }

  // 1. Webhook Handshake Verification (GET request)
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === verifyToken) {
      console.log("Meta Webhook handshake verified successfully.");
      res.setHeader("Content-Type", "text/plain");
      return res.status(200).send(challenge);
    }

    console.warn("Meta Webhook handshake failed: Invalid verification token.");
    return res.status(403).send("Forbidden");
  }

  // 2. Incoming Event Ingestion (POST request)
  if (req.method === "POST") {
    let rawBody = "";
    try {
      rawBody = await getRawBody(req);
    } catch (err: any) {
      return res.status(400).json({ error: "Failed to read request body" });
    }

    // A. Payload Signature Verification (X-Hub-Signature-256)
    const signatureHeader = req.headers["x-hub-signature-256"];
    if (!signatureHeader || typeof signatureHeader !== "string") {
      return res.status(401).json({ error: "Missing x-hub-signature-256 header" });
    }

    const signature = signatureHeader.startsWith("sha256=") ? signatureHeader.substring(7) : signatureHeader;
    const hmac = crypto.createHmac("sha256", appSecret);
    const computedSignature = hmac.update(rawBody).digest("hex");

    try {
      if (!crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(computedSignature, "hex"))) {
        console.warn("Invalid webhook signature received.");
        return res.status(401).json({ error: "Signature verification failed" });
      }
    } catch (_) {
      return res.status(401).json({ error: "Signature verification failed" });
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch (err: any) {
      return res.status(400).json({ error: "Invalid JSON body" });
    }

    const supabase = getSupabaseClient();

    // Check if the event is a leadgen event
    const changeValue = payload.entry?.[0]?.changes?.[0]?.value;
    const changeField = payload.entry?.[0]?.changes?.[0]?.field;

    if (changeField !== "leadgen") {
      // Return 200 to acknowledge non-leadgen events but ignore processing
      return res.status(200).json({ success: true, message: "Ignored non-leadgen event" });
    }

    const leadgenId = changeValue?.leadgen_id;
    const pageId = changeValue?.page_id;
    const formId = changeValue?.form_id;

    if (!leadgenId) {
      return res.status(400).json({ error: "Missing leadgen_id in leadgen event" });
    }

    // B. Idempotency Check (prevent duplicate processing on Meta retries)
    const { data: existingLog } = await supabase
      .from("meta_webhook_logs")
      .select("status, leadgen_id")
      .eq("leadgen_id", leadgenId)
      .in("status", ["PROCESSED", "DUPLICATE"])
      .maybeSingle();

    if (existingLog) {
      console.log(`Idempotency hit: Leadgen ID ${leadgenId} has already been processed.`);
      return res.status(200).json({ success: true, message: "Lead already processed (idempotency match)" });
    }

    // Check customer table directly as safety fallback
    const { data: existingCust } = await supabase
      .from("customers")
      .select("id")
      .eq("meta_lead_id", leadgenId)
      .maybeSingle();

    if (existingCust) {
      console.log(`Safety Idempotency hit: Customer already exists with meta_lead_id ${leadgenId}.`);
      return res.status(200).json({ success: true, message: "Lead already processed (customer match)" });
    }

    // Create entry log as RECEIVED
    const { data: logEntry, error: logErr } = await supabase
      .from("meta_webhook_logs")
      .insert({
        leadgen_id: leadgenId,
        page_id: pageId,
        form_id: formId,
        event_type: "leadgen",
        status: "RECEIVED",
        payload: payload,
      })
      .select()
      .single();

    const logId = logEntry?.id;

    // C. Lead Retrieval & DB Insertion
    // Note: We process this synchronously inside the serverless function context to guarantee 
    // Vercel does not terminate execution before the Graph API query completes.
    try {
      const graphUrl = `https://graph.facebook.com/${graphVersion}/${leadgenId}?access_token=${accessToken}`;
      const leadDetails = await fetchWithRetry(graphUrl, 5);

      const fieldData = leadDetails.field_data || [];
      
      // Parse fields using our config mapping file
      const leadMap: Record<string, string> = {};
      const customQuestions: Record<string, any> = {};

      for (const field of fieldData) {
        const keyName = field.name;
        const val = field.values?.[0] || "";
        
        // Find mapped internal CRM column
        const internalField = metaLeadFieldMapping[keyName];
        if (internalField) {
          leadMap[internalField] = val;
        } else {
          customQuestions[keyName] = val;
        }
      }

      // Populate meta tracking details
      const metaMetadata = {
        meta_lead_id: leadgenId,
        page_id: pageId || leadDetails.page_id || null,
        form_id: formId || leadDetails.form_id || null,
        campaign_id: leadDetails.campaign_id || null,
        campaign_name: leadDetails.campaign_name || null,
        adset_id: leadDetails.adset_id || null,
        ad_id: leadDetails.ad_id || null,
        platform: leadDetails.platform || (pageId ? "Facebook" : "Instagram"),
        submission_time: leadDetails.created_time || new Date().toISOString(),
        custom_questions: customQuestions,
        raw_payload: payload,
      };

      // Formulate Lead Ads Source
      const platformSource = metaMetadata.platform === "instagram" || metaMetadata.platform === "Instagram" 
        ? "Instagram Lead Ads" 
        : "Facebook Lead Ads";

      const newLead = {
        name: leadMap.name || "Meta Lead",
        phone: leadMap.phone || "",
        email: leadMap.email || undefined,
        city: leadMap.city || undefined,
        budget: leadMap.budget || "₹1.5 Cr",
        source: platformSource,
        project_id: leadMap.project_id || null,
        owner: "Unassigned",
        temperature: "warm",
      };

      // 1. Store the leadgen_id in options to check/store on create
      const result = await addLeadInternal(newLead, "Meta Integration Service", {
        isWebhook: true,
        metaLeadId: leadgenId,
        metaMetadata: metaMetadata,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      // Update log entry to PROCESSED or DUPLICATE depending on insertion outcome
      const finalStatus = result.isDuplicate ? "DUPLICATE" : "PROCESSED";
      await supabase
        .from("meta_webhook_logs")
        .update({
          status: finalStatus,
          processed_at: new Date().toISOString(),
        })
        .eq("id", logId);

      return res.status(200).json({
        success: true,
        customerId: result.customerId,
        opportunityId: result.opportunityId,
        isDuplicate: result.isDuplicate,
      });

    } catch (err: any) {
      console.error(`Meta lead ingestion failed for leadgen_id ${leadgenId}:`, err.message);
      
      // Log failure state in webhook logs table
      await supabase
        .from("meta_webhook_logs")
        .update({
          status: "FAILED",
          error_message: err.message,
          processed_at: new Date().toISOString(),
        })
        .eq("id", logId);

      return res.status(200).json({
        success: false,
        error: err.message,
        message: "Webhook processed but lead creation failed",
      });
    }
  }

  // Handle other request methods
  res.setHeader("Allow", "GET, POST");
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
