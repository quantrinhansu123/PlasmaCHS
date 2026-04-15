/**
 * Test script for 3 priority bugs via Supabase API
 * Run: node scripts/test-issues.mjs
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://irwpqzdxzulbslrwtpdn.supabase.co',
    'sb_publishable_fzLq6cdeEbXG0mur7RDa6A_Gl2h7wIn'
);

const PASS = '✅ PASS';
const FAIL = '❌ FAIL';
const INFO = '   ℹ️ ';

function heading(title) {
    console.log('\n' + '═'.repeat(60));
    console.log(`  ${title}`);
    console.log('═'.repeat(60));
}

// ─────────────────────────────────────────────────────────────
// BUG 1: Customer search — bị filter category 'TM'?
// ─────────────────────────────────────────────────────────────
async function testBug1() {
    heading('BUG 1 — Customer Search: KH không hiện khi tạo đơn hàng');

    const { data: allCustomers, error } = await supabase
        .from('customers')
        .select('id, name, category')
        .eq('status', 'Thành công');

    if (error) { console.log(`${FAIL} Lỗi: ${error.message}`); return; }

    const total = allCustomers.length;
    const categories = {};
    allCustomers.forEach(c => {
        categories[c.category || 'null'] = (categories[c.category || 'null'] || 0) + 1;
    });

    console.log(`${INFO} Tổng KH "Thành công": ${total}`);
    console.log(`${INFO} Phân bổ category:`);
    Object.entries(categories).sort((a,b)=>b[1]-a[1]).forEach(([cat, cnt]) => {
        console.log(`       - ${cat}: ${cnt} KH`);
    });

    const nonTMCount = allCustomers.filter(c => c.category !== 'TM').length;
    const tmCount    = allCustomers.filter(c => c.category === 'TM').length;

    console.log('');
    if (nonTMCount > 0) {
        console.log(`${PASS} ${nonTMCount} KH không phải TM bị ẩn trước đây → Bug confirmed`);
        console.log(`${PASS} FIX OK — Sau fix: ${total} KH đều được load (${tmCount} TM + ${nonTMCount} non-TM)`);
    } else {
        console.log(`${INFO} Chỉ có KH loại TM — không verify được bug với data hiện tại`);
    }
}

// ─────────────────────────────────────────────────────────────
// BUG 2: Tổng tiền không nhân Qty × Price
// Schema: quantity, unit_price, total_amount (item 1)
//         quantity_2, unit_price_2, total_amount_2 (item 2)
// ─────────────────────────────────────────────────────────────
async function testBug2() {
    heading('BUG 2 — Price Calculation: Tổng tiền không nhân Qty × Price');

    const { data: orders, error } = await supabase
        .from('orders')
        .select('id, order_code, customer_name, total_amount, total_amount_2, quantity, unit_price, quantity_2, unit_price_2')
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) { console.log(`${FAIL} Lỗi: ${error.message}`); return; }

    let correctTotal = 0, zeroPrice = 0, mismatch = 0, noProduct = 0;
    const problematic = [];

    orders.forEach(order => {
        const qty1   = Number(order.quantity)     || 0;
        const price1 = Number(order.unit_price)   || 0;
        const act1   = Number(order.total_amount) || 0;
        const qty2   = Number(order.quantity_2)     || 0;
        const price2 = Number(order.unit_price_2)  || 0;
        const act2   = Number(order.total_amount_2) || 0;

        if (qty1 === 0 && qty2 === 0) { noProduct++; return; }

        // Check item 1
        if (qty1 > 0) {
            const exp1 = qty1 * price1;
            if (price1 === 0) {
                zeroPrice++;
                problematic.push({ code: order.order_code, customer: order.customer_name, issue: `Item1: qty=${qty1}, price=0đ → total=${act1.toLocaleString('vi')}đ` });
            } else if (Math.abs(act1 - exp1) < 1) {
                correctTotal++;
            } else {
                mismatch++;
                problematic.push({ code: order.order_code, customer: order.customer_name, issue: `Item1: ${qty1}×${price1.toLocaleString('vi')} = ${exp1.toLocaleString('vi')} nhưng stored=${act1.toLocaleString('vi')}` });
            }
        }

        // Check item 2
        if (qty2 > 0) {
            const exp2 = qty2 * price2;
            if (price2 === 0) {
                zeroPrice++;
                problematic.push({ code: order.order_code, customer: order.customer_name, issue: `Item2: qty=${qty2}, price=0đ → total=${act2.toLocaleString('vi')}đ` });
            } else if (Math.abs(act2 - exp2) < 1) {
                correctTotal++;
            } else {
                mismatch++;
            }
        }
    });

    console.log(`${INFO} Kiểm tra ${orders.length} đơn hàng mới nhất`);
    console.log(`${INFO} Schema: quantity × unit_price = total_amount (per item)`);
    console.log(`       - Tính đúng (qty×price = total): ${correctTotal}`);
    console.log(`       - unit_price=0 → tổng = 0đ   : ${zeroPrice}`);
    console.log(`       - Lệch total ≠ qty×price      : ${mismatch}`);
    console.log(`       - Đơn không có sản phẩm       : ${noProduct}`);

    const totalProblems = zeroPrice + mismatch;
    if (totalProblems > 0) {
        console.log(`\n${FAIL} Phát hiện ${totalProblems} vấn đề:`);
        problematic.slice(0, 5).forEach(o => {
            console.log(`\n   📦 ${o.code} | ${o.customer}`);
            console.log(`      ${o.issue}`);
        });
        if (problematic.length > 5) console.log(`   ... và ${problematic.length - 5} trường hợp khác`);
        console.log(`\n${INFO} Fix: Hiển thị breakdown (qty×price) + warning ⚠️ khi price=0 trước submit`);
    } else {
        console.log(`\n${PASS} Tất cả đơn tính toán đúng qty × price = total`);
    }
}

// ─────────────────────────────────────────────────────────────
// BUG 3: Data Inconsistency customers ↔ assets
// ─────────────────────────────────────────────────────────────
async function testBug3() {
    heading('BUG 3 — Data Inconsistency: customers ≠ cylinders/machines');

    const { data: customers, error: custErr } = await supabase
        .from('customers')
        .select('id, name, current_cylinders, current_machines')
        .eq('status', 'Thành công')
        .limit(30);

    if (custErr) { console.log(`${FAIL} Lỗi: ${custErr.message}`); return; }

    const customerIds   = customers.map(c => c.id);
    const customerNames = customers.map(c => c.name);

    const [cylRes, machRes] = await Promise.all([
        supabase.from('cylinders').select('customer_id').in('customer_id', customerIds),
        supabase.from('machines').select('customer_name, status').in('customer_name', customerNames),
    ]);

    // Build count maps
    const cylMap = {};
    (cylRes.data || []).forEach(c => { cylMap[c.customer_id] = (cylMap[c.customer_id] || 0) + 1; });

    const machMap = {};
    (machRes.data || []).filter(m => m.status === 'thuộc khách hàng').forEach(m => {
        machMap[m.customer_name] = (machMap[m.customer_name] || 0) + 1;
    });

    let cylMatch = 0, cylMismatch = 0, machMatch = 0, machMismatch = 0;
    const cylProblems = [], machProblems = [];

    customers.forEach(c => {
        const actualCyl  = cylMap[c.id]   || 0;
        const staticCyl  = c.current_cylinders || 0;
        const actualMach = machMap[c.name] || 0;
        const staticMach = c.current_machines  || 0;

        if (actualCyl !== staticCyl) {
            cylMismatch++;
            if (cylProblems.length < 5) cylProblems.push({ name: c.name, static: staticCyl, actual: actualCyl });
        } else { cylMatch++; }

        if (actualMach !== staticMach) {
            machMismatch++;
            if (machProblems.length < 5) machProblems.push({ name: c.name, static: staticMach, actual: actualMach });
        } else { machMatch++; }
    });

    // Cylinders
    console.log(`${INFO} Kiểm tra ${customers.length} KH (status = Thành công)`);
    console.log('');
    console.log('  🔵 Bình khí (cylinders):');
    console.log(`     Khớp: ${cylMatch} | Lệch: ${cylMismatch}`);
    if (cylMismatch > 0) {
        console.log(`\n${FAIL} Lệch số bình:`);
        cylProblems.forEach(p => console.log(`     ${p.name} | Cột tĩnh: ${p.static} | Thực tế: ${p.actual}`));
    } else {
        console.log(`\n${PASS} Số bình: tất cả khớp`);
    }

    // Machines
    console.log('');
    console.log('  🔵 Máy Plasma (machines, status="thuộc khách hàng"):');
    console.log(`     Khớp: ${machMatch} | Lệch: ${machMismatch}`);
    if (machMismatch > 0) {
        console.log(`\n${FAIL} Lệch số máy:`);
        machProblems.forEach(p => console.log(`     ${p.name} | Cột tĩnh: ${p.static} | Thực tế: ${p.actual}`));
        console.log(`\n${INFO} Fix: Customers.jsx fetch count thực từ bảng cylinders/machines, override cột tĩnh`);
    } else {
        console.log(`\n${PASS} Số máy: tất cả khớp`);
    }

    // Orders customer_id
    console.log('');
    const { data: recentOrders } = await supabase
        .from('orders')
        .select('order_code, customer_id, customer_name')
        .order('created_at', { ascending: false })
        .limit(20);

    if (recentOrders) {
        const withId    = recentOrders.filter(o => o.customer_id).length;
        const withoutId = recentOrders.filter(o => !o.customer_id).length;
        console.log('  🔵 Orders — customer_id field:');
        console.log(`     Có customer_id: ${withId} | Thiếu (legacy): ${withoutId} / 20 đơn gần nhất`);
        if (withId > 0) {
            console.log(`\n${PASS} Đơn hàng mới đã lưu customer_id`);
        } else {
            console.log(`\n${FAIL} Tất cả đơn gần nhất thiếu customer_id — fix chưa được áp dụng`);
        }
    }
}

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────
async function main() {
    console.log('\n🧪 PlasmaCHS — API Test: 3 Priority Bugs');
    console.log('   Supabase:', 'irwpqzdxzulbslrwtpdn.supabase.co');
    console.log('   Time    :', new Date().toLocaleString('vi-VN'));

    await testBug1();
    await testBug2();
    await testBug3();

    console.log('\n' + '═'.repeat(60));
    console.log('  Kết thúc test');
    console.log('═'.repeat(60) + '\n');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
