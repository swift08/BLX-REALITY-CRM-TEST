-- ==========================================
-- DATABASE SCHEMA DDL FOR SUPABASE
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
    gallery_images JSONB DEFAULT '[]'::jsonb NOT NULL,
    status TEXT DEFAULT 'New Launch' NOT NULL,
    property_type TEXT DEFAULT 'Apartment' NOT NULL,
    possession_timeline TEXT,
    project_size TEXT,
    rera_number TEXT,
    cover_image_url TEXT
);

-- Project Configurations Table
CREATE TABLE IF NOT EXISTS project_configurations (
    id TEXT PRIMARY KEY DEFAULT 'config-' || substring(gen_random_uuid()::text from 1 for 8),
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by TEXT,
    UNIQUE(project_id, name)
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
    "timeline" JSONB DEFAULT '[]'::jsonb NOT NULL,
    meta_lead_id TEXT UNIQUE,
    meta_metadata JSONB DEFAULT '{}'::jsonb NOT NULL
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
    reserved_by TEXT REFERENCES customers(id) ON DELETE SET NULL,
    configuration_id TEXT REFERENCES project_configurations(id) ON DELETE SET NULL,
    CONSTRAINT unique_project_unit UNIQUE (project_id, unit_number)
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

-- Activities Table (Legacy)
CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY DEFAULT 'act-' || substring(gen_random_uuid()::text from 1 for 8),
    customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL,
    summary TEXT,
    time TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    next_followup TIMESTAMP WITH TIME ZONE
);

-- Communication Logs Table (Legacy)
CREATE TABLE IF NOT EXISTS communications (
    id TEXT PRIMARY KEY DEFAULT 'comm-' || substring(gen_random_uuid()::text from 1 for 8),
    customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL,
    direction TEXT NOT NULL,
    summary TEXT,
    details TEXT,
    time TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Interactions Table
CREATE TABLE IF NOT EXISTS interactions (
    id TEXT PRIMARY KEY DEFAULT 'int-' || substring(gen_random_uuid()::text from 1 for 8),
    customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL,
    direction TEXT DEFAULT 'outbound' NOT NULL,
    summary TEXT NOT NULL,
    details TEXT,
    time TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    next_followup TIMESTAMP WITH TIME ZONE,
    created_by TEXT DEFAULT 'System'
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
    details TEXT,
    status TEXT DEFAULT 'pending' NOT NULL
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

-- Invoice Settings Table (CMS)
CREATE TABLE IF NOT EXISTS invoice_settings (
    id TEXT PRIMARY KEY DEFAULT 'inv_settings_default',
    company_info JSONB DEFAULT '{}'::jsonb NOT NULL,
    banking_details JSONB DEFAULT '{}'::jsonb NOT NULL,
    tax_statutory JSONB DEFAULT '{}'::jsonb NOT NULL,
    invoice_notes JSONB DEFAULT '{}'::jsonb NOT NULL,
    branding JSONB DEFAULT '{}'::jsonb NOT NULL,
    numbering JSONB DEFAULT '{}'::jsonb NOT NULL,
    payment_info JSONB DEFAULT '{}'::jsonb NOT NULL,
    default_template_id TEXT DEFAULT 'modern_executive' NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_by TEXT
);

-- Invoice Role Permissions Table
CREATE TABLE IF NOT EXISTS invoice_role_permissions (
    role TEXT PRIMARY KEY,
    can_view_cms BOOLEAN DEFAULT true NOT NULL,
    can_edit_company_info BOOLEAN DEFAULT false NOT NULL,
    can_update_banking BOOLEAN DEFAULT false NOT NULL,
    can_modify_tax BOOLEAN DEFAULT false NOT NULL,
    can_edit_terms BOOLEAN DEFAULT false NOT NULL,
    can_change_branding BOOLEAN DEFAULT false NOT NULL,
    can_manage_templates BOOLEAN DEFAULT false NOT NULL,
    can_generate_invoices BOOLEAN DEFAULT true NOT NULL,
    can_regenerate_invoices BOOLEAN DEFAULT false NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_by TEXT
);

-- User Invoice Permissions Table (Per-user overrides)
CREATE TABLE IF NOT EXISTS user_invoice_permissions (
    user_id TEXT PRIMARY KEY,
    user_name TEXT,
    role TEXT NOT NULL,
    can_view_cms BOOLEAN DEFAULT true NOT NULL,
    can_edit_company_info BOOLEAN DEFAULT false NOT NULL,
    can_update_banking BOOLEAN DEFAULT false NOT NULL,
    can_modify_tax BOOLEAN DEFAULT false NOT NULL,
    can_edit_terms BOOLEAN DEFAULT false NOT NULL,
    can_change_branding BOOLEAN DEFAULT false NOT NULL,
    can_manage_templates BOOLEAN DEFAULT false NOT NULL,
    can_generate_invoices BOOLEAN DEFAULT true NOT NULL,
    can_regenerate_invoices BOOLEAN DEFAULT false NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_by TEXT
);


-- Meta Webhook Logs Table
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

CREATE INDEX IF NOT EXISTS idx_meta_logs_leadgen ON meta_webhook_logs(leadgen_id);

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

UPDATE customers
  SET timeline = '[]'::jsonb
  WHERE timeline IS NULL;

-- Step 2: Add Meta tracking columns to the customers table if not already present
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS meta_lead_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS meta_metadata JSONB DEFAULT '{}'::jsonb NOT NULL;

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

-- Step 5: Add configuration_id to the inventory (units) table if not already present
ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS configuration_id TEXT REFERENCES project_configurations(id) ON DELETE SET NULL;

-- Step 6: Migrate plain text configurations to project_configurations table
INSERT INTO project_configurations (project_id, name, created_by)
SELECT DISTINCT project_id, configuration, 'System Migration'
FROM inventory
WHERE configuration IS NOT NULL AND configuration <> ''
ON CONFLICT (project_id, name) DO NOTHING;

UPDATE inventory i
SET configuration_id = pc.id
FROM project_configurations pc
WHERE i.project_id = pc.project_id AND i.configuration = pc.name AND i.configuration_id IS NULL;

-- Step 7: Migrate legacy activities into new interactions table
INSERT INTO interactions (id, customer_id, type, direction, summary, details, time, next_followup, created_by)
SELECT 
    id, 
    customer_id, 
    type, 
    'outbound', 
    summary, 
    '', 
    time, 
    next_followup, 
    'System Migration'
FROM activities
ON CONFLICT (id) DO NOTHING;

-- Step 8: Migrate legacy communications into new interactions table
INSERT INTO interactions (id, customer_id, type, direction, summary, details, time, created_by)
SELECT 
    id, 
    customer_id, 
    type, 
    direction, 
    summary, 
    details, 
    time, 
    'System Migration'
FROM communications
ON CONFLICT (id) DO NOTHING;

-- Step 9: Confirm column existence
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

-- Step 10: Add status column to calendar_events table if not already present
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' NOT NULL;

-- ============================================================
-- LEAD ASSIGNMENT ENGINE TABLES & MIGRATIONS
-- ============================================================

-- Lead Assignment Settings Table
CREATE TABLE IF NOT EXISTS lead_assignment_settings (
    id TEXT PRIMARY KEY DEFAULT 'default_assignment_settings',
    distribution_strategy TEXT DEFAULT 'round_robin' NOT NULL, -- 'round_robin' | 'project_based' | 'source_based' | 'manual' | 'capacity_based'
    auto_assign_leads BOOLEAN DEFAULT true NOT NULL,
    skip_paused_users BOOLEAN DEFAULT true NOT NULL,
    skip_inactive_users BOOLEAN DEFAULT true NOT NULL,
    enable_project_routing BOOLEAN DEFAULT false NOT NULL,
    enable_source_routing BOOLEAN DEFAULT false NOT NULL,
    allow_manager_override BOOLEAN DEFAULT true NOT NULL,
    maintain_assignment_history BOOLEAN DEFAULT true NOT NULL,
    source_routes JSONB DEFAULT '{
      "Facebook": "Sales Executive",
      "Instagram": "Sales Executive",
      "Website": "Sales Executive",
      "Referral": "Sales Executive",
      "Walk-in": "Sales Executive",
      "Landing Page": "Sales Executive"
    }'::jsonb NOT NULL,
    sla_first_contact_mins INTEGER DEFAULT 30 NOT NULL,
    sla_manager_escalate_hours INTEGER DEFAULT 2 NOT NULL,
    sla_auto_reassign_hours INTEGER DEFAULT 24 NOT NULL,
    last_assigned_index_map JSONB DEFAULT '{}'::jsonb NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_by TEXT DEFAULT 'System'
);

-- Lead Assignment History (Audit Trail) Table
CREATE TABLE IF NOT EXISTS lead_assignment_history (
    id TEXT PRIMARY KEY DEFAULT 'assign-' || substring(gen_random_uuid()::text from 1 for 8),
    lead_id TEXT REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
    previous_owner TEXT DEFAULT 'Unassigned' NOT NULL,
    assigned_owner TEXT NOT NULL,
    strategy_used TEXT NOT NULL, -- 'round_robin' | 'project_based' | 'source_based' | 'manual' | 'capacity_based' | 'sla_reassignment'
    reason TEXT NOT NULL,
    assigned_by TEXT DEFAULT 'System' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lead_assignment_history_lead ON lead_assignment_history(lead_id);

-- Initialize Default Lead Assignment Settings if missing
INSERT INTO lead_assignment_settings (id, distribution_strategy)
VALUES ('default_assignment_settings', 'round_robin')
ON CONFLICT (id) DO NOTHING;

-- ALTER STATEMENTS FOR PROJECT COVER IMAGE AND DETAILED PARAMETERS
ALTER TABLE projects ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'New Launch' NOT NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS property_type TEXT DEFAULT 'Apartment' NOT NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS possession_timeline TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_size TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS rera_number TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

-- Negotiation Details Table
CREATE TABLE IF NOT EXISTS negotiation_details (
    id TEXT PRIMARY KEY DEFAULT 'neg-' || substring(gen_random_uuid()::text from 1 for 8),
    opportunity_id TEXT REFERENCES opportunities(id) ON DELETE CASCADE UNIQUE NOT NULL,
    original_price NUMERIC DEFAULT 0 NOT NULL,
    current_offer NUMERIC DEFAULT 0 NOT NULL,
    expected_closing NUMERIC DEFAULT 0 NOT NULL,
    min_approved NUMERIC DEFAULT 0 NOT NULL,
    status TEXT DEFAULT 'started' NOT NULL, -- 'started', 'reviewing', 'waiting_approval', 'counter_sent', 'agreed', 'ready_booking', 'failed'
    outcome TEXT,
    discounts JSONB DEFAULT '[]'::jsonb NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Negotiation Timeline Table
CREATE TABLE IF NOT EXISTS negotiation_timeline (
    id TEXT PRIMARY KEY DEFAULT 'negtl-' || substring(gen_random_uuid()::text from 1 for 8),
    opportunity_id TEXT REFERENCES opportunities(id) ON DELETE CASCADE NOT NULL,
    executive TEXT NOT NULL,
    action_taken TEXT NOT NULL,
    offer_amount NUMERIC DEFAULT 0 NOT NULL,
    customer_response TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_negotiation_details_opportunity ON negotiation_details(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_negotiation_timeline_opportunity ON negotiation_timeline(opportunity_id);

-- ============================================================
-- BOOKINGS OPERATIONAL COLUMNS MIGRATION
-- Adds status tracking, cancellation, and refund columns to
-- the bookings table. All statements are idempotent.
-- Run in Supabase SQL console after initial schema setup.
-- ============================================================

-- Booking lifecycle status
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' NOT NULL;

-- Cancellation tracking
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled_by TEXT;

-- Refund tracking
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS refund_amount NUMERIC DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS refund_status TEXT; -- 'pending' | 'processed' | 'rejected'
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS refund_processed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS refund_reference TEXT;

-- Booking metadata
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS approved_by TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS notes TEXT;

-- Index for fast status-based queries
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_opportunity ON bookings(opportunity_id);

-- ============================================================
-- INVOICES OPERATIONAL COLUMNS MIGRATION
-- Adds payment method, audit, and void tracking columns.
-- ============================================================

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_method TEXT;   -- 'bank_transfer' | 'cheque' | 'cash' | 'upi'
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS void_reason TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS generated_by TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS outstanding_amount NUMERIC DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS issued_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS issued_by TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS snapshot JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_invoices_booking ON invoices(booking_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- ============================================================
-- POST-SALES OPERATIONS TABLES
-- ============================================================

-- Sale Deed Registrations Table
CREATE TABLE IF NOT EXISTS public.registrations (
    id TEXT PRIMARY KEY DEFAULT 'reg-' || substring(gen_random_uuid()::text from 1 for 8),
    booking_id TEXT REFERENCES bookings(id) ON DELETE CASCADE NOT NULL,
    registration_date TIMESTAMP WITH TIME ZONE,
    sub_registrar_office TEXT,
    document_number TEXT,
    stamp_duty NUMERIC DEFAULT 0,
    registration_charges NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'scheduled' NOT NULL,
    created_by TEXT,
    updated_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Property Possessions Table
CREATE TABLE IF NOT EXISTS public.possessions (
    id TEXT PRIMARY KEY DEFAULT 'poss-' || substring(gen_random_uuid()::text from 1 for 8),
    booking_id TEXT REFERENCES bookings(id) ON DELETE CASCADE NOT NULL,
    possession_date TIMESTAMP WITH TIME ZONE,
    keys_handover_status TEXT DEFAULT 'pending' NOT NULL,
    snag_list JSONB DEFAULT '[]'::jsonb NOT NULL,
    handover_checklist JSONB DEFAULT '{}'::jsonb NOT NULL,
    signed_off_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Milestone Payment Schedules Table
CREATE TABLE IF NOT EXISTS public.payment_schedules (
    id TEXT PRIMARY KEY DEFAULT 'sched-' || substring(gen_random_uuid()::text from 1 for 8),
    booking_id TEXT REFERENCES bookings(id) ON DELETE CASCADE NOT NULL,
    milestone_name TEXT NOT NULL,
    percentage NUMERIC DEFAULT 0 NOT NULL,
    amount NUMERIC DEFAULT 0 NOT NULL,
    due_date TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'pending' NOT NULL,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Booking Refunds Table
CREATE TABLE IF NOT EXISTS public.refunds (
    id TEXT PRIMARY KEY DEFAULT 'ref-' || substring(gen_random_uuid()::text from 1 for 8),
    booking_id TEXT REFERENCES bookings(id) ON DELETE CASCADE NOT NULL,
    voucher_number TEXT NOT NULL,
    requested_amount NUMERIC DEFAULT 0 NOT NULL,
    approved_amount NUMERIC DEFAULT 0 NOT NULL,
    status TEXT DEFAULT 'requested' NOT NULL,
    refund_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    payment_method TEXT DEFAULT 'bank_transfer' NOT NULL,
    reference TEXT,
    notes TEXT,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_registrations_booking ON public.registrations(booking_id);
CREATE INDEX IF NOT EXISTS idx_possessions_booking ON public.possessions(booking_id);
CREATE INDEX IF NOT EXISTS idx_payment_schedules_booking ON public.payment_schedules(booking_id);
CREATE INDEX IF NOT EXISTS idx_refunds_booking ON public.refunds(booking_id);

