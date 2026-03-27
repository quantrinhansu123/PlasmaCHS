
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://irwpqzdxzulbslrwtpdn.supabase.co';
const supabaseKey = 'sb_publishable_fzLq6cdeEbXG0mur7RDa6A_Gl2h7wIn';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCustomerData() {
    try {
        const { data, error } = await supabase
            .from('customers')
            .select('category, managed_by, care_by, status')
            .limit(10);
        
        if (error) {
            console.error('❌ Error:', error.message);
        } else {
            console.log('✅ Success! Data:', JSON.stringify(data, null, 2));
        }
    } catch (err) {
        console.error('Caught error:', err.message);
    }
}

checkCustomerData();
