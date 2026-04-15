/**
 * Backfill: Cập nhật unit_price cho đơn cũ có price=0
 * bằng cách lấy từ bảng order_items (nếu tồn tại)
 * hoặc skip và chỉ report.
 *
 * Run: node scripts/backfill-orders-price.mjs
 */
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
    'https://irwpqzdxzulbslrwtpdn.supabase.co',
    'sb_publishable_fzLq6cdeEbXG0mur7RDa6A_Gl2h7wIn'
);

async function main() {
    console.log('\n🔧 Backfill: Đơn hàng có unit_price = 0\n');

    // 1. Lấy tất cả đơn có unit_price = 0 nhưng quantity > 0
    const { data: badOrders, error } = await sb
        .from('orders')
        .select('id, order_code, customer_name, quantity, unit_price, total_amount, quantity_2, unit_price_2, total_amount_2')
        .or('unit_price.eq.0,unit_price.is.null')
        .gt('quantity', 0)
        .order('created_at', { ascending: false });

    if (error) { console.log('❌ Error:', error.message); return; }
    console.log(`ℹ️  Tìm thấy ${badOrders.length} đơn có unit_price = 0\n`);

    if (badOrders.length === 0) {
        console.log('✅ Không có đơn nào cần xử lý!');
        return;
    }

    // 2. Kiểm tra order_items xem có giá không
    const orderIds = badOrders.map(o => o.id);
    const { data: items, error: itemsErr } = await sb
        .from('order_items')
        .select('order_id, unit_price, quantity, product_type')
        .in('order_id', orderIds);

    if (itemsErr) { console.log('⚠️  Lỗi order_items:', itemsErr.message); }

    // Build map: order_id → first item with unit_price > 0
    const itemMap = {};
    (items || []).forEach(it => {
        if (it.unit_price > 0 && !itemMap[it.order_id]) {
            itemMap[it.order_id] = it;
        }
    });

    let canFix = 0, cantFix = 0;
    const toUpdate = [];
    const needManual = [];

    badOrders.forEach(o => {
        if (itemMap[o.id]) {
            canFix++;
            const item = itemMap[o.id];
            toUpdate.push({
                id: o.id,
                order_code: o.order_code,
                customer: o.customer_name,
                unit_price: item.unit_price,
                quantity: o.quantity,
                total_amount: o.quantity * item.unit_price,
            });
        } else {
            cantFix++;
            needManual.push({ order_code: o.order_code, customer: o.customer_name, qty: o.quantity });
        }
    });

    console.log(`📊 Có thể auto-fix từ order_items: ${canFix}`);
    console.log(`📊 Cần nhập thủ công (không có giá ở đâu cả): ${cantFix}`);

    // 3. Apply fixes
    if (toUpdate.length > 0) {
        console.log('\n⚡ Auto-fix từ order_items:');
        for (const o of toUpdate) {
            const { error: upErr } = await sb
                .from('orders')
                .update({ unit_price: o.unit_price, total_amount: o.total_amount })
                .eq('id', o.id);
            if (upErr) {
                console.log(`  ❌ ${o.order_code} | ${o.customer}: ${upErr.message}`);
            } else {
                console.log(`  ✅ ${o.order_code} | ${o.customer}: ${o.quantity} × ${o.unit_price.toLocaleString('vi')}đ = ${o.total_amount.toLocaleString('vi')}đ`);
            }
        }
    }

    // 4. Report manual cases
    if (needManual.length > 0) {
        console.log('\n⚠️  Đơn cần nhập giá thủ công (không có price ở đâu cả):');
        console.log('   (Vào app → Đơn hàng → Edit từng đơn và điền giá)');
        console.log('─'.repeat(55));
        needManual.forEach(o => {
            console.log(`  • ${(o.order_code || '?').padEnd(20)} | ${o.customer} (qty: ${o.qty})`);
        });
    }

    console.log('\n' + '─'.repeat(55));
    console.log(`Xong. ${canFix} đơn auto-fixed, ${cantFix} đơn cần nhập thủ công.`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
