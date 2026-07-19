# Meta Lead Ads Integration Deployment Checklist

This document details the step-by-step instructions for deploying and configuring the Meta Lead Ads Integration.

---

## 1. Database Schema Migration

Run the following SQL DDL query inside the **Supabase SQL Editor** or apply it via your migrations setup:

```sql
-- 1. Add Meta tracking columns to the customers table
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS meta_lead_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS meta_metadata JSONB DEFAULT '{}'::jsonb NOT NULL;

-- 2. Create the meta_webhook_logs table
CREATE TABLE IF NOT EXISTS meta_webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    leadgen_id TEXT,
    page_id TEXT,
    form_id TEXT,
    event_type TEXT,
    status TEXT, -- 'RECEIVED', 'PROCESSED', 'FAILED', 'DUPLICATE'
    error_message TEXT,
    payload JSONB DEFAULT '{}'::jsonb NOT NULL,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE
);

-- 3. Create index for query performance
CREATE INDEX IF NOT EXISTS idx_meta_logs_leadgen ON meta_webhook_logs(leadgen_id);
```

---

## 2. Environment Variables

Configure the following environment variables on **Vercel** under **Project Settings → Environment Variables**:

| Variable Name        | Description                                                        | Example / Recommendations                                                                      |
| -------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `META_APP_ID`        | Your Meta App ID.                                                  | `1065172274005031`                                                                             |
| `META_APP_SECRET`    | Your Meta App Secret (used to verify incoming request signatures). | `32-character hexadecimal string`                                                              |
| `META_VERIFY_TOKEN`  | A custom secret string that you define for the handshake.          | `blx_reality_fb_verify_token_2026`                                                             |
| `META_ACCESS_TOKEN`  | Long-Lived Page Access Token or System User Token.                 | `EAAC...` (Must have `ads_management`, `pages_show_list`, `pages_read_engagement` permissions) |
| `META_GRAPH_VERSION` | Meta Graph API Version to fetch lead details.                      | `v23.0`                                                                                        |

---

## 3. Vercel Deployment

1. Commit and push the new files to your Git repository:
   - `api/shared/lead-service.ts`
   - `api/meta/webhook.ts`
   - `api/meta/webhook/status.ts`
   - `src/config/metaLeadFieldMapping.ts`
   - Modified `api/crm.ts` and `vite.config.ts`.
2. Wait for Vercel to build and deploy.
3. Verify that the webhook endpoint is active:
   - Open `https://<your-crm-domain>/api/meta/webhook` in a browser. It should return **HTTP 405 Method Not Allowed** (since GET requests without verification params are blocked), proving the endpoint is deployed and active.

---

## 4. Meta App Configuration (Dashboard Setup)

1. Go to [Meta Developers Portal](https://developers.facebook.com/).
2. Select your app (`1065172274005031`).
3. Click on **Customize Use Case** → **Webhooks** or add the **Webhooks** product.
4. Set the **Object/Product** dropdown to **Page**.
5. Click **Configure a Webhook** and fill in:
   - **Callback URL**: `https://<your-crm-domain>/api/meta/webhook`
   - **Verify Token**: _Use the exact string configured in `META_VERIFY_TOKEN`_
6. Click **Verify and Save**. Meta will immediately ping your endpoint; once successful, the webhook is active.
7. Under the list of Page subscription fields, locate **`leadgen`** and click **Subscribe**.

---

## 5. Test Lead Procedure

To verify the integration works end-to-end without spending ad budget:

1. Go to the [Meta Lead Ads Testing Tool](https://developers.facebook.com/tools/lead-ads-testing/).
2. Select your **Page** and the **Form** you want to test.
3. Click **Create Lead**.
4. Check the CRM Dashboard to see if the lead is correctly ingested.
5. Hit the CRM Webhook Status endpoint: `https://<your-crm-domain>/api/meta/webhook/status` to review processing stats and logs.

---

## 6. Troubleshooting

- **Signature Verification Fails**: Double check that `META_APP_SECRET` on Vercel matches your Meta App Dashboard exactly.
- **Handshake Fails**: Ensure `META_VERIFY_TOKEN` matches the token entered in the developer portal, and ensure the domain is running on HTTPS.
- **Empty / Missing Fields**: If name/phone is empty in the CRM, check `src/config/metaLeadFieldMapping.ts` and make sure it maps the exact field labels used on your Facebook Form.
