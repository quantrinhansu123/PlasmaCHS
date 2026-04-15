/**
 * Script tạo tài khoản Admin trong bảng app_users
 * Usage: node scripts/create-admin.mjs
 *
 * Thông tin tài khoản sẽ tạo:
 *   username : admin
 *   password : Admin@2024
 *   role     : Admin
 *   approval : Admin
 */

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const SUPABASE_URL = 'https://irwpqzdxzulbslrwtpdn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_fzLq6cdeEbXG0mur7RDa6A_Gl2h7wIn';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── CONFIG: Thay đổi các thông tin bên dưới nếu cần ─────────────────────────
const ADMIN_CONFIG = {
    name:           'Quản Trị Hệ Thống',
    username:       'admin',
    password:       'Admin@2024',         // ← đổi mật khẩu tại đây nếu muốn
    phone:          '0901234567',
    role:           'Admin',
    approval_level: 'Admin',
    department:     'Ban Giám Đốc',
    team:           '',
    sales_group:    '',
    nguoi_quan_ly:  'Quản Trị Hệ Thống',
    status:         'Hoạt động',
};
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
    console.log('🔐 PlasmaCHS — Tạo tài khoản Admin\n');

    // 1. Kiểm tra username đã tồn tại chưa
    const { data: existing, error: checkErr } = await supabase
        .from('app_users')
        .select('id, username, role')
        .eq('username', ADMIN_CONFIG.username)
        .maybeSingle();

    if (checkErr) {
        console.error('❌ Lỗi kiểm tra:', checkErr.message);
        process.exit(1);
    }

    if (existing) {
        console.log(`⚠️  Tài khoản "${ADMIN_CONFIG.username}" đã tồn tại (id: ${existing.id}, role: ${existing.role})`);
        console.log('💡 Nếu muốn reset mật khẩu, chạy lại script sau khi đổi username trong config hoặc xóa user cũ trước.\n');
        process.exit(0);
    }

    // 2. Hash mật khẩu
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(ADMIN_CONFIG.password, salt);

    // 3. Insert vào app_users
    const payload = {
        name:           ADMIN_CONFIG.name,
        username:       ADMIN_CONFIG.username,
        password:       hashedPassword,
        phone:          ADMIN_CONFIG.phone,
        role:           ADMIN_CONFIG.role,
        approval_level: ADMIN_CONFIG.approval_level,
        department:     ADMIN_CONFIG.department,
        team:           ADMIN_CONFIG.team,
        sales_group:    ADMIN_CONFIG.sales_group,
        nguoi_quan_ly:  ADMIN_CONFIG.nguoi_quan_ly,
        status:         ADMIN_CONFIG.status,
        updated_at:     new Date().toISOString(),
    };

    const { data: inserted, error: insertErr } = await supabase
        .from('app_users')
        .insert([payload])
        .select('id, username, role')
        .single();

    if (insertErr) {
        console.error('❌ Lỗi tạo tài khoản:', insertErr.message);
        process.exit(1);
    }

    console.log('✅ Tài khoản Admin đã được tạo thành công!\n');
    console.log('────────────────────────────────────────');
    console.log(`  ID       : ${inserted.id}`);
    console.log(`  Username : ${inserted.username}`);
    console.log(`  Password : ${ADMIN_CONFIG.password}   ← (đây là mật khẩu gốc, lưu lại!)`);
    console.log(`  Role     : ${inserted.role}`);
    console.log(`  Approval : ${ADMIN_CONFIG.approval_level}`);
    console.log('────────────────────────────────────────\n');
    console.log('🌐 Đăng nhập tại: http://localhost:6060');
}

main();
