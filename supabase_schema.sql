-- ==========================================
-- 1. DATABASE SCHEMA DDL FOR SUPABASE
-- ==========================================

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Developers Table
CREATE TABLE IF NOT EXISTS developers (
    id TEXT PRIMARY KEY DEFAULT 'dev-' || substring(gen_random_uuid()::text from 1 for 8),
    name TEXT NOT NULL,
    contact TEXT,
    location TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    brochures JSONB DEFAULT '[]'::jsonb NOT NULL,
    agreements JSONB DEFAULT '[]'::jsonb NOT NULL,
    pricelists JSONB DEFAULT '[]'::jsonb NOT NULL,
    documents JSONB DEFAULT '[]'::jsonb NOT NULL
);

-- Projects Table
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY DEFAULT 'proj-' || substring(gen_random_uuid()::text from 1 for 8),
    name TEXT NOT NULL,
    developer_id TEXT REFERENCES developers(id) ON DELETE SET NULL,
    location TEXT,
    total_units INTEGER,
    available_units INTEGER,
    price_range TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    brochures JSONB DEFAULT '[]'::jsonb NOT NULL,
    floor_plans JSONB DEFAULT '[]'::jsonb NOT NULL,
    documents JSONB DEFAULT '[]'::jsonb NOT NULL,
    gallery_images JSONB DEFAULT '[]'::jsonb NOT NULL
);

-- Customers Table
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY DEFAULT 'cust-' || substring(gen_random_uuid()::text from 1 for 8),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    source TEXT,
    city TEXT,
    priority_score INTEGER DEFAULT 0,
    "activeOpportunityId" TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by TEXT,
    is_deleted BOOLEAN DEFAULT false,
    "timeline" JSONB DEFAULT '[]'::jsonb NOT NULL
);

-- Opportunities Table
CREATE TABLE IF NOT EXISTS opportunities (
    id TEXT PRIMARY KEY DEFAULT 'opp-' || substring(gen_random_uuid()::text from 1 for 8),
    customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    budget TEXT,
    stage TEXT DEFAULT 'new' NOT NULL,
    temperature TEXT DEFAULT 'warm' NOT NULL,
    owner TEXT DEFAULT 'Unassigned' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    lost_reason TEXT
);

-- Inventory Table (Units)
CREATE TABLE IF NOT EXISTS inventory (
    id TEXT PRIMARY KEY DEFAULT 'unit-' || substring(gen_random_uuid()::text from 1 for 8),
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
    unit_number TEXT NOT NULL,
    configuration TEXT,
    area NUMERIC,
    price NUMERIC,
    status TEXT DEFAULT 'available' NOT NULL,
    reserved_by TEXT REFERENCES customers(id) ON DELETE SET NULL
);

-- Bookings Table
CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY DEFAULT 'book-' || substring(gen_random_uuid()::text from 1 for 8),
    opportunity_id TEXT REFERENCES opportunities(id) ON DELETE CASCADE NOT NULL,
    unit_id TEXT REFERENCES inventory(id) ON DELETE RESTRICT NOT NULL,
    amount NUMERIC NOT NULL,
    payment_status TEXT DEFAULT 'pending' NOT NULL,
    booking_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Invoices Table
CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY DEFAULT 'inv-' || substring(gen_random_uuid()::text from 1 for 8),
    booking_id TEXT REFERENCES bookings(id) ON DELETE CASCADE NOT NULL,
    amount NUMERIC NOT NULL,
    status TEXT DEFAULT 'unpaid' NOT NULL,
    due_date TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Payments Table
CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY DEFAULT 'pay-' || substring(gen_random_uuid()::text from 1 for 8),
    invoice_id TEXT REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
    amount NUMERIC NOT NULL,
    date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    reference TEXT NOT NULL
);

-- Activities Table
CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY DEFAULT 'act-' || substring(gen_random_uuid()::text from 1 for 8),
    customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL,
    summary TEXT,
    time TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    next_followup TIMESTAMP WITH TIME ZONE
);

-- Communication Logs Table
CREATE TABLE IF NOT EXISTS communications (
    id TEXT PRIMARY KEY DEFAULT 'comm-' || substring(gen_random_uuid()::text from 1 for 8),
    customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL,
    direction TEXT NOT NULL,
    summary TEXT,
    details TEXT,
    time TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Documents Table
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY DEFAULT 'doc-' || substring(gen_random_uuid()::text from 1 for 8),
    customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    size INTEGER,
    category TEXT,
    uploaded_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Followups Table
CREATE TABLE IF NOT EXISTS followups (
    id TEXT PRIMARY KEY DEFAULT 'f-' || substring(gen_random_uuid()::text from 1 for 8),
    lead_id TEXT REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    time TIMESTAMP WITH TIME ZONE NOT NULL,
    priority TEXT DEFAULT 'medium' NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL,
    assigned_sales TEXT NOT NULL
);

-- Calendar Events Table
CREATE TABLE IF NOT EXISTS calendar_events (
    id TEXT PRIMARY KEY DEFAULT 'cal-' || substring(gen_random_uuid()::text from 1 for 8),
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
    sales_person TEXT,
    details TEXT
);

-- Workflow Rules Table
CREATE TABLE IF NOT EXISTS workflow_rules (
    id TEXT PRIMARY KEY DEFAULT 'wf-' || substring(gen_random_uuid()::text from 1 for 8),
    name TEXT NOT NULL,
    event TEXT NOT NULL,
    conditions JSONB,
    actions JSONB,
    is_active BOOLEAN DEFAULT true
);

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY DEFAULT 'log-' || substring(gen_random_uuid()::text from 1 for 8),
    "user" TEXT NOT NULL,
    action TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    ip TEXT
);

-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY DEFAULT 'ntf-' || substring(gen_random_uuid()::text from 1 for 8),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    lead_id TEXT REFERENCES customers(id) ON DELETE CASCADE,
    priority TEXT DEFAULT 'medium' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    read BOOLEAN DEFAULT false NOT NULL,
    role TEXT DEFAULT 'all' NOT NULL,
    assigned_to TEXT
);

-- Notes Table
CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY DEFAULT 'note-' || substring(gen_random_uuid()::text from 1 for 8),
    customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    author TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    pinned BOOLEAN DEFAULT false
);

-- Settings Table
CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    company_name TEXT DEFAULT 'BLX Realty' NOT NULL,
    working_hours TEXT DEFAULT '09:00 AM - 07:00 PM' NOT NULL,
    reminder_time INTEGER DEFAULT 30 NOT NULL,
    lead_sources TEXT[] DEFAULT ARRAY['Website', 'Instagram', 'Facebook', 'WhatsApp', 'Walk-in', 'Referral', 'Landing Page']::TEXT[] NOT NULL,
    body_font TEXT,
    heading_font TEXT,
    response_sla_mins INTEGER DEFAULT 30,
    escalation_sla_hours INTEGER DEFAULT 2
);

-- (No seed data or auth users are created so the database returns no rows on initialization)

-- Revoke execution rights on SECURITY DEFINER functions from public roles if the function exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.proname = 'rls_auto_enable'
    ) THEN
        REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM public, anon, authenticated;
    END IF;
END $$;

-- ============================================================
-- SCHEMA REPAIR / MIGRATIONS
-- Ensures existing databases are patched to match current schema
-- ============================================================

-- Step 1: Add the timeline column to customers table if not already present
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS timeline JSONB DEFAULT '[]'::jsonb NOT NULL;

-- Step 2: Backfill any existing rows that might have NULL (safety net)
UPDATE customers
  SET timeline = '[]'::jsonb
  WHERE timeline IS NULL;

-- Step 3: Add file catalog columns to developers table if not already present
ALTER TABLE developers
  ADD COLUMN IF NOT EXISTS brochures JSONB DEFAULT '[]'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS agreements JSONB DEFAULT '[]'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS pricelists JSONB DEFAULT '[]'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]'::jsonb NOT NULL;

-- Step 4: Add file catalog columns to projects table if not already present
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS brochures JSONB DEFAULT '[]'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS floor_plans JSONB DEFAULT '[]'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS gallery_images JSONB DEFAULT '[]'::jsonb NOT NULL;

-- Step 5: Confirm column existence
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'timeline'
  ) THEN
    RAISE NOTICE 'Migration: customers.timeline column is present. OK.';
  ELSE
    RAISE EXCEPTION 'Migration FAILED: customers.timeline column not found.';
  END IF;
END;
$$;
