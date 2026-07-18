-- ============================================================
-- Meta Lead Ads Integration Schema Migration
-- Filename: supabase/migrations/20260717_meta_lead_ads.sql
-- Description: Adds columns to customers table and creates a logs table for webhook events.
-- ============================================================

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

-- 3. Create index for fast query retrieval on leadgen_id
CREATE INDEX IF NOT EXISTS idx_meta_logs_leadgen ON meta_webhook_logs(leadgen_id);
