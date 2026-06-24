import * as XLSX from 'xlsx';

export const CUSTOMER_MACHINE_RECEIVE_DATE_HEADERS = ['Mã KH', 'Ngày nhận máy'];

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
            return val;
        }
    }
    const normalizedEntries = Object.entries(row || {}).map(([k, v]) => [normalizeKey(k), v]);
    for (const key of keys) {
        const nk = normalizeKey(key);
        const hit = normalizedEntries.find(([k]) => k === nk);
        if (hit && hit[1] !== undefined && hit[1] !== null && String(hit[1]).trim() !== '') {
            return hit[1];
        }
    }
    return '';
};

const toIsoDate = (raw) => {
    if (raw === null || raw === undefined || String(raw).trim() === '') return '';

    if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
        return raw.toISOString().slice(0, 10);
    }

    if (typeof raw === 'number' && Number.isFinite(raw)) {
        const excelEpoch = new Date(Date.UTC(1899, 11, 30));
        const ms = excelEpoch.getTime() + raw * 24 * 60 * 60 * 1000;
        const date = new Date(ms);
        if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
    }

    const text = String(raw).trim();
    const ddmmyyyy = text.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (ddmmyyyy) {
        const day = ddmmyyyy[1].padStart(2, '0');
        const month = ddmmyyyy[2].padStart(2, '0');
        return `${ddmmyyyy[3]}-${month}-${day}`;
    }

    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString().slice(0, 10);
    }
    return '';
};

export function downloadCustomerMachineReceiveDateTemplate() {
    const exampleData = [
        { 'Mã KH': 'KH00001', 'Ngày nhận máy': '2026-06-01' },
        { 'Mã KH': 'KH00002', 'Ngày nhận máy': '2026-06-15' },
    ];
    const ws = XLSX.utils.json_to_sheet(exampleData, { header: CUSTOMER_MACHINE_RECEIVE_DATE_HEADERS });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ngay nhan may KH');
    XLSX.writeFile(wb, 'mau_cap_nhat_ngay_nhan_may.xlsx');
}

export async function readCustomerMachineReceiveDateExcel(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const wb = XLSX.read(evt.target.result, { type: 'binary', cellDates: true });
                const ws = wb.Sheets[wb.SheetNames[0]];
                resolve(XLSX.utils.sheet_to_json(ws, { raw: true }));
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = () => reject(new Error('Không đọc được file Excel'));
        reader.readAsBinaryString(file);
    });
}

export function parseCustomerMachineReceiveDateRows(rows = []) {
    return (rows || [])
        .map((row, index) => {
            const customerCode = String(
                pickCell(row, 'Mã KH', 'Ma KH', 'Mã khách hàng', 'Ma khach hang', 'code') || '',
            ).trim();
            const receivedRaw = pickCell(
                row,
                'Ngày nhận máy',
                'Ngay nhan may',
                'Ngày nhận',
                'machine_received_date',
            );
            const machineReceivedDate = toIsoDate(receivedRaw);
            if (!customerCode && !receivedRaw) return null;
            return {
                rowIndex: index + 2,
                customerCode,
                machineReceivedDate,
            };
        })
        .filter(Boolean);
}

export async function importCustomerMachineReceiveDateFromRows(supabaseClient, rows = []) {
    const parsed = parseCustomerMachineReceiveDateRows(rows);
    if (!parsed.length) {
        return {
            updated: 0,
            errors: [{ message: 'File không có dòng hợp lệ (cần cột Mã KH và Ngày nhận máy).' }],
        };
    }

    const latestByCode = new Map();
    const errors = [];
    for (const row of parsed) {
        if (!row.customerCode || !row.machineReceivedDate) {
            errors.push({ row: row.rowIndex, message: 'Thiếu Mã KH hoặc Ngày nhận máy không hợp lệ' });
            continue;
        }
        latestByCode.set(row.customerCode, row);
    }

    const codeList = [...latestByCode.keys()];
    if (!codeList.length) return { updated: 0, errors };

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
            .update({ machine_received_date: row.machineReceivedDate, updated_at: now })
            .eq('id', customer.id);
        if (error) {
            errors.push({ row: row.rowIndex, message: error.message || 'Lỗi cập nhật ngày nhận máy' });
            continue;
        }
        updated += 1;
    }

    return { updated, errors };
}
