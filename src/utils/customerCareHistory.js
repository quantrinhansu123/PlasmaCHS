import { normalizeVnPhoneDigits } from './phoneNormalize';
import { supabase } from '../supabase/config';

/**
 * Mọi customer_id có cùng SĐT (sau chuẩn hóa) — dùng gom lịch sử chăm sóc.
 * Ưu tiên RPC DB; fallback quét bảng customers (khi chưa chạy migration).
 */
export async function getCustomerIdsForCareHistory(customer) {
    if (!customer?.id) return [];

    const { data, error } = await supabase.rpc('customer_ids_by_same_phone', {
        p_customer_id: customer.id,
    });

    if (!error && Array.isArray(data) && data.length > 0) {
        const ids = data.map((row) => row.customer_id).filter(Boolean);
        if (ids.length) return [...new Set(ids)];
    }

    const norm = normalizeVnPhoneDigits(customer.phone);
    if (!norm || norm.length < 9) return [customer.id];

    const { data: rows, error: scanError } = await supabase
        .from('customers')
        .select('id, phone')
        .not('phone', 'is', null);

    if (scanError) {
        console.warn('getCustomerIdsForCareHistory fallback:', scanError);
        return [customer.id];
    }

    const ids = new Set([customer.id]);
    for (const r of rows || []) {
        if (normalizeVnPhoneDigits(r.phone) === norm) ids.add(r.id);
    }
    return [...ids];
}

/** Lịch sử chăm sóc: cũ → mới, theo mọi bản ghi khách cùng SĐT. */
export async function fetchCareHistoryRows(customer) {
    const ids = await getCustomerIdsForCareHistory(customer);
    const { data, error } = await supabase
        .from('customer_care_history')
        .select('*')
        .in('customer_id', ids)
        .order('assigned_at', { ascending: true })
        .order('id', { ascending: true });

    if (error) {
        console.error('fetchCareHistoryRows:', error);
        return [];
    }

    const rows = data || [];
    const seen = new Set();
    return rows.filter((r) => {
        if (seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
    });
}
