import * as XLSX from 'xlsx';
import { resolveWarehouseCode } from './customerOrderMatch';
import { readExcelFileToRows } from './orderExcelImport';

export { readExcelFileToRows };

export const DNXM_IMPORT_HEADERS = [
    'Mã phiếu (DNXM-123456 hoặc 123456)',
    'Loại khách (BV/TM/PK/NG/SP)',
    'Kho (mã: HN, OCP1, CT...)',
    'Tên khách hàng / cơ sở',
    'Cơ sở / Phòng',
    'SĐT',
    'Địa chỉ đặt máy',
    'Loại máy (TM, SD, FM — cách nhau dấu phẩy)',
    'Sản phẩm / model',
    'Hình thức (Bán, Thuê, Demo...)',
    'Số lượng',
    'SL phê duyệt',
    'Phụ trách máy',
    'Mã máy (serial, cách nhau dấu phẩy)',
    'PT vận chuyển',
    'Ngày cần máy (dd/mm/yyyy)',
    'Ngày giao (dd/mm/yyyy)',
    'Ngày thu hồi dự kiến (dd/mm/yyyy)',
    'NV lập phiếu',
    'Ghi chú',
];

const pickCell = (row, ...keys) => {
    for (const key of keys) {
        const raw = row[key];
        if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
            return String(raw).trim();
        }
    }
    return '';
};

const parseNumber = (value, fallback = 0) => {
    if (value === undefined || value === null || value === '') return fallback;
    const n = Number(String(value).replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : fallback;
};

const mapCustomerCategory = (raw) => {
    const key = String(raw || 'TM')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .trim();
    if (['BV', 'TM', 'PK', 'NG', 'SP'].includes(key)) return key;
    return 'TM';
};

/** Khớp MachineIssueRequestForm: lưu mã như ô «Mã phiếu» (có thể không có tiền tố DNXM-). */
const normalizeDnxmOrderCode = (raw) => {
    const s = String(raw || '').trim();
    if (!s) return `DNXM-${String(Date.now()).slice(-6)}`;
    if (/^DNXM-/i.test(s)) return s.replace(/^DNXM-/i, '');
    return s;
};

const buildDnxmNote = ({
    machineTypes,
    product,
    issueTypes,
    colors,
    dateNeeded,
    dateDelivery,
    dateRecall,
    machineManager,
    shipping,
    warehouse,
    machineCodes,
    quantityApproved,
    notes,
}) => {
    const isSaleIssue = /bán/i.test(issueTypes);
    return `Loại máy: ${machineTypes || 'TM'}. 
Sản phẩm: ${product || ''}.
Hình thức: ${issueTypes || 'Chưa chọn'}.
Màu máy: ${colors || ''}. 
Ngày cần: ${dateNeeded || ''}. 
Giao: ${dateDelivery || ''}. 
${isSaleIssue ? '' : `Thu hồi dự kiến: ${dateRecall || ''}. 
`}
Phụ trách máy: ${machineManager || ''}. 
PT Vận chuyển: ${shipping || ''}. 
Kho: ${warehouse || ''}.
Mã máy: ${machineCodes || ''}. 
SL phê duyệt: ${quantityApproved || ''}.
Ghi chú: ${notes || ''}`;
};

export function buildDnxmImportTemplateRows(warehousesList = []) {
    const sampleWarehouse =
        warehousesList.find((w) => String(w.code || '').toUpperCase() === 'OCP1')?.code
        || warehousesList[0]?.code
        || 'OCP1';

    return [
        {
            'Mã phiếu (DNXM-123456 hoặc 123456)': '',
            'Loại khách (BV/TM/PK/NG/SP)': 'TM',
            'Kho (mã: HN, OCP1, CT...)': sampleWarehouse,
            'Tên khách hàng / cơ sở': 'Thẩm mỹ viện Kangnam',
            'Cơ sở / Phòng': 'Chi nhánh Quận 1',
            'SĐT': '0988123456',
            'Địa chỉ đặt máy': '190 Trường Chinh, Quận 12, TP.HCM',
            'Loại máy (TM, SD, FM — cách nhau dấu phẩy)': 'TM',
            'Sản phẩm / model': 'PlasmaRosy',
            'Hình thức (Bán, Thuê, Demo...)': 'Bán',
            'Số lượng': 1,
            'SL phê duyệt': 1,
            'Phụ trách máy': 'Nguyễn Văn A',
            'Mã máy (serial, cách nhau dấu phẩy)': '',
            'PT vận chuyển': 'Xe Công ty',
            'Ngày cần máy (dd/mm/yyyy)': '15/06/2026',
            'Ngày giao (dd/mm/yyyy)': '16/06/2026',
            'Ngày thu hồi dự kiến (dd/mm/yyyy)': '',
            'NV lập phiếu': 'Nguyễn Thị B',
            'Ghi chú': 'Giao trong giờ hành chính',
        },
    ];
}

export function downloadDnxmImportTemplate(warehousesList = []) {
    const exampleData = buildDnxmImportTemplateRows(warehousesList);
    const ws = XLSX.utils.json_to_sheet(exampleData, { header: DNXM_IMPORT_HEADERS });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mau Import DNXM');
    XLSX.writeFile(wb, 'mau_import_de_nghi_xuat_may.xlsx');
}

export function parseDnxmImportRows(rows = [], { warehousesList = [], defaultRequester = '' } = {}) {
    const usedCodes = new Set();
    const orders = [];
    const errors = [];

    rows.forEach((row, index) => {
        const lineNo = index + 2;
        const customerName = pickCell(row, 'Tên khách hàng / cơ sở', 'Tên khách hàng', 'Khách hàng');
        if (!customerName) {
            errors.push(`Dòng ${lineNo}: thiếu tên khách hàng / cơ sở.`);
            return;
        }

        const facilityName = pickCell(row, 'Cơ sở / Phòng', 'Cơ sở', 'Phòng') || customerName;
        const phone = pickCell(row, 'SĐT', 'Số điện thoại', 'SĐT người nhận') || 'N/A';
        const address = pickCell(row, 'Địa chỉ đặt máy', 'Địa chỉ nhận', 'Địa chỉ') || 'N/A';

        let orderCode = normalizeDnxmOrderCode(
            pickCell(row, 'Mã phiếu (DNXM-123456 hoặc 123456)', 'Mã phiếu', 'Mã đơn', 'Mã ĐNXM'),
        );
        if (usedCodes.has(orderCode)) {
            errors.push(`Dòng ${lineNo}: mã phiếu «${orderCode}» trùng trong file.`);
            return;
        }
        usedCodes.add(orderCode);

        const warehouseRaw = pickCell(row, 'Kho (mã: HN, OCP1, CT...)', 'Kho', 'Kho xuất');
        const warehouseCode = resolveWarehouseCode(warehouseRaw, warehousesList) || warehouseRaw || '';

        const machineTypes = pickCell(
            row,
            'Loại máy (TM, SD, FM — cách nhau dấu phẩy)',
            'Loại máy (TM, SD, FM - cách nhau dấu phẩy)',
            'Loại máy',
        ) || 'TM';
        const typeList = machineTypes.split(',').map((t) => t.trim()).filter(Boolean);
        const dbProductType = typeList.length === 1 ? typeList[0] : 'MAY';

        const quantity = Math.max(1, parseInt(parseNumber(pickCell(row, 'Số lượng', 'SL'), 1), 10) || 1);
        const quantityApproved = pickCell(row, 'SL phê duyệt', 'Số lượng phê duyệt') || String(quantity);

        const note = buildDnxmNote({
            machineTypes,
            product: pickCell(row, 'Sản phẩm / model', 'Sản phẩm'),
            issueTypes: pickCell(row, 'Hình thức (Bán, Thuê, Demo...)', 'Hình thức'),
            colors: '',
            dateNeeded: pickCell(row, 'Ngày cần máy (dd/mm/yyyy)', 'Ngày cần máy'),
            dateDelivery: pickCell(row, 'Ngày giao (dd/mm/yyyy)', 'Ngày giao'),
            dateRecall: pickCell(row, 'Ngày thu hồi dự kiến (dd/mm/yyyy)', 'Ngày thu hồi'),
            machineManager: pickCell(row, 'Phụ trách máy', 'NV phụ trách máy'),
            shipping: pickCell(row, 'PT vận chuyển', 'Phương thức vận chuyển'),
            warehouse: warehouseCode,
            machineCodes: pickCell(row, 'Mã máy (serial, cách nhau dấu phẩy)', 'Mã máy', 'Serial máy'),
            quantityApproved,
            notes: pickCell(row, 'Ghi chú', 'Note'),
        });

        orders.push({
            order_code: orderCode,
            customer_category: mapCustomerCategory(
                pickCell(row, 'Loại khách (BV/TM/PK/NG/SP)', 'Loại khách', 'Loại KH'),
            ),
            warehouse: warehouseCode || null,
            customer_name: customerName,
            recipient_name: facilityName,
            recipient_address: address,
            recipient_phone: phone.replace(/\s/g, ''),
            order_type: 'DNXM',
            product_type: dbProductType,
            quantity,
            unit_price: 0,
            total_amount: 0,
            note,
            ordered_by: pickCell(row, 'NV lập phiếu', 'NVKD', 'Nhân viên lập') || defaultRequester || null,
            status: 'CHO_DUYET',
            shipping_fee: 0,
            assigned_cylinders: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });
    });

    return { orders, errors };
}

export async function importDnxmFromExcelRows(supabaseClient, rows, options = {}) {
    const { orders, errors } = parseDnxmImportRows(rows, options);
    if (errors.length > 0) {
        throw new Error(errors.slice(0, 5).join('\n'));
    }
    if (orders.length === 0) {
        throw new Error('Không có dòng hợp lệ để import.');
    }

    const { data: inserted, error } = await supabaseClient
        .from('orders')
        .insert(orders)
        .select('id, order_code');

    if (error) {
        if (error.code === '23505') {
            throw new Error('Mã phiếu ĐNXM bị trùng trong hệ thống. Kiểm tra cột «Mã phiếu».');
        }
        throw error;
    }

    return { count: inserted?.length || 0, orders: inserted || [] };
}
