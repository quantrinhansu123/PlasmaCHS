import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { Camera, CheckCircle2, Loader2, Truck, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { supabase } from '../../supabase/config';
import {
    isCloudinaryConfigured,
    uploadDeliveryProofFile,
} from '../../utils/cloudinaryUpload';

const appendProofToNotes = (existingNotes, photoUrls) => {
    const base = String(existingNotes || '').trim();
    const proofLine = photoUrls.length
        ? `[GIAO_HANG_PROOF]: ${photoUrls.join(', ')}`
        : '';
    if (!proofLine) return base || null;
    return base ? `${base}\n${proofLine}` : proofLine;
};

export default function ShippingTransportConfirmModal({
    kind,
    record,
    partyName = '—',
    onClose,
    onSuccess,
    onEditDetails,
}) {
    const isIssue = kind === 'ISSUE';
    const code = isIssue ? record?.issue_code : record?.receipt_code;
    const [delivererName, setDelivererName] = useState('');
    const [delivererAddress, setDelivererAddress] = useState('');
    const [receivedBy, setReceivedBy] = useState('');
    const [photoUrls, setPhotoUrls] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [issueItems, setIssueItems] = useState([]);

    useEffect(() => {
        setDelivererName(record?.deliverer_name || '');
        setDelivererAddress(record?.deliverer_address || '');
        setReceivedBy(record?.received_by || '');
        setPhotoUrls([]);
        setIssueItems([]);
    }, [record?.id, kind]);

    useEffect(() => {
        if (!isIssue || !record?.id) return;
        let cancelled = false;
        (async () => {
            const { data } = await supabase
                .from('goods_issue_items')
                .select('item_code, item_type, quantity')
                .eq('issue_id', record.id);
            if (!cancelled && data) setIssueItems(data);
        })();
        return () => {
            cancelled = true;
        };
    }, [isIssue, record?.id]);

    const handleUploadImages = async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        setUploading(true);
        const next = [...photoUrls];
        try {
            if (!isCloudinaryConfigured()) {
                throw new Error('Chưa cấu hình Cloudinary (.env).');
            }
            const folder = `plasmavn/delivery_proofs/shipping/${isIssue ? 'issue' : 'receipt'}/${code || 'task'}`;
            for (const file of files) {
                const { url } = await uploadDeliveryProofFile(file, folder);
                next.push(url);
            }
            setPhotoUrls(next);
            toast.success(`Đã tải ${files.length} ảnh.`);
        } catch (err) {
            toast.error('Lỗi tải ảnh: ' + (err?.message || ''));
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const handleConfirm = async () => {
        const name = delivererName.trim();
        const address = delivererAddress.trim();
        if (!name) {
            toast.error('Vui lòng nhập người vận chuyển.');
            return;
        }
        if (!address) {
            toast.error('Vui lòng nhập địa chỉ giao hàng.');
            return;
        }

        setIsSubmitting(true);
        try {
            const table = isIssue ? 'goods_issues' : 'goods_receipts';
            const existingNotes = isIssue ? record?.notes : record?.note;
            const payload = {
                status: 'HOAN_THANH',
                deliverer_name: name,
                deliverer_address: address,
                updated_at: new Date().toISOString(),
                ...(isIssue
                    ? { notes: appendProofToNotes(existingNotes, photoUrls) }
                    : { note: appendProofToNotes(existingNotes, photoUrls) }),
            };
            if (!isIssue) {
                payload.received_by = receivedBy.trim() || record?.received_by || null;
            }

            const { error } = await supabase.from(table).update(payload).eq('id', record.id);
            if (error) throw error;

            toast.success(
                isIssue
                    ? `Đã xác nhận vận chuyển thành công — phiếu ${code}`
                    : `Đã xác nhận giao hàng thành công — phiếu ${code}`,
            );
            onSuccess?.();
        } catch (err) {
            console.error(err);
            toast.error('Lỗi xác nhận: ' + (err?.message || ''));
        } finally {
            setIsSubmitting(false);
        }
    };

    const addressLabel = isIssue ? 'Địa chỉ giao (NCC)' : 'Địa chỉ nhận hàng';

    return (
        <div className="fixed inset-0 z-[100010] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh]">
                <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
                    <div>
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                            <Truck className="w-3.5 h-3.5" /> Xác nhận vận chuyển
                        </p>
                        <h2 className="text-lg font-bold text-slate-900 mt-1">
                            {isIssue ? 'Xuất trả NCC' : 'Nhập hàng NCC'} — {code}
                        </h2>
                        <p className="text-[12px] text-slate-500 mt-0.5">
                            {isIssue ? 'NCC' : 'NCC'}: <span className="font-bold text-slate-700">{partyName}</span>
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">
                        <X size={20} />
                    </button>
                </div>

                <div className="px-5 py-4 overflow-y-auto space-y-4 flex-1">
                    <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        <p className="text-[12px] font-semibold text-emerald-800">
                            Xác nhận đã giao hàng thành công. Phiếu chuyển sang <strong>Hoàn thành</strong>.
                        </p>
                    </div>

                    {isIssue && issueItems.length > 0 && (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Mã đã xuất ({issueItems.length})</p>
                            <p className="text-[11px] font-mono text-slate-700 line-clamp-3">
                                {issueItems.map((it) => it.item_code).filter(Boolean).join(', ') || '—'}
                            </p>
                        </div>
                    )}

                    <div className="space-y-3">
                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase">Người vận chuyển *</label>
                            <input
                                value={delivererName}
                                onChange={(e) => setDelivererName(e.target.value)}
                                className="mt-1 w-full h-10 px-3 border border-slate-200 rounded-xl text-sm font-semibold"
                                placeholder="Tên shipper / người giao"
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase">{addressLabel} *</label>
                            <input
                                value={delivererAddress}
                                onChange={(e) => setDelivererAddress(e.target.value)}
                                className="mt-1 w-full h-10 px-3 border border-slate-200 rounded-xl text-sm font-semibold"
                                placeholder="Địa chỉ giao hàng"
                            />
                        </div>
                        {!isIssue && (
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase">Người nhận (kho)</label>
                                <input
                                    value={receivedBy}
                                    onChange={(e) => setReceivedBy(e.target.value)}
                                    className="mt-1 w-full h-10 px-3 border border-slate-200 rounded-xl text-sm font-semibold"
                                />
                            </div>
                        )}
                    </div>

                    <div>
                        <p className="text-[11px] font-bold text-slate-500 uppercase mb-2">Ảnh bằng chứng giao hàng</p>
                        <div className="grid grid-cols-3 gap-2">
                            {photoUrls.map((url, idx) => (
                                <div key={url} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200">
                                    <img src={url} alt="" className="w-full h-full object-cover" />
                                    <button
                                        type="button"
                                        onClick={() => setPhotoUrls((prev) => prev.filter((_, i) => i !== idx))}
                                        className="absolute top-1 right-1 p-0.5 bg-black/50 text-white rounded-full"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}
                            <label className="aspect-square border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary text-slate-400">
                                <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={handleUploadImages} />
                                {uploading ? <Loader2 className="w-6 h-6 animate-spin text-primary" /> : <Camera className="w-6 h-6" />}
                                <span className="text-[9px] font-bold mt-1">Chụp ảnh</span>
                            </label>
                        </div>
                    </div>

                    {onEditDetails && (
                        <button
                            type="button"
                            onClick={() => onEditDetails(record)}
                            className="text-[12px] font-bold text-primary hover:underline"
                        >
                            Sửa đầy đủ phiếu (mã RFID, dòng hàng…)
                        </button>
                    )}
                </div>

                <div className="p-4 border-t border-slate-100 flex gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-600"
                    >
                        Hủy
                    </button>
                    <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={handleConfirm}
                        className={clsx(
                            'flex-1 py-3 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700',
                            isSubmitting && 'opacity-60',
                        )}
                    >
                        {isSubmitting ? 'Đang lưu...' : 'Xác nhận giao thành công'}
                    </button>
                </div>
            </div>
        </div>
    );
}
