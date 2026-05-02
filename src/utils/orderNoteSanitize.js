/**
 * Gỡ phần ảnh giao hàng shipper ghép vào `orders.note` (không sửa DB — chỉ hiển thị).
 * Ví dụ: dòng `[Ảnh giao hàng]:` + URL hoặc chuỗi base64 rất dài.
 */
export function stripDeliveryMediaFromNote(text) {
    if (text == null || text === '') return '';

    let s = String(text);

    s = s
        .split(/\r?\n/)
        .filter((line) => !/^\s*\[Ảnh giao hàng\]\s*:/i.test(line.trim()))
        .join('\n');

    s = s.replace(/\[Ảnh giao hàng\]\s*:[^\n\r]*/gi, '');

    s = s.replace(/data:image\/[a-zA-Z0-9+.@-]+;base64,[A-Za-z0-9+/=\s\r\n]{200,}/gi, '');

    return s.replace(/\n{3,}/g, '\n\n').trim();
}
