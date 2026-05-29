const normalizeDepartmentKey = (value = '') =>
    String(value || '')
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

export const isWarehouseDepartment = (department = '') =>
    normalizeDepartmentKey(department) === 'kho';

export const filterWarehouseKeeperUsers = (users = []) =>
    (users || []).filter((user) => {
        if (!isWarehouseDepartment(user?.department)) return false;
        const name = String(user?.name || '').trim();
        return Boolean(name);
    });
