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
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
  try {
    const { data: customers } = await supabase.from('customers').select('agency_name, business_group');
    const { data: warehouses } = await supabase.from('warehouses').select('branch_office');

    const agencies = [...new Set((customers || []).map(a => a.agency_name).filter(Boolean))];
    const groups = [...new Set((customers || []).map(g => g.business_group).filter(Boolean))];
    const branches = [...new Set((warehouses || []).map(w => w.branch_office).filter(Boolean))];

    console.log("AGENCIES:" + JSON.stringify(agencies));
    console.log("GROUPS:" + JSON.stringify(groups));
    console.log("BRANCHES:" + JSON.stringify(branches));
  } catch (err) {
    console.error("Error:", err);
  }
}

checkData();
