import { clsx } from 'clsx';
import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { Camera, CheckCircle2, Loader2, PackageCheck, X } from 'lucide-react';
import {
    isCloudinaryConfigured,
    isCloudinaryDeliveryUrl,
    uploadDeliveryProofFile,
} from '../../utils/cloudinaryUpload';

function CylinderSerialBarcodeCard({ serial }) {
    const code = String(serial || '').trim().toUpperCase();
    return (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <div
                className="h-14 bg-slate-900"
                style={{
                    backgroundImage:
                        'repeating-linear-gradient(90deg, #f8fafc 0px, #f8fafc 2px, transparent 2px, transparent 5px, #f8fafc 5px, #f8fafc 7px, transparent 7px, transparent 11px)',
                    backgroundSize: '11px 100%',
                }}
                aria-hidden
            />
            <div className="px-4 py-4 text-center bg-slate-50">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Mã bình</p>
                <p className="font-mono text-2xl font-black text-slate-900 tracking-wide break-all">{code || '—'}</p>
            </div>
        </div>
    );
}

export default function RecoveryDeliveryConfirmModal({
    recovery,
    items = [],
    isSubmitting = false,
    onClose,
    onConfirm,
}) {
    const [photoUrls, setPhotoUrls] = useState([]);
    const [uploading, setUploading] = useState(false);

    const serials = items
        .map((row) => String(row.serial_number || '').trim())
        .filter(Boolean);

    const cloudPhotos = photoUrls.filter((url) => isCloudinaryDeliveryUrl(url));

    useEffect(() => {
        const existing = Array.isArray(recovery?.photos) ? recovery.photos.filter(isCloudinaryDeliveryUrl) : [];
        setPhotoUrls(existing);
    }, [recovery?.id]);

    const handleUploadImages = async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        setUploading(true);
        const next = [...photoUrls];
        try {
            if (!isCloudinaryConfigured()) {
                throw new Error(
                    'Chưa cấu hình Cloudinary. Thêm VITE_CLOUDINARY_CLOUD_NAME và VITE_CLOUDINARY_UPLOAD_PRESET vào .env, rồi khởi động lại npm run dev.',
                );
            }
            const folder = `plasmavn/delivery_proofs/recovery/${recovery?.recovery_code || recovery?.id || 'tasks'}`;
            for (const file of files) {
                const { url } = await uploadDeliveryProofFile(file, folder);
                next.push(url);
            }
            setPhotoUrls(next);
            toast.success(`Đã tải lên ${files.length} ảnh.`);
        } catch (err) {
            console.error(err);
            toast.error('Lỗi tải ảnh: ' + (err?.message || ''));
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const removePhoto = (index) => {
        setPhotoUrls((prev) => prev.filter((_, i) => i !== index));
    };

    const handleConfirm = () => {
        if (serials.length === 0) {
            toast.error('Phiếu chưa có mã bình.');
            return;
        }
        if (cloudPhotos.length === 0) {
            toast.error('Vui lòng chụp ít nhất một ảnh hiện trường.');
            return;
        }
        onConfirm?.(cloudPhotos);
    };

    return (
        <div className="fixed inset-0 z-[100010] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-10 duration-500">
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white rounded-t-3xl z-10">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                            <PackageCheck size={22} />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-xl font-bold text-slate-900">Phiếu xác nhận thu hồi vỏ</h2>
                            <p className="text-[12px] font-bold text-amber-700 truncate">#{recovery?.recovery_code || '—'}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting || uploading}
                        className="shrink-0 p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 disabled:opacity-50"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="px-6 py-5 overflow-y-auto space-y-6 flex-1">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                            Mã bình cần thu ({serials.length})
                        </p>
                        {serials.length > 0 ? (
                            <div className="space-y-3">
                                {serials.map((serial) => (
                                    <CylinderSerialBarcodeCard key={serial} serial={serial} />
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 font-medium">
                                Phiếu chưa có mã bình. Vui lòng liên hệ điều phối để bổ sung danh sách trước khi thu hồi.
                            </div>
                        )}
                    </div>

                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                            Ảnh hiện trường <span className="text-rose-500">*</span>
                        </p>
                        <div className="grid grid-cols-3 gap-3">
                            {photoUrls.map((url, idx) => (
                                <div
                                    key={`${url}-${idx}`}
                                    className="relative aspect-square rounded-xl border border-slate-200 overflow-hidden bg-slate-100 group"
                                >
                                    <img src={url} alt={`Ảnh thu hồi ${idx + 1}`} className="w-full h-full object-cover" />
                                    <button
                                        type="button"
                                        onClick={() => removePhoto(idx)}
                                        disabled={isSubmitting || uploading}
                                        className="absolute top-1 right-1 p-1 bg-black/40 text-white rounded-full hover:bg-black/60 transition-colors disabled:opacity-50"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}
                            <div className="relative aspect-square">
                                <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    multiple
                                    onChange={handleUploadImages}
                                    disabled={isSubmitting || uploading}
                                    className="absolute inset-0 opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
                                />
                                <div className="w-full h-full border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center gap-1.5 text-slate-400 hover:border-primary hover:text-primary transition-all bg-slate-50">
                                    {uploading ? (
                                        <Loader2 size={20} className="animate-spin text-primary" />
                                    ) : (
                                        <Camera size={24} />
                                    )}
                                    <span className="text-[10px] font-bold text-center leading-tight">
                                        Chụp ảnh
                                        <br />
                                        hiện trường
                                    </span>
                                </div>
                            </div>
                        </div>
                        {cloudPhotos.length === 0 && photoUrls.length > 0 ? (
                            <p className="text-[11px] text-rose-600 font-medium mt-2">
                                Ảnh chưa upload Cloudinary. Chụp lại sau khi kiểm tra .env.
                            </p>
                        ) : null}
                    </div>
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50/50 rounded-b-3xl">
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={isSubmitting || uploading || serials.length === 0 || cloudPhotos.length === 0}
                        className={clsx(
                            'w-full text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] disabled:opacity-50 transition-all text-lg',
                            'bg-emerald-600 shadow-emerald-600/20 active:bg-emerald-700',
                        )}
                    >
                        {isSubmitting ? <Loader2 className="animate-spin" size={24} /> : <CheckCircle2 size={24} />}
                        Xác nhận đã thu hồi
                    </button>
                    <p className="text-center text-[11px] text-slate-400 mt-3 italic">
                        Cần chụp ảnh hiện trường và xác nhận đủ mã bình trước khi hoàn tất phiếu.
                    </p>
                </div>
            </div>
        </div>
    );
}
