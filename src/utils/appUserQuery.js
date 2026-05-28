import { supabase } from '../supabase/config';

/** Cột profile dùng cho phân quyền / lọc dữ liệu */
const PROFILE_SELECT_EXTENDED =
    'id, name, role, username, department, sales_group, chi_nhanh, nguoi_quan_ly, team';

const PROFILE_SELECT_BASE = 'id, name, role, username, department';

const isMissingColumnError = (error) => {
    const msg = String(error?.message || error?.details || '').toLowerCase();
    return (
        error?.code === 'PGRST204' ||
        error?.code === '42703' ||
        msg.includes('does not exist') ||
        msg.includes('column')
    );
};

/**
 * Load app_users by id or name/username.
 * Falls back to base columns if DB chưa migrate chi_nhanh / team / nguoi_quan_ly.
 */
export async function fetchAppUserProfile({ userId, userName } = {}) {
    const run = (select) => {
        let query = supabase.from('app_users').select(select);
        if (userId) {
            query = query.eq('id', userId);
        } else if (userName) {
            const escaped = String(userName).replace(/"/g, '\\"');
            query = query.or(`name.eq."${escaped}",username.eq."${escaped}"`);
        } else {
            return Promise.resolve({ data: null, error: new Error('Missing user id or name') });
        }
        return query.maybeSingle();
    };

    let { data, error } = await run(PROFILE_SELECT_EXTENDED);
    if (error && isMissingColumnError(error)) {
        ({ data, error } = await run(PROFILE_SELECT_BASE));
    }
    if (error && isMissingColumnError(error)) {
        let query = supabase.from('app_users').select('*');
        if (userId) query = query.eq('id', userId);
        else if (userName) {
            const escaped = String(userName).replace(/"/g, '\\"');
            query = query.or(`name.eq."${escaped}",username.eq."${escaped}"`);
        }
        ({ data, error } = await query.maybeSingle());
    }
    return { data, error };
}
