// ============================================================
// Meta Webhook Health Status Endpoint
// Filename: api/meta/webhook/status.ts
// Description: Returns health status, sync statistics, and API checks.
// ============================================================

import { getSupabaseClient } from "../../shared/lead-service.js";

export default async function handler(req: any, res: any) {
  // Only allow GET requests
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const appSecret = process.env.META_APP_SECRET;
  const verifyToken = process.env.META_VERIFY_TOKEN;
  const accessToken = process.env.META_ACCESS_TOKEN;
  const graphVersion = process.env.META_GRAPH_VERSION || "v23.0";

  // Check if env vars are present
  const isConfigured = !!(appSecret && verifyToken && accessToken);

  if (!isConfigured) {
    return res.status(200).json({
      status: "degraded",
      configuration: {
        meta_app_secret: !!appSecret,
        meta_verify_token: !!verifyToken,
        meta_access_token: !!accessToken,
      },
      message: "Required Meta environment variables are missing.",
      graphApi: "unreachable",
      webhook: "unverified",
    });
  }

  const supabase = getSupabaseClient();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startOfDayISO = startOfDay.toISOString();

  try {
    // 1. Fetch lead statistics from logs
    const { data: logs, error: logsErr } = await supabase
      .from("meta_webhook_logs")
      .select("status, received_at")
      .gte("received_at", startOfDayISO);

    if (logsErr) {
      throw new Error(`Database error fetching logs: ${logsErr.message}`);
    }

    let processedToday = 0;
    let failedToday = 0;
    let duplicateIgnored = 0;

    for (const log of logs || []) {
      if (log.status === "PROCESSED") processedToday++;
      else if (log.status === "FAILED") failedToday++;
      else if (log.status === "DUPLICATE") duplicateIgnored++;
    }

    // 2. Fetch last sync details
    const { data: lastLog } = await supabase
      .from("meta_webhook_logs")
      .select("received_at, status, error_message")
      .order("received_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 3. Verify Graph API connection and token validity
    let graphApiStatus = "reachable";
    let tokenErrorMessage = null;

    try {
      const graphCheckUrl = `https://graph.facebook.com/${graphVersion}/me?access_token=${accessToken}`;
      const graphResponse = await fetch(graphCheckUrl);
      
      if (!graphResponse.ok) {
        graphApiStatus = "error";
        const errJson = await graphResponse.json().catch(() => ({}));
        tokenErrorMessage = errJson.error?.message || `HTTP Status ${graphResponse.status}`;
      }
    } catch (graphErr: any) {
      graphApiStatus = "unreachable";
      tokenErrorMessage = graphErr.message;
    }

    const overallStatus = graphApiStatus === "reachable" && failedToday === 0 ? "healthy" : "degraded";

    return res.status(200).json({
      status: overallStatus,
      lastLead: lastLog ? lastLog.received_at : null,
      processedToday,
      failedToday,
      duplicateIgnored,
      graphApi: graphApiStatus,
      webhook: "verified",
      tokenError: tokenErrorMessage,
      lastError: lastLog && lastLog.status === "FAILED" ? lastLog.error_message : null,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error("Health endpoint error:", error.message);
    return res.status(500).json({
      status: "error",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}
