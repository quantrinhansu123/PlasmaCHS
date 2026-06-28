/** Các dòng ghi chú chứa URL ảnh bằng chứng giao hàng — không hiển thị dạng text. */
const PROOF_LINE_PREFIX_RE =
    /^\s*\[(Ảnh giao hàng|GIAO_HANG_PROOF|Ảnh Bàn Giao|Anh Kho Nhan|Xác nhận tài xế[^\]]*)\]\s*:/i;

const PROOF_INLINE_RE =
    /\[(Ảnh giao hàng|GIAO_HANG_PROOF|Ảnh Bàn Giao|Anh Kho Nhan|Xác nhận tài xế[^\]]*)\]\s*:[^\n\r]*/gi;

const URL_TOKEN_RE = /^https?:\/\/\S+|^data:image\/\S+/i;

function splitProofTokens(raw) {
    return String(raw || '')
        .split(/[,;\n\r]+/)
        .map((part) => part.trim())
        .filter((part) => URL_TOKEN_RE.test(part));
}

/** Trích URL ảnh bằng chứng từ ghi chú (Cloudinary, Supabase, data URL…). */
export function extractDeliveryProofUrlsFromNote(text) {
    if (text == null || text === '') return [];

    const urls = new Set();
    const s = String(text);

    s.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (!PROOF_LINE_PREFIX_RE.test(trimmed)) return;
        const afterColon = trimmed.replace(/^\[[^\]]+\]\s*:\s*/i, '');
        splitProofTokens(afterColon).forEach((url) => urls.add(url));
    });

    const inlineMatches = s.match(PROOF_INLINE_RE) || [];
    inlineMatches.forEach((block) => {
        const afterColon = block.replace(/^\[[^\]]+\]\s*:\s*/i, '');
        splitProofTokens(afterColon).forEach((url) => urls.add(url));
    });

    const dataUrlMatches =
        s.match(/data:image\/[a-zA-Z0-9+.@-]+;base64,[A-Za-z0-9+/=\s]+/gi) || [];
    dataUrlMatches.forEach((url) => urls.add(url.replace(/\s+/g, '')));

    return [...urls];
}

/** Ghép URL ảnh vào ghi chú (lưu DB) — hiển thị UI dùng strip + gallery. */
export function appendDeliveryProofToNotes(existingNotes, photoUrls = []) {
    const base = stripDeliveryMediaFromNote(existingNotes);
    const urls = [...new Set((photoUrls || []).map((u) => String(u || '').trim()).filter(Boolean))];
    if (!urls.length) return base || null;
    const proofLine = `[GIAO_HANG_PROOF]: ${urls.join(', ')}`;
    return base ? `${base}\n${proofLine}` : proofLine;
}

/**
 * Gỡ phần ảnh giao hàng khỏi ghi chú (chỉ hiển thị — không sửa DB).
 */
export function stripDeliveryMediaFromNote(text) {
    if (text == null || text === '') return '';

    let s = String(text);

    s = s
        .split(/\r?\n/)
        .filter((line) => !PROOF_LINE_PREFIX_RE.test(line.trim()))
        .join('\n');

    s = s.replace(PROOF_INLINE_RE, '');
    s = s.replace(/data:image\/[a-zA-Z0-9+.@-]+;base64,[A-Za-z0-9+/=\s\r\n]{200,}/gi, '');

    return s.replace(/\n{3,}/g, '\n\n').trim();
}
