import { Html5QrcodeSupportedFormats } from 'html5-qrcode';

/** Chỉ barcode 1D Code 128 (RFID bình) — không quét QR. */
export const SCAN_FORMATS = [Html5QrcodeSupportedFormats.CODE_128];

export const SCANNER_CONFIG = {
    formatsToSupport: SCAN_FORMATS,
    useBarCodeDetectorIfSupported: true,
    verbose: false,
};
