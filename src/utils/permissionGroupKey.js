const normalizePart = (value = '') =>
    String(value)
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

export const buildPermissionGroupKey = (department = '', position = '') => {
    const departmentKey = normalizePart(department);
    const positionKey = normalizePart(position);

    if (!departmentKey || !positionKey) return '';
    return `@group:${departmentKey}:${positionKey}`;
};

export const parsePermissionGroupKey = (value = '') => {
    const raw = String(value || '');
    const matched = raw.match(/^@group:([^:]+):([^:]+)$/i);
    if (!matched) return null;

    const [, departmentKey, positionKey] = matched;
    return {
        departmentKey,
        positionKey,
    };
};

/** Nhãn hiển thị: Phòng ban_vị trí */
export const buildPermissionGroupLabel = (department = '', position = '') => {
    const dep = String(department || '').trim();
    const pos = String(position || '').trim();
    if (dep && pos) return `${dep}_${pos}`;
    return dep || pos;
};

export const isPermissionGroupKey = (name = '') => String(name || '').startsWith('@group:');
