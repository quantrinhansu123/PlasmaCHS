import { supabase } from '../supabase/config';
import { formatPhoneNumber, normalizePhoneDigits } from './taxUtils';

/** Khớp bản ghi khách/cơ sở theo customer_id hoặc tên cơ sở (recipient_name). */
export function matchCustomerRecordForOrder(customers, orderLike = {}) {
    if (!Array.isArray(customers) || customers.length === 0) return null;

    const customerId = String(orderLike?.customer_id || orderLike?.customerId || '').trim();
    if (customerId) {
        const byId = customers.find((c) => String(c.id) === customerId);
        if (byId) return byId;
    }

    const facilityKey = String(orderLike?.recipient_name || orderLike?.facilityName || '').trim().toLowerCase();
    if (facilityKey) {
        const byFacility = customers.find((c) => {
            const candidates = [c.name, c.agency_name, c.invoice_company_name]
                .map((v) => String(v || '').trim().toLowerCase())
                .filter(Boolean);
            return candidates.includes(facilityKey);
        });
        if (byFacility) return byFacility;
    }

    return customers[0];
}

export function resolveWarehouseCode(value, warehouseList = []) {
    const raw = String(value || '').trim();
    if (!raw) return '';

    if (!Array.isArray(warehouseList) || warehouseList.length === 0) return raw;

    const normalized = raw.toLowerCase();
    const matched = warehouseList.find((w) => {
        const code = String(w?.code || '').trim().toLowerCase();
        const id = String(w?.id || '').trim().toLowerCase();
        const name = String(w?.name || '').trim().toLowerCase();
        return normalized === code || normalized === id || normalized === name;
    });

    return matched?.code ? String(matched.code).trim() : raw;
}

export function resolveWarehouseCodeFromCustomer(customer, warehouseList = []) {
    if (!customer?.warehouse_id) return '';
    return resolveWarehouseCode(String(customer.warehouse_id).trim(), warehouseList);
}

export async function fetchCustomersByPhone(phone) {
    const formattedPhone = formatPhoneNumber(phone);
    const phoneDigits = normalizePhoneDigits(phone);
    if (phoneDigits.length < 8) return [];

    const lookupValues = [...new Set(
        [formattedPhone, String(phone || '').trim(), phoneDigits].filter(Boolean)
    )];

    for (const candidate of lookupValues) {
        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .eq('phone', candidate);
        if (!error && data?.length) return data;
    }

    const { data, error } = await supabase
        .from('customers')
        .select('*')
        .ilike('phone', `%${phoneDigits.slice(-4)}%`);

    if (error || !data?.length) return [];

    return data.filter((customer) => normalizePhoneDigits(customer.phone) === phoneDigits);
}
