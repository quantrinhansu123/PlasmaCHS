/**
 * Vietnamese Tax Code (Mã số thuế - MST) Validation
 * Based on Circular 105/2020/TT-BTC
 */
export const validateMST = (mst) => {
    if (!mst) return true; // Optional field usually
    
    // Remove hyphens and spaces
    const cleanMST = mst.toString().replace(/[- ]/g, '');
    
    // Length must be 10 or 13
    if (cleanMST.length !== 10 && cleanMST.length !== 13) {
        return false;
    }

    // Must be all digits
    if (!/^\d+$/.test(cleanMST)) {
        return false;
    }

    // Algorithm for the first 10 digits
    const digits = cleanMST.split('').map(Number);
    const weights = [31, 29, 23, 19, 17, 13, 7, 5, 3];
    
    let sum = 0;
    for (let i = 0; i < 9; i++) {
        sum += digits[i] * weights[i];
    }
    
    const remainder = sum % 11;
    
    // According to standard: 
    // If remainder is 0: Invalid MST (10 - 0 = 10, not a digit)
    // If remainder is 1..10: d10 = 10 - remainder
    
    if (remainder === 0) {
        return false; 
    }
    
    const checkDigit = 10 - remainder;
    
    if (digits[9] !== checkDigit) {
        return false;
    }

    // If 13 digits, the last 3 digits are sub-unit code (001-999)
    if (cleanMST.length === 13) {
        const subUnit = parseInt(cleanMST.substring(10), 10);
        if (subUnit < 1 || subUnit > 999) {
            return false;
        }
    }

    return true;
};

/**
 * Vietnamese Phone Number Validation
 * Supports mobile (10 digits) and landline (10-11 digits)
 */
export const validatePhone = (phone) => {
    if (!phone) return true; // Optional field
    
    // Remove spaces, dots, hyphens
    const cleanPhone = phone.toString().replace(/[ .()-]/g, '');
    
    // Basic regex for Vietnamese numbers:
    // Starts with 0 or +84
    // Next digit is 3, 5, 7, 8, 9 (mobile) or 2 (landline)
    // Followed by 8 or 9 digits
    const phoneRegex = /^(\+84|0)(3|5|7|8|9|2)([0-9]{8,9})$/;
    
    return phoneRegex.test(cleanPhone);
};
