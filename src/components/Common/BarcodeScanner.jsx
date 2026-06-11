import React, { useEffect, useId, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import useBarcodeScanner from '../../hooks/useBarcodeScanner';
import { Camera, CameraOff, ImagePlus, ScanLine } from 'lucide-react';

const BarcodeScanner = ({
    onScanSuccess,
    isOpen,
    onClose,
    title = 'Quét mã vạch',
    elementId = 'barcode-reader',
    debounceMs = 600,
    allowDuplicateScans = false,
    currentCount = 0,
    totalCount = null
}) => {
    const [pendingScan, setPendingScan] = React.useState(null);
    const [scanTime, setScanTime] = React.useState(null);
    const [manualInput, setManualInput] = React.useState('');
    const [fileScanError, setFileScanError] = React.useState('');
    const [isFileScanning, setIsFileScanning] = React.useState(false);
    const fileInputRef = useRef(null);
    const pauseRef = useRef(() => {});
    const reactId = useId();
    const scannerElementId = useMemo(
        () => `${elementId}-${reactId.replace(/:/g, '')}`,
        [elementId, reactId]
    );

    const { isScanning, scanError, hasPermission, start, stop, pause, resume, scanFromFile, resetLastScanned } = useBarcodeScanner({
        elementId: scannerElementId,
        debounceMs,
        allowDuplicateScans
    });

    pauseRef.current = pause;

    const getCurrentTimeVN = () => {
        return new Date().toLocaleTimeString('vi-VN', { 
            hour: '2-digit', 
            minute: '2-digit'
        });
    };

    const handleConfirm = () => {
        if (pendingScan) {
            // Ensure we have a time even if state hasn't updated immediately
            const timeToPass = scanTime || getCurrentTimeVN();
            onScanSuccess(pendingScan, timeToPass);
            
            setPendingScan(null);
            setScanTime('');
            resetLastScanned();
            resume();
        }
    };

    const handlePhotoPick = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;

        setFileScanError('');
        setIsFileScanning(true);
        try {
            const decodedText = await scanFromFile(file);
            if (decodedText) {
                pauseRef.current(true);
                setPendingScan(decodedText);
                setScanTime(getCurrentTimeVN());
            }
        } catch (error) {
            setFileScanError(error.message || 'Không đọc được mã từ ảnh.');
        } finally {
            setIsFileScanning(false);
        }
    };

    const handleManualSubmit = (e) => {
        e.preventDefault();
        if (manualInput.trim()) {
            pauseRef.current(true);
            setPendingScan(manualInput.trim());
            setScanTime(getCurrentTimeVN());
            setManualInput('');
        }
    };

    const handleCancel = () => {
        setPendingScan(null);
        setScanTime(null);
        resetLastScanned();
        resume();
    };

    useEffect(() => {
        if (!isOpen) {
            stop();
            setPendingScan(null);
            return undefined;
        }

        const wrapScanSuccess = (decodedText) => {
            pauseRef.current(true);
            setPendingScan(decodedText);
            setScanTime(getCurrentTimeVN());
        };

        let cancelled = false;
        let rafId = 0;
        rafId = requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (!cancelled) {
                    start(wrapScanSuccess);
                }
            });
        });

        return () => {
            cancelled = true;
            cancelAnimationFrame(rafId);
            stop();
        };
    }, [isOpen, start, stop]);

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100010] bg-black flex flex-col w-screen h-[100dvh] overflow-hidden">
            {/* Header: Fixed at top using Flex */}
            <div className="flex-none bg-black/90 p-4 flex items-center justify-between text-white border-b border-white/10 z-50">
                <div className="flex items-center gap-3">
                    <ScanLine className="w-6 h-6 text-blue-400" />
                    <h3 className="text-lg font-medium tracking-wide leading-none">{title}</h3>
                </div>
                <button
                    onClick={onClose}
                    className="p-2.5 bg-white/20 rounded-full hover:bg-red-500/80 hover:text-white transition-colors flex items-center justify-center"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Scanner Viewport (Takes remaining space) */}
            <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-black z-10 w-full">
                {scanError ? (
                    <div className="p-8 text-center max-w-sm z-20">
                        <CameraOff className="w-16 h-16 text-yellow-500 mx-auto mb-4 opacity-80" />
                        <h4 className="text-white text-lg font-semibold mb-2">Không khả dụng</h4>
                        <p className="text-gray-400 text-sm leading-relaxed">{scanError}</p>
                        {!hasPermission && (
                            <button 
                                onClick={() => start(onScanSuccess)}
                                className="mt-6 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium w-full shadow-lg"
                            >
                                Thử cấp quyền lại
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="absolute inset-0 w-full h-full">
                        <div
                            id={scannerElementId}
                            className="barcode-scanner-container w-full h-full min-h-[240px]"
                        />
                        
                    </div>
                )}
            </div>

            {/* Confirmation Overlay */}
            {pendingScan && (
                <div className="fixed inset-0 z-[200000] bg-black/95 flex flex-col items-center justify-center p-6 confirmation-overlay-white-force" style={{ color: '#FFFFFF' }}>
                    <div className="w-full max-w-sm bg-gray-900 rounded-3xl border border-white/20 p-8 flex flex-col items-center text-center shadow-2xl">
                        <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-blue-500/50">
                            <ScanLine className="w-10 h-10 text-white" style={{ color: '#FFFFFF' }} />
                        </div>
                        
                        <h4 className="text-2xl font-black mb-2 tracking-tight" style={{ color: '#FFFFFF' }}>ĐÃ QUÉT MÃ</h4>
                        <div className="bg-white/10 px-6 py-4 rounded-2xl mb-2 border border-white/20 w-full shadow-inner">
                            <span className="text-2xl md:text-3xl font-mono font-bold tracking-widest break-all" style={{ color: '#FFFFFF' }}>{pendingScan}</span>
                        </div>
                        <p className="text-sm font-medium mb-8" style={{ color: '#FFFFFF' }}>Thời gian quét: <span className="font-bold" style={{ color: '#FFFFFF' }}>{scanTime}</span></p>

                        <div className="w-full space-y-4">
                            <button
                                onClick={handleConfirm}
                                className="w-full py-5 bg-blue-600 hover:bg-blue-700 font-black text-xl rounded-2xl shadow-xl shadow-blue-600/30 transition-all flex items-center justify-center gap-3 active:scale-95"
                                style={{ color: '#FFFFFF' }}
                            >
                                XÁC NHẬN {totalCount ? `(${currentCount + 1}/${totalCount})` : `(${currentCount + 1})`}
                            </button>
                            
                            <button
                                onClick={handleCancel}
                                className="w-full py-4 bg-white/5 hover:bg-white/10 font-bold text-lg rounded-2xl transition-all active:scale-95 border border-white/10"
                                style={{ color: '#FFFFFF' }}
                            >
                                Quét lại mã này
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Manual Input Form */}
            <div className="flex-none bg-black/95 p-4 border-t border-white/10 z-[100] shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">
                <div className="flex items-center justify-center gap-2 mb-3">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={handlePhotoPick}
                    />
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isFileScanning}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white text-xs font-bold hover:bg-white/15 disabled:opacity-50"
                    >
                        {isFileScanning ? (
                            <Camera className="w-4 h-4 animate-pulse" />
                        ) : (
                            <ImagePlus className="w-4 h-4" />
                        )}
                        Chụp / chọn ảnh mã
                    </button>
                </div>
                {fileScanError && (
                    <p className="text-center text-rose-300 text-xs mb-2">{fileScanError}</p>
                )}
                <form onSubmit={handleManualSubmit} className="flex items-center gap-2 w-full max-w-sm mx-auto">
                    <input
                        type="text"
                        value={manualInput}
                        onChange={e => setManualInput(e.target.value.toUpperCase())}
                        placeholder="Hoặc nhập mã thủ công..."
                        className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm font-mono tracking-widest"
                    />
                    <button
                        type="submit"
                        disabled={!manualInput.trim()}
                        className="px-5 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        OK
                    </button>
                </form>
            </div>

            {/* Footer / Instructions */}
            <div className="flex-none bg-black/90 p-3 text-center z-50">
                <p className="text-gray-200 text-xs font-medium truncate">
                    {isScanning
                        ? 'Đưa mã vạch 1D (Code 128) nằm ngang vào khung quét'
                        : 'Không tìm thấy hoặc hỏng Camera'}
                </p>
                {/* Visual indicator for scanning status */}
                <div className="mt-1.5 flex justify-center gap-2 items-center">
                    <span className={`inline-flex rounded-full h-2.5 w-2.5 ${isScanning ? 'bg-green-500' : 'bg-gray-500'}`} />
                    <span className="text-[11px] font-bold text-gray-300">
                        {isScanning ? 'Đang tự động quét' : 'Tạm dừng'}
                    </span>
                </div>
            </div>
            
            <style jsx="true">{`
                /* Force White Text Hack - Very Aggressive */
                .confirmation-overlay-white-force,
                .confirmation-overlay-white-force *,
                .confirmation-overlay-white-force h4,
                .confirmation-overlay-white-force span,
                .confirmation-overlay-white-force p {
                    color: #ffffff !important;
                    -webkit-text-fill-color: #ffffff !important; /* Some mobile browsers need this */
                }

                .confirmation-overlay-white-force {
                    color-scheme: dark !important; /* Tells mobile browsers this is a dark area */
                }

                /* Hide any default elements injected by html5-qrcode */
                #${scannerElementId} select,
                #${scannerElementId} a {
                    display: none !important;
                }
            `}</style>
        </div>,
        document.body
    );
};

export default BarcodeScanner;
