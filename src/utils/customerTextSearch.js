/** Tìm khách/cơ sở trên Supabase (dùng chung form đơn, phiếu sửa chữa, …). */
export function appendCustomerTextSearch(query, searchTrimmed) {
    let q = query;
    const t = (searchTrimmed || '').trim();
    if (!t) return q;

    const esc = t.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_').replace(/,/g, '');
    const p = `%${esc}%`;

    let orString = [
        `code.ilike.${p}`,
        `name.ilike.${p}`,
        `phone.ilike.${p}`,
        `address.ilike.${p}`,
        `legal_rep.ilike.${p}`,
        `invoice_company_name.ilike.${p}`,
        `agency_name.ilike.${p}`,
    ].join(',');

    const digits = t.replace(/\D/g, '');
    if (digits.length >= 3) {
        const phoneP = `%${digits.split('').join('%')}%`;
        orString += `,phone.ilike.${phoneP}`;
    }

    return q.or(orString);
}

export const CUSTOMER_PICKER_FIELDS =
    'id, name, address, phone, legal_rep, invoice_company_name, agency_name, machines_in_use, code';
