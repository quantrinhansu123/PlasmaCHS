import { supabase } from '../supabase/config';

export async function uploadDeliveryProofDataUrl(dataUrl, fileName) {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const { error } = await supabase.storage.from('delivery_proofs').upload(fileName, blob, {
        contentType: blob.type || 'image/png',
        upsert: true,
    });
    if (error) {
        if (String(error.message || '').includes('Bucket not found')) {
            return dataUrl;
        }
        throw error;
    }
    const { data } = supabase.storage.from('delivery_proofs').getPublicUrl(fileName);
    return data.publicUrl;
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
        `transfer_${transferCode || transferRequestId}_proof_${stamp}.png`,
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
