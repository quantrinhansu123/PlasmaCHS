-- Migration: Add support for multiple delivery images and shipper tasks
-- Description: Updates orders table for multiple images and adds shipper role permissions.

-- 1. Update orders table to support multiple image URLs
-- We add delivery_images as a text array to store multiple Supabase URLs
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_images TEXT[] DEFAULT '{}';

-- 2. Add 'shipping_tasks' to app_roles structure
-- This will allow us to control who can see the Shipper Dashboard
-- We also ensure 'Shipper' role exists

INSERT INTO app_roles (name, type, permissions)
VALUES (
    'Shipper',
    'group',
    '{
        "dashboard": {"view": true},
        "orders": {"view": true},
        "shipping_tasks": {"view": true, "edit": true}
    }'::jsonb
)
ON CONFLICT (name) DO UPDATE 
SET permissions = EXCLUDED.permissions,
    type = 'group',
    updated_at = NOW();

-- 3. Create Storage Bucket for delivery proofs if it doesn't exist
-- Note: This is usually done via Supabase Dashboard, but documenting it here.
-- Name: delivery_proofs
-- Public: false (recommended) or true if easy access needed.
