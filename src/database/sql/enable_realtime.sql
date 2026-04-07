-- SQL to enable Supabase Realtime for notifications and repair_tickets
-- Run this in your Supabase SQL Editor if real-time events are not being received.

-- 1. Enable replication for 'notifications' table
ALTER publication supabase_realtime ADD TABLE notifications;

-- 2. Enable replication for 'repair_tickets' table
ALTER publication supabase_realtime ADD TABLE repair_tickets;

-- 3. (Optional) Set REPLICA IDENTITY to FULL if you need previous values for UPDATE/DELETE
-- ALTER TABLE notifications REPLICA IDENTITY FULL;
-- ALTER TABLE repair_tickets REPLICA IDENTITY FULL;
