import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase credentials in .env/.env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function getAnyWarehouse() {
    const { data, error } = await supabase
        .from('warehouses')
        .select('id, name')
        .eq('status', 'Đang hoạt động')
        .order('name')
        .limit(1)
        .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Không tìm thấy kho đang hoạt động để seed.');
    return data;
}

async function ensureInventoryRow(warehouseId, itemType, itemName, quantity = 20) {
    const { data, error } = await supabase
        .from('inventory')
        .upsert(
            [{ warehouse_id: warehouseId, item_type: itemType, item_name: itemName, quantity }],
            { onConflict: 'warehouse_id,item_type,item_name' }
        )
        .select('id, quantity')
        .single();
    if (error) throw error;
    return data;
}

async function seedManualTestData() {
    console.log('Seeding manual test data...');
    const ts = Date.now().toString().slice(-6);
    const nowLabel = new Date().toLocaleString('vi-VN');
    const warehouse = await getAnyWarehouse();

    // 1) Tạo đơn hàng + log kho "bán cho ai/ở chỗ ai/ai giao/ai duyệt/time"
    const orderCode = `SEED-ORD-${ts}`;
    const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([{
            order_code: orderCode,
            customer_category: 'TM',
            warehouse: warehouse.id,
            customer_name: `KH Seed ${ts}`,
            recipient_name: `Người nhận Seed ${ts}`,
            recipient_address: 'Địa chỉ test seed',
            recipient_phone: '0900000000',
            order_type: 'Bán',
            product_type: 'BINH_4L',
            quantity: 1,
            unit_price: 1000000,
            total_amount: 1000000,
            status: 'CHO_GIAO_HANG',
            ordered_by: 'Seeder Bot',
            delivery_unit: 'DVVC Seed'
        }])
        .select('id, order_code')
        .single();
    if (orderError) throw orderError;

    const inventorySale = await ensureInventoryRow(warehouse.id, 'BINH', `Bình seed ${ts}`, 50);
    const { error: txSaleError } = await supabase.from('inventory_transactions').insert([{
        inventory_id: inventorySale.id,
        transaction_type: 'OUT',
        reference_id: orderData.id,
        reference_code: orderCode,
        quantity_changed: 1,
        note: `Bán cho KH Seed ${ts} | Đơn ${orderCode} | Sản phẩm Bình seed ${ts} x1 | Đang ở: KH Seed ${ts} | Kho xuất: ${warehouse.name} | Người giao: DVVC Seed | Người duyệt: Seeder Bot | Thời gian: ${nowLabel}`
    }]);
    if (txSaleError) throw txSaleError;

    // 2) Thu hồi vỏ + log kho "đã về kho/từ đâu về/time"
    const inventoryRecovery = await ensureInventoryRow(warehouse.id, 'BINH', `Bình thu hồi seed ${ts}`, 10);
    const { error: txRecoveryError } = await supabase.from('inventory_transactions').insert([{
        inventory_id: inventoryRecovery.id,
        transaction_type: 'IN',
        reference_code: `THV-SEED-${ts}`,
        quantity_changed: 1,
        note: `Thu hồi vỏ thành công | Bình thu hồi seed ${ts} x1 | Từ: Khách hàng thu hồi seed ${ts} | Về kho: ${warehouse.name} | Trạng thái: đã về kho | Thời gian: ${nowLabel}`
    }]);
    if (txRecoveryError) throw txRecoveryError;

    // 3) Lead để test chốt Thành công + chọn kho gán
    const leadCode = `KHLD${ts}`;
    const { error: leadError } = await supabase.from('customers').insert([{
        code: leadCode,
        name: `Lead test chọn kho ${ts}`,
        phone: `09${ts}001`,
        address: 'Lead seed address',
        category: 'TM',
        status: 'Chưa thành công',
        managed_by: 'Seeder Bot',
        care_by: 'Seeder Bot'
    }]);
    if (leadError) throw leadError;

    // 4) + 5) ĐNXM có kho auto theo khách + sản phẩm ready trong kho + quantity approved khác requested
    const customerCode = `KHSC${ts}`;
    const { data: customerSuccess, error: customerSuccessError } = await supabase
        .from('customers')
        .insert([{
            code: customerCode,
            name: `Khách DNXM seed ${ts}`,
            phone: `08${ts}002`,
            address: 'Customer DNXM seed',
            category: 'TM',
            status: 'Thành công',
            managed_by: 'Seeder Bot',
            care_by: 'Seeder Bot',
            warehouse_id: warehouse.id
        }])
        .select('id, name')
        .single();
    if (customerSuccessError) throw customerSuccessError;

    const serialA = `SEEDM${ts}A`;
    const serialB = `SEEDM${ts}B`;
    const { error: machineError } = await supabase.from('machines').insert([
        {
            serial_number: serialA,
            status: 'sẵn sàng',
            warehouse: warehouse.id,
            machine_type: 'TM'
        },
        {
            serial_number: serialB,
            status: 'sẵn sàng',
            warehouse: warehouse.id,
            machine_type: 'TM'
        }
    ]);
    if (machineError) throw machineError;

    const dnxmCode = `DNXM-SEED-${ts}`;
    const { error: dnxmError } = await supabase.from('orders').insert([{
        order_code: dnxmCode,
        customer_category: 'TM',
        warehouse: warehouse.id,
        customer_name: customerSuccess.name,
        recipient_name: customerSuccess.name,
        recipient_address: 'Địa chỉ DNXM seed',
        recipient_phone: '0911111111',
        order_type: 'DNXM',
        product_type: 'TM',
        quantity: 3, // yêu cầu
        quantity_2: 1, // phê duyệt
        unit_price: 0,
        total_amount: 0,
        status: 'KHO_XU_LY',
        ordered_by: 'Seeder Bot',
        note: `Loại máy: TM.
Sản phẩm: TM.
Ngày cần: 01/01/2026.
Kho: ${warehouse.id}.
Mã máy: ${serialA}.
SL phê duyệt: 1.
Ghi chú: Seed testcase approved qty`
    }]);
    if (dnxmError) throw dnxmError;

    console.log('Seed done.');
    console.log(`- Order sale log: ${orderCode}`);
    console.log(`- Recovery log ref: THV-SEED-${ts}`);
    console.log(`- Lead test code: ${leadCode}`);
    console.log(`- DNXM test code: ${dnxmCode}`);
}

seedManualTestData().catch((error) => {
    console.error('Seed failed:', error.message || error);
    process.exit(1);
});
