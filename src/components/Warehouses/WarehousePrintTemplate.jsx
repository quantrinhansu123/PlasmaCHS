import { useEffect, useState } from 'react';
import { supabase } from '../../supabase/config';

// Inline styles to bypass global CSS overrides and ensure reliability across different views/portals
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
        width: '65%',
        border: 'none',
        padding: '0',
        verticalAlign: 'top',
        fontSize: '10pt',
    },
    headerTdRight: {
        width: '35%',
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
        marginTop: '15px',
        marginBottom: '5px',
        textTransform: 'uppercase',
    },
    subtitle: {
        textAlign: 'center',
        fontStyle: 'italic',
        marginBottom: '20px',
        fontSize: '10pt',
    },
    infoSection: {
        marginBottom: '10px',
        fontSize: '10pt',
    },
    dataTable: {
        width: '100%',
        borderCollapse: 'collapse',
        marginBottom: '20px',
        tableLayout: 'fixed',
    },
    th: {
        border: '1px solid #000',
        padding: '4px 2px',
        textAlign: 'center',
        fontSize: '9.5pt',
        fontWeight: 'bold',
        wordBreak: 'break-word',
    },
    td: {
        border: '1px solid #000',
        padding: '4px 2px',
        textAlign: 'center',
        fontSize: '9pt',
        wordBreak: 'break-word',
    },
    tdLeft: {
        border: '1px solid #000',
        padding: '4px 4px',
        textAlign: 'left',
        fontSize: '9pt',
        wordBreak: 'break-word',
    },
    tdRight: {
        border: '1px solid #000',
        padding: '4px 4px',
        textAlign: 'right',
        fontSize: '9pt',
        wordBreak: 'break-word',
    },
    signatureTable: {
        width: '100%',
        border: 'none',
        textAlign: 'center',
        marginTop: '30px',
        borderSpacing: '0',
    },
    signatureTd: {
        border: 'none',
        padding: '5px',
        verticalAlign: 'top',
        fontSize: '9.5pt', // Reduced from 11pt
        width: '25%',
    },
    footer: {
        textAlign: 'left',
        marginTop: '20px',
        fontSize: '11pt',
    }
};

export default function WarehousePrintTemplate({ warehouse, onPrinted }) {
    const [inventory, setInventory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!warehouse) return;
        fetchInventory();
    }, [warehouse]);

    // Handle printing once data is loaded
    useEffect(() => {
        if (!loading && warehouse && inventory.length >= 0) {
            const timer = setTimeout(() => {
                window.print();
                if (onPrinted) onPrinted();
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [loading, warehouse, inventory]);

    const fetchInventory = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('inventory')
                .select('*')
                .eq('warehouse_id', warehouse.id)
                .order('item_type', { ascending: true })
                .order('item_name', { ascending: true });

            if (error) throw error;
            setInventory(data || []);
        } catch (error) {
            console.error('Error fetching inventory for print:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!warehouse) return null;

    const now = new Date();
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear();

    return (
        <div className="warehouse-print-page" style={S.page}>
            <style>
                {`
                @media screen {
                    .warehouse-print-page { display: none !important; }
                }
                @media print {
                    @page { margin: 0; size: A4 portrait; }
                    body { -webkit-print-color-adjust: exact; background: #fff !important; margin: 0; }
                    .warehouse-print-page { 
                        display: block !important; 
                        margin: 0;
                        padding: 20mm !important; /* Proper margins for content */
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
                            TK ngân hàng: 8186222999 - Ngân hàng TMCP Quân đội<br />
                            Tel: 0981878423
                        </td>
                        <td style={S.headerTdRight}>
                            <b>Mẫu số: 03XKNB3/001</b><br />
                            Ký hiệu: .................<br />
                            Số: CK{warehouse.id?.toString().slice(-5).toUpperCase() || '00001'}
                        </td>
                    </tr>
                </tbody>
            </table>

            <div style={S.title}>PHIẾU XUẤT KHO KIÊM VẬN CHUYỂN NỘI BỘ</div>
            <div style={S.subtitle}>
                Liên 2: Dùng để vận chuyển hàng<br />
                Ngày {day} tháng {month} năm {year}
            </div>

            <div style={S.infoSection}>
                Căn cứ lệnh điều động số ....... Ngày {day} tháng {month} năm {year} của CTY TNHH dịch vụ y tế cộng đồng CHS về việc: Vận chuyển hàng hóa<br />
                Họ tên người vận chuyển: ....................................................................................................................................<br />
                Phương tiện vận chuyển: .....................................................................................................................................<br />
                Xuất tại kho: <b>{warehouse.name}</b> &nbsp;&nbsp;&nbsp;&nbsp; Nhập tại kho: ....................................................................
            </div>

            <table style={S.dataTable}>
                <thead>
                    <tr>
                        <th style={{ ...S.th, width: '6%', whiteSpace: 'nowrap' }} rowSpan="2">STT</th>
                        <th style={{ ...S.th, width: '30%' }} rowSpan="2">Tên nhãn hiệu, quy cách,<br />phẩm chất vật tư<br />(sản phẩm, hàng hóa)</th>
                        <th style={{ ...S.th, width: '11%' }} rowSpan="2">Mã số</th>
                        <th style={{ ...S.th, width: '7%' }} rowSpan="2">Đơn vị tính</th>
                        <th style={S.th} colSpan="2">Số lượng</th>
                        <th style={{ ...S.th, width: '12%' }} rowSpan="2">Đơn giá</th>
                        <th style={{ ...S.th, width: '14%' }} rowSpan="2">Thành tiền</th>
                    </tr>
                    <tr>
                        <th style={{ ...S.th, width: '10%' }}>Thực xuất</th>
                        <th style={{ ...S.th, width: '10%' }}>Thực nhập</th>
                    </tr>
                </thead>
                <tbody>
                    {loading ? (
                        <tr>
                            <td colSpan="8" style={{ ...S.td, padding: '20px', fontStyle: 'italic' }}>Đang tải dữ liệu tồn kho...</td>
                        </tr>
                    ) : inventory.length === 0 ? (
                        <tr>
                            <td colSpan="8" style={{ ...S.td, padding: '20px', fontStyle: 'italic' }}>Kho hiện đang trống</td>
                        </tr>
                    ) : (
                        inventory.map((item, index) => (
                            <tr key={item.id}>
                                <td style={S.td}>{index + 1}</td>
                                <td style={S.tdLeft}>{item.item_name}</td>
                                <td style={S.td}>{item.id?.toString().split('-')[0].toUpperCase() || '—'}</td>
                                <td style={S.td}>{item.item_type === 'Cylinder' ? 'Bình' : item.item_type === 'Machine' ? 'Máy' : 'Cái'}</td>
                                <td style={S.tdRight}>{(item.quantity || 0).toLocaleString('vi-VN')}</td>
                                <td style={S.tdRight}>{(item.quantity || 0).toLocaleString('vi-VN')}</td>
                                <td style={S.td}></td>
                                <td style={S.td}></td>
                            </tr>
                        ))
                    )}
                    <tr>
                        <td colSpan="4" style={{ ...S.tdLeft, fontWeight: 'bold' }}>Tổng cộng</td>
                        <td style={{ ...S.tdRight, fontWeight: 'bold' }}>
                            {inventory.reduce((sum, item) => sum + (item.quantity || 0), 0).toLocaleString('vi-VN')}
                        </td>
                        <td style={{ ...S.tdRight, fontWeight: 'bold' }}>
                            {inventory.reduce((sum, item) => sum + (item.quantity || 0), 0).toLocaleString('vi-VN')}
                        </td>
                        <td style={S.td}></td>
                        <td style={S.td}></td>
                    </tr>
                </tbody>
            </table>

            <div style={S.infoSection}>Hợp đồng số: .....................................................................</div>

            <table style={S.signatureTable}>
                <tbody>
                    <tr>
                        <td style={S.signatureTd}><b>Người lập phiếu</b><br /><i>(Ký, họ tên)</i></td>
                        <td style={S.signatureTd}><b>Thủ kho xuất</b><br /><i>(Ký, họ tên)</i></td>
                        <td style={S.signatureTd}><b>Người vận chuyển</b><br /><i>(Ký, họ tên)</i></td>
                        <td style={S.signatureTd}><b>Thủ kho nhập</b><br /><i>(Ký, họ tên)</i></td>
                    </tr>
                    <tr>
                        <td style={{ height: '80px' }}></td>
                        <td></td>
                        <td></td>
                        <td></td>
                    </tr>
                </tbody>
            </table>

            <div style={S.footer}>
                <b>AMIS KE TOAN</b><br />
                <i>(Cần kiểm tra, đối chiếu khi lập, giao, nhận hóa đơn)</i>
            </div>
        </div>
    );
}
