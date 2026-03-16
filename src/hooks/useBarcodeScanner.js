import { useState, useEffect, useRef, useCallback } from 'react';
import { createScannerEngine, startScanner, stopScanner } from '../services/scannerEngine';

/**
 * Custom hook for managing the barcode scanner state and logic.
 * 
 * @param {Object} options Options for the scanner
 * @param {string} options.elementId The ID of the HTML element to render the scanner in
 * @param {number} [options.debounceMs=1500] Minimum time in ms between consecutive successful scans
 * @param {boolean} [options.allowDuplicateScans=false] Whether to allow scanning the exact same barcode multiple times in a row
 * @returns {Object} Scanner state and control functions
 */
const useBarcodeScanner = ({ 
    elementId = 'barcode-reader', 
    debounceMs = 1500,
    allowDuplicateScans = false
} = {}) => {
    const [isScanning, setIsScanning] = useState(false);
    const [scanError, setScanError] = useState(null);
    const [hasPermission, setHasPermission] = useState(null);
    
    // Refs for mutable state that shouldn't trigger re-renders
    const scannerRef = useRef(null);
    const lastScannedTimeRef = useRef(0);
    const lastScannedTextRef = useRef('');
    // Store the callback in a ref to always access the latest version without dependency loops
    const onSuccessCallbackRef = useRef(null);

    // Initialization cleanup
    useEffect(() => {
        return () => {
            if (scannerRef.current) {
                stopScanner(scannerRef.current);
                scannerRef.current = null;
            }
        };
    }, []);

    const start = useCallback(async (onSuccess) => {
        // Store the callback in ref to avoid re-initializing engine when callback changes
        onSuccessCallbackRef.current = onSuccess;
        
        // If already scanning, just update the callback and return
        if (isScanning && scannerRef.current) {
            return;
        }

        setScanError(null);

        // Clear previous instance if any
        if (scannerRef.current) {
            await stopScanner(scannerRef.current);
        }

        try {
            const scanner = createScannerEngine(elementId);
            scannerRef.current = scanner;

            const handleScanSuccess = (decodedText, decodedResult) => {
                const now = Date.now();
                const timeSinceLastScan = now - lastScannedTimeRef.current;
                
                // Debounce logic
                if (timeSinceLastScan < debounceMs) return;
                
                // Duplicate check logic
                if (!allowDuplicateScans && decodedText === lastScannedTextRef.current && timeSinceLastScan < debounceMs * 3) {
                    return; // Ignore rapid duplicate scans of the same code
                }

                // Update refs BEFORE calling the callback to prevent race conditions
                lastScannedTimeRef.current = now;
                lastScannedTextRef.current = decodedText;

                // Fire callback
                if (onSuccessCallbackRef.current) {
                    onSuccessCallbackRef.current(decodedText, decodedResult);
                }
            };

            const handleScanFailure = (errorMsg) => {
                // Ignore general visual noise errors (ZXing standard behavior)
                // We only care about fatal errors
            };

            await startScanner(scanner, elementId, handleScanSuccess, handleScanFailure);
            
            setIsScanning(true);
            setHasPermission(true);
            
        } catch (err) {
            console.error('Hook start error:', err);
            setIsScanning(false);
            setHasPermission(false);
            setScanError(err.message || 'Không thể truy cập camera. Vui lòng kiểm tra quyền.');
            scannerRef.current = null;
        }
    }, [elementId, debounceMs, allowDuplicateScans]);

    const stop = useCallback(async () => {
        if (scannerRef.current) {
            await stopScanner(scannerRef.current);
            scannerRef.current = null;
        }
        setIsScanning(false);
    }, []);

    // Helper to programmatically reset the last scanned value, useful for continuous scanning forms
    const resetLastScanned = useCallback(() => {
        lastScannedTextRef.current = '';
        lastScannedTimeRef.current = 0;
    }, []);

    return {
        isScanning,
        scanError,
        hasPermission,
        start,
        stop,
        resetLastScanned
    };
};

export default useBarcodeScanner;
