const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCustomerData() {
  const { data, error } = await supabase
    .from('customers')
    .select('name, category, customer_type, machines_in_use')
    .limit(10);

  if (error) {
    console.error("Error fetching customers:", error);
    return;
  }

  console.log("--- Sample Customer Data ---");
  data.forEach(c => {
    console.log(`Name: ${c.name} | Category: ${c.category} | Type: ${c.customer_type} | Machines: ${c.machines_in_use}`);
  });

  const { data: catStats } = await supabase.rpc('get_distinct_categories').catch(() => ({data: null}));
  if (catStats) {
      console.log("\n--- Distinct Categories (from RPC if exists) ---");
      console.log(catStats);
  } else {
      const { data: cats } = await supabase.from('customers').select('category');
      const uniqueCats = [...new Set((cats || []).map(c => c.category))];
      console.log("\n--- Distinct Categories (from Table) ---");
      console.log(uniqueCats);
  }
}

checkCustomerData();
