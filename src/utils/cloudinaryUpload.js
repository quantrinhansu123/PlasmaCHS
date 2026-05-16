const CLOUDINARY_CLOUD_NAME = String(import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '').trim();
const CLOUDINARY_UPLOAD_PRESET = String(import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '').trim();
const DEFAULT_DELIVERY_FOLDER = 'plasmavn/delivery_proofs';

export function isCloudinaryConfigured() {
    return Boolean(CLOUDINARY_CLOUD_NAME && CLOUDINARY_UPLOAD_PRESET);
}

export function getCloudinaryConfigMessage() {
    return 'Thêm VITE_CLOUDINARY_CLOUD_NAME và VITE_CLOUDINARY_UPLOAD_PRESET vào file .env (upload preset unsigned trên Cloudinary), rồi khởi động lại npm run dev.';
}

function ensureCloudinaryConfig() {
    if (!isCloudinaryConfigured()) {
        throw new Error(getCloudinaryConfigMessage());
    }
}

function formatCloudinaryError(message) {
    const raw = String(message || '').trim();
    if (!raw) return 'Upload Cloudinary thất bại.';
    if (/unknown api key/i.test(raw)) {
        return `Cloudinary: API key không hợp lệ. Kiểm tra cloud name "${CLOUDINARY_CLOUD_NAME}" và upload preset unsigned "${CLOUDINARY_UPLOAD_PRESET}".`;
    }
    if (/upload preset/i.test(raw) && /not found|invalid/i.test(raw)) {
        return `Cloudinary: upload preset "${CLOUDINARY_UPLOAD_PRESET}" không tồn tại hoặc chưa bật unsigned.`;
    }
    return raw.startsWith('Cloudinary') ? raw : `Cloudinary: ${raw}`;
}

async function uploadToCloudinary(formData) {
    ensureCloudinaryConfig();
    const endpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
    const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(formatCloudinaryError(payload?.error?.message || 'Upload thất bại'));
    }
    const url = payload.secure_url || payload.url || '';
    if (!url) throw new Error('Cloudinary không trả về URL ảnh.');
    return url;
}

function normalizeFolder(folder) {
    const safe = String(folder || DEFAULT_DELIVERY_FOLDER)
        .trim()
        .replace(/\\/g, '/')
        .replace(/^\/+|\/+$/g, '');
    return safe || DEFAULT_DELIVERY_FOLDER;
}

export function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        if (!file) {
            reject(new Error('Không có file để đọc.'));
            return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Không đọc được file ảnh.'));
        reader.readAsDataURL(file);
    });
}

/** Upload ảnh phiếu xác nhận — chỉ Cloudinary. */
export async function uploadDeliveryProofFile(file, folder = DEFAULT_DELIVERY_FOLDER) {
    const url = await uploadFileToCloudinary(file, folder);
    return { url, storage: 'cloudinary' };
}

export async function uploadFileToCloudinary(file, folder = DEFAULT_DELIVERY_FOLDER) {
    if (!file) throw new Error('Không có file để upload.');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('folder', normalizeFolder(folder));
    return uploadToCloudinary(formData);
}

/** Upload từ data URL (chụp ảnh / canvas) — chỉ Cloudinary. */
export async function uploadDataUrlToCloudinary(dataUrl, folder = DEFAULT_DELIVERY_FOLDER) {
    if (!dataUrl) throw new Error('Không có dữ liệu ảnh để upload.');
    const formData = new FormData();
    formData.append('file', dataUrl);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('folder', normalizeFolder(folder));
    return uploadToCloudinary(formData);
}

export function isCloudinaryDeliveryUrl(url) {
    return /^https?:\/\//i.test(String(url || '')) && !String(url).startsWith('data:');
}
