
import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://irwpqzdxzulbslrwtpdn.supabase.co';
const supabaseAnonKey = 'sb_publishable_fzLq6cdeEbXG0mur7RDa6A_Gl2h7wIn';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkData() {
    try {
        console.log('--- WAREHOUSES ---');
        const { data: warehouses, error: wErr } = await supabase.from('warehouses').select('id, name');
        if (wErr) throw wErr;
        console.log(JSON.stringify(warehouses, null, 2));

        console.log('\n--- ORDERS (First 5) ---');
        const { data: orders, error: oErr } = await supabase.from('orders').select('order_code, warehouse').limit(5);
        if (oErr) throw oErr;
        console.log(JSON.stringify(orders, null, 2));

        console.log('\n--- DISTINCT WAREHOUSE VALUES IN ORDERS ---');
        const { data: distinctWarehouses, error: dErr } = await supabase.from('orders').select('warehouse');
        if (dErr) throw dErr;
        const unique = [...new Set(distinctWarehouses?.map(o => o.warehouse) || [])];
        console.log(unique);
    } catch (e) {
        console.error('Error:', e);
    }
}

checkData();
