import * as XLSX from 'xlsx';
import { normalizeMachineSerialKey } from './machineCustomerFromOrders';

export const CUSTOMER_MACHINE_LINK_HEADERS = ['Mã KH', 'Mã máy'];

const normalizeKey = (value) =>
    String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

const pickCell = (row, ...keys) => {
    for (const key of keys) {
        if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
            return String(row[key]).trim();
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

const serialVariants = (serialRaw) => {
    const t = String(serialRaw || '').trim();
    if (!t) return [];
    return [...new Set([t, t.replace(/\s+/g, ' ').trim(), t.replace(/\s+/g, '')])].filter(Boolean);
};

const parseExistingMachineSerials = (raw) => {
    const text = String(raw || '').trim();
    if (!text) return [];
    try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
        if (parsed && typeof parsed === 'object') {
            const arr = parsed.serials || parsed.machines || parsed.serial_numbers;
            if (Array.isArray(arr)) return arr.map(String).filter(Boolean);
        }
    } catch {
        /* text / comma */
    }
    return text.split(/[,;|\n]+/).map((s) => s.trim()).filter(Boolean);
};

const mergeMachineSerials = (existingRaw, addedSerials = []) => {
    const set = new Set(parseExistingMachineSerials(existingRaw));
    addedSerials.forEach((s) => {
        const v = String(s || '').trim();
        if (v) set.add(v);
    });
    return [...set].join(', ');
};

export function parseCustomerMachineLinkRows(rows = []) {
    return (rows || [])
        .map((row, index) => {
            const customerCode = pickCell(row, 'Mã KH', 'Ma KH', 'Mã khách hàng', 'Ma khach hang', 'code');
            const machineSerial = pickCell(
                row,
                'Mã máy',
                'Ma may',
                'Mã máy (Serial)',
                'Serial',
                'serial_number',
            );
            if (!customerCode && !machineSerial) return null;
            const nk = normalizeKey(customerCode);
            if (nk.includes('ma kh') && nk.includes('cot')) return null;
            if (nk === 'ma kh' || nk === 'ma may') return null;
            return {
                rowIndex: index + 2,
                customerCode,
                machineSerial,
            };
        })
        .filter(Boolean);
}

export function downloadCustomerMachineLinkTemplate() {
    const exampleData = [
        { 'Mã KH': 'KH00001', 'Mã máy': 'PLT-25D1-50-TM' },
        { 'Mã KH': 'KH00002', 'Mã máy': 'PLT-25D2-50-BV' },
    ];
    const ws = XLSX.utils.json_to_sheet(exampleData, { header: CUSTOMER_MACHINE_LINK_HEADERS });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Gan may cho KH');
    XLSX.writeFile(wb, 'mau_gan_may_khach_hang.xlsx');
}

export async function readCustomerMachineLinkExcel(file) {
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

/**
 * Gán máy (machines.serial_number) cho KH (customers.code).
 * Cập nhật machines.customer_name + customers.machines_in_use.
 */
export async function importCustomerMachineLinksFromRows(supabaseClient, rows = []) {
    const parsed = parseCustomerMachineLinkRows(rows);
    if (!parsed.length) {
        return {
            linked: 0,
            customerUpdates: 0,
            errors: [{ message: 'File không có dòng hợp lệ (cần cột Mã KH và Mã máy).' }],
        };
    }

    /** serial norm → { customerCode, machineSerial, rowIndex } — giữ dòng cuối nếu trùng serial */
    const linkBySerialNorm = new Map();
    const errors = [];

    for (const row of parsed) {
        if (!row.customerCode || !row.machineSerial) {
            errors.push({
                row: row.rowIndex,
                message: 'Thiếu Mã KH hoặc Mã máy',
            });
            continue;
        }
        const norm = normalizeMachineSerialKey(row.machineSerial);
        if (!norm) {
            errors.push({ row: row.rowIndex, message: 'Mã máy không hợp lệ' });
            continue;
        }
        linkBySerialNorm.set(norm, row);
    }

    const customerCodes = [...new Set([...linkBySerialNorm.values()].map((r) => r.customerCode))];
    /** @type {Map<string, { code: string, name: string, machines_in_use?: string }>} */
    const customerByCode = new Map();

    for (let i = 0; i < customerCodes.length; i += 100) {
        const chunk = customerCodes.slice(i, i + 100);
        const { data, error } = await supabaseClient
            .from('customers')
            .select('code, name, machines_in_use')
            .in('code', chunk);
        if (error) throw error;
        (data || []).forEach((customer) => {
            if (customer?.code) customerByCode.set(String(customer.code).trim(), customer);
        });
    }

    const allVariants = new Set();
    for (const row of linkBySerialNorm.values()) {
        serialVariants(row.machineSerial).forEach((v) => allVariants.add(v));
    }

    /** @type {Map<string, { id: string, serial_number: string }>} */
    const machineByNorm = new Map();
    const variantList = [...allVariants];

    for (let i = 0; i < variantList.length; i += 100) {
        const chunk = variantList.slice(i, i + 100);
        const { data, error } = await supabaseClient
            .from('machines')
            .select('id, serial_number')
            .in('serial_number', chunk);
        if (error) throw error;
        (data || []).forEach((machine) => {
            const norm = normalizeMachineSerialKey(machine.serial_number);
            if (norm) machineByNorm.set(norm, machine);
        });
    }

    /** customerCode → serial[] */
    const serialsLinkedByCustomer = new Map();
    let linked = 0;
    const now = new Date().toISOString();

    for (const [serialNorm, row] of linkBySerialNorm.entries()) {
        const customer = customerByCode.get(row.customerCode);
        if (!customer) {
            errors.push({
                row: row.rowIndex,
                message: `Không tìm thấy Mã KH «${row.customerCode}»`,
            });
            continue;
        }

        const machine = machineByNorm.get(serialNorm);
        if (!machine) {
            errors.push({
                row: row.rowIndex,
                message: `Không tìm thấy Mã máy «${row.machineSerial}»`,
            });
            continue;
        }

        const { error: machineError } = await supabaseClient
            .from('machines')
            .update({
                customer_name: customer.name,
                status: 'thuộc khách hàng',
                updated_at: now,
            })
            .eq('id', machine.id);

        if (machineError) {
            errors.push({
                row: row.rowIndex,
                message: machineError.message || 'Lỗi cập nhật máy',
            });
            continue;
        }

        linked += 1;
        const serialStored = String(machine.serial_number || row.machineSerial).trim();
        const list = serialsLinkedByCustomer.get(customer.code) || [];
        list.push(serialStored);
        serialsLinkedByCustomer.set(customer.code, list);
    }

    let customerUpdates = 0;
    for (const [code, serials] of serialsLinkedByCustomer.entries()) {
        const customer = customerByCode.get(code);
        if (!customer) continue;
        const merged = mergeMachineSerials(customer.machines_in_use, serials);
        const { error } = await supabaseClient
            .from('customers')
            .update({ machines_in_use: merged, updated_at: now })
            .eq('code', code);
        if (error) {
            errors.push({ message: `Lỗi cập nhật KH ${code}: ${error.message}` });
            continue;
        }
        customerUpdates += 1;
        customer.machines_in_use = merged;
    }

    return { linked, customerUpdates, errors };
}
