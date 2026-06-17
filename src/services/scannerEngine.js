import { SCANNER_CONFIG } from '../utils/barcodeFormats';

export const isIOS = () =>
    /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const isAndroid = () => /Android/i.test(navigator.userAgent);

export const isMobile = () => isIOS() || isAndroid();

export const hasNativeBarcodeDetector = () => typeof window !== 'undefined' && 'BarcodeDetector' in window;

const NATIVE_FORMATS = ['code_128'];
const SCAN_INTERVAL_MS = 80;

const getVideoConstraints = () => {
    if (isMobile()) {
        return {
            facingMode: { ideal: 'environment' },
            width: { ideal: 640, max: 800 },
            height: { ideal: 360, max: 480 },
        };
    }
    return {
        facingMode: { ideal: 'environment' },
        width: { ideal: 800, max: 960 },
        height: { ideal: 450, max: 540 },
    };
};

const mountVideo = (container) => {
    const video = document.createElement('video');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.playsInline = true;
    video.muted = true;
    video.autoplay = true;
    video.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;background:#000';
    container.innerHTML = '';
    container.appendChild(video);
    return video;
};

/** Native BarcodeDetector — nhẹ nhất, chỉ Code 128. */
class NativeBarcodeEngine {
    constructor(elementId) {
        this.elementId = elementId;
        this.video = null;
        this.stream = null;
        this.detector = null;
        this.rafId = 0;
        this.isScanning = false;
        this.isPaused = false;
    }

    async start(onSuccess) {
        const container = document.getElementById(this.elementId);
        if (!container) throw new Error(`Container #${this.elementId} not found`);

        await this.stop();

        this.detector = new BarcodeDetector({ formats: NATIVE_FORMATS });
        this.video = mountVideo(container);
        this.stream = await navigator.mediaDevices.getUserMedia({
            video: getVideoConstraints(),
            audio: false,
        });
        this.video.srcObject = this.stream;
        await this.video.play();

        this.isScanning = true;
        this.isPaused = false;
        let lastScanAt = 0;

        const tick = async (now) => {
            if (!this.isScanning) return;
            this.rafId = requestAnimationFrame(tick);

            if (this.isPaused || !this.video || this.video.readyState < 2) return;
            if (now - lastScanAt < SCAN_INTERVAL_MS) return;
            lastScanAt = now;

            try {
                const codes = await this.detector.detect(this.video);
                const value = codes[0]?.rawValue;
                if (value) onSuccess(value);
            } catch {
                /* frame noise */
            }
        };

        this.rafId = requestAnimationFrame(tick);
    }

    async scanFromFile(file) {
        const detector = new BarcodeDetector({ formats: NATIVE_FORMATS });
        const bitmap = await createImageBitmap(file);
        try {
            const codes = await detector.detect(bitmap);
            return codes[0]?.rawValue || null;
        } finally {
            bitmap.close();
        }
    }

    pause(pauseVideo = true) {
        this.isPaused = true;
        if (pauseVideo && this.video) this.video.pause();
    }

    resume() {
        this.isPaused = false;
        if (this.video) this.video.play().catch(() => {});
    }

    async stop() {
        this.isScanning = false;
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.rafId = 0;
        if (this.stream) {
            this.stream.getTracks().forEach((t) => t.stop());
        }
        this.stream = null;
        this.video = null;
        this.detector = null;
        const container = document.getElementById(this.elementId);
        if (container) container.innerHTML = '';
    }
}

/** Fallback iOS — html5-qrcode chỉ Code 128, load lazy. */
class Html5FallbackEngine {
    constructor(elementId) {
        this.elementId = elementId;
        this.html5Qrcode = null;
        this.isScanning = false;
        this.isPaused = false;
    }

    async getEngine() {
        if (!this.html5Qrcode) {
            const { Html5Qrcode } = await import('html5-qrcode');
            this.html5Qrcode = new Html5Qrcode(this.elementId, {
                ...SCANNER_CONFIG,
                useBarCodeDetectorIfSupported: false,
            });
        }
        return this.html5Qrcode;
    }

    buildQrBox(viewfinderWidth, viewfinderHeight) {
        const width = Math.floor(viewfinderWidth * 0.88);
        const height = Math.floor(Math.min(viewfinderHeight * 0.22, 88));
        return { width: Math.max(width, 180), height: Math.max(height, 48) };
    }

    async start(onSuccess) {
        const container = document.getElementById(this.elementId);
        if (!container) throw new Error(`Container #${this.elementId} not found`);

        await this.stop();
        const engine = await this.getEngine();
        this.isScanning = true;
        this.isPaused = false;

        await engine.start(
            { facingMode: 'environment' },
            {
                fps: 10,
                qrbox: (w, h) => this.buildQrBox(w, h),
                disableFlip: true,
                videoConstraints: getVideoConstraints(),
            },
            (text) => {
                if (this.isScanning && !this.isPaused) onSuccess(text);
            },
            () => {},
        );
    }

    async scanFromFile(file) {
        const engine = await this.getEngine();
        const result = await engine.scanFileV2(file, false);
        return result.decodedText;
    }

    pause(pauseVideo = true) {
        if (!this.html5Qrcode || !this.isScanning || this.isPaused) return;
        try {
            this.html5Qrcode.pause(pauseVideo);
            this.isPaused = true;
        } catch { /* */ }
    }

    resume() {
        if (!this.html5Qrcode || !this.isScanning || !this.isPaused) return;
        try {
            this.html5Qrcode.resume();
            this.isPaused = false;
        } catch { /* */ }
    }

    async stop() {
        this.isScanning = false;
        this.isPaused = false;
        if (!this.html5Qrcode) return;
        try {
            if (this.html5Qrcode.isScanning) await this.html5Qrcode.stop();
            this.html5Qrcode.clear();
        } catch { /* */ }
        this.html5Qrcode = null;
    }
}

class ScannerEngine {
    constructor(elementId) {
        this.elementId = elementId;
        this.inner = hasNativeBarcodeDetector() && !isIOS()
            ? new NativeBarcodeEngine(elementId)
            : new Html5FallbackEngine(elementId);
    }

    start(onSuccess) {
        return this.inner.start(onSuccess);
    }

    scanFromFile(file) {
        return this.inner.scanFromFile(file);
    }

    pause(pauseVideo = true) {
        this.inner.pause(pauseVideo);
    }

    resume() {
        this.inner.resume();
    }

    stop() {
        return this.inner.stop();
    }
}

export const createScannerEngine = (htmlElementId) => new ScannerEngine(htmlElementId);

export const startScanner = async (scannerInstance, _htmlElementId, onScanSuccess, onScanError) => {
    try {
        await scannerInstance.start(onScanSuccess);
        return true;
    } catch (error) {
        if (onScanError) onScanError(error);
        throw error;
    }
};

export const stopScanner = async (scannerInstance) => {
    if (scannerInstance) await scannerInstance.stop();
};

export const pauseScanner = (scannerInstance, pauseVideo = true) => {
    if (scannerInstance) scannerInstance.pause(pauseVideo);
};

export const resumeScanner = (scannerInstance) => {
    if (scannerInstance) scannerInstance.resume();
};

export const scanFileWithEngine = async (scannerInstance, file) => {
    if (!scannerInstance) throw new Error('Scanner is not ready');
    return scannerInstance.scanFromFile(file);
};

/** @deprecated giữ tương thích import cũ */
export const shouldUseNativeBarcodeDetector = () => hasNativeBarcodeDetector() && !isIOS();
