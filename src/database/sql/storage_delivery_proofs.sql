-- Bucket ảnh xác nhận giao hàng (Nhiệm vụ giao hàng / shipper)
-- Chạy trên Supabase SQL Editor nếu upload báo "Bucket not found"

INSERT INTO storage.buckets (id, name, public)
VALUES ('delivery_proofs', 'delivery_proofs', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Policies (authenticated users)
DROP POLICY IF EXISTS "delivery_proofs_select" ON storage.objects;
CREATE POLICY "delivery_proofs_select"
ON storage.objects FOR SELECT
USING (bucket_id = 'delivery_proofs');

DROP POLICY IF EXISTS "delivery_proofs_insert" ON storage.objects;
CREATE POLICY "delivery_proofs_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'delivery_proofs');

DROP POLICY IF EXISTS "delivery_proofs_update" ON storage.objects;
CREATE POLICY "delivery_proofs_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'delivery_proofs');

DROP POLICY IF EXISTS "delivery_proofs_delete" ON storage.objects;
CREATE POLICY "delivery_proofs_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'delivery_proofs');
