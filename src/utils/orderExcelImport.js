import * as XLSX from 'xlsx';
import { resolveWarehouseCode } from './customerOrderMatch';

export const ORDER_IMPORT_HEADERS = [
    'Mã đơn hàng',
    'Loại khách (BV/TM/PK/NG/SP)',
    'Kho (mã: HN, OCP1, CT...)',
    'Tên khách hàng / cơ sở',
    'Người nhận',
    'Địa chỉ nhận',
    'SĐT người nhận',
    'Loại đơn (BAN/THUE/DEMO/NGOAI_GIAO/NGHIEN_CUU)',
    'Loại hàng (BINH_4L/BINH_8L/TM/SD/FM/MAY_ROSY...)',
    'Số lượng',
    'Đơn giá',
    'Khoa / Mã máy',
    'Ghi chú',
    'Mã khuyến mãi',
    'NV kinh doanh',
];

const ORDER_TYPE_ALIASES = {
    BAN: 'BAN',
    'ĐƠN BÁN': 'BAN',
    THUE: 'THUE',
    'ĐƠN THUÊ': 'THUE',
    DEMO: 'DEMO',
    'DÙNG THỬ': 'DEMO',
    NGOAI_GIAO: 'NGOAI_GIAO',
    'NGOẠI GIAO': 'NGOAI_GIAO',
    NGHIEN_CUU: 'NGHIEN_CUU',
    'NGHIÊN CỨU': 'NGHIEN_CUU',
};

const normalizeKey = (value) =>
    String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .trim();

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

const mapOrderType = (raw) => {
    const key = normalizeKey(raw);
    if (!key) return 'BAN';
    return ORDER_TYPE_ALIASES[key] || key;
};

const mapProductType = (raw) => {
    const key = normalizeKey(raw);
    if (!key) return 'BINH_4L';
    if (key.includes('BINH') && key.includes('8')) return 'BINH_8L';
    if (key.includes('BINH') && key.includes('4')) return 'BINH_4L';
    if (key === 'BINH 4L' || key === 'BINH4L') return 'BINH_4L';
    if (key === 'BINH 8L' || key === 'BINH8L') return 'BINH_8L';
    return key;
};

const mapCustomerCategory = (raw) => {
    const key = normalizeKey(raw);
    if (['BV', 'TM', 'PK', 'NG', 'SP'].includes(key)) return key;
    return 'BV';
};

export function buildOrderImportTemplateRows(warehousesList = []) {
    const sampleWarehouse =
        warehousesList.find((w) => String(w.code || '').toUpperCase() === 'OCP1')?.code
        || warehousesList[0]?.code
        || 'OCP1';

    return [
        {
            'Mã đơn hàng': '',
            'Loại khách (BV/TM/PK/NG/SP)': 'BV',
            'Kho (mã: HN, OCP1, CT...)': sampleWarehouse,
            'Tên khách hàng / cơ sở': 'Bệnh viện Đa khoa Tỉnh',
            'Người nhận': 'Nguyễn Văn A',
            'Địa chỉ nhận': '123 Đường ABC, Quận 1, TP.HCM',
            'SĐT người nhận': '0912345678',
            'Loại đơn (BAN/THUE/DEMO/NGOAI_GIAO/NGHIEN_CUU)': 'BAN',
            'Loại hàng (BINH_4L/BINH_8L/TM/SD/FM/MAY_ROSY...)': 'BINH_4L',
            'Số lượng': 2,
            'Đơn giá': 1500000,
            'Khoa / Mã máy': 'Khoa Nội',
            'Ghi chú': 'Giao trong giờ hành chính',
            'Mã khuyến mãi': '',
            'NV kinh doanh': 'Nguyễn Thị B',
        },
    ];
}

export function downloadOrderImportTemplate(warehousesList = []) {
    const exampleData = buildOrderImportTemplateRows(warehousesList);
    const ws = XLSX.utils.json_to_sheet(exampleData, { header: ORDER_IMPORT_HEADERS });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mau Import Don Hang');
    XLSX.writeFile(wb, 'mau_import_don_hang.xlsx');
}

export function parseOrderImportRows(rows = [], { warehousesList = [], defaultOrderedBy = '' } = {}) {
    const usedCodes = new Set();
    const orders = [];
    const errors = [];

    rows.forEach((row, index) => {
        const lineNo = index + 2;
        const customerName = pickCell(row, 'Tên khách hàng / cơ sở', 'Tên khách hàng', 'Khách hàng');
        const recipientName = pickCell(row, 'Người nhận', 'Tên người nhận');
        const recipientAddress = pickCell(row, 'Địa chỉ nhận', 'Địa chỉ');
        const recipientPhone = pickCell(row, 'SĐT người nhận', 'Số điện thoại', 'SĐT');
        const quantity = Math.max(1, parseInt(parseNumber(pickCell(row, 'Số lượng', 'SL'), 1), 10) || 1);
        const unitPrice = Math.max(0, parseNumber(pickCell(row, 'Đơn giá', 'Đơn Giá'), 0));

        if (!customerName) {
            errors.push(`Dòng ${lineNo}: thiếu tên khách hàng / cơ sở.`);
            return;
        }
        if (!recipientName || !recipientAddress || !recipientPhone) {
            errors.push(`Dòng ${lineNo}: thiếu người nhận / địa chỉ / SĐT.`);
            return;
        }

        let orderCode = pickCell(row, 'Mã đơn hàng', 'Mã ĐH', 'Mã đơn');
        if (!orderCode) {
            do {
                orderCode = String(Math.floor(100000 + Math.random() * 900000));
            } while (usedCodes.has(orderCode));
        }
        if (usedCodes.has(orderCode)) {
            errors.push(`Dòng ${lineNo}: mã đơn «${orderCode}» bị trùng trong file.`);
            return;
        }
        usedCodes.add(orderCode);

        const warehouseRaw = pickCell(row, 'Kho (mã: HN, OCP1, CT...)', 'Kho', 'Kho xuất');
        const warehouse = resolveWarehouseCode(warehouseRaw, warehousesList) || warehouseRaw || null;

        const productType = mapProductType(pickCell(row, 'Loại hàng (BINH_4L/BINH_8L/TM/SD/FM/MAY_ROSY...)', 'Loại hàng', 'Hàng hóa'));
        const totalAmount = quantity * unitPrice;

        orders.push({
            order_code: orderCode,
            customer_category: mapCustomerCategory(
                pickCell(row, 'Loại khách (BV/TM/PK/NG/SP)', 'Loại khách', 'Loại KH'),
            ),
            warehouse,
            customer_name: customerName,
            recipient_name: recipientName,
            recipient_address: recipientAddress,
            recipient_phone: recipientPhone.replace(/\s/g, ''),
            order_type: mapOrderType(
                pickCell(row, 'Loại đơn (BAN/THUE/DEMO/NGOAI_GIAO/NGHIEN_CUU)', 'Loại đơn', 'Loại ĐH'),
            ),
            note: pickCell(row, 'Ghi chú', 'Note') || null,
            product_type: productType,
            quantity,
            unit_price: unitPrice,
            total_amount: totalAmount,
            department: pickCell(row, 'Khoa / Mã máy', 'Khoa', 'Mã máy') || null,
            promotion_code: pickCell(row, 'Mã khuyến mãi', 'Khuyến mãi') || null,
            ordered_by: pickCell(row, 'NV kinh doanh', 'Nhân viên KD', 'NVKD') || defaultOrderedBy || null,
            status: 'CHO_DUYET',
            shipping_fee: 0,
            assigned_cylinders: null,
            updated_at: new Date().toISOString(),
        });
    });

    return { orders, errors };
}

export async function importOrdersFromExcelRows(supabaseClient, rows, options = {}) {
    const { orders, errors } = parseOrderImportRows(rows, options);
    if (errors.length > 0) {
        throw new Error(errors.slice(0, 5).join('\n'));
    }
    if (orders.length === 0) {
        throw new Error('Không có dòng hợp lệ để import.');
    }

    const { data: inserted, error } = await supabaseClient
        .from('orders')
        .insert(orders)
        .select('id, order_code, product_type, quantity, unit_price, department');

    if (error) {
        if (error.code === '23505') {
            throw new Error('Mã đơn hàng bị trùng trong hệ thống. Vui lòng kiểm tra cột «Mã đơn hàng».');
        }
        throw error;
    }

    const itemsPayload = (inserted || []).map((order, idx) => ({
        order_id: order.id,
        product_type: order.product_type || orders[idx]?.product_type,
        quantity: order.quantity || orders[idx]?.quantity || 1,
        unit_price: order.unit_price ?? orders[idx]?.unit_price ?? 0,
        total_amount: (order.quantity || orders[idx]?.quantity || 1) * (order.unit_price ?? orders[idx]?.unit_price ?? 0),
        department: order.department || orders[idx]?.department || null,
        serial_number: null,
        assigned_cylinders: null,
    }));

    if (itemsPayload.length > 0) {
        const { error: itemsError } = await supabaseClient.from('order_items').insert(itemsPayload);
        if (itemsError) throw itemsError;
    }

    return { count: inserted?.length || 0, orders: inserted || [] };
}

export async function readExcelFileToRows(file) {
    const bstr = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (evt) => resolve(evt.target.result);
        reader.onerror = () => reject(new Error('Không đọc được file Excel.'));
        reader.readAsBinaryString(file);
    });

    const wb = XLSX.read(bstr, { type: 'binary' });
    const wsname = wb.SheetNames[0];
    const ws = wb.Sheets[wsname];
    return XLSX.utils.sheet_to_json(ws);
}
