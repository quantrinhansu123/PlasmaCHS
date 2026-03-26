import { useEffect, useState } from 'react';
import { supabase } from '../../supabase/config';

// Professional inline styles for printing
const S = {
    page: {
        fontFamily: '"Times New Roman", Times, serif',
        fontSize: '11pt',
        lineHeight: '1.4',
        color: '#000',
        background: '#fff',
        width: '100%',
        padding: '10mm',
        boxSizing: 'border-box',
    },
    headerTable: {
        width: '100%',
        marginBottom: '20px',
        borderCollapse: 'collapse',
    },
    headerTdLeft: {
        width: '60%',
        border: 'none',
        padding: '0',
        verticalAlign: 'top',
        fontSize: '10pt',
    },
    headerTdRight: {
        width: '40%',
        border: 'none',
        padding: '0',
        verticalAlign: 'top',
        textAlign: 'right',
        fontSize: '10pt',
    },
    title: {
        textAlign: 'center',
        fontSize: '16pt',
        fontWeight: 'bold',
        marginTop: '20px',
        marginBottom: '5px',
        textTransform: 'uppercase',
    },
    subtitle: {
        textAlign: 'center',
        fontStyle: 'italic',
        marginBottom: '20px',
        fontSize: '10pt',
    },
    infoGrid: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '10px',
        marginBottom: '15px',
        fontSize: '10pt',
    },
    infoItem: {
        marginBottom: '5px',
    },
    dataTable: {
        width: '100%',
        borderCollapse: 'collapse',
        marginBottom: '20px',
    },
    th: {
        border: '1px solid #000',
        padding: '4px 2px',
        textAlign: 'center',
        fontSize: '9pt',
        fontWeight: 'bold',
        backgroundColor: '#f9f9f9',
    },
    td: {
        border: '1px solid #000',
        padding: '4px 2px',
        textAlign: 'center',
        fontSize: '9pt',
    },
    tdLeft: {
        border: '1px solid #000',
        padding: '4px 6px',
        textAlign: 'left',
        fontSize: '9pt',
    },
    signatureTable: {
        width: '100%',
        border: 'none',
        textAlign: 'center',
        marginTop: '30px',
    },
    signatureTd: {
        border: 'none',
        padding: '5px',
        verticalAlign: 'top',
        width: '50%',
        fontSize: '9.5pt',
    },
    footerContainer: {
        marginTop: '30px',
        fontSize: '9pt',
        borderTop: '1px solid #ccc',
        paddingTop: '10px',
    }
};

const getConditionLabel = (cond) => {
    const map = { tot: 'Tốt', lo: 'Lỗi nhẹ', hong: 'Hỏng nặng', khac: 'Khác' };
    return map[cond] || cond;
};

export default function MachineRecoveryPrintTemplate({ recovery, items: initialItems, customerName, customerAddress, warehouseName, onPrinted }) {
    const [items, setItems] = useState(initialItems || []);
    const [loading, setLoading] = useState(!initialItems);

    useEffect(() => {
        if (!initialItems && recovery?.id) {
            fetchItems();
        }
    }, [recovery, initialItems]);

    // Printing logic
    useEffect(() => {
        if (!loading && recovery && items.length >= 0) {
            const timer = setTimeout(() => {
                window.print();
                if (onPrinted) onPrinted();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [loading, recovery, items]);

    const fetchItems = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('machine_recovery_items')
                .select('*')
                .eq('recovery_id', recovery.id);
            if (error) throw error;
            setItems(data || []);
        } catch (err) {
            console.error('Error fetching machine recovery items:', err);
        } finally {
            setLoading(false);
        }
    };

    if (!recovery) return null;

    const recoveryDate = new Date(recovery.recovery_date);
    const day = recoveryDate.getDate().toString().padStart(2, '0');
    const month = (recoveryDate.getMonth() + 1).toString().padStart(2, '0');
    const year = recoveryDate.getFullYear();

    return (
        <div className="machine-recovery-print-page" style={S.page}>
            <style>
                {`
                @media screen {
                    .machine-recovery-print-page { display: none !important; }
                }
                @media print {
                    @page { margin: 0; size: A4 portrait; }
                    body { -webkit-print-color-adjust: exact; background: #fff !important; margin: 0; }
                    .machine-recovery-print-page { 
                        display: block !important; 
                        margin: 0;
                        padding: 20mm !important;
                    }
                    .no-print { display: none !important; }
                }
                `}
            </style>

            <table style={S.headerTable}>
                <tbody>
                    <tr>
                        <td style={S.headerTdLeft}>
                            <b>CÔNG TY TNHH DỊCH VỤ Y TẾ CỘNG ĐỒNG CHS</b><br />
                            Hải âu 02 - 57 Vinhomes Ocean Park,<br />Xã Đa Tốn, Huyện Gia Lâm, Thành phố Hà Nội, Việt Nam<br />
                            Mã số thuế: 0110517351<br />
                            Tel: 0981878423
                        </td>
                        <td style={S.headerTdRight}>
                            <b>BIÊN BẢN THU HỒI MÁY</b><br />
                            Mã phiếu: <b>{recovery.recovery_code}</b><br />
                            Ngày {day} tháng {month} năm {year}
                        </td>
                    </tr>
                </tbody>
            </table>

            <div style={S.title}>BIÊN BẢN THU HỒI MÁY</div>
            <div style={S.subtitle}>Dành cho bộ phận vận chuyển và kho</div>

            <div style={S.infoGrid}>
                <div style={S.infoItem}>Khách hàng: <b>{customerName}</b></div>
                <div style={S.infoItem}>Địa chỉ: {customerAddress || '—'}</div>
                <div style={S.infoItem}>NV vận chuyển: {recovery.driver_name || '—'}</div>
                <div style={S.infoItem}>Kho nhận: {warehouseName || recovery.warehouse_id}</div>
                <div style={S.infoItem}>Tổng số máy: <b>{items.length}</b></div>
            </div>

            {recovery.notes && (
                <div style={{ ...S.infoItem, marginBottom: '15px', fontSize: '11pt' }}>
                    Ghi chú: {recovery.notes}
                </div>
            )}

            <table style={S.dataTable}>
                <thead>
                    <tr>
                        <th style={{ ...S.th, width: '10%' }}>STT</th>
                        <th style={{ ...S.th, width: '40%' }}>Mã Serial Máy</th>
                        <th style={{ ...S.th, width: '20%' }}>Tình trạng</th>
                        <th style={{ ...S.th, width: '30%' }}>Ghi chú chi tiết</th>
                    </tr>
                </thead>
                <tbody>
                    {loading ? (
                        <tr><td colSpan="4" style={S.td}>Đang tải...</td></tr>
                    ) : items.length === 0 ? (
                        <tr><td colSpan="4" style={S.td}>Không có dữ liệu máy</td></tr>
                    ) : (
                        items.map((item, idx) => (
                            <tr key={item.id || idx}>
                                <td style={S.td}>{idx + 1}</td>
                                <td style={{ ...S.td, fontWeight: 'bold' }}>{item.serial_number}</td>
                                <td style={S.td}>{getConditionLabel(item.condition)}</td>
                                <td style={S.tdLeft}>{item.note || '—'}</td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>

            <table style={S.signatureTable}>
                <tbody>
                    <tr>
                        <td style={S.signatureTd}>
                            <b>BÊN GIAO (KHÁCH HÀNG)</b><br />
                            <i>(Ký và ghi rõ họ tên)</i>
                        </td>
                        <td style={S.signatureTd}>
                            <b>BÊN NHẬN (NV VẬN CHUYỂN)</b><br />
                            <i>(Ký và ghi rõ họ tên)</i>
                        </td>
                    </tr>
                    <tr>
                        <td style={{ height: '100px' }}></td>
                        <td style={{ height: '100px' }}></td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}
