const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Try to find VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local
const envPath = path.join(process.cwd(), '.env.local');
let supabaseUrl, supabaseKey;

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const urlMatch = envContent.match(/VITE_SUPABASE_URL\s*=\s*(.*)/);
  const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY\s*=\s*(.*)/);
  if (urlMatch) supabaseUrl = urlMatch[1].trim();
  if (keyMatch) supabaseKey = keyMatch[1].trim();
}

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
  try {
    const { data: agencies } = await supabase.from('customers').select('agency_name').not('agency_name', 'is', null).neq('agency_name', '');
    const { data: groups } = await supabase.from('customers').select('business_group').not('business_group', 'is', null).neq('business_group', '');
    const { data: warehouses } = await supabase.from('warehouses').select('branch_office').not('branch_office', 'is', null).neq('branch_office', '');

    console.log("--- Agencies in Customers ---");
    console.log([...new Set((agencies || []).map(a => a.agency_name).filter(Boolean))]);
    
    console.log("\n--- Business Groups in Customers ---");
    console.log([...new Set((groups || []).map(g => g.business_group).filter(Boolean))]);

    console.log("\n--- Branch Offices in Warehouses ---");
    console.log([...new Set((warehouses || []).map(w => w.branch_office).filter(Boolean))]);
  } catch (err) {
    console.error("Error:", err);
  }
}

checkData();
