-- 1. Create order_items table for dynamic multi-product support
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_type VARCHAR(50) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    
    -- Specific tracking per item
    department VARCHAR(255), -- Dept for this specific item (e.g. Machine A for Dept A, Machine B for Dept B)
    serial_number VARCHAR(255), -- Serial for machines
    assigned_cylinders TEXT[], -- RFID list for this specific item line
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- 2. Migration Script: Move current order data to order_items
-- Migration for Product 1
INSERT INTO order_items (order_id, product_type, quantity, unit_price, total_amount, department, assigned_cylinders)
SELECT 
    id as order_id, 
    product_type, 
    quantity, 
    unit_price, 
    total_amount,
    department,
    assigned_cylinders
FROM orders
WHERE product_type IS NOT NULL AND product_type != '';

-- Migration for Product 2 (if exists)
INSERT INTO order_items (order_id, product_type, quantity, unit_price, total_amount)
SELECT 
    id as order_id, 
    product_type_2, 
    quantity_2, 
    unit_price_2, 
    total_amount_2
FROM orders
WHERE product_type_2 IS NOT NULL AND product_type_2 != '' AND quantity_2 > 0;

-- 3. Comment out old columns (Optional, better to keep for safety during transition)
-- ALTER TABLE orders RENAME COLUMN product_type TO _deprecated_product_type;
-- ALTER TABLE orders RENAME COLUMN quantity TO _deprecated_quantity;
-- ...etc
