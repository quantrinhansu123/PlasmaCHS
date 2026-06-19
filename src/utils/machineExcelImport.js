import * as XLSX from 'xlsx';
import { MACHINE_STATUSES, MACHINE_TYPES } from '../constants/machineConstants';
import {
    applyManagingWarehouseOrFilter,
    buildScopedWarehouseFilterKeys,
    deriveManagingWarehouseCodesFromUser,
} from './orderWarehouseScope';

export const MACHINE_IMPORT_HEADERS = [
    'Mã máy (Serial)',
    'Loại máy (BV/TM/FM/IOT)',
    'Tài khoản máy',
    'Bluetooth MAC',
    'Phiên bản',
    'Thể tích bình',
    'Loại khí',
    'Loại van',
    'Loại đầu phát',
    'Đại lý',
    'Kho quản lý (mã: OCP1, CT, HN...)',
    'Cơ sở đang sử dụng máy',
    'Trạng thái',
    'Ngày bảo trì gần nhất (YYYY-MM-DD)',
    'Loại bảo trì',
    'Ghi chú bảo trì',
    'Ngày bảo trì tiếp theo (YYYY-MM-DD)',
    'Người thực hiện bảo trì',
];

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

const isGuideOrHeaderRow = (row) => {
    const serial = pickCell(row, 'Mã máy (Serial)', 'Serial', 'Mã máy', 'serial_number');
    if (!serial) return true;
    const nk = normalizeKey(serial);
    return (
        nk.includes('ma may')
        || nk === 'serial'
        || nk === 'cot'
        || nk.includes('bat buoc')
    );
};

const parseExcelDate = (value) => {
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString().slice(0, 10);
    }
    const raw = String(value).trim();
    if (!raw) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
    const serial = Number(raw);
    if (Number.isFinite(serial) && serial > 20000) {
        const excelEpoch = new Date(1899, 11, 30);
        const d = new Date(excelEpoch.getTime() + serial * 86400000);
        if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
    const dmY = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (dmY) {
        const [, d, m, y] = dmY;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return raw;
};

const toDateOrNull = (value) => {
    const parsed = parseExcelDate(value);
    if (!parsed || !/^\d{4}-\d{2}-\d{2}$/.test(parsed)) return null;
    return parsed;
};

const sanitizeMachineInsertRow = (row) => {
    const cleaned = { ...row };
    ['bluetooth_mac', 'version', 'cylinder_volume', 'gas_type', 'valve_type', 'emission_head_type',
        'department_in_charge', 'customer_name', 'maintenance_type', 'maintenance_note', 'maintenance_by',
    ].forEach((key) => {
        if (cleaned[key] === '' || cleaned[key] === undefined) cleaned[key] = null;
    });
    cleaned.maintenance_date = toDateOrNull(cleaned.maintenance_date);
    cleaned.next_maintenance_date = toDateOrNull(cleaned.next_maintenance_date);
    if (!cleaned.warehouse) {
        cleaned.warehouse = null;
    }
    return cleaned;
};

const buildWarehouseLookup = (warehousesList = []) => {
    const map = new Map();
    (warehousesList || []).forEach((warehouse) => {
        const storage = String(warehouse?.code || warehouse?.id || '').trim();
        if (!storage) return;
        [warehouse?.name, warehouse?.code, warehouse?.id, warehouse?.branch_office]
            .map((v) => normalizeKey(v))
            .filter(Boolean)
            .forEach((key) => map.set(key, storage));
    });
    return map;
};

const resolveDefaultWarehouseCode = (warehousesList = [], { user, department } = {}) => {
    const fromList = (warehousesList || []).find((w) => w?.code)?.code;
    if (fromList) return String(fromList).trim();
    const derived = deriveManagingWarehouseCodesFromUser({ user, department });
    return derived[0] ? String(derived[0]).toUpperCase() : '';
};

export function resolveMachineWarehouseImportValue(rawValue, warehousesList = [], options = {}) {
    const raw = String(rawValue || '').trim();
    const lookup = buildWarehouseLookup(warehousesList);
    const defaultCode = resolveDefaultWarehouseCode(warehousesList, options);

    if (!raw) return defaultCode || null;

    const fromLookup = lookup.get(normalizeKey(raw));
    if (fromLookup) return fromLookup;

    if (/^[a-z0-9-]{2,}$/i.test(raw)) return raw.toUpperCase();

    return defaultCode || raw;
};

const ALLOWED_MACHINE_TYPES = new Set(['BV', 'TM', 'FM', 'IOT']);

const ALLOWED_MACHINE_STATUSES = new Set(
    MACHINE_STATUSES.map((item) => item.id),
);

const MACHINE_TYPE_ALIASES = {
    bv: 'BV',
    'benh vien': 'BV',
    benhvien: 'BV',
    'benh vien bv': 'BV',
    tm: 'TM',
    'tham my': 'TM',
    thammy: 'TM',
    'tham my tm': 'TM',
    fm: 'FM',
    iot: 'IOT',
    may: 'TM',
    'may tm': 'TM',
    'may tham my': 'TM',
    'may benh vien': 'BV',
};

const inferMachineTypeFromSerial = (serial) => {
    const upper = String(serial || '').trim().toUpperCase();
    if (!upper) return '';

    const suffixMatch = upper.match(/[-_/](BV|TM|FM|IOT)$/);
    if (suffixMatch) return suffixMatch[1];

    const embeddedMatch = upper.match(/(?:^|[-_/])(BV|TM|FM|IOT)(?:$|[-_/])/);
    if (embeddedMatch) return embeddedMatch[1];

    return '';
};

const mapMachineType = (raw, serial = '') => {
    const rawText = String(raw || '').trim();
    const normalized = normalizeKey(rawText);

    if (normalized) {
        if (MACHINE_TYPE_ALIASES[normalized]) {
            return MACHINE_TYPE_ALIASES[normalized];
        }

        const found = MACHINE_TYPES.find(
            (item) =>
                normalizeKey(item.id) === normalized
                || normalizeKey(item.label) === normalized,
        );
        if (found) return found.id;

        const parenMatch = rawText.match(/\((BV|TM|FM|IOT)\)/i);
        if (parenMatch) return parenMatch[1].toUpperCase();

        const upper = rawText.toUpperCase();
        if (ALLOWED_MACHINE_TYPES.has(upper)) return upper;

        for (const [alias, typeId] of Object.entries(MACHINE_TYPE_ALIASES)) {
            if (normalized.includes(alias) || alias.includes(normalized)) {
                return typeId;
            }
        }
    }

    const fromSerial = inferMachineTypeFromSerial(serial);
    if (fromSerial) return fromSerial;

    return 'TM';
};

const mapMachineStatus = (rawStatus, facilityName) => {
    const statusVal = String(rawStatus || '').trim();
    if (statusVal) {
        const found = MACHINE_STATUSES.find(
            (item) =>
                normalizeKey(item.label) === normalizeKey(statusVal)
                || normalizeKey(item.id) === normalizeKey(statusVal),
        );
        if (found) return found.id;

        const lowered = statusVal.toLowerCase();
        if (ALLOWED_MACHINE_STATUSES.has(lowered)) return lowered;
    }

    if (facilityName) return 'thuộc khách hàng';
    return 'sẵn sàng';
};

export function buildMachineImportTemplateRows(warehousesList = [], options = {}) {
    const sampleWarehouse =
        resolveDefaultWarehouseCode(warehousesList, options)
        || warehousesList[0]?.code
        || warehousesList[0]?.name
        || 'OCP1';

    return [
        {
            'Mã máy (Serial)': 'PLT-25D1-50-TM',
            'Loại máy (BV/TM/FM/IOT)': 'TM',
            'Tài khoản máy': 'ACC-001',
            'Bluetooth MAC': '00:1A:2B:3C:4D:5E',
            'Phiên bản': 'V1.0',
            'Thể tích bình': 'Bình 4L/ CGA870',
            'Loại khí': 'ArgonMed',
            'Loại van': 'Van Messer',
            'Loại đầu phát': 'Tia thường',
            'Đại lý': 'Đại lý A',
            'Kho quản lý (mã: OCP1, CT, HN...)': sampleWarehouse,
            'Cơ sở đang sử dụng máy': 'Bệnh viện Đa khoa Tỉnh',
            'Trạng thái': 'Sẵn sàng',
            'Ngày bảo trì gần nhất (YYYY-MM-DD)': '2023-10-01',
            'Loại bảo trì': 'Bảo dưỡng',
            'Ghi chú bảo trì': 'Thay dây dẫn khí',
            'Ngày bảo trì tiếp theo (YYYY-MM-DD)': '2024-01-01',
            'Người thực hiện bảo trì': 'Nguyễn Văn A',
        },
    ];
};

export function downloadMachineImportTemplate(warehousesList = [], options = {}) {
    const exampleData = buildMachineImportTemplateRows(warehousesList, options);
    const ws = XLSX.utils.json_to_sheet(exampleData, { header: MACHINE_IMPORT_HEADERS });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mẫu import máy');

    const guideRows = [
        { Cột: 'Mã máy (Serial)', 'Bắt buộc': 'Có', 'Ghi chú': 'Mã duy nhất, không trùng' },
        { Cột: 'Loại máy', 'Bắt buộc': 'Không', 'Ghi chú': 'BV / TM / FM / IOT' },
        { Cột: 'Kho quản lý', 'Bắt buộc': 'Không', 'Ghi chú': 'Mã kho: OCP1, CT, HN...' },
        { Cột: 'Trạng thái', 'Bắt buộc': 'Không', 'Ghi chú': MACHINE_STATUSES.map((s) => s.label).join(', ') },
    ];
    const guideWs = XLSX.utils.json_to_sheet(guideRows);
    XLSX.utils.book_append_sheet(wb, guideWs, 'Hướng dẫn');

    XLSX.writeFile(wb, 'mau_import_may_moc.xlsx');
};

export function readExcelFileToRows(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const wb = XLSX.read(evt.target.result, { type: 'binary', cellDates: true });
                const sheetName =
                    wb.SheetNames.find((name) => /mẫu|mau|import/i.test(name))
                    || wb.SheetNames.find((name) => !/hướng dẫn|huong dan/i.test(name))
                    || wb.SheetNames[0];
                const ws = wb.Sheets[sheetName];
                if (!ws) {
                    reject(new Error('Không tìm thấy sheet dữ liệu trong file Excel'));
                    return;
                }
                const rows = XLSX.utils.sheet_to_json(ws, { raw: false, dateNF: 'yyyy-mm-dd' });
                resolve((rows || []).filter((row) => !isGuideOrHeaderRow(row)));
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error('Không đọc được file Excel'));
        reader.readAsBinaryString(file);
    });
}

export function mapExcelRowsToMachines(rows = [], warehousesList = [], options = {}) {
    const { allowedWarehouseCodes = null } = options;
    const allowedSet = allowedWarehouseCodes?.length
        ? new Set(allowedWarehouseCodes.map((code) => normalizeKey(code)))
        : null;

    return (rows || [])
        .map((row) => {
            const serial = pickCell(row, 'Mã máy (Serial)', 'Serial', 'Mã máy', 'serial_number');
            if (!serial) return null;

            const facilityName = pickCell(
                row,
                'Cơ sở đang sử dụng máy',
                'Khách hàng đang sử dụng máy',
                'Khách hàng',
                'customer_name',
            );
            const statusRaw = pickCell(row, 'Trạng thái', 'status');
            const warehouseRaw = pickCell(
                row,
                'Kho quản lý (mã: OCP1, CT, HN...)',
                'Kho quản lý',
                'Kho',
                'warehouse',
            );
            const warehouse = resolveMachineWarehouseImportValue(warehouseRaw, warehousesList, options);

            if (allowedSet && warehouse) {
                const whKey = normalizeKey(warehouse);
                const allowed = [...allowedSet].some(
                    (code) => code === whKey || whKey.includes(code) || code.includes(whKey),
                );
                if (!allowed) return null;
            }

            return sanitizeMachineInsertRow({
                serial_number: serial,
                machine_type: mapMachineType(
                    pickCell(row, 'Loại máy (BV/TM/FM/IOT)', 'Loại máy', 'machine_type'),
                    serial,
                ),
                machine_account: pickCell(row, 'Tài khoản máy', 'machine_account') || serial,
                bluetooth_mac: pickCell(row, 'Bluetooth MAC', 'bluetooth_mac') || null,
                version: pickCell(row, 'Phiên bản', 'version') || null,
                cylinder_volume: pickCell(row, 'Thể tích bình', 'cylinder_volume') || null,
                gas_type: pickCell(row, 'Loại khí', 'gas_type') || null,
                valve_type: pickCell(row, 'Loại van', 'valve_type') || null,
                emission_head_type: pickCell(row, 'Loại đầu phát', 'emission_head_type') || null,
                department_in_charge: pickCell(row, 'Đại lý', 'department_in_charge') || null,
                warehouse,
                customer_name: facilityName || null,
                status: mapMachineStatus(statusRaw, facilityName),
                maintenance_date: toDateOrNull(pickCell(row, 'Ngày bảo trì gần nhất (YYYY-MM-DD)', 'maintenance_date')),
                maintenance_type: pickCell(row, 'Loại bảo trì', 'maintenance_type') || null,
                maintenance_note: pickCell(row, 'Ghi chú bảo trì', 'maintenance_note') || null,
                next_maintenance_date: toDateOrNull(
                    pickCell(row, 'Ngày bảo trì tiếp theo (YYYY-MM-DD)', 'next_maintenance_date'),
                ),
                maintenance_by: pickCell(row, 'Người thực hiện bảo trì', 'maintenance_by') || null,
            });
        })
        .filter(Boolean);
};

/** Trùng Serial trong cùng file Excel → giữ dòng cuối. */
const dedupeMachinesBySerial = (machines = []) => {
    const bySerial = new Map();
    (machines || []).forEach((row) => {
        const key = String(row?.serial_number || '').trim();
        if (!key) return;
        bySerial.set(key.toLowerCase(), { ...row, serial_number: key });
    });
    return [...bySerial.values()];
};

const upsertMachines = async (supabaseClient, machines = []) => {
    const CHUNK_SIZE = 100;
    let written = 0;

    for (let i = 0; i < machines.length; i += CHUNK_SIZE) {
        const chunk = machines.slice(i, i + CHUNK_SIZE);
        const { error } = await supabaseClient
            .from('machines')
            .upsert(chunk, { onConflict: 'serial_number' });

        if (!error) {
            written += chunk.length;
            continue;
        }

        if (error.code !== '23505') {
            throw error;
        }

        for (const row of chunk) {
            const { error: rowError } = await supabaseClient
                .from('machines')
                .upsert([row], { onConflict: 'serial_number' });
            if (rowError) throw rowError;
            written += 1;
        }
    }

    return written;
};

export async function clearMachinesBeforeImport(supabaseClient, options = {}) {
    const {
        warehousesList = [],
        allowedWarehouseCodes = null,
        warehouseFilterKeys = [],
        user,
        department,
    } = options;

    const scopedKeys = (warehouseFilterKeys || []).filter(Boolean);
    const hasScope = Boolean(allowedWarehouseCodes?.length) || scopedKeys.length > 0;

    if (!hasScope) {
        const { error } = await supabaseClient
            .from('machines')
            .delete()
            .not('serial_number', 'is', null);
        if (error) throw error;
        return;
    }

    const keys = scopedKeys.length
        ? scopedKeys
        : buildScopedWarehouseFilterKeys(
            (warehousesList || []).filter((warehouse) => {
                if (!allowedWarehouseCodes?.length) return true;
                const allowed = allowedWarehouseCodes.map((code) => normalizeKey(code));
                const candidates = [
                    warehouse?.code,
                    warehouse?.name,
                    warehouse?.id,
                ].map((value) => normalizeKey(value));
                return candidates.some((candidate) =>
                    allowed.some((code) => candidate === code || candidate.includes(code) || code.includes(candidate)),
                );
            }),
        );

    const derivedCodes = deriveManagingWarehouseCodesFromUser({ user, department })
        .map((code) => String(code).toUpperCase());
    const deleteKeys = [...new Set([...keys, ...derivedCodes].filter(Boolean))];

    if (!deleteKeys.length) {
        throw new Error('Không xác định được kho để xóa dữ liệu máy cũ.');
    }

    let query = supabaseClient.from('machines').delete();
    query = applyManagingWarehouseOrFilter(query, {
        warehouseColumn: 'warehouse',
        warehouseKeys: deleteKeys,
        noAccessValue: '__NO_MACHINES_TO_DELETE__',
    });

    const { error } = await query;
    if (error) throw error;
}

export async function importMachinesFromExcelRows(supabaseClient, rows = [], options = {}) {
    const machinesToInsert = dedupeMachinesBySerial(
        mapExcelRowsToMachines(rows, options.warehousesList || [], options),
    );

    if (!machinesToInsert.length) {
        throw new Error('Không tìm thấy dữ liệu hợp lệ (thiếu mã máy hoặc kho không thuộc phạm vi quản lý).');
    }

    const invalidTypes = machinesToInsert.filter((row) => !ALLOWED_MACHINE_TYPES.has(row.machine_type));
    if (invalidTypes.length > 0) {
        const samples = invalidTypes
            .slice(0, 3)
            .map((row) => `${row.serial_number}: "${row.machine_type}"`)
            .join(', ');
        throw new Error(
            `Loại máy không hợp lệ (chỉ BV / TM / FM / IOT). Ví dụ: ${samples}`,
        );
    }

    const invalidStatuses = machinesToInsert.filter((row) => !ALLOWED_MACHINE_STATUSES.has(row.status));
    if (invalidStatuses.length > 0) {
        const samples = invalidStatuses
            .slice(0, 3)
            .map((row) => `${row.serial_number}: "${row.status}"`)
            .join(', ');
        throw new Error(
            `Trạng thái không hợp lệ. Ví dụ: ${samples}`,
        );
    }

    if (options.clearExisting) {
        await clearMachinesBeforeImport(supabaseClient, options);
    }

    try {
        const count = await upsertMachines(supabaseClient, machinesToInsert);
        return { count };
    } catch (error) {
        if (String(error.message || '').includes('check_machine_type')) {
            throw new Error('Loại máy không hợp lệ. Cột «Loại máy» chỉ nhận: BV, TM, FM hoặc IOT.');
        }
        if (String(error.message || '').includes('check_machine_status')) {
            throw new Error('Trạng thái máy không hợp lệ. Dùng: Sẵn sàng, Thuộc khách hàng, Kiểm tra, Đang sửa, Bảo trì...');
        }
        throw error;
    }
}
