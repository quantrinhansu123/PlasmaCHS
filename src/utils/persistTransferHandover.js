import { supabase } from '../supabase/config';
import { isCloudinaryDeliveryUrl, uploadDataUrlToCloudinary } from './cloudinaryUpload';

export async function uploadDeliveryProofDataUrl(dataUrl, transferCode) {
    const folder = `plasmavn/delivery_proofs/transfers/${transferCode || 'handover'}`;
    const url = await uploadDataUrlToCloudinary(dataUrl, folder);
    if (!isCloudinaryDeliveryUrl(url)) {
        throw new Error('Không upload được ảnh lên Cloudinary.');
    }
    return url;
}

/**
 * Ghi xác nhận bàn giao luân chuyển vào `inventory_transfer_requests`.
 */
export async function persistTransferHandover({
    transferRequestId,
    transferCode,
    handoverProofBase64,
    transferChecklist = {},
}) {
    if (!transferRequestId) {
        throw new Error('Thiếu mã phiếu luân chuyển.');
    }
    if (!handoverProofBase64) {
        throw new Error('Bạn cần chụp ảnh xác nhận bàn giao.');
    }

    const stamp = Date.now();
    const proofUrl = await uploadDeliveryProofDataUrl(
        handoverProofBase64,
        transferCode || transferRequestId,
    );

    const checklistDone = Object.keys(transferChecklist).filter((key) => transferChecklist[key]);
    const appendLines = [
        `[Kho Nhan Xac Nhan]: TRUE`,
        `[Anh Kho Nhan]: ${proofUrl}`,
        `[Checklist Kho Nhan]: ${JSON.stringify(checklistDone)}`,
        `[Thoi Gian Xac Nhan]: ${new Date().toISOString()}`,
    ].join('\n');

    const { data: requestRow, error: loadErr } = await supabase
        .from('inventory_transfer_requests')
        .select('id, note')
        .eq('id', transferRequestId)
        .maybeSingle();
    if (loadErr) throw loadErr;

    const nextNote = `${requestRow?.note || ''}\n${appendLines}`.trim();
    const { error: updateErr } = await supabase
        .from('inventory_transfer_requests')
        .update({
            note: nextNote,
            handover_image_url: proofUrl,
        })
        .eq('id', transferRequestId);
    if (updateErr) throw updateErr;

    return { proofUrl };
}
