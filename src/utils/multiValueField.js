/** Tách chuỗi nhiều giá trị (phân tách bằng dấu phẩy, chấm phẩy, ...) */
export const splitMultiValue = (value) =>
    String(value || '')
        .split(/[,;/|]+/)
        .map((part) => part.trim())
        .filter(Boolean);

/** Ghép mảng thành chuỗi lưu DB */
export const joinMultiValue = (values) =>
    [...new Set((values || []).map((v) => String(v).trim()).filter(Boolean))].join(', ');

/** Gom tất cả giá trị đơn từ các bản ghi (mỗi field có thể chứa nhiều giá trị) */
export const collectUniqueMultiValues = (rows, fieldName) => {
    const set = new Set();
    (rows || []).forEach((row) => {
        splitMultiValue(row?.[fieldName]).forEach((v) => set.add(v));
    });
    return [...set];
};
