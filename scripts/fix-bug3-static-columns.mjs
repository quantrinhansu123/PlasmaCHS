/**
 * Fix Bug 3: Update static columns (current_cylinders, current_machines)
 * from actual data in cylinders/machines tables.
 * Run: node scripts/fix-bug3-static-columns.mjs
 */
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
    'https://irwpqzdxzulbslrwtpdn.supabase.co',
    'sb_publishable_fzLq6cdeEbXG0mur7RDa6A_Gl2h7wIn'
);

async function main() {
    console.log('\n🔧 Fix Bug 3: Sync static columns from actual asset data\n');

    // 1. Fetch all active customers
    const { data: customers, error: custErr } = await sb
        .from('customers')
        .select('id, name, current_cylinders, current_machines')
        .eq('status', 'Thành công');
    if (custErr) { console.log('❌ Lỗi fetch customers:', custErr.message); return; }
    console.log(`ℹ️  Total active customers: ${customers.length}`);

    // 2. Fetch actual cylinder counts per customer_id
    const { data: cyls, error: cylErr } = await sb
        .from('cylinders')
        .select('customer_id');
    if (cylErr) { console.log('❌ Lỗi fetch cylinders:', cylErr.message); return; }

    const cylMap = {};
    (cyls || []).forEach(c => {
        if (c.customer_id) cylMap[c.customer_id] = (cylMap[c.customer_id] || 0) + 1;
    });

    // 3. Fetch actual machine counts per customer_name (status = 'thuộc khách hàng')
    const { data: machs, error: machErr } = await sb
        .from('machines')
        .select('customer_name, status')
        .eq('status', 'thuộc khách hàng');
    if (machErr) { console.log('❌ Lỗi fetch machines:', machErr.message); return; }

    const machMap = {};
    (machs || []).forEach(m => {
        if (m.customer_name) machMap[m.customer_name] = (machMap[m.customer_name] || 0) + 1;
    });

    // 4. Find mismatches + update
    let updated = 0, skipped = 0;

    for (const c of customers) {
        const actualCyl  = cylMap[c.id]   || 0;
        const actualMach = machMap[c.name] || 0;
        const storedCyl  = c.current_cylinders || 0;
        const storedMach = c.current_machines  || 0;

        if (actualCyl === storedCyl && actualMach === storedMach) {
            skipped++;
            continue;
        }

        console.log(`\n📋 Cần update: ${c.name}`);
        console.log(`   Bình:  ${storedCyl} → ${actualCyl}`);
        console.log(`   Máy:   ${storedMach} → ${actualMach}`);

        const { error: updateErr } = await sb
            .from('customers')
            .update({
                current_cylinders: actualCyl,
                current_machines:  actualMach,
            })
            .eq('id', c.id);

        if (updateErr) {
            console.log(`   ❌ FAIL: ${updateErr.message}`);
        } else {
            console.log(`   ✅ Updated OK`);
            updated++;
        }
    }

    console.log(`\n${'─'.repeat(50)}`);
    console.log(`✅ Done: ${updated} KH updated, ${skipped} KH already correct`);
    console.log('');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
