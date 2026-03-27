
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://irwpqzdxzulbslrwtpdn.supabase.co';
const supabaseKey = 'sb_publishable_fzLq6cdeEbXG0mur7RDa6A_Gl2h7wIn';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAppUsersSchema() {
    try {
        // Query to check column names from RPC or simply trying to select the problematic column
        const { data, error } = await supabase
            .from('app_users')
            .select('id, name, username, approval_level')
            .limit(1);
        
        if (error) {
            console.log('❌ Error:', error.message);
            if (error.message.includes('approval_level')) {
                console.log('👉 Column "approval_level" is definitely MISSING.');
            }
        } else {
            console.log('✅ Success! Columns exist. Data:', data);
        }
    } catch (err) {
        console.log('Caught error:', err.message);
    }
}

checkAppUsersSchema();
