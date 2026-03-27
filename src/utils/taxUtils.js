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
 * Supports mobile (03, 05, 07, 08, 09) and landline (02)
 * Standard length is 10 digits
 */
export const validatePhone = (phone) => {
    if (!phone) return true;

    // Remove spaces, dots, hyphens
    const cleanPhone = phone.toString().replace(/[ .()-]/g, '');

    // Vietnam phone numbers: starts with 0 or +84
    // Mobile prefixes: 3, 5, 7, 8, 9
    // Landline prefix: 2
    // Total digits after 0/+84 must be 9 digits (total 10 for 0-prefix)
    const phoneRegex = /^(0|\+84)(2|3|5|7|8|9)([0-9]{8})$/;

    return phoneRegex.test(cleanPhone);
};

/**
 * Format phone number to standard 0XXX XXX XXX
 */
export const formatPhoneNumber = (phone) => {
    if (!phone) return '';

    // Strip everything except digits
    let cleaned = phone.toString().replace(/\D/g, '');

    // If starts with 84, replace with 0
    if (cleaned.startsWith('84')) {
        cleaned = '0' + cleaned.substring(2);
    }

    // Format if it's 10 digits
    if (cleaned.length === 10) {
        return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
    }

    return cleaned;
};
