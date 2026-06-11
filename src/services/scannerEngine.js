import { Html5Qrcode } from 'html5-qrcode';

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

/**
 * html5-qrcode cameraIdOrConfig must be a deviceId string OR an object with
 * exactly one key (facingMode | deviceId). Resolution goes in videoConstraints.
 */
const resolveCameraSelection = async () => {
    if (isMobile()) {
        return { facingMode: 'environment' };
    }

    try {
        const cameras = await Html5Qrcode.getCameras();
        if (cameras.length > 0) {
            return cameras[cameras.length - 1].id;
        }
    } catch (error) {
        console.warn('Could not list cameras:', error);
    }

    return { facingMode: 'user' };
};

const getVideoConstraints = () => {
    const resolution = isIOS()
        ? { width: { ideal: 1280 }, height: { ideal: 720 } }
        : { width: { ideal: 1280 }, height: { ideal: 720 } };

    if (isMobile()) {
        return {
            facingMode: { ideal: 'environment' },
            ...resolution,
        };
    }

    return resolution;
};

/** Wide scan band for Code 128 labels (TN13469). */
const buildQrBox = (viewfinderWidth, viewfinderHeight) => {
    const width = Math.floor(Math.min(viewfinderWidth * 0.92, 560));
    const height = Math.floor(Math.min(viewfinderHeight * 0.42, 200));
    return {
        width: Math.max(width, 260),
        height: Math.max(height, 100),
    };
};

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
            useBarCodeDetectorIfSupported: shouldUseNativeBarcodeDetector(),
            verbose: false,
        });

        const cameraSelection = await resolveCameraSelection();

        await this.html5Qrcode.start(
            cameraSelection,
            {
                fps: 10,
                qrbox: buildQrBox,
                disableFlip: false,
                videoConstraints: getVideoConstraints(),
            },
            (decodedText, result) => {
                if (this.isScanning && !this.isPaused) {
                    onSuccess(decodedText, result);
                }
            },
            () => {}
        );
    }

    async scanFromFile(file) {
        if (!this.html5Qrcode) {
            this.html5Qrcode = new Html5Qrcode(this.elementId, {
                useBarCodeDetectorIfSupported: shouldUseNativeBarcodeDetector(),
                verbose: false,
            });
        }

        const result = await this.html5Qrcode.scanFileV2(file, false);
        return result.decodedText;
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

export const scanFileWithEngine = async (scannerInstance, file) => {
    if (!scannerInstance) {
        throw new Error('Scanner is not ready');
    }
    return scannerInstance.scanFromFile(file);
};
