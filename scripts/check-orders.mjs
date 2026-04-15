/**
 * Deep check: orders customer_id + zero price root cause
 * Run: node scripts/check-orders.mjs
 */
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
    'https://irwpqzdxzulbslrwtpdn.supabase.co',
    'sb_publishable_fzLq6cdeEbXG0mur7RDa6A_Gl2h7wIn'
);

async function main() {
    // 1. Orders + customer_id
    const { data: orders, error } = await sb
        .from('orders')
        .select('id, order_code, customer_id, customer_name, created_at, unit_price, unit_price_2, quantity, quantity_2, product_type, product_type_2, total_amount, ordered_by')
        .order('created_at', { ascending: false });

    if (error) { console.log('Error:', error.message); return; }

    const total  = (orders||[]).length;
    const withId = orders.filter(o => o.customer_id).length;
    const noId   = orders.filter(o => !o.customer_id).length;

    console.log('\n=== ORDERS customer_id coverage ===');
    console.log(`Total: ${total} | Has customer_id: ${withId} | Missing: ${noId}`);
    console.log('\n5 đơn mới nhất:');
    orders.slice(0, 5).forEach(o => {
        const d = new Date(o.created_at).toLocaleDateString('vi-VN');
        const cid = o.customer_id ? o.customer_id.slice(0,8)+'...' : 'NULL';
        console.log(`  [${d}] ${(o.order_code||'?').padEnd(14)} | ${(o.customer_name||'').slice(0,28).padEnd(30)} | customer_id: ${cid}`);
    });

    // 2. Zero price analysis
    console.log('\n=== ZERO PRICE ANALYSIS ===');
    const zeroPriceOrders = orders.filter(o => !Number(o.unit_price));
    console.log(`Đơn có unit_price = 0: ${zeroPriceOrders.length} / ${total}`);

    // By product type
    const byType = {};
    zeroPriceOrders.forEach(o => {
        const t = o.product_type || 'null';
        byType[t] = (byType[t] || 0) + 1;
    });
    console.log('Theo product_type:');
    Object.entries(byType).sort((a,b)=>b[1]-a[1]).forEach(([t,c]) => console.log(`  ${t}: ${c}`));

    // By who created it
    const byUser = {};
    zeroPriceOrders.forEach(o => {
        const u = o.ordered_by || 'unknown';
        byUser[u] = (byUser[u] || 0) + 1;
    });
    console.log('Theo người tạo (ordered_by):');
    Object.entries(byUser).sort((a,b)=>b[1]-a[1]).forEach(([u,c]) => console.log(`  ${u}: ${c}`));

    // By date range
    const now = new Date();
    const last7  = zeroPriceOrders.filter(o => (now - new Date(o.created_at)) <= 7*86400*1000).length;
    const last30 = zeroPriceOrders.filter(o => (now - new Date(o.created_at)) <= 30*86400*1000).length;
    console.log(`Trong 7 ngày gần đây: ${last7} đơn price=0`);
    console.log(`Trong 30 ngày       : ${last30} đơn price=0`);

    // 3. The lệch order (7106: stored 6M vs calc 3M)
    console.log('\n=== ĐƠN LỆCH TOTAL (7106) ===');
    const odd = orders.find(o => o.order_code === '7106');
    if (odd) {
        console.log(`  order_code: ${odd.order_code}`);
        console.log(`  customer: ${odd.customer_name}`);
        console.log(`  product_type: ${odd.product_type}`);
        console.log(`  qty: ${odd.quantity} | price: ${Number(odd.unit_price).toLocaleString('vi')} | exp_total: ${(odd.quantity*odd.unit_price).toLocaleString('vi')}`);
        console.log(`  stored total_amount: ${Number(odd.total_amount).toLocaleString('vi')}`);
        console.log(`  diff: ${(Number(odd.total_amount) - odd.quantity*odd.unit_price).toLocaleString('vi')}`);
    } else {
        console.log('  Không tìm thấy đơn 7106');
    }

    // 4. Bug 3: static vs actual update suggestion
    console.log('\n=== BUG 3 FIX SUGGESTION: customers to update ===');
    const { data: custs } = await sb.from('customers').select('id, name, current_cylinders, current_machines').eq('status', 'Thành công');
    const { data: cyls } = await sb.from('cylinders').select('customer_id');
    const { data: machs } = await sb.from('machines').select('customer_name, status').eq('status', 'thuộc khách hàng');

    const cylMap = {};
    (cyls||[]).forEach(c => { cylMap[c.customer_id] = (cylMap[c.customer_id]||0)+1; });
    const machMap = {};
    (machs||[]).forEach(m => { machMap[m.customer_name] = (machMap[m.customer_name]||0)+1; });

    const toUpdate = [];
    (custs||[]).forEach(c => {
        const actualCyl  = cylMap[c.id]   || 0;
        const actualMach = machMap[c.name] || 0;
        if (actualCyl !== (c.current_cylinders||0) || actualMach !== (c.current_machines||0)) {
            toUpdate.push({ id: c.id, name: c.name, current_cylinders: actualCyl, current_machines: actualMach,
                            old_cyls: c.current_cylinders, old_machs: c.current_machines });
        }
    });

    if (toUpdate.length === 0) {
        console.log('  Không có KH nào cần update');
    } else {
        toUpdate.forEach(c => {
            console.log(`  KH: ${c.name}`);
            console.log(`    cylinders: ${c.old_cyls} → ${c.current_cylinders}`);
            console.log(`    machines : ${c.old_machs} → ${c.current_machines}`);
        });
    }

    // 5. Orders backfill: how many can we auto-match customer_id?
    console.log('\n=== BUG 3: ORDERS BACKFILL — customer_id ===');
    const noIdOrders = orders.filter(o => !o.customer_id && o.customer_name);
    const custsByName = {};
    (custs||[]).forEach(c => { custsByName[c.name] = c.id; });
    const canBackfill = noIdOrders.filter(o => custsByName[o.customer_name]).length;
    const cantBackfill = noIdOrders.filter(o => !custsByName[o.customer_name]).length;
    console.log(`  Đơn thiếu customer_id: ${noIdOrders.length}`);
    console.log(`  Có thể backfill (tên khớp KH): ${canBackfill}`);
    console.log(`  Không thể tự match (tên lạ): ${cantBackfill}`);
    if (cantBackfill > 0) {
        const unmatched = noIdOrders.filter(o => !custsByName[o.customer_name]).map(o=>o.customer_name);
        console.log('  Tên không match:', [...new Set(unmatched)].slice(0,10).join(', '));
    }
}

main().catch(e => { console.error('Error:', e); process.exit(1); });
