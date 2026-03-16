import React from 'react';

const numberToVietnameseWords = (num) => {
    if (!num || num === 0) return 'Không';
    const units = ['', 'nghìn', 'triệu', 'tỷ'];
    const ones = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

    const readGroup = (n) => {
        const h = Math.floor(n / 100);
        const t = Math.floor((n % 100) / 10);
        const o = n % 10;
        let result = '';
        if (h > 0) result += ones[h] + ' trăm ';
        if (t > 1) {
            result += ones[t] + ' mươi ';
            if (o === 1) result += 'mốt';
            else if (o === 5) result += 'lăm';
            else if (o > 0) result += ones[o];
        } else if (t === 1) {
            result += 'mười ';
            if (o === 5) result += 'lăm';
            else if (o > 0) result += ones[o];
        } else if (t === 0 && h > 0 && o > 0) {
            result += 'lẻ ' + ones[o];
        } else if (o > 0) {
            result += ones[o];
        }
        return result.trim();
    };

    const groups = [];
    let n = Math.floor(num);
    while (n > 0) {
        groups.push(n % 1000);
        n = Math.floor(n / 1000);
    }

    let result = '';
    for (let i = groups.length - 1; i >= 0; i--) {
        if (groups[i] > 0) {
            result += readGroup(groups[i]) + ' ' + units[i] + ' ';
        }
    }
    return result.trim().replace(/^\w/, c => c.toUpperCase()) + ' đồng';
};

const formatNumber = (val) => {
    if (val === null || val === undefined || val === '' || val === 0) return '';
    const parts = val.toString().split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return parts.join(',');
};

const getWarehouseLabel = (warehousesList, id) => warehousesList?.find(w => w.id === id)?.name || id;

// Inline styles to bypass global !important overrides
const S = {
    page: {
        fontFamily: '"Times New Roman", Times, serif',
        fontSize: '10pt',
        lineHeight: '1.1',
        color: '#000',
        background: '#fff',
        width: '100%',
        padding: '20mm',
        boxSizing: 'border-box',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '3mm',
    },
    headerLeft: {
        flex: '0 0 56%',
        fontSize: '10pt',
    },
    headerRight: {
        flex: '0 0 42%',
        textAlign: 'center',
        fontSize: '9pt',
    },
    companyName: {
        fontSize: '10pt',
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    companyInfo: {
        fontSize: '10pt',
        marginTop: '2px',
        fontWeight: 'normal',
    },
    formNumber: {
        fontWeight: 'bold',
        fontSize: '11pt',
    },
    formLegal: {
        fontSize: '9pt',
        fontStyle: 'italic',
        fontWeight: 'normal',
    },
    titleSection: {
        textAlign: 'center',
        margin: '4mm 0 2mm',
    },
    titleH1: {
        fontSize: '15pt',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        marginBottom: '2mm',
    },
    dateLine: {
        fontSize: '11pt',
        fontWeight: 'bold',
        marginBottom: '2mm',
    },
    titleRow: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
    },
    titleCenter: {
        textAlign: 'center',
        flex: '1',
        fontSize: '11pt',
    },
    debitCredit: {
        textAlign: 'right',
        fontSize: '9pt',
        minWidth: '100px',
    },
    infoSection: {
        margin: '2mm 0',
    },
    infoRow: {
        display: 'flex',
        alignItems: 'baseline',
        marginBottom: '1mm',
        fontSize: '11pt',
    },
    infoLabel: {
        whiteSpace: 'nowrap',
        fontWeight: 'normal',
    },
    infoValue: {
        flex: '1',
        fontFamily: '"Times New Roman", Times, serif',
        fontSize: '10pt',
        padding: '0 4px',
        minHeight: '18px',
        fontWeight: 'normal',
    },
    infoFixedValue: {
        fontFamily: '"Times New Roman", Times, serif',
        fontSize: '10pt',
        padding: '0 4px',
        minHeight: '18px',
        fontWeight: 'normal',
        textAlign: 'center',
    },
    infoRowSplit: {
        display: 'flex',
        alignItems: 'baseline',
        marginBottom: '1mm',
        fontSize: '10pt',
    },
    splitHalf: {
        flex: '1',
        display: 'flex',
        alignItems: 'baseline',
    },
    // Table styles
    table: {
        width: '100%',
        borderCollapse: 'collapse',
        margin: '2mm 0',
        fontSize: '10pt',
    },
    th: {
        border: '1px solid #000',
        padding: '4px 2px',
        textAlign: 'center',
        verticalAlign: 'middle',
        fontWeight: 'bold',
        fontSize: '9pt',
        whiteSpace: 'normal',
        color: '#000',
        background: 'transparent',
    },
    td: {
        border: '1px solid #000',
        padding: '3px 2px',
        textAlign: 'center',
        verticalAlign: 'middle',
        fontSize: '9pt',
        fontWeight: 'normal',
        color: '#000',
        whiteSpace: 'normal',
    },
    tdLeft: {
        border: '1px solid #000',
        padding: '3px 4px',
        textAlign: 'left',
        verticalAlign: 'middle',
        fontSize: '9pt',
        fontWeight: 'normal',
        color: '#000',
        whiteSpace: 'normal',
    },
    tdRight: {
        border: '1px solid #000',
        padding: '3px 4px',
        textAlign: 'right',
        verticalAlign: 'middle',
        fontSize: '9pt',
        fontWeight: 'normal',
        color: '#000',
        whiteSpace: 'normal',
    },
    tdBold: {
        border: '1px solid #000',
        padding: '3px 4px',
        textAlign: 'center',
        verticalAlign: 'middle',
        fontSize: '10pt',
        fontWeight: 'bold',
        color: '#000',
        whiteSpace: 'normal',
    },
    tdBoldRight: {
        border: '1px solid #000',
        padding: '3px 4px',
        textAlign: 'right',
        verticalAlign: 'middle',
        fontSize: '10pt',
        fontWeight: 'bold',
        color: '#000',
        whiteSpace: 'normal',
    },
    summarySection: {
        margin: '3mm 0',
        fontSize: '10pt',
    },
    dateFooter: {
        textAlign: 'right',
        fontSize: '10pt',
        margin: '3mm 0 2mm',
        fontStyle: 'italic',
        fontWeight: 'normal',
    },
    signatureSection: {
        display: 'flex',
        justifyContent: 'space-between',
        textAlign: 'center',
        marginTop: '3mm',
        fontSize: '10pt',
    },
    sigBlock: {
        width: '23%',
    },
    sigTitle: {
        fontWeight: 'bold',
        fontSize: '10pt',
    },
    sigSubtitle: {
        fontStyle: 'italic',
        fontSize: '10pt',
        fontWeight: 'normal',
    },
    sigSpace: {
        height: '40px',
    },
    dots: {
        borderBottom: '1px dotted #000',
        display: 'inline-block',
        minWidth: '60px',
        textAlign: 'center',
        fontFamily: '"Times New Roman", Times, serif',
    },
};

const ReceiptItem = ({ receipt, items, warehousesList }) => {
    if (!receipt) return null;

    const today = receipt.receipt_date ? new Date(receipt.receipt_date) : new Date(receipt.created_at || Date.now());
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();

    const warehouseLabel = getWarehouseLabel(warehousesList, receipt.warehouse_id);

    // Build table rows from items
    const rows = items.map((item, idx) => ({
        stt: idx + 1,
        name: item.item_name || '',
        code: item.serial_number || item.item_type || '',
        unit: item.unit || (item.item_name?.toLowerCase().includes('bình') ? 'Bình' : 'Cái'),
        qtyReq: item.quantity || 0,
        qtyAct: item.quantity || 0,
        price: item.unit_price || '',
        total: item.unit_price && item.quantity ? item.unit_price * item.quantity : '',
    }));



    const totalQty = items.reduce((sum, i) => sum + (i.quantity || 0), 0);
    const totalAmount = receipt.total_amount || items.reduce((sum, i) => sum + ((i.unit_price || 0) * (i.quantity || 0)), 0);

    return (
        <div className="order-print-page" style={S.page}>
            {/* ===== HEADER ===== */}
            <div style={S.header}>
                <div style={S.headerLeft}>
                    <div style={S.companyName}>CÔNG TY TNHH DỊCH VỤ Y TẾ CỘNG ĐỒNG CHS</div>
                    <div style={S.companyInfo}>Hải âu 02 - 57 Vinhomes Ocean Park,<br />Xã Đa Tốn, Huyện Gia Lâm, Thành phố Hà Nội, Việt Nam</div>
                    <div style={S.companyInfo}>Mã số thuế: 0110517351</div>
                    <div style={S.companyInfo}>Tel: 0981 878 423</div>
                </div>
                <div style={S.headerRight}>
                    <div style={S.formNumber}>Mẫu số: 01 - VT</div>
                    <div style={S.formLegal}>
                        (Ban hành theo Thông tư số 133/2016/TT-BTC<br />
                        ngày 26/08/2016 của Bộ Tài chính)
                    </div>
                </div>
            </div>

            {/* ===== TITLE ===== */}
            <div style={S.titleSection}>
                <div style={S.titleH1}>PHIẾU NHẬP KHO</div>
                <div style={S.dateLine}>
                    Ngày {day} tháng {month} năm {year}
                </div>
            </div>

            <div style={S.titleRow}>
                <div style={S.titleCenter}>
                    Số: <span style={{ fontWeight: 'bold' }}>{receipt.receipt_code}</span>
                </div>
                <div style={S.debitCredit}>
                    <div style={{ marginBottom: '2px' }}>Nợ: <span style={S.dots}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></div>
                    <div>Có: <span style={S.dots}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></div>
                </div>
            </div>

            {/* ===== INFO FIELDS ===== */}
            <div style={S.infoSection}>
                <div style={S.infoRow}>
                    <span style={S.infoLabel}>- Họ và tên người giao:</span>
                    <span style={S.infoValue}>{receipt.supplier_name || ''}</span>
                </div>
                <div style={S.infoRow}>
                    <span style={S.infoLabel}>- Theo</span>
                    <span style={{ ...S.infoFixedValue, width: '80px', flex: '0 0 80px' }}></span>
                    <span style={S.infoLabel}>&nbsp;số</span>
                    <span style={{ ...S.infoFixedValue, width: '80px', flex: '0 0 80px' }}>{receipt.receipt_code}</span>
                    <span style={S.infoLabel}>&nbsp;ngày</span>
                    <span style={{ ...S.infoFixedValue, width: '40px', flex: '0 0 40px' }}>{day}</span>
                    <span style={S.infoLabel}>&nbsp;tháng</span>
                    <span style={{ ...S.infoFixedValue, width: '40px', flex: '0 0 40px' }}>{month}</span>
                    <span style={S.infoLabel}>&nbsp;năm</span>
                    <span style={{ ...S.infoFixedValue, width: '50px', flex: '0 0 50px' }}>{year}</span>
                    <span style={S.infoLabel}>&nbsp;của</span>
                    <span style={S.infoValue}>{receipt.supplier_name || ''}</span>
                </div>
                <div style={S.infoRowSplit}>
                    <div style={S.splitHalf}>
                        <span style={S.infoLabel}>- Nhập tại kho:</span>
                        <span style={S.infoValue}>{warehouseLabel || ''}</span>
                    </div>
                    <div style={S.splitHalf}>
                        <span style={S.infoLabel}>Địa điểm:</span>
                        <span style={S.infoValue}>{warehouseLabel || ''}</span>
                    </div>
                </div>
            </div>

            {/* ===== MAIN TABLE ===== */}
            <table style={S.table}>
                <thead>
                    <tr>
                        <th style={{ ...S.th, width: '5%' }} rowSpan={2}>STT</th>
                        <th style={{ ...S.th, width: '28%' }} rowSpan={2}>
                            Tên, nhãn hiệu, quy cách,<br />phẩm chất vật tư, dụng cụ<br />sản phẩm, hàng hóa
                        </th>
                        <th style={{ ...S.th, width: '8%' }} rowSpan={2}>Mã số</th>
                        <th style={{ ...S.th, width: '7%' }} rowSpan={2}>Đơn vị<br />tính</th>
                        <th style={{ ...S.th }} colSpan={2}>Số lượng</th>
                        <th style={{ ...S.th, width: '14%' }} rowSpan={2}>Đơn giá</th>
                        <th style={{ ...S.th, width: '18%' }} rowSpan={2}>Thành tiền</th>
                    </tr>
                    <tr>
                        <th style={{ ...S.th, width: '10%' }}>Yêu cầu</th>
                        <th style={{ ...S.th, width: '10%' }}>Thực nhập</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, idx) => (
                        <tr key={idx}>
                            <td style={S.td}>{row.stt}</td>
                            <td style={S.tdLeft}>{row.name}</td>
                            <td style={S.td}>{row.code}</td>
                            <td style={S.td}>{row.unit}</td>
                            <td style={S.tdRight}>{row.qtyReq !== '' ? String(row.qtyReq).padStart(2, '0') : ''}</td>
                            <td style={S.tdRight}>{row.qtyAct !== '' ? String(row.qtyAct).padStart(2, '0') : ''}</td>
                            <td style={S.tdRight}>{row.price ? formatNumber(row.price) : ''}</td>
                            <td style={S.tdRight}>{row.total ? formatNumber(row.total) : ''}</td>
                        </tr>
                    ))}
                    {/* Total row */}
                    <tr>
                        <td style={S.tdBold}></td>
                        <td style={S.tdBold}>Cộng</td>
                        <td style={S.tdBold}></td>
                        <td style={S.tdBold}></td>
                        <td style={S.tdBoldRight}>{String(totalQty).padStart(2, '0')}</td>
                        <td style={S.tdBoldRight}>{String(totalQty).padStart(2, '0')}</td>
                        <td style={S.tdBold}></td>
                        <td style={S.tdBoldRight}>{totalAmount ? formatNumber(totalAmount) : ''}</td>
                    </tr>
                </tbody>
            </table>

            {/* ===== SUMMARY ===== */}
            <div style={S.summarySection}>
                <div style={S.infoRow}>
                    <span style={S.infoLabel}>- Tổng số tiền (Viết bằng chữ):</span>
                    <span style={S.infoValue}>{totalAmount ? numberToVietnameseWords(totalAmount) : ''}</span>
                </div>
                <div style={S.infoRow}>
                    <span style={S.infoLabel}>- Số chứng từ gốc kèm theo:</span>
                    <span style={S.infoValue}></span>
                </div>
            </div>

            {/* ===== DATE FOOTER ===== */}
            <div style={S.dateFooter}>
                Ngày {day} tháng {month} năm {year}
            </div>

            {/* ===== SIGNATURES (4 blocks) ===== */}
            <div style={S.signatureSection}>
                <div style={S.sigBlock}>
                    <div style={S.sigTitle}>Người lập biểu</div>
                    <div style={S.sigSubtitle}>(Ký, họ tên)</div>
                    <div style={S.sigSpace}></div>
                </div>
                <div style={S.sigBlock}>
                    <div style={S.sigTitle}>Người giao hàng</div>
                    <div style={S.sigSubtitle}>(Ký, họ tên)</div>
                    <div style={S.sigSpace}></div>
                </div>
                <div style={S.sigBlock}>
                    <div style={S.sigTitle}>Thủ kho</div>
                    <div style={S.sigSubtitle}>(Ký, họ tên)</div>
                    <div style={S.sigSpace}></div>
                </div>
                <div style={S.sigBlock}>
                    <div style={S.sigTitle}>Kế toán trưởng</div>
                    <div style={S.sigSubtitle}>(Ký, họ tên)</div>
                    <div style={S.sigSpace}></div>
                </div>
            </div>
        </div>
    );
};

const GoodsReceiptPrintTemplate = ({ receipt, items, warehousesList = [] }) => {
    if (!receipt) return null;
    const receiptList = Array.isArray(receipt) ? receipt : [receipt];
    const itemsList = Array.isArray(items) ? items : [];

    return (
        <div className="bulk-print-container">
            {receiptList.map((r, index) => (
                <React.Fragment key={r.id || index}>
                    <ReceiptItem receipt={r} items={itemsList} warehousesList={warehousesList} />
                    {index < receiptList.length - 1 && <div className="page-break" />}
                </React.Fragment>
            ))}
        </div>
    );
};

export default GoodsReceiptPrintTemplate;
