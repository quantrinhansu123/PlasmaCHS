import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

export const isIOS = () => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

export const isAndroid = () => /Android/i.test(navigator.userAgent);

export const isMobile = () => isIOS() || isAndroid();

export const hasNativeBarcodeDetector = () => 'BarcodeDetector' in window;

/** Native BarcodeDetector is reliable on Android Chrome only. */
export const shouldUseNativeBarcodeDetector = () => {
    return isAndroid() && hasNativeBarcodeDetector();
};

/** Fewer formats = faster decode (cylinder labels use Code 128 / Code 39). */
const SCAN_FORMATS = [
    Html5QrcodeSupportedFormats.CODE_128,
    Html5QrcodeSupportedFormats.CODE_39,
    Html5QrcodeSupportedFormats.QR_CODE,
];

/** Compact ROI — wide but shallow for 1D barcodes, fewer pixels to process. */
const buildQrBox = (viewfinderWidth, viewfinderHeight) => {
    const width = Math.floor(Math.min(viewfinderWidth * 0.88, 420));
    const height = Math.floor(Math.min(viewfinderHeight * 0.28, 120));
    return {
        width: Math.max(width, 220),
        height: Math.max(height, 64),
    };
};

const getCameraConfig = () => {
    if (isIOS()) {
        return {
            facingMode: 'environment',
            width: { ideal: 960, max: 1280 },
            height: { ideal: 540, max: 720 },
        };
    }

    if (isAndroid()) {
        return {
            facingMode: 'environment',
            width: { ideal: 1280, max: 1280 },
            height: { ideal: 720, max: 720 },
        };
    }

    return {
        width: { ideal: 1280, max: 1280 },
        height: { ideal: 720, max: 720 },
    };
};

/**
 * Scanner engine backed by html5-qrcode.
 * Tuned for smooth preview + fast Code 128 reads on mobile/desktop.
 */
class ScannerEngine {
    constructor(elementId) {
        this.elementId = elementId;
        this.html5Qrcode = null;
        this.isScanning = false;
        this.isPaused = false;
    }

    async start(onSuccess) {
        const container = document.getElementById(this.elementId);
        if (!container) {
            throw new Error(`Container #${this.elementId} not found`);
        }

        this.isScanning = true;
        this.isPaused = false;

        if (this.html5Qrcode) {
            await this.stop();
        }

        this.html5Qrcode = new Html5Qrcode(this.elementId, {
            formatsToSupport: SCAN_FORMATS,
            useBarCodeDetectorIfSupported: shouldUseNativeBarcodeDetector(),
            verbose: false,
        });

        await this.html5Qrcode.start(
            getCameraConfig(),
            {
                fps: shouldUseNativeBarcodeDetector() ? 12 : 8,
                qrbox: buildQrBox,
                disableFlip: true,
            },
            (decodedText, result) => {
                if (this.isScanning && !this.isPaused) {
                    onSuccess(decodedText, result);
                }
            },
            () => {}
        );
    }

    pause(pauseVideo = true) {
        if (!this.html5Qrcode || !this.isScanning || this.isPaused) return;
        try {
            this.html5Qrcode.pause(pauseVideo);
            this.isPaused = true;
        } catch (error) {
            console.warn('Scanner pause warning:', error);
        }
    }

    resume() {
        if (!this.html5Qrcode || !this.isScanning || !this.isPaused) return;
        try {
            this.html5Qrcode.resume();
            this.isPaused = false;
        } catch (error) {
            console.warn('Scanner resume warning:', error);
        }
    }

    async stop() {
        this.isScanning = false;
        this.isPaused = false;

        if (!this.html5Qrcode) return;

        try {
            if (this.html5Qrcode.isScanning) {
                await this.html5Qrcode.stop();
            }
            this.html5Qrcode.clear();
        } catch (error) {
            console.warn('Scanner stop warning:', error);
        } finally {
            this.html5Qrcode = null;
        }
    }
}

export const createScannerEngine = (htmlElementId) => new ScannerEngine(htmlElementId);

export const startScanner = async (scannerInstance, htmlElementId, onScanSuccess, onScanError) => {
    try {
        await scannerInstance.start(onScanSuccess);
        return true;
    } catch (error) {
        if (onScanError) onScanError(error);
        throw error;
    }
};

export const stopScanner = async (scannerInstance) => {
    if (scannerInstance) {
        await scannerInstance.stop();
    }
};

export const pauseScanner = (scannerInstance, pauseVideo = true) => {
    if (scannerInstance) {
        scannerInstance.pause(pauseVideo);
    }
};

export const resumeScanner = (scannerInstance) => {
    if (scannerInstance) {
        scannerInstance.resume();
    }
};
