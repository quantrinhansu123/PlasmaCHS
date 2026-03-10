import React from 'react';
import { PRODUCT_TYPES } from '../constants/orderConstants';

const getProductLabel = (id) => PRODUCT_TYPES.find(p => p.id === id)?.label || id;

// Inline styles to bypass global !important overrides
const S = {
    page: {
        fontFamily: '"Times New Roman", Times, serif',
        fontSize: '13pt',
        lineHeight: '1.5',
        color: '#000',
        background: '#fff',
        width: '100%',
        padding: '15mm 20mm 15mm 25mm',
        boxSizing: 'border-box',
    },
    headerCompany: {
        textAlign: 'left',
        marginBottom: '3mm',
    },
    companyName: {
        fontSize: '13pt',
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    companyAddress: {
        fontSize: '12pt',
        marginTop: '2px',
        fontWeight: 'normal',
    },
    titleSection: {
        textAlign: 'center',
        margin: '8mm 0 6mm',
    },
    titleH1: {
        fontSize: '18pt',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        marginBottom: '3mm',
    },
    dateIntro: {
        textAlign: 'left',
        marginBottom: '4mm',
        fontSize: '13pt',
        fontStyle: 'italic',
        fontWeight: 'normal',
    },
    partySection: {
        marginBottom: '4mm',
    },
    partyTitle: {
        fontWeight: 'bold',
        fontSize: '13pt',
        textTransform: 'uppercase',
        marginBottom: '2mm',
    },
    partyRow: {
        display: 'flex',
        alignItems: 'baseline',
        marginBottom: '2mm',
        fontSize: '13pt',
        paddingLeft: '8mm',
    },
    partyLabel: {
        whiteSpace: 'nowrap',
        fontWeight: 'normal',
    },
    partyValue: {
        flex: '1',
        borderBottom: '1px dotted #000',
        fontFamily: '"Times New Roman", Times, serif',
        fontSize: '13pt',
        padding: '0 4px',
        minHeight: '20px',
        fontWeight: 'normal',
    },
    partyText: {
        fontSize: '13pt',
        fontWeight: 'normal',
    },
    partyRowInline: {
        display: 'flex',
        alignItems: 'baseline',
        marginBottom: '2mm',
        fontSize: '13pt',
        paddingLeft: '8mm',
    },
    half: {
        flex: '1',
        display: 'flex',
        alignItems: 'baseline',
    },
    checkText: {
        fontSize: '13pt',
        margin: '4mm 0 3mm',
        fontWeight: 'normal',
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse',
        margin: '3mm 0 4mm',
        fontSize: '12pt',
    },
    th: {
        border: '1px solid #000',
        padding: '5px 6px',
        verticalAlign: 'middle',
        fontWeight: 'bold',
        textAlign: 'center',
        fontSize: '12pt',
        color: '#000',
        background: 'transparent',
        whiteSpace: 'normal',
    },
    td: {
        border: '1px solid #000',
        padding: '5px 6px',
        verticalAlign: 'middle',
        fontSize: '12pt',
        fontWeight: 'normal',
        color: '#000',
        whiteSpace: 'normal',
        textAlign: 'center',
    },
    tdLeft: {
        border: '1px solid #000',
        padding: '5px 6px',
        verticalAlign: 'middle',
        fontSize: '12pt',
        fontWeight: 'normal',
        color: '#000',
        whiteSpace: 'normal',
        textAlign: 'left',
    },
    footerNote: {
        fontSize: '13pt',
        margin: '4mm 0 6mm',
        textAlign: 'justify',
        fontWeight: 'normal',
    },
    signatureSection: {
        display: 'flex',
        justifyContent: 'space-between',
        textAlign: 'center',
        marginTop: '8mm',
    },
    sigBlock: {
        width: '45%',
    },
    sigTitle: {
        fontWeight: 'bold',
        fontSize: '14pt',
        textTransform: 'uppercase',
        marginBottom: '3mm',
    },
    sigLine: {
        marginTop: '40px',
        fontSize: '13pt',
        fontWeight: 'normal',
    },
};

const HandoverItem = ({ order }) => {
    if (!order) return null;

    const today = new Date(order.created_at || Date.now());
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();

    const productLabel = getProductLabel(order.product_type);

    // Build rows for the table
    const rows = [];
    rows.push({
        tt: 1,
        content: productLabel,
        qty: order.quantity || 1,
        status: '',
        machineCode: order.department || '',
    });



    return (
        <div className="order-print-page" style={S.page}>
            {/* ===== HEADER ===== */}
            <div style={S.headerCompany}>
                <div style={S.companyName}>CÔNG TY TNHH DỊCH VỤ Y TẾ CỘNG ĐỒNG</div>
                <div style={S.companyAddress}>Hải Âu 02-57 Vinhomes Ocean Park, Gia Lâm, Hà Nội</div>
            </div>

            {/* ===== TITLE ===== */}
            <div style={S.titleSection}>
                <div style={S.titleH1}>Biên Bản Bàn Giao Máy</div>
            </div>

            {/* ===== DATE INTRO ===== */}
            <div style={S.dateIntro}>
                Hôm nay, ngày {day} tháng {month} năm {year}, chúng tôi gồm:
            </div>

            {/* ===== BÊN GIAO (fixed) ===== */}
            <div style={S.partySection}>
                <div style={S.partyTitle}>ĐẠI DIỆN BÊN GIAO: CÔNG TY TNHH DỊCH VỤ Y TẾ CỘNG ĐỒNG CHS</div>
                <div style={S.partyRow}>
                    <span style={S.partyLabel}>Ông (Bà):&nbsp;</span>
                    <span style={S.partyText}>Lê Hoài Anh</span>
                </div>
                <div style={S.partyRow}>
                    <span style={S.partyLabel}>Chức vụ:&nbsp;</span>
                    <span style={S.partyValue}></span>
                </div>
                <div style={S.partyRow}>
                    <span style={S.partyLabel}>Địa chỉ:&nbsp;</span>
                    <span style={S.partyText}>Hải Âu 02-57 Vinhomes Ocean Park, Xã Gia Lâm, Hà Nội</span>
                </div>
                <div style={S.partyRowInline}>
                    <div style={S.half}>
                        <span style={S.partyLabel}>Điện thoại:&nbsp;</span>
                        <span style={S.partyText}>0981 878 423</span>
                    </div>
                    <div style={S.half}>
                        <span style={S.partyLabel}>Fax:&nbsp;</span>
                        <span style={S.partyValue}></span>
                    </div>
                </div>
            </div>

            {/* ===== BÊN NHẬN (from order) ===== */}
            <div style={S.partySection}>
                <div style={{ ...S.partyTitle, textTransform: 'none' }}>
                    Đại diện bên nhận: <span style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{order.customer_name || ''}</span>
                </div>
                <div style={S.partyRow}>
                    <span style={S.partyLabel}>Cơ sở kinh doanh:&nbsp;</span>
                    <span style={S.partyValue}>{order.customer_name || ''}</span>
                </div>
                <div style={S.partyRow}>
                    <span style={S.partyLabel}>Ông (Bà):&nbsp;</span>
                    <span style={S.partyValue}>{order.recipient_name || ''}</span>
                </div>
                <div style={S.partyRow}>
                    <span style={S.partyLabel}>Chức vụ:&nbsp;</span>
                    <span style={S.partyValue}></span>
                </div>
                <div style={S.partyRow}>
                    <span style={S.partyLabel}>Địa chỉ:&nbsp;</span>
                    <span style={S.partyValue}>{order.recipient_address || ''}</span>
                </div>
                <div style={S.partyRowInline}>
                    <div style={S.half}>
                        <span style={S.partyLabel}>Điện thoại:&nbsp;</span>
                        <span style={S.partyValue}>{order.recipient_phone || ''}</span>
                    </div>
                    <div style={S.half}>
                        <span style={S.partyLabel}>Fax:&nbsp;</span>
                        <span style={S.partyValue}></span>
                    </div>
                </div>
            </div>

            {/* ===== CHECK TEXT ===== */}
            <div style={S.checkText}>
                Hai bên đã cùng kiểm tra và tiến hành giao, nhận các tài sản cụ thể như sau:
            </div>

            {/* ===== MAIN TABLE ===== */}
            <table style={S.table}>
                <thead>
                    <tr>
                        <th style={{ ...S.th, width: '6%' }}>TT</th>
                        <th style={{ ...S.th, width: '34%' }}>Nội dung</th>
                        <th style={{ ...S.th, width: '12%' }}>Số lượng</th>
                        <th style={{ ...S.th, width: '24%' }}>Tình trạng</th>
                        <th style={{ ...S.th, width: '24%' }}>Hình ảnh mã máy</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, idx) => (
                        <tr key={idx}>
                            <td style={S.td}>{row.tt}</td>
                            <td style={S.tdLeft}>{row.content}</td>
                            <td style={S.td}>{row.qty !== '' ? String(row.qty).padStart(2, '0') : ''}</td>
                            <td style={S.tdLeft}>{row.status}</td>
                            <td style={S.td}>{row.machineCode}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* ===== FOOTER NOTE ===== */}
            <div style={S.footerNote}>
                Biên bản bàn giao máy được lập thành 02 bản, mỗi bên giữ 01 bản có giá trị như nhau.
            </div>

            {/* ===== SIGNATURES (2 blocks) ===== */}
            <div style={S.signatureSection}>
                <div style={S.sigBlock}>
                    <div style={S.sigTitle}>Đại diện bên giao</div>
                    <div style={S.sigLine}>....................................</div>
                </div>
                <div style={S.sigBlock}>
                    <div style={S.sigTitle}>Đại diện bên nhận</div>
                    <div style={S.sigLine}>....................................</div>
                </div>
            </div>
        </div>
    );
};

const MachineHandoverPrintTemplate = ({ orders }) => {
    if (!orders) return null;
    const orderList = Array.isArray(orders) ? orders : [orders];

    return (
        <div className="bulk-print-container">
            {orderList.map((order, index) => (
                <React.Fragment key={order.id || index}>
                    <HandoverItem order={order} />
                    {index < orderList.length - 1 && <div className="page-break" />}
                </React.Fragment>
            ))}
        </div>
    );
};

export default MachineHandoverPrintTemplate;
