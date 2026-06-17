import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import useBarcodeScanner from '../../hooks/useBarcodeScanner';
import { CameraOff, ChevronDown, X } from 'lucide-react';

const BarcodeScanner = ({
    onScanSuccess,
    isOpen,
    onClose,
    title = 'Quét mã vạch',
    elementId = 'barcode-reader',
    debounceMs = 200,
    allowDuplicateScans = false,
    currentCount = 0,
    totalCount = null,
}) => {
    const [lastScan, setLastScan] = useState('');
    const [showManual, setShowManual] = useState(false);
    const [manualInput, setManualInput] = useState('');
    const reactId = useId();
    const flashTimerRef = useRef(0);
    const onScanSuccessRef = useRef(onScanSuccess);
    onScanSuccessRef.current = onScanSuccess;
    const scannerElementId = useMemo(
        () => `${elementId}-${reactId.replace(/:/g, '')}`,
        [elementId, reactId],
    );

    const { isScanning, scanError, hasPermission, start, stop, resetLastScanned } = useBarcodeScanner({
        elementId: scannerElementId,
        debounceMs,
        allowDuplicateScans,
    });

    const getCurrentTimeVN = () =>
        new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    const flashScan = (text) => {
        setLastScan(text);
        window.clearTimeout(flashTimerRef.current);
        flashTimerRef.current = window.setTimeout(() => setLastScan(''), 1800);
    };

    const deliverScanRef = useRef(null);
    deliverScanRef.current = (decodedText) => {
        const normalized = decodedText.trim().toUpperCase();
        if (!normalized) return;
        onScanSuccessRef.current(normalized, getCurrentTimeVN());
        flashScan(normalized);
        resetLastScanned();
    };

    const handleManualSubmit = (e) => {
        e.preventDefault();
        if (manualInput.trim()) {
            deliverScanRef.current(manualInput.trim());
            setManualInput('');
        }
    };

    useEffect(() => {
        if (!isOpen) {
            stop();
            setLastScan('');
            setShowManual(false);
            return undefined;
        }

        let cancelled = false;
        const rafId = requestAnimationFrame(() => {
            if (!cancelled) start((text) => deliverScanRef.current?.(text));
        });

        return () => {
            cancelled = true;
            cancelAnimationFrame(rafId);
            window.clearTimeout(flashTimerRef.current);
            stop();
        };
    }, [isOpen, start, stop]);

    if (!isOpen) return null;

    const countLabel = totalCount
        ? `${currentCount + 1}/${totalCount}`
        : currentCount > 0
            ? String(currentCount + 1)
            : '';

    return createPortal(
        <div className="fixed inset-0 z-[100010] bg-black flex flex-col w-screen h-[100dvh] overflow-hidden">
            <div className="flex-none flex items-center justify-between px-3 py-2.5 text-white border-b border-white/10">
                <div className="min-w-0 flex-1 pr-2">
                    <p className="text-sm font-semibold truncate">{title}</p>
                    {countLabel && (
                        <p className="text-[11px] text-emerald-400 font-bold">Đã quét: {countLabel}</p>
                    )}
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="p-2 rounded-full bg-white/15 hover:bg-white/25"
                    aria-label="Đóng"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="flex-1 relative bg-black min-h-0">
                {scanError ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                        <CameraOff className="w-12 h-12 text-amber-400 mb-3" />
                        <p className="text-white text-sm font-medium mb-1">Không mở được camera</p>
                        <p className="text-gray-400 text-xs">{scanError}</p>
                        {!hasPermission && (
                            <button
                                type="button"
                                onClick={() => start((text) => deliverScanRef.current?.(text))}
                                className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg"
                            >
                                Thử lại
                            </button>
                        )}
                    </div>
                ) : (
                    <div
                        id={scannerElementId}
                        className="barcode-scanner-container absolute inset-0 w-full h-full"
                    />
                )}

                {lastScan && (
                    <div className="absolute bottom-3 left-3 right-3 z-20 pointer-events-none">
                        <div className="barcode-scanner-flash mx-auto max-w-md px-3 py-2 rounded-lg bg-emerald-600/95 text-white text-center">
                            <span className="text-[10px] font-bold uppercase tracking-wide opacity-90">OK</span>
                            <p className="font-mono font-bold text-lg tracking-wider break-all">{lastScan}</p>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex-none border-t border-white/10 bg-black/90">
                <button
                    type="button"
                    onClick={() => setShowManual((v) => !v)}
                    className="w-full flex items-center justify-center gap-1 py-2 text-[11px] text-gray-400 hover:text-white"
                >
                    Nhập tay
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showManual ? 'rotate-180' : ''}`} />
                </button>
                {showManual && (
                    <form onSubmit={handleManualSubmit} className="px-3 pb-3 flex gap-2">
                        <input
                            type="text"
                            value={manualInput}
                            onChange={(e) => setManualInput(e.target.value.toUpperCase())}
                            placeholder="Mã RFID..."
                            autoFocus
                            className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-blue-500"
                        />
                        <button
                            type="submit"
                            disabled={!manualInput.trim()}
                            className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg disabled:opacity-40"
                        >
                            OK
                        </button>
                    </form>
                )}
                <p className="pb-2 text-center text-[10px] text-gray-500">
                    {isScanning ? 'Đưa mã Code 128 vào khung ngang' : 'Đang khởi động...'}
                </p>
            </div>
        </div>,
        document.body,
    );
};

export default BarcodeScanner;
