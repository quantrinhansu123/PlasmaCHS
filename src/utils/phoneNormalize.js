/** Chuẩn hóa SĐT VN để so khớp giữa các bản ghi (0xxxxxxxxx, +84, 84…). */
export function normalizeVnPhoneDigits(phone) {
    if (phone == null || typeof phone !== 'string') return '';
    const d = phone.replace(/\D/g, '');
    if (d.length >= 11 && d.startsWith('84')) return `0${d.slice(2)}`;
    if (d.length === 10 && d.startsWith('0')) return d;
    if (d.length === 9) return `0${d}`;
    return d;
}
