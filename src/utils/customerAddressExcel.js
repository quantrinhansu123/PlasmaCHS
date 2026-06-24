import * as XLSX from 'xlsx';

export const CUSTOMER_ADDRESS_HEADERS = ['Mã KH', 'Địa chỉ'];

const normalizeKey = (value) =>
    String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

const pickCell = (row, ...keys) => {
    for (const key of keys) {
        const val = row?.[key];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
            return String(val).trim();
        }
    }
    const normalizedEntries = Object.entries(row || {}).map(([k, v]) => [normalizeKey(k), v]);
    for (const key of keys) {
        const nk = normalizeKey(key);
        const hit = normalizedEntries.find(([k]) => k === nk);
        if (hit && hit[1] !== undefined && hit[1] !== null && String(hit[1]).trim() !== '') {
            return String(hit[1]).trim();
        }
    }
    return '';
};

export function downloadCustomerAddressTemplate() {
    const exampleData = [
        { 'Mã KH': 'KH00001', 'Địa chỉ': '123 Nguyễn Huệ, Quận 1, TP.HCM' },
        { 'Mã KH': 'KH00002', 'Địa chỉ': '45 Trần Hưng Đạo, Hoàn Kiếm, Hà Nội' },
    ];
    const ws = XLSX.utils.json_to_sheet(exampleData, { header: CUSTOMER_ADDRESS_HEADERS });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cap nhat dia chi KH');
    XLSX.writeFile(wb, 'mau_cap_nhat_dia_chi_khach_hang.xlsx');
}

export async function readCustomerAddressExcel(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const wb = XLSX.read(evt.target.result, { type: 'binary' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                resolve(XLSX.utils.sheet_to_json(ws));
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = () => reject(new Error('Không đọc được file Excel'));
        reader.readAsBinaryString(file);
    });
}

export function parseCustomerAddressRows(rows = []) {
    return (rows || [])
        .map((row, index) => {
            const customerCode = pickCell(row, 'Mã KH', 'Ma KH', 'Mã khách hàng', 'Ma khach hang', 'code');
            const address = pickCell(row, 'Địa chỉ', 'Dia chi', 'Địa chỉ giao nhận', 'address');
            if (!customerCode && !address) return null;
            return {
                rowIndex: index + 2,
                customerCode,
                address,
            };
        })
        .filter(Boolean);
}

export async function importCustomerAddressFromRows(supabaseClient, rows = []) {
    const parsed = parseCustomerAddressRows(rows);
    if (!parsed.length) {
        return {
            updated: 0,
            errors: [{ message: 'File không có dòng hợp lệ (cần cột Mã KH và Địa chỉ).' }],
        };
    }

    const latestByCode = new Map();
    const errors = [];
    for (const row of parsed) {
        if (!row.customerCode || !row.address) {
            errors.push({ row: row.rowIndex, message: 'Thiếu Mã KH hoặc Địa chỉ' });
            continue;
        }
        latestByCode.set(row.customerCode, row);
    }

    const codeList = [...latestByCode.keys()];
    if (!codeList.length) {
        return { updated: 0, errors };
    }

    const existingByCode = new Map();
    for (let i = 0; i < codeList.length; i += 200) {
        const chunk = codeList.slice(i, i + 200);
        const { data, error } = await supabaseClient
            .from('customers')
            .select('id, code')
            .in('code', chunk);
        if (error) throw error;
        (data || []).forEach((customer) => {
            if (customer?.code) existingByCode.set(String(customer.code).trim(), customer);
        });
    }

    let updated = 0;
    const now = new Date().toISOString();
    for (const [code, row] of latestByCode.entries()) {
        const customer = existingByCode.get(code);
        if (!customer) {
            errors.push({ row: row.rowIndex, message: `Không tìm thấy Mã KH "${code}"` });
            continue;
        }

        const { error } = await supabaseClient
            .from('customers')
            .update({ address: row.address, updated_at: now })
            .eq('id', customer.id);
        if (error) {
            errors.push({ row: row.rowIndex, message: error.message || 'Lỗi cập nhật địa chỉ' });
            continue;
        }
        updated += 1;
    }

    return { updated, errors };
}
