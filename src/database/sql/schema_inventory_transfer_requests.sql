CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS inventory_transfer_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transfer_code VARCHAR(100) NOT NULL UNIQUE,
    from_warehouse_id VARCHAR(50) NOT NULL,
    to_warehouse_id VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'CHO_DUYET',
    note TEXT,
    handover_image_url TEXT,
    items_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_quantity INTEGER NOT NULL DEFAULT 0,
    created_by VARCHAR(255),
    approved_by VARCHAR(255),
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE inventory_transfer_requests
    ADD CONSTRAINT check_transfer_request_status
    CHECK (status IN ('CHO_DUYET', 'DA_DUYET', 'TU_CHOI'));
