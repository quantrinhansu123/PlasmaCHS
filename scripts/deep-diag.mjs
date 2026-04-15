/**
 * Deep diagnostic for Bug 2 & Bug 3
 * Run: node scripts/deep-diag.mjs
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://irwpqzdxzulbslrwtpdn.supabase.co',
    'sb_publishable_fzLq6cdeEbXG0mur7RDa6A_Gl2h7wIn'
);

const PASS = '✅ PASS';
const FAIL = '❌ FAIL';
const WARN = '⚠️  WARN';
const INFO = '   ℹ️  ';
const SEP  = '─'.repeat(60);

// ═══════════════════════════════════════════════════════════
// BUG 2 DEEP ANALYSIS
// ═══════════════════════════════════════════════════════════
async function diagBug2() {
    console.log('\n' + '═'.repeat(60));
    console.log('  BUG 2 DEEP — Price Calculation Analysis');
    console.log('═'.repeat(60));

    // Fetch ALL orders (no limit)
    const { data: orders, error } = await supabase
        .from('orders')
        .select('id, order_code, customer_name, created_at, status, total_amount, total_amount_2, quantity, unit_price, quantity_2, unit_price_2')
        .order('created_at', { ascending: false });

    if (error) { console.log(`${FAIL} ${error.message}`); return; }

    console.log(`\n${INFO} Tổng số đơn trong DB: ${orders.length}`);
    console.log(SEP);

    // Classify each order
    const groups = {
        bothPriceZero: [],       // qty>0 nhưng cả 2 unit_price = 0
        item1PriceZero: [],      // item1 qty>0, price=0
        item2PriceZero: [],      // item2 qty>0, price=0
        totalMismatch: [],       // qty*price ≠ stored total
        correct: [],             // tất cả đúng
        neitherQty: [],          // không có sản phẩm nào qty>0
    };

    orders.forEach(o => {
        const qty1   = Number(o.quantity)     || 0;
        const price1 = Number(o.unit_price)   || 0;
        const act1   = Number(o.total_amount) || 0;
        const qty2   = Number(o.quantity_2)     || 0;
        const price2 = Number(o.unit_price_2)  || 0;
        const act2   = Number(o.total_amount_2) || 0;

        if (qty1 === 0 && qty2 === 0) { groups.neitherQty.push(o); return; }

        let hasError = false;

        if (qty1 > 0 && price1 === 0) { groups.item1PriceZero.push(o); hasError = true; }
        if (qty2 > 0 && price2 === 0) { groups.item2PriceZero.push(o); hasError = true; }

        if (qty1 > 0 && price1 > 0) {
            const exp1 = qty1 * price1;
            if (Math.abs(act1 - exp1) >= 1) {
                groups.totalMismatch.push({ ...o, exp1, act1 });
                hasError = true;
            }
        }
        if (qty2 > 0 && price2 > 0) {
            const exp2 = qty2 * price2;
            if (Math.abs(act2 - exp2) >= 1) {
                groups.totalMismatch.push({ ...o, exp2, act2 });
                hasError = true;
            }
        }

        if (!hasError) groups.correct.push(o);
    });

    // Summary
    console.log('\n📊 Phân loại đơn hàng:');
    console.log(`   Đúng hoàn toàn             : ${groups.correct.length}`);
    console.log(`   Item 1 thiếu đơn giá (=0)  : ${groups.item1PriceZero.length}`);
    console.log(`   Item 2 thiếu đơn giá (=0)  : ${groups.item2PriceZero.length}`);
    console.log(`   Tổng tiền lệch qty×price   : ${groups.totalMismatch.length}`);
    console.log(`   Không có sản phẩm          : ${groups.neitherQty.length}`);

    // Detail: item1 price=0
    if (groups.item1PriceZero.length > 0) {
        console.log(`\n${FAIL} ${groups.item1PriceZero.length} đơn có Item 1 price=0:`);
        console.log(SEP);
        groups.item1PriceZero.slice(0, 10).forEach(o => {
            const date = new Date(o.created_at).toLocaleDateString('vi-VN');
            console.log(`   ${o.order_code || o.id} | ${o.customer_name} | ${date} | status: ${o.status}`);
            console.log(`       qty=${o.quantity}, price=0, total_stored=${Number(o.total_amount).toLocaleString('vi')}đ`);
        });
        if (groups.item1PriceZero.length > 10) console.log(`   ... và ${groups.item1PriceZero.length - 10} đơn khác`);
    }

    // Detail: item2 price=0
    if (groups.item2PriceZero.length > 0) {
        console.log(`\n${FAIL} ${groups.item2PriceZero.length} đơn có Item 2 price=0:`);
        console.log(SEP);
        groups.item2PriceZero.slice(0, 5).forEach(o => {
            const date = new Date(o.created_at).toLocaleDateString('vi-VN');
            console.log(`   ${o.order_code || o.id} | ${o.customer_name} | ${date}`);
            console.log(`       qty2=${o.quantity_2}, price2=0, total2_stored=${Number(o.total_amount_2).toLocaleString('vi')}đ`);
        });
    }

    // Detail: mismatch
    if (groups.totalMismatch.length > 0) {
        console.log(`\n${FAIL} ${groups.totalMismatch.length} đơn có total lệch:`);
        console.log(SEP);
        groups.totalMismatch.slice(0, 10).forEach(o => {
            const date = new Date(o.created_at).toLocaleDateString('vi-VN');
            console.log(`   ${o.order_code || o.id} | ${o.customer_name} | ${date}`);
            if (o.exp1 !== undefined) console.log(`       Item1: ${o.quantity}×${Number(o.unit_price).toLocaleString('vi')} = ${o.exp1.toLocaleString('vi')} | stored: ${o.act1.toLocaleString('vi')}`);
            if (o.exp2 !== undefined) console.log(`       Item2: ${o.quantity_2}×${Number(o.unit_price_2).toLocaleString('vi')} = ${o.exp2.toLocaleString('vi')} | stored: ${o.act2.toLocaleString('vi')}`);
        });
    }

    // Data distribution over time: are old or new orders affected?
    const now = new Date();
    const old30  = groups.item1PriceZero.filter(o => (now - new Date(o.created_at)) > 30*24*3600*1000).length;
    const new30  = groups.item1PriceZero.filter(o => (now - new Date(o.created_at)) <= 30*24*3600*1000).length;
    console.log(`\n${INFO} Phân bổ theo thời gian (item1 price=0):`);
    console.log(`       Đơn > 30 ngày tuổi  : ${old30}`);
    console.log(`       Đơn ≤ 30 ngày gần đây: ${new30}`);
    if (new30 > 0) {
        console.log(`\n${WARN} Còn đơn mới bị lỗi price=0 — cần patch UI warning`);
    } else {
        console.log(`\n${PASS} Đơn mới (30 ngày) không có lỗi price=0`);
    }
}

// ═══════════════════════════════════════════════════════════
// BUG 3 DEEP ANALYSIS
// ═══════════════════════════════════════════════════════════
async function diagBug3() {
    console.log('\n' + '═'.repeat(60));
    console.log('  BUG 3 DEEP — Data Inconsistency Analysis');
    console.log('═'.repeat(60));

    // Fetch ALL customers (success)
    const { data: customers, error: custErr } = await supabase
        .from('customers')
        .select('id, name, current_cylinders, current_machines')
        .eq('status', 'Thành công');

    if (custErr) { console.log(`${FAIL} ${custErr.message}`); return; }
    console.log(`\n${INFO} Tổng KH "Thành công": ${customers.length}`);

    // Fetch ALL cylinders grouped by customer_id
    const { data: allCylinders } = await supabase
        .from('cylinders')
        .select('customer_id, status');

    // Fetch ALL machines
    const { data: allMachines } = await supabase
        .from('machines')
        .select('customer_name, status');

    const cylMap = {};
    (allCylinders || []).forEach(c => {
        cylMap[c.customer_id] = (cylMap[c.customer_id] || 0) + 1;
    });

    const machMap = {};
    (allMachines || []).filter(m => m.status === 'thuộc khách hàng').forEach(m => {
        machMap[m.customer_name] = (machMap[m.customer_name] || 0) + 1;
    });

    // --- Cylinder analysis
    let cylMatch = 0, cylMismatch = 0;
    let cylOver  = 0, cylUnder = 0;
    const cylProblems = [];

    customers.forEach(c => {
        const actual = cylMap[c.id] || 0;
        const stored = c.current_cylinders || 0;
        if (actual === stored) { cylMatch++; }
        else {
            cylMismatch++;
            if (actual > stored) cylOver++;
            else cylUnder++;
            cylProblems.push({ name: c.name, stored, actual, diff: actual - stored });
        }
    });

    console.log(`\n${SEP}\n🔵 CYLINDERS (Bình khí)`);
    console.log(`   Tổng bình trong DB: ${(allCylinders||[]).length}`);
    console.log(`   KH khớp  : ${cylMatch} / ${customers.length}`);
    console.log(`   KH lệch  : ${cylMismatch} (actual > static: ${cylOver}, actual < static: ${cylUnder})`);

    if (cylProblems.length > 0) {
        console.log(`\n${FAIL} Chi tiết KH lệch bình:`);
        cylProblems.sort((a,b)=>Math.abs(b.diff)-Math.abs(a.diff)).forEach(p => {
            const tag = p.diff > 0 ? `+${p.diff}` : `${p.diff}`;
            console.log(`   ${p.name.padEnd(40)} static=${p.stored} | actual=${p.actual} | diff=${tag}`);
        });
    } else {
        console.log(`\n${PASS} Không có lệch bình`);
    }

    // --- Machine analysis
    let machMatch = 0, machMismatch = 0;
    const machProblems = [];

    customers.forEach(c => {
        const actual = machMap[c.name] || 0;
        const stored = c.current_machines || 0;
        if (actual === stored) { machMatch++; }
        else {
            machMismatch++;
            machProblems.push({ name: c.name, stored, actual, diff: actual - stored });
        }
    });

    console.log(`\n${SEP}\n🔵 MACHINES (Máy Plasma - status "thuộc khách hàng")`);
    console.log(`   Tổng máy "thuộc KH": ${Object.values(machMap).reduce((a,b)=>a+b,0)}`);
    console.log(`   KH khớp  : ${machMatch} / ${customers.length}`);
    console.log(`   KH lệch  : ${machMismatch}`);

    if (machProblems.length > 0) {
        console.log(`\n${FAIL} Chi tiết KH lệch máy:`);
        machProblems.sort((a,b)=>Math.abs(b.diff)-Math.abs(a.diff)).forEach(p => {
            const tag = p.diff > 0 ? `+${p.diff}` : `${p.diff}`;
            console.log(`   ${p.name.padEnd(40)} static=${p.stored} | actual=${p.actual} | diff=${tag}`);
        });
    } else {
        console.log(`\n${PASS} Không có lệch máy`);
    }

    // --- Orders: customer_id coverage
    console.log(`\n${SEP}\n🔵 ORDERS — customer_id field coverage`);
    const { data: allOrders } = await supabase
        .from('orders')
        .select('id, order_code, customer_id, customer_name, created_at')
        .order('created_at', { ascending: false });

    if (allOrders) {
        const total   = allOrders.length;
        const withId  = allOrders.filter(o => o.customer_id).length;
        const noId    = allOrders.filter(o => !o.customer_id).length;
        const pct     = ((withId / total) * 100).toFixed(1);

        console.log(`   Tổng đơn hàng         : ${total}`);
        console.log(`   Có customer_id        : ${withId} (${pct}%)`);
        console.log(`   Thiếu customer_id     : ${noId}`);

        // Check if newest orders have customer_id
        const newest5 = allOrders.slice(0, 5);
        console.log(`\n   5 đơn mới nhất:`);
        newest5.forEach(o => {
            const date = new Date(o.created_at).toLocaleDateString('vi-VN');
            const idTag = o.customer_id ? `✅ ${o.customer_id.slice(0,8)}...` : '❌ NULL';
            console.log(`   ${(o.order_code||o.id).padEnd(20)} ${o.customer_name?.slice(0,25).padEnd(26)} customer_id: ${idTag}  (${date})`);
        });

        if (withId === 0) {
            console.log(`\n${FAIL} Không có đơn nào có customer_id — fix OrderFormModal chưa hoạt động`);
        } else if (noId > 0) {
            console.log(`\n${WARN} ${noId} đơn cũ thiếu customer_id — có thể cần backfill bằng script`);
            // Check if we can match by name
            const canMatch = allOrders.filter(o => !o.customer_id && o.customer_name).length;
            console.log(`${INFO} Có thể backfill ${canMatch} đơn từ customer_name → customer_id`);
        } else {
            console.log(`\n${PASS} Tất cả đơn đều có customer_id`);
        }
    }
}

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────
async function main() {
    console.log('\n🔬 PlasmaCHS — Deep Diagnostic: Bug 2 & Bug 3');
    console.log('   Time:', new Date().toLocaleString('vi-VN'));
    await diagBug2();
    await diagBug3();
    console.log('\n' + '═'.repeat(60));
    console.log('  Xong. Kiểm tra kết quả ở trên.');
    console.log('═'.repeat(60) + '\n');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
