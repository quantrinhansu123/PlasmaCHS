import React, { useEffect } from 'react';
import useBarcodeScanner from '../../hooks/useBarcodeScanner';
import { CameraOff, ScanLine } from 'lucide-react';

const BarcodeScanner = ({
    onScanSuccess,
    isOpen,
    onClose,
    title = 'Quét mã vạch',
    elementId = 'barcode-reader',
    debounceMs = 1500,
    allowDuplicateScans = false
}) => {
    const { isScanning, scanError, hasPermission, start, stop, resetLastScanned } = useBarcodeScanner({
        elementId,
        debounceMs,
        allowDuplicateScans
    });

    useEffect(() => {
        if (isOpen) {
            start(onScanSuccess);
        } else {
            stop();
        }
        
        return () => {
            stop();
        };
    }, [isOpen, start, stop, onScanSuccess]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[99999] bg-black flex flex-col w-screen h-[100dvh] overflow-hidden">
            {/* Header: Fixed at top using Flex */}
            <div className="flex-none bg-black/80 backdrop-blur-md p-4 flex items-center justify-between text-white border-b border-white/10 z-50 shadow-md">
                <div className="flex items-center gap-3">
                    <ScanLine className="w-6 h-6 text-blue-400" />
                    <h3 className="text-lg font-medium tracking-wide leading-none">{title}</h3>
                </div>
                <button
                    onClick={onClose}
                    className="p-2.5 bg-white/20 rounded-full hover:bg-red-500/80 hover:text-white transition-colors flex items-center justify-center backdrop-blur-md"
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
                        <div id={elementId} className="w-full h-full [&_video]:object-cover" />
                        
                        {/* Rectangular Scanner Overlay with Cutout */}
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-30">
                            {/* The clear box in the middle with thick box-shadow to darken surroundings */}
                            <div 
                                className="w-[85%] max-w-sm h-[35%] relative" 
                                style={{ boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.75)' }}
                            >
                                {/* Corner borders (Reticle) */}
                                <div className="absolute -top-1 -left-1 w-10 h-10 border-t-[4px] border-l-[4px] border-blue-500 rounded-tl-xl shadow-blue-500/50"></div>
                                <div className="absolute -top-1 -right-1 w-10 h-10 border-t-[4px] border-r-[4px] border-blue-500 rounded-tr-xl shadow-blue-500/50"></div>
                                <div className="absolute -bottom-1 -left-1 w-10 h-10 border-b-[4px] border-l-[4px] border-blue-500 rounded-bl-xl shadow-blue-500/50"></div>
                                <div className="absolute -bottom-1 -right-1 w-10 h-10 border-b-[4px] border-r-[4px] border-blue-500 rounded-br-xl shadow-blue-500/50"></div>
                                
                                {/* Animated Scan Line */}
                                <div className="absolute top-0 left-0 w-full h-[3px] bg-blue-400 animate-scan-line shadow-[0_0_12px_3px_rgba(59,130,246,0.8)]"></div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer / Instructions */}
            <div className="flex-none bg-black/80 backdrop-blur-md p-5 text-center shadow-[0_-10px_20px_rgba(0,0,0,0.5)] z-50">
                <p className="text-gray-200 text-sm font-medium truncate">
                    {isScanning 
                        ? 'Đưa mã vạch vào khung chữ nhật' 
                        : 'Đang khởi động Camera...'}
                </p>
                {/* Visual indicator for scanning status */}
                <div className="mt-2.5 flex justify-center gap-2 items-center">
                    <span className="relative flex h-3 w-3">
                        {isScanning && (
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        )}
                        <span className={`relative inline-flex rounded-full h-3 w-3 ${isScanning ? 'bg-green-500' : 'bg-gray-500'}`}></span>
                    </span>
                    <span className="text-xs font-bold text-gray-300">
                        {isScanning ? 'Hệ thống đang hoạt động' : 'Tạm dừng'}
                    </span>
                </div>
            </div>
            
            <style jsx="true">{`
                @keyframes scanLine {
                    0% { top: 0%; opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { top: 100%; opacity: 0; }
                }
                .animate-scan-line {
                    animation: scanLine 2s infinite linear;
                }
                
                /* Hide any default elements injected by html5-qrcode (if ZXing/html5-qrcode leaks) */
                #${elementId} select,
                #${elementId} button,
                #${elementId} a {
                    display: none !important;
                }
                #qr-canvas-visible {
                    display: none !important;
                }
            `}</style>
        </div>
    );
};

export default BarcodeScanner;
