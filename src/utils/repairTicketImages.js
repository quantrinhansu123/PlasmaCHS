import { supabase } from '../supabase/config';

const REPAIR_TICKET_BUCKET = 'repair-tickets';

export const normalizeRepairTicketImages = (value) => {
    if (Array.isArray(value)) {
        return value.map((item) => String(item || '').trim()).filter(Boolean);
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return [];

        if (trimmed.startsWith('[')) {
            try {
                const parsed = JSON.parse(trimmed);
                return Array.isArray(parsed)
                    ? parsed.map((item) => String(item || '').trim()).filter(Boolean)
                    : [trimmed];
            } catch {
                return [trimmed];
            }
        }

        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            return trimmed
                .slice(1, -1)
                .split(',')
                .map((item) => item.trim().replace(/^"+|"+$/g, ''))
                .filter(Boolean);
        }

        return [trimmed];
    }

    return [];
};

export const toRepairStoragePath = (value) => {
    const raw = String(value || '').trim();
    if (!raw || raw.startsWith('data:') || raw.startsWith('blob:')) return '';

    if (/^https?:\/\//i.test(raw)) {
        const publicMarker = `/object/public/${REPAIR_TICKET_BUCKET}/`;
        const publicIndex = raw.indexOf(publicMarker);
        if (publicIndex >= 0) {
            return decodeURIComponent(raw.slice(publicIndex + publicMarker.length).split('?')[0]);
        }

        const signedMarker = `/object/sign/${REPAIR_TICKET_BUCKET}/`;
        const signedIndex = raw.indexOf(signedMarker);
        if (signedIndex >= 0) {
            return decodeURIComponent(raw.slice(signedIndex + signedMarker.length).split('?')[0]);
        }

        return '';
    }

    return raw.replace(new RegExp(`^${REPAIR_TICKET_BUCKET}/`), '');
};

export const resolveRepairTicketImageAccess = async (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (raw.startsWith('data:') || raw.startsWith('blob:')) return raw;

    const storagePath = toRepairStoragePath(raw);
    if (storagePath) {
        const { data, error } = await supabase.storage
            .from(REPAIR_TICKET_BUCKET)
            .createSignedUrl(storagePath, 60 * 60);
        if (!error && data?.signedUrl) return data.signedUrl;
    }

    if (/^https?:\/\//i.test(raw)) return raw;

    const { data: publicUrlData } = supabase.storage.from(REPAIR_TICKET_BUCKET).getPublicUrl(storagePath || raw);
    return publicUrlData?.publicUrl || raw;
};

export const resolveRepairTicketImageList = async (value) => {
    const items = normalizeRepairTicketImages(value);
    return Promise.all(items.map((item) => resolveRepairTicketImageAccess(item)));
};

export const appendRepairTicketImageFiles = (currentFiles, fileList) => {
    const existing = Array.isArray(currentFiles) ? currentFiles : [];
    const incoming = Array.from(fileList || []);
    if (incoming.length === 0) return existing;

    const seen = new Set(
        existing.map((file) => `${file.name}-${file.size}-${file.lastModified}`)
    );

    const next = [...existing];
    for (const file of incoming) {
        const key = `${file.name}-${file.size}-${file.lastModified}`;
        if (seen.has(key)) continue;
        seen.add(key);
        next.push(file);
    }

    return next;
};

const readFileAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('Không đọc được ảnh'));
        reader.readAsDataURL(file);
    });

const buildRepairTicketStoragePath = (folder, index, file) => {
    const fileExt = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const safeFolder = String(folder || 'technical').replace(/^\/+|\/+$/g, '');
    const uniqueId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2, 10);
    return `${safeFolder}/${Date.now()}_${index}_${uniqueId}.${fileExt}`;
};

const shouldFallbackRepairTicketUpload = (error) => {
    const message = String(error?.message || error || '').toLowerCase();
    return (
        message.includes('bucket not found') ||
        message.includes('row-level security') ||
        message.includes('permission') ||
        message.includes('not authorized') ||
        message.includes('403')
    );
};

export const uploadRepairTicketImages = async (files, { folder = 'technical' } = {}) => {
    const urls = [];
    const failures = [];
    const fallbackWarnings = [];

    for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const filePath = buildRepairTicketStoragePath(folder, index, file);

        const { error } = await supabase.storage.from(REPAIR_TICKET_BUCKET).upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type || 'image/jpeg',
        });

        if (!error) {
            urls.push(filePath);
            continue;
        }

        if (shouldFallbackRepairTicketUpload(error)) {
            try {
                const dataUrl = await readFileAsDataUrl(file);
                if (dataUrl) {
                    urls.push(dataUrl);
                    fallbackWarnings.push(file.name || `Ảnh ${index + 1}`);
                    continue;
                }
            } catch (fallbackError) {
                failures.push({ file, error: fallbackError });
                continue;
            }
        }

        failures.push({ file, error });
    }

    return { urls, failures, fallbackWarnings };
};
