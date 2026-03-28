import React, { useEffect } from 'react';

// Professional inline styles for printing (following A4 standards)
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
        padding: '6px 2px',
        textAlign: 'center',
        fontSize: '9pt',
        fontWeight: 'bold',
        backgroundColor: '#f9f9f9',
    },
    td: {
        border: '1px solid #000',
        padding: '6px 2px',
        textAlign: 'center',
        fontSize: '9pt',
    },
    tdLeft: {
        border: '1px solid #000',
        padding: '6px 8px',
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
        width: '33%',
        fontSize: '9.5pt',
    },
    footerContainer: {
        marginTop: '40px',
        fontSize: '9pt',
        borderTop: '1px solid #ccc',
        paddingTop: '10px',
        textAlign: 'center',
        fontStyle: 'italic',
        color: '#666'
    }
};

const GoodsIssuePrintTemplate = React.forwardRef(({ issue, items = [], warehouseName, supplierName, onPrinted }, ref) => {
    // Auto printing once rendered (if ref is not used for printing control)
    useEffect(() => {
        if (issue && items.length >= 0) {
            const timer = setTimeout(() => {
                window.print();
                if (onPrinted) {
                    onPrinted();
                }
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [issue, items, onPrinted]);

    if (!issue) return null;

    const formatDate = (dateStr) => {
        if (!dateStr) return '.../.../202...';
        const d = new Date(dateStr);
        return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
    };

    const getTypeLabel = (type) => {
        const types = {
            'TRA_VO': 'XUẤT TRẢ VỎ BÌNH',
            'TRA_BINH_LOI': 'XUẤT TRẢ BÌNH LỖI',
            'TRA_MAY': 'XUẤT TRẢ MÁY MÓC'
        };
        return types[type] || 'PHIẾU XUẤT KHO';
    };

    return (
        <div className="pvn-goods-issue-print" style={S.page} ref={ref}>
            <style>
                {`
                @media screen {
                    .pvn-goods-issue-print { display: none !important; }
                }
                @media print {
                    @page { margin: 0; size: A4 portrait; }
                    body { -webkit-print-color-adjust: exact; background: #fff !important; margin: 0; }
                    .pvn-goods-issue-print { 
                        display: block !important; 
                        margin: 0;
                        padding: 15mm !important;
                    }
                    /* Hide everything else when printing */
                    body > *:not(.pvn-goods-issue-print-portal) {
                        display: none !important;
                    }
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
                            <b>PHIẾU XUẤT KHO</b><br />
                            Mã phiếu: <b>{issue.issue_code}</b><br />
                            Ngày {formatDate(issue.issue_date)}
                        </td>
                    </tr>
                </tbody>
            </table>

            <div style={S.title}>{getTypeLabel(issue.issue_type)}</div>
            <div style={S.subtitle}>Dành cho bộ phận quản lý kho và nhà cung cấp</div>

            <div style={S.infoGrid}>
                <div style={S.infoItem}>Đơn vị nhận (NCC): <b>{supplierName || 'N/A'}</b></div>
                <div style={S.infoItem}>Kho xuất hàng: <b>{warehouseName || issue.warehouse_id}</b></div>
                <div style={S.infoItem}>Lý do xuất: {issue.notes || 'Trả nhà cung cấp'}</div>
                <div style={S.infoItem}>Người lập phiếu: {issue.created_by || 'Admin hệ thống'}</div>
            </div>

            <table style={S.dataTable}>
                <thead>
                    <tr>
                        <th style={{ ...S.th, width: '10%' }}>STT</th>
                        <th style={{ ...S.th, width: '40%' }}>Tên hàng hóa / Mã Serial</th>
                        <th style={{ ...S.th, width: '20%' }}>Phân loại</th>
                        <th style={{ ...S.th, width: '30%' }}>Ghi chú chi tiết</th>
                    </tr>
                </thead>
                <tbody>
                    {items.length === 0 ? (
                        <tr><td colSpan="4" style={S.td}>Không có dữ liệu hàng hóa</td></tr>
                    ) : (
                        items.map((item, idx) => (
                            <tr key={item.id || idx}>
                                <td style={S.td}>{idx + 1}</td>
                                <td style={{ ...S.tdLeft, fontWeight: 'bold' }}>{item.item_code}</td>
                                <td style={S.td}>{item.item_type || 'N/A'}</td>
                                <td style={S.td}>Số lượng: {item.quantity || 1}</td>
                            </tr>
                        ))
                    )}
                    {/* Add empty rows to fill A4 if few items */}
                    {[...Array(Math.max(0, 8 - items.length))].map((_, i) => (
                        <tr key={`empty-${i}`} style={{ height: '25px' }}>
                            <td style={S.td}></td>
                            <td style={S.td}></td>
                            <td style={S.td}></td>
                            <td style={S.td}></td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr style={{ fontWeight: 'bold' }}>
                        <td colSpan="3" style={{ ...S.td, textAlign: 'right', paddingRight: '15px' }}>TỔNG CỘNG</td>
                        <td style={S.td}>{items.length} mặt hàng</td>
                    </tr>
                </tfoot>
            </table>

            <table style={S.signatureTable}>
                <tbody>
                    <tr>
                        <td style={S.signatureTd}>
                            <b>NGƯỜI LẬP PHIẾU</b><br />
                            <i>(Ký, ghi rõ họ tên)</i>
                        </td>
                        <td style={S.signatureTd}>
                            <b>NGƯỜI GIAO HÀNG</b><br />
                            <i>(Ký, ghi rõ họ tên)</i>
                        </td>
                        <td style={S.signatureTd}>
                            <b>NGƯỜI NHẬN HÀNG</b><br />
                            <i>(Ký, ghi rõ họ tên)</i>
                        </td>
                    </tr>
                    <tr>
                        <td style={{ height: '80px' }}></td>
                        <td style={{ height: '80px' }}></td>
                        <td style={{ height: '80px' }}></td>
                    </tr>
                    <tr>
                        <td style={{ fontWeight: 'bold' }}>{issue.created_by || 'Admin hệ thống'}</td>
                        <td></td>
                        <td></td>
                    </tr>
                </tbody>
            </table>

            <div style={S.footerContainer}>
                Cảm ơn quý khách đã tin tưởng dịch vụ của Plasma Việt Nam
            </div>
        </div>
    );
});

export default GoodsIssuePrintTemplate;
