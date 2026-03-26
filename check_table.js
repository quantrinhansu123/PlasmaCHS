
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://irwpqzdxzulbslrwtpdn.supabase.co';
const supabaseKey = 'sb_publishable_fzLq6cdeEbXG0mur7RDa6A_Gl2h7wIn';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrders() {
    try {
        const { data, error } = await supabase
            .from('orders')
            .select('order_code')
            .ilike('order_code', 'ĐNXM%')
            .limit(10);
        
        if (error) {
            console.log('Error:', error.message);
        } else {
            console.log('ĐNXM orders found:', data);
        }
    } catch (err) {
        console.log('Caught error:', err.message);
    }
}

checkOrders();
