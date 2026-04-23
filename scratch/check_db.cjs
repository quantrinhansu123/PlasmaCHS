const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://irwpqzdxzulbslrwtpdn.supabase.co';
const supabaseAnonKey = 'sb_publishable_fzLq6cdeEbXG0mur7RDa6A_Gl2h7wIn';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkWarehouses() {
    console.log('--- Checking Warehouses ---');
    const { data, error } = await supabase
        .from('warehouses')
        .select('id, name, code')
        .order('name');
    
    if (error) {
        console.error('Error fetching warehouses:', error);
    } else {
        console.table(data);
    }

    console.log('\n--- Checking Orders Warehouse Constraints/Data ---');
    const { data: orders, error: orderError } = await supabase
        .from('orders')
        .select('warehouse')
        .not('warehouse', 'is', null)
        .limit(10);
    
    if (orderError) {
        console.error('Error fetching orders:', orderError);
    } else {
        console.log('Sample warehouse values in orders:', orders.map(o => o.warehouse));
    }
}

checkWarehouses();
