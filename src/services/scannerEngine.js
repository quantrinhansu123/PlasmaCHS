import { BrowserMultiFormatReader } from '@zxing/browser';

// Constants for platform and compatibility checking
export const isIOS = () => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

export const hasNativeBarcodeDetector = () => {
    return 'BarcodeDetector' in window;
};

/**
 * Enterprise Scanner Engine for Web
 * Supports Native BarcodeDetector API for Android
 * Fallbacks to ZXing Javascript Decoder for iOS / Desktop
 */
class ScannerEngine {
    constructor(elementId) {
        this.videoElementId = elementId;
        this.videoElement = null;
        this.isScanning = false;
        
        // Native properties
        this.nativeDetector = null;
        this.nativeInterval = null;
        
        // ZXing properties
        this.zxingReader = null;
        this.mediaStream = null;
    }

    /**
     * Patch iOS to prevent video from going fullscreen automatically
     */
    applyIOSVideoPatch() {
        if (!this.videoElement) return;
        this.videoElement.setAttribute('autoplay', '');
        this.videoElement.setAttribute('muted', '');
        this.videoElement.setAttribute('playsinline', ''); 
    }

    /**
     * Get optimized camera constraints based on platform
     * iOS prefers lower resolution for better focus speed
     */
    getCameraConstraints() {
        const isAppleDevice = isIOS();
        
        if (isAppleDevice) {
            return {
                video: {
                    facingMode: 'environment', // Always prefer rear camera
                    width: { ideal: 1280 }, // Limit to 720p for fast focus
                    height: { ideal: 720 }
                }
            };
        }

        return {
            video: {
                facingMode: 'environment',
                width: { ideal: 1920 }, // Android can handle 1080p nicely
                height: { ideal: 1080 }
            }
        };
    }

    /**
     * Setup the video element injected into the DOM container
     */
    async setupVideoElement() {
        const container = document.getElementById(this.videoElementId);
        if (!container) throw new Error(`Container #${this.videoElementId} not found`);

        this.videoElement = document.createElement('video');
        this.videoElement.style.width = '100%';
        this.videoElement.style.height = '100%';
        this.videoElement.style.objectFit = 'cover';
        this.applyIOSVideoPatch();
        
        // Clear container and append video
        container.innerHTML = '';
        container.appendChild(this.videoElement);

        try {
            const constraints = this.getCameraConstraints();
            console.log('Requesting camera with constraints:', constraints);
            this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
            this.videoElement.srcObject = this.mediaStream;
            
            // Wait for video ready
            await new Promise((resolve) => {
                this.videoElement.onloadedmetadata = () => {
                    this.videoElement.play();
                    resolve();
                };
            });
            console.log('Video stream started successfully.');
        } catch (error) {
            console.error('Failed to access camera:', error);
            throw new Error('Camera access denied or unavailable.');
        }
    }

    /**
     * Start the native Android (Chrome) scanner Loop
     * Extremely fast and efficient because it uses WebKit deep integration
     */
    async startNativeEngine(onSuccess) {
        console.log('Starting Native BarcodeDetector Engine...');
        try {
            // Need to specify what formats to look for to increase speed
            // If empty, it searches for everything
            const formats = ['code_128', 'ean_13', 'qr_code', 'upc_a', 'data_matrix'];
            this.nativeDetector = new window.BarcodeDetector({ formats });
            
            // Android can handle 20 FPS (every 50ms)
            const MS_PER_FRAME = 50; 
            
            this.nativeInterval = setInterval(async () => {
                if (!this.isScanning || !this.videoElement) return;

                try {
                    const barcodes = await this.nativeDetector.detect(this.videoElement);
                    if (barcodes.length > 0) {
                        // Assuming center crop ROI logic for the future
                        // Currently just taking the first detected barcode
                        const result = barcodes[0];
                        onSuccess(result.rawValue, result);
                    }
                } catch (e) {
                    // Ignore transient errors (e.g., video not ready)
                }
            }, MS_PER_FRAME);
            
        } catch (err) {
            console.error('Failed to initialize Native Barcode Detector:', err);
            // Fallback dynamically if Native fails to initialize
            console.log('Falling back to ZXing Decoder...');
            this.stop();
            await this.start(onSuccess, true); 
        }
    }

    /**
     * Start the ZXing WASM fallback engine
     * Good for iOS Safari or Edge Desktop
     */
    async startZXingEngine(onSuccess) {
        console.log('Starting ZXing Engine Fallback...');
        
        this.zxingReader = new BrowserMultiFormatReader();
        
        // iOS requires less aggressive frame reading (10-15 FPS) to prevent hanging
        const delayBetweenReads = isIOS() ? 100 : 50; 
        this.zxingReader.timeBetweenDecodingAttempts = delayBetweenReads;

        try {
            await this.zxingReader.decodeFromVideoElement(this.videoElement, (result, error) => {
                if (result && this.isScanning) {
                    onSuccess(result.getText(), result);
                }
                if (error) {
                    // Ignore common NotFoundException
                }
            });
        } catch (error) {
            console.error('ZXing decoder error:', error);
            throw error;
        }
    }

    /**
     * Central Method to Start the Engine Route
     */
    async start(onSuccess, forceZXing = false) {
        this.isScanning = true;
        
        try {
            await this.setupVideoElement();

            if (!isIOS() && hasNativeBarcodeDetector() && !forceZXing) {
                // Tier 1: Android Chrome Native Engine
                await this.startNativeEngine(onSuccess);
            } else {
                // Tier 2: iOS/Desktop Fallback Engine
                await this.startZXingEngine(onSuccess);
            }
        } catch (error) {
            this.isScanning = false;
            throw error;
        }
    }

    /**
     * Stop the engine and release hardware resources
     */
    stop() {
        this.isScanning = false;
        
        // Stop Native Loop
        if (this.nativeInterval) {
            clearInterval(this.nativeInterval);
            this.nativeInterval = null;
        }
        
        // Stop ZXing loop
        if (this.zxingReader && this.videoElement) {
            try {
                this.zxingReader.reset();
            } catch (e) { console.error('Error resetting ZXing', e); }
        }

        // Release Media Stream tracks (turn off camera light)
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => {
                try {
                    track.stop();
                } catch (e) {}
            });
            this.mediaStream = null;
        }

        // Clear Video src
        if (this.videoElement) {
            this.videoElement.srcObject = null;
            this.videoElement.remove();
            this.videoElement = null;
        }
        
        console.log('Scanner Engine Stopped & Resources Released.');
    }
}

// Ensure interface compatibility with the previous html5-qrcode implementation
export const createScannerEngine = (htmlElementId) => {
    return new ScannerEngine(htmlElementId);
};

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
        scannerInstance.stop();
    }
};
