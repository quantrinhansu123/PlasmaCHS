/**
 * Script tạo tài khoản Shipper trong bảng app_users
 * Usage: node scripts/create-shipper.mjs
 */

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const SUPABASE_URL = 'https://irwpqzdxzulbslrwtpdn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_fzLq6cdeEbXG0mur7RDa6A_Gl2h7wIn';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SHIPPER_CONFIG = {
    name: 'Shipper Test',
    username: 'shipper_test_20260419',
    password: 'Shipper@2026',
    phone: '0909001234',
    role: 'Shipper',
    approval_level: 'Staff',
    department: 'Giao nhận',
    team: 'Vận chuyển',
    sales_group: '',
    nguoi_quan_ly: 'Shipper Test',
    status: 'Hoạt động',
};

async function main() {
    console.log('PlasmaCHS - Tạo tài khoản Shipper\n');

    const { data: existing, error: checkErr } = await supabase
        .from('app_users')
        .select('id, username, role')
        .eq('username', SHIPPER_CONFIG.username)
        .maybeSingle();

    if (checkErr) {
        console.error('Lỗi kiểm tra:', checkErr.message);
        process.exit(1);
    }

    if (existing) {
        console.log(`Tài khoản "${SHIPPER_CONFIG.username}" đã tồn tại (id: ${existing.id}, role: ${existing.role})`);
        process.exit(0);
    }

    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(SHIPPER_CONFIG.password, salt);

    const payload = {
        name: SHIPPER_CONFIG.name,
        username: SHIPPER_CONFIG.username,
        password: hashedPassword,
        phone: SHIPPER_CONFIG.phone,
        role: SHIPPER_CONFIG.role,
        approval_level: SHIPPER_CONFIG.approval_level,
        department: SHIPPER_CONFIG.department,
        team: SHIPPER_CONFIG.team,
        sales_group: SHIPPER_CONFIG.sales_group,
        nguoi_quan_ly: SHIPPER_CONFIG.nguoi_quan_ly,
        status: SHIPPER_CONFIG.status,
        updated_at: new Date().toISOString(),
    };

    const { data: inserted, error: insertErr } = await supabase
        .from('app_users')
        .insert([payload])
        .select('id, username, role, status')
        .single();

    if (insertErr) {
        console.error('Lỗi tạo tài khoản:', insertErr.message);
        process.exit(1);
    }

    console.log('Tạo tài khoản Shipper thành công.');
    console.log('----------------------------------------');
    console.log(`ID       : ${inserted.id}`);
    console.log(`Username : ${inserted.username}`);
    console.log(`Password : ${SHIPPER_CONFIG.password}`);
    console.log(`Role     : ${inserted.role}`);
    console.log(`Status   : ${inserted.status}`);
    console.log('----------------------------------------');
}

main();
