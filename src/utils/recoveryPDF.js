import jsPDF from 'jspdf';
import 'jspdf-autotable';

export async function generateRecoveryPDF(recovery, items, customerName) {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('CÔNG TY TNHH PLASMAVN', 14, 15);
    doc.text('Hotline: 0xxx.xxx.xxx', 14, 20);

    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.text('BIÊN BẢN THU NHẬN VỎ BÌNH', pageWidth / 2, 35, { align: 'center' });

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Mã phiếu: ${recovery.recovery_code}`, pageWidth / 2, 42, { align: 'center' });

    // Info section
    const startY = 52;
    doc.setFontSize(10);
    doc.setTextColor(0);

    const info = [
        [`Ngày thu hồi: ${new Date(recovery.recovery_date).toLocaleDateString('vi-VN')}`, `Kho nhận: ${recovery.warehouse_id}`],
        [`Khách hàng: ${customerName}`, `NV vận chuyển: ${recovery.driver_name || '—'}`],
    ];

    info.forEach((row, idx) => {
        doc.text(row[0], 14, startY + idx * 7);
        doc.text(row[1], pageWidth / 2, startY + idx * 7);
    });

    if (recovery.notes) {
        doc.text(`Ghi chú: ${recovery.notes}`, 14, startY + info.length * 7);
    }

    // Items table
    const tableStartY = startY + (info.length + 1) * 7 + 4;

    doc.autoTable({
        startY: tableStartY,
        head: [['STT', 'Mã Serial Vỏ Bình', 'Tình trạng', 'Ghi chú']],
        body: items.map((item, idx) => [
            idx + 1,
            item.serial_number,
            getConditionLabel(item.condition),
            item.note || ''
        ]),
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 248, 250] },
        theme: 'grid'
    });

    const finalY = doc.lastAutoTable.finalY + 10;

    // Summary
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text(`Tổng số vỏ thu hồi: ${items.length}`, 14, finalY);

    // Signatures
    const sigY = finalY + 20;
    doc.setFontSize(10);
    doc.text('Bên giao (Khách hàng)', 35, sigY, { align: 'center' });
    doc.text('Bên nhận (NV vận chuyển)', pageWidth - 45, sigY, { align: 'center' });

    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text('(Ký, ghi rõ họ tên)', 35, sigY + 5, { align: 'center' });
    doc.text('(Ký, ghi rõ họ tên)', pageWidth - 45, sigY + 5, { align: 'center' });

    // Save
    doc.save(`Bien_ban_thu_hoi_${recovery.recovery_code}.pdf`);
}

function getConditionLabel(cond) {
    const map = { tot: 'Tốt', hong: 'Hỏng', meo: 'Méo/Móp', khac: 'Khác' };
    return map[cond] || cond;
}
