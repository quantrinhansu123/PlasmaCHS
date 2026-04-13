import { clsx } from 'clsx';
import { Printer, Save, Eye, EyeOff, Edit } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase/config';
import { toast } from 'react-toastify';
import usePermissions from '../../hooks/usePermissions';
import { notificationService } from '../../utils/notificationService';

const dmyToYmd = (dmy) => {
    if (!dmy || typeof dmy !== 'string') return "";
    const parts = dmy.split('/');
    if (parts.length !== 3) return "";
    const [d, m, y] = parts;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
};

const ymdToDmy = (ymd) => {
    if (!ymd || typeof ymd !== 'string') return "";
    const parts = ymd.split('-');
    if (parts.length !== 3) return ymd; // Might be already d/m/y if something went wrong
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
};

const MachineIssueRequestForm = ({ overrideOrderId, overrideViewOnly, onClosePopup }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { role, user } = usePermissions();
    
    // Authorization check for Machine Code
    const canEditMachineCode = role === 'Admin' || role === 'Thủ kho';

    const [formData, setFormData] = useState({
        orangeNumber: '',
        formNumber: '',
        requesterName: '',
        machineManager: '',
        customerId: '',
        customerName: '',
        phone: '',
        facilityName: '',
        placementAddress: '',
        status: '',
        // Checkboxes
        machineType: {
            TM: false,
            SD: false,
            FM: false,
            Khac: false
        },
        machineColor: {
            'Ghi xám': false,
            'Trắng(600-WH1, fullshade)': false,
            'Xanh dương(600-RBL70,WH1)': false,
            'Xanh Lá(600-TGR32, WH1)': false,
            'Hồng Nhạt(600-RRD84, WH1)': false,
            'Tím (600-VT20, RGB17)': false
        },
        quantity: '',
        machineCode: '',
        dateNeeded: '',
        dateDelivery: '',
        dateRecall: '',
        shippingMethod: {
            'KD tự vận chuyển': false,
            'Xe Công ty': false
        },
        issueType: {
            'Demo': false,
            'Thuê': false,
            'Bán': false,
            'Ngoại Giao': false
        },
        notes: ''
    });

    const [editOrderId, setEditOrderId] = useState(null);
    const [isReadOnly, setIsReadOnly] = useState(false);
    const currentActorName =
        user?.name ||
        localStorage.getItem('user_name') ||
        sessionStorage.getItem('user_name') ||
        'Nhân viên';

    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const orderId = overrideOrderId || queryParams.get('orderId');
        const viewOnly = overrideViewOnly ? 'true' : queryParams.get('viewOnly');
        const phone = queryParams.get('phone');
        
        if (viewOnly === 'true') {
            setIsReadOnly(true);
            setShowPreview(true);
        }
        
        if (orderId) {
            setEditOrderId(orderId);
            fetchExistingOrder(orderId);
        } else if (phone) {
            setFormData(prev => ({ ...prev, phone }));
        }
    }, [location.search]);

    useEffect(() => {
        if (!editOrderId && user?.name && !formData.requesterName) {
            setFormData(prev => ({ ...prev, requesterName: user.name }));
        }
    }, [user, editOrderId]);

    const fetchExistingOrder = async (id) => {
        try {
            const { data, error } = await supabase.from('orders').select('*').eq('id', id).single();
            if (error) throw error;
            if (data) {
                const noteStr = data.note || '';
                const lines = noteStr.split('\n').map(l => l.trim());
                
                const parseField = (prefix) => {
                    const match = lines.find(l => l.startsWith(prefix));
                    return match ? match.replace(prefix, '').replace(/\.\s*$/, '').trim() : '';
                };
                
                const types = parseField('Loại máy:').split(',').map(s => s.trim()).filter(Boolean);
                const issues = parseField('Hình thức:').split(',').map(s => s.trim()).filter(Boolean);
                const colors = parseField('Màu máy:').split(',').map(s => s.trim()).filter(Boolean);
                const pShipping = parseField('PT Vận chuyển:').split(',').map(s => s.trim()).filter(Boolean);
                
                let notesRemaining = '';
                const ghichuIndex = lines.findIndex(l => l.startsWith('Ghi chú:'));
                if (ghichuIndex !== -1) {
                    const firstLine = lines[ghichuIndex].replace('Ghi chú:', '').trim();
                    const rest = lines.slice(ghichuIndex + 1).map(l => l.replace(/\.\s*$/, '')).join('\n');
                    notesRemaining = `${firstLine}${rest ? '\n' + rest : ''}`;
                }
                
                setFormData({
                    orangeNumber: data.order_code?.replace('DNXM-', '') || '',
                    requesterName: data.ordered_by || '',
                    machineManager: parseField('Phụ trách máy:'),
                    customerId: data.customer_id || '',
                    customerName: data.customer_name || '',
                    phone: data.recipient_phone || '',
                    facilityName: data.recipient_name || '',
                    placementAddress: data.recipient_address || '',
                    status: data.status || '',
                    
                    machineType: {
                        TM: types.includes('TM'),
                        SD: types.includes('SD'),
                        FM: types.includes('FM'),
                        Khac: types.includes('Khac') || types.includes('Khác (NK, IoT)')
                    },
                    machineColor: {
                        'Ghi xám': colors.includes('Ghi xám'),
                        'Trắng(600-WH1, fullshade)': colors.includes('Trắng(600-WH1, fullshade)'),
                        'Xanh dương(600-RBL70,WH1)': colors.includes('Xanh dương(600-RBL70,WH1)'),
                        'Xanh Lá(600-TGR32, WH1)': colors.includes('Xanh Lá(600-TGR32, WH1)'),
                        'Hồng Nhạt(600-RRD84, WH1)': colors.includes('Hồng Nhạt(600-RRD84, WH1)'),
                        'Tím (600-VT20, RGB17)': colors.includes('Tím (600-VT20, RGB17)')
                    },
                    quantity: data.quantity?.toString() || '',
                    machineCode: parseField('Mã máy:'),
                    dateNeeded: dmyToYmd(parseField('Ngày cần:')),
                    dateDelivery: dmyToYmd(parseField('Giao:')),
                    dateRecall: dmyToYmd(parseField('Thu hồi dự kiến:')),
                    shippingMethod: {
                        'KD tự vận chuyển': pShipping.includes('KD tự vận chuyển'),
                        'Xe Công ty': pShipping.includes('Xe Công ty')
                    },
                    issueType: {
                        'Demo': issues.includes('Demo'),
                        'Thuê': issues.includes('Thuê'),
                        'Bán': issues.includes('Bán'),
                        'Ngoại Giao': issues.includes('Ngoại Giao')
                    },
                    notes: notesRemaining
                });
            }
        } catch (err) {
            console.error('Error fetching DNXM:', err);
            toast.error('Lỗi khi tải phiếu đề xuất: ' + err.message);
        }
    };

    const [isSearching, setIsSearching] = useState(false);
    const [staffList, setStaffList] = useState([]);

    useEffect(() => {
        const fetchStaff = async () => {
            try {
                const { data } = await supabase.from('app_users').select('id, name, role').order('name');
                if (data) setStaffList(data);
            } catch (err) {
                console.error('Error fetching staff:', err);
            }
        };
        fetchStaff();
    }, []);

    // Auto-fill logic when phone changes
    useEffect(() => {
        const fetchCustomerData = async () => {
            if (!formData.phone || formData.phone.length < 8) return;

            setIsSearching(true);
            try {
                const { data, error } = await supabase
                    .from('customers')
                    .select('*')
                    .eq('phone', formData.phone)
                    .limit(1);

                if (data && data.length > 0 && !error) {
                    const customer = data[0];
                    setFormData(prev => ({
                        ...prev,
                        customerId: customer.id || prev.customerId,
                        customerName: customer.name || '',
                        facilityName: customer.agency_name || customer.invoice_company_name || customer.name || '',
                        placementAddress: customer.address || '',
                        machineManager: customer.managed_by || prev.machineManager
                    }));
                }
            } catch (error) {
                // Ignore error if customer not found, just let user type manually
                console.log("Customer not found for auto-fill");
            } finally {
                setIsSearching(false);
            }
        };

        const timeoutId = setTimeout(fetchCustomerData, 600);
        return () => clearTimeout(timeoutId);
    }, [formData.phone]);

    const handleInputChange = (field, value) => {
        setFormData(prev => {
            const newData = { ...prev, [field]: value };
            
            // Auto-calculate quantity based on machineCode split by comma
            if (field === 'machineCode') {
                const codes = value.split(',').map(c => c.trim()).filter(c => c !== '');
                newData.quantity = codes.length > 0 ? codes.length.toString() : '';
            }
            
            return newData;
        });
    };

    const handleCheckboxChange = (group, key) => {
        setFormData(prev => ({
            ...prev,
            [group]: {
                ...prev[group],
                [key]: !prev[group][key]
            }
        }));
    };

    const currentYear = new Date().getFullYear();
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
    const currentDay = String(new Date().getDate()).padStart(2, '0');

    const [showPreview, setShowPreview] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const handlePrint = () => {
        window.print();
    };

    const handleSave = async () => {
        if (!formData.customerName) {
            toast.error('Vui lòng điền tên khách hàng');
            return;
        }

        setIsSaving(true);
        try {
            // Determine machine types
            const selectedMachineTypes = Object.entries(formData.machineType)
                .filter(([_, checked]) => checked)
                .map(([type]) => type);
            
            // For DB product_type constraint, use a single value
            const dbProductType = selectedMachineTypes.length === 1 
                ? selectedMachineTypes[0] 
                : 'MAY';

            const selectedColors = Object.entries(formData.machineColor)
                .filter(([_, checked]) => checked)
                .map(([color]) => color)
                .join(', ');

            const issueTypesList = Object.entries(formData.issueType)
                .filter(([_, checked]) => checked)
                .map(([type]) => type)
                .join(', ');

            const shippingList = Object.entries(formData.shippingMethod)
                .filter(([_, checked]) => checked)
                .map(([m]) => m)
                .join(', ');

            // Map ĐNXM fields to orders table
            const orderData = {
                order_code: formData.orangeNumber || `DNXM-${Date.now().toString().slice(-6)}`,
                customer_id: formData.customerId || null,
                customer_name: formData.customerName,
                recipient_name: formData.facilityName || formData.customerName, // Required NOT NULL
                recipient_address: formData.placementAddress || 'N/A', // Required NOT NULL
                recipient_phone: formData.phone || 'N/A', // Required NOT NULL
                product_type: dbProductType,
                quantity: parseInt(formData.quantity) || 1,
                unit_price: 0, // Required NOT NULL
                total_amount: 0, // Required NOT NULL
                order_type: 'DNXM',
                note: `Loại máy: ${selectedMachineTypes.join(', ')}. 
Hình thức: ${issueTypesList || 'Chưa chọn'}.
Màu máy: ${selectedColors}. 
Ngày cần: ${ymdToDmy(formData.dateNeeded)}. 
Giao: ${ymdToDmy(formData.dateDelivery)}. 
Thu hồi dự kiến: ${ymdToDmy(formData.dateRecall)}. 
Phụ trách máy: ${formData.machineManager}. 
PT Vận chuyển: ${shippingList}. 
Mã máy: ${formData.machineCode}. 
Ghi chú: ${formData.notes}`,
                ordered_by: formData.requesterName || currentActorName,
                customer_category: 'TM' 
            };

            if (editOrderId) {
                const { error } = await supabase
                    .from('orders')
                    .update({ ...orderData, updated_at: new Date().toISOString() })
                    .eq('id', editOrderId);
                if (error) throw error;
                
                notificationService.add({
                    title: `📝 Cập nhật ĐNXM: ${orderData.customer_name}`,
                    description: `${currentActorName} vừa cập nhật thông tin phiếu ĐNXM${formData.orangeNumber ? ' ' + formData.orangeNumber : ''} - KH: ${orderData.customer_name}`,
                    type: 'info',
                    link: `/de-nghi-xuat-may/tao?orderId=${editOrderId}&viewOnly=true`
                });

                // Nếu phiếu đã duyệt xong, cập nhật lại gán máy trong kho nếu có thay đổi mã máy
                if (formData.status === 'DA_DUYET') {
                    await assignMachinesToCustomer(formData.machineCode, formData.customerName);
                }
                toast.success('Đã cập nhật Phiếu Đề Nghị Xuất Máy thành công!');
                setTimeout(() => navigate('/de-nghi-xuat-may'), 1000);
            } else {
                orderData.status = 'CHO_DUYET';
                orderData.created_at = new Date().toISOString();
                const { data: insertedData, error } = await supabase
                    .from('orders')
                    .insert([orderData])
                    .select('id')
                    .single();
                if (error) throw error;
                
                const newOrderId = insertedData?.id;
                notificationService.add({
                    title: `💡 ĐNXM mới: ${orderData.customer_name}`,
                    description: `${currentActorName} vừa lập phiếu đề nghị xuất máy mới.`,
                    type: 'info',
                    link: newOrderId ? `/de-nghi-xuat-may/tao?orderId=${newOrderId}&viewOnly=true` : '/de-nghi-xuat-may'
                });
                toast.success('Đã được lưu vào hệ thống!');
                setTimeout(() => navigate('/de-nghi-xuat-may'), 1000);
            }
        } catch (error) {
            console.error('Error saving DNXM:', error);
            toast.error('Lỗi khi lưu phiếu: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    // Auto-assign machines to customer when warehouse approves
    const assignMachinesToCustomer = async (machineCodes, customerName) => {
        if (!machineCodes) return;
        const codes = machineCodes.split(',').map(c => c.trim()).filter(Boolean);
        if (codes.length === 0) return;

        for (const code of codes) {
            const { error } = await supabase
                .from('machines')
                .update({
                    status: 'thuộc khách hàng',
                    customer_name: customerName,
                    warehouse: null
                })
                .eq('serial_number', code);
            if (error) console.error(`Lỗi gán máy ${code}:`, error);
        }
    };

    const handleApproveStatus = async () => {
        if (!formData.status) return;
        let nextStatus = '';
        let confirmMsg = '';
        let successMsg = '';
        let notifTitle = '';
        let notifDesc = '';

        switch (formData.status) {
            case 'CHO_DUYET':
                nextStatus = 'CHO_CTY_DUYET';
                confirmMsg = 'Leader Duyệt (1/3): Chuyển phiếu cho Công ty duyệt?';
                successMsg = 'Leader đã duyệt → Chờ Công ty duyệt';
                notifTitle = '✅ Leader đã duyệt ĐNXM';
                notifDesc = `Phiếu ĐNXM${formData.orangeNumber || ''} - KH: ${formData.customerName} → Chờ Công ty duyệt`;
                break;
            case 'CHO_CTY_DUYET':
                nextStatus = 'KHO_XU_LY';
                confirmMsg = 'Công ty Duyệt (2/3): Chuyển phiếu cho Kho xử lý?';
                successMsg = 'Công ty đã duyệt → Chờ Kho duyệt';
                notifTitle = '✅ Công ty đã duyệt ĐNXM';
                notifDesc = `Phiếu ĐNXM${formData.orangeNumber || ''} - KH: ${formData.customerName} → Chờ Kho xử lý`;
                break;
            case 'KHO_XU_LY':
                nextStatus = 'DA_DUYET';
                confirmMsg = 'Kho Duyệt (3/3): Xác nhận xuất máy cho khách hàng?';
                successMsg = 'Kho đã duyệt xuất máy thành công!';
                notifTitle = '🏭 Kho đã duyệt xuất máy';
                notifDesc = `Phiếu ĐNXM${formData.orangeNumber || ''} hoàn tất. Máy đã giao cho ${formData.customerName}`;
                break;
            default:
                toast.info('Phiếu đã xử lý, không thể duyệt tiếp.');
                return;
        }

        if (!window.confirm(confirmMsg)) return;

        setIsSaving(true);
        try {
            const { error } = await supabase.from('orders').update({
                status: nextStatus,
                updated_at: new Date().toISOString()
            }).eq('id', editOrderId);

            if (error) throw error;

            // Khi Kho duyệt → tự động gán máy cho khách hàng
            if (nextStatus === 'DA_DUYET') {
                await assignMachinesToCustomer(formData.machineCode, formData.customerName);
            }
            
            setFormData(prev => ({ ...prev, status: nextStatus }));
            toast.success(successMsg);
            
            notificationService.add({
                title: notifTitle,
                description: `${notifDesc} • Thực hiện bởi: ${currentActorName}`,
                type: 'success',
                link: `/de-nghi-xuat-may/tao?orderId=${editOrderId}&viewOnly=true`
            });
        } catch (error) {
            toast.error('Lỗi khi duyệt: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleRejectStatus = async () => {
        if (!window.confirm('Bạn có thực sự muốn TỪ CHỐI phiếu đề nghị xuất máy này?')) return;
        
        setIsSaving(true);
        try {
            const { error } = await supabase.from('orders').update({
                status: 'TU_CHOI',
                updated_at: new Date().toISOString()
            }).eq('id', editOrderId);

            if (error) throw error;
            
            setFormData(prev => ({ ...prev, status: 'TU_CHOI' }));
            toast.error('Đã từ chối phiếu đề xuất.');

            notificationService.add({
                title: `❌ ĐNXM bị từ chối`,
                description: `Phiếu ĐNXM${formData.orangeNumber || ''} - KH: ${formData.customerName} đã bị từ chối • Thực hiện bởi: ${currentActorName}.`,
                type: 'warning',
                link: `/de-nghi-xuat-may/tao?orderId=${editOrderId}&viewOnly=true`
            });
        } catch (error) {
            toast.error('Lỗi khi từ chối: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <>
            {/* DATA ENTRY FORM (MÀN HÌNH CHUẨN) */}
            <div className={clsx("max-w-4xl mx-auto mb-10 print:hidden space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500", isReadOnly ? "hidden" : "block")}>
                <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm p-4 md:p-6 pb-24">
                    <h2 className="text-xl font-bold text-foreground mb-6 pb-4 border-b border-border">Nhập thông tin Đề Nghị Xuất Máy</h2>

                    <div className="space-y-6">
                        {/* Orange/Form Number */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">Số Order (Ô cam)</label>
                                <input
                                    type="text"
                                    value={formData.orangeNumber}
                                    readOnly={isReadOnly}
                                    onChange={(e) => handleInputChange('orangeNumber', e.target.value)}
                                    className={clsx("w-full px-4 py-2 border rounded-lg focus:outline-none transition-all", isReadOnly ? "bg-muted/50 border-border/50 text-muted-foreground cursor-not-allowed italic font-normal" : "bg-background border-border focus:ring-2 focus:ring-primary/20")}
                                    placeholder="Điền số thứ tự"
                                />
                            </div>
                        </div>

                        {/* Người phụ trách */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">Người đề nghị</label>
                                <select
                                    value={formData.requesterName}
                                    onChange={(e) => handleInputChange('requesterName', e.target.value)}
                                    className="w-full h-10 px-4 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer font-semibold"
                                >
                                    <option value="">-- Chọn Người đề nghị --</option>
                                    {staffList.map(u => (
                                        <option key={u.id} value={u.name}>
                                            {u.name}{u.role ? ` (${u.role})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">Nhân viên phụ trách máy</label>
                                <select
                                    value={formData.machineManager}
                                    onChange={(e) => handleInputChange('machineManager', e.target.value)}
                                    className="w-full h-10 px-4 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                                >
                                    <option value="">-- Chọn Nhân viên --</option>
                                    {staffList.map(u => (
                                        <option key={`m-${u.id}`} value={u.name}>
                                            {u.name}{u.role ? ` (${u.role})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Thông tin Khách hàng */}
                        <div className="bg-muted/30 p-4 rounded-lg border border-border/50 space-y-4">
                            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                Thông tin khách hàng
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-foreground mb-1.5">Số điện thoại (Nhập để tự điền)</label>
                                    <div className="relative">
                                        <input
                                            type="tel"
                                            value={formData.phone}
                                            onChange={(e) => handleInputChange('phone', e.target.value)}
                                            className={clsx(
                                                "w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20",
                                                isSearching ? "pr-10" : ""
                                            )}
                                        />
                                        {isSearching && <span className="absolute right-3 top-2.5 w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin"></span>}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1.5">Tên khách hàng / Tên cơ sở</label>
                                    <input
                                        type="text"
                                        value={formData.customerName}
                                        onChange={(e) => handleInputChange('customerName', e.target.value)}
                                        className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1.5">Tên cơ sở</label>
                                    <input
                                        type="text"
                                        value={formData.facilityName}
                                        onChange={(e) => handleInputChange('facilityName', e.target.value)}
                                        className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-foreground mb-1.5">Địa chỉ đặt máy</label>
                                    <input
                                        type="text"
                                        value={formData.placementAddress}
                                        onChange={(e) => handleInputChange('placementAddress', e.target.value)}
                                        className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Phân loại và Yêu cầu */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Checkbox Groups */}
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-3">Loại máy đề xuất</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {Object.keys(formData.machineType).map(type => (
                                            <label key={type} className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-muted transition-colors border border-transparent hover:border-border">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.machineType[type]}
                                                    onChange={() => handleCheckboxChange('machineType', type)}
                                                    className="w-4 h-4 rounded text-primary focus:ring-primary/20"
                                                />
                                                <span className="text-sm">{type === 'Khac' ? 'Khác (NK, IoT)' : type}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-3">Dạng xuất</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {Object.keys(formData.issueType).map(type => (
                                            <label key={type} className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-muted transition-colors border border-transparent hover:border-border">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.issueType[type]}
                                                    onChange={() => handleCheckboxChange('issueType', type)}
                                                    className="w-4 h-4 rounded text-primary focus:ring-primary/20"
                                                />
                                                <span className="text-sm">{type}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-3">Phương thức vận chuyển</label>
                                    <div className="flex flex-col gap-3">
                                        {Object.keys(formData.shippingMethod).map(method => (
                                            <label key={method} className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-muted transition-colors border border-transparent hover:border-border">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.shippingMethod[method]}
                                                    onChange={() => handleCheckboxChange('shippingMethod', method)}
                                                    className="w-4 h-4 rounded text-primary focus:ring-primary/20"
                                                />
                                                <span className="text-sm">{method}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-3">Màu máy yêu cầu dành cho TM</label>
                                    <div className="grid grid-cols-1 gap-2">
                                        {Object.keys(formData.machineColor).map(color => (
                                            <label key={color} className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-muted transition-colors border border-transparent hover:border-border">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.machineColor[color]}
                                                    onChange={() => handleCheckboxChange('machineColor', color)}
                                                    className="w-4 h-4 rounded text-primary focus:ring-primary/20"
                                                />
                                                <span className="text-sm">{color}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-1.5">Số lượng</label>
                                        <input
                                            type="text"
                                            value={formData.quantity}
                                            onChange={(e) => handleInputChange('quantity', e.target.value)}
                                            className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        />
                                    </div>
                                    <div>
                                        <label className={clsx(
                                            "block text-sm font-medium mb-1.5",
                                            canEditMachineCode ? "text-foreground" : "text-muted-foreground"
                                        )}>
                                            Mã máy {!canEditMachineCode && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded ml-1 text-muted-foreground font-normal">(Chỉ Admin/Kho)</span>}
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.machineCode}
                                            readOnly={!canEditMachineCode}
                                            onChange={(e) => handleInputChange('machineCode', e.target.value)}
                                            placeholder={canEditMachineCode ? "Nhập mã máy..." : "Chưa được gán mã"}
                                            className={clsx(
                                                "w-full px-4 py-2 border rounded-lg focus:outline-none transition-all",
                                                canEditMachineCode 
                                                    ? "bg-background border-border focus:ring-2 focus:ring-primary/20" 
                                                    : "bg-muted/50 border-border/50 text-muted-foreground cursor-not-allowed italic font-normal"
                                            )}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Ngày tháng */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">Ngày cần máy</label>
                                <input
                                    type="date"
                                    value={formData.dateNeeded}
                                    onChange={(e) => handleInputChange('dateNeeded', e.target.value)}
                                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">Ngày giao</label>
                                <input
                                    type="date"
                                    value={formData.dateDelivery}
                                    onChange={(e) => handleInputChange('dateDelivery', e.target.value)}
                                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                            {!formData.issueType['Bán'] && (
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1.5">Thu hồi dự kiến</label>
                                    <input
                                        type="date"
                                        value={formData.dateRecall}
                                        onChange={(e) => handleInputChange('dateRecall', e.target.value)}
                                        className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Ghi chú */}
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">Ghi chú khác (nếu có)</label>
                            <textarea
                                value={formData.notes}
                                onChange={(e) => handleInputChange('notes', e.target.value)}
                                rows="3"
                                className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                            />
                        </div>
                    </div>
                </div>

                {/* Print Action / Inline button */}
                {/* ACTION BUTTONS */}
                {!isReadOnly && (
                    <div className="no-print mt-8 px-4 flex flex-wrap justify-center gap-4 w-full z-10 md:justify-end md:px-0">
                        <button
                            onClick={() => setShowPreview(!showPreview)}
                            className="flex items-center justify-center gap-2 bg-slate-600 text-white px-6 py-3 rounded-xl shadow-lg hover:bg-slate-700 transition-all font-bold text-sm"
                        >
                            {showPreview ? <EyeOff size={18} /> : <Eye size={18} />}
                            {showPreview ? 'QUAY LẠI NHẬP LIỆU' : 'XEM TRƯỚC VĂN BẢN'}
                        </button>

                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl shadow-lg hover:bg-blue-700 transition-all font-bold text-sm disabled:opacity-50"
                        >
                            {isSaving ? <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" /> : <Save size={18} />}
                            {editOrderId ? 'CẬP NHẬT PHIẾU' : 'LƯU HỆ THỐNG'}
                        </button>
                    </div>
                )}
            </div>

            {isReadOnly && (
                <div className="no-print max-w-[210mm] mx-auto flex flex-wrap justify-end gap-4 print:hidden mb-6">
                    {(() => {
                        const isLevel1 = formData.status === 'CHO_DUYET';
                        const isLevel2 = formData.status === 'CHO_CTY_DUYET';
                        const isLevel3 = formData.status === 'KHO_XU_LY';

                        const r = role?.toLowerCase() || '';
                        let canApprove = false;
                        if (r === 'admin' || r === 'giám đốc') canApprove = true;
                        else if (isLevel1 && (r.includes('lead') || r.includes('trưởng'))) canApprove = true;
                        else if (isLevel2 && (r === 'admin' || r === 'giám đốc')) canApprove = true;
                        else if (isLevel3 && (r.includes('kho'))) canApprove = true;

                        const canEdit = ['CHO_DUYET', 'CHO_CTY_DUYET', 'KHO_XU_LY', 'DA_DUYET'].includes(formData.status);

                        return (
                            <div className="flex flex-wrap gap-2">
                                {/* Nút Chỉnh sửa - hiện ở mọi bước chưa hoàn tất */}
                                {canEdit && (
                                    <button
                                        onClick={() => {
                                            setIsReadOnly(false);
                                            setShowPreview(false);
                                        }}
                                        className="flex items-center justify-center gap-2 bg-amber-500 text-white px-6 py-3 rounded-xl shadow-lg hover:bg-amber-600 transition-all font-bold text-sm"
                                    >
                                        <Edit size={18} />
                                        CHỈNH SỬA
                                    </button>
                                )}

                                {/* Nút Duyệt - chỉ hiện nếu user có quyền */}
                                {canApprove && ['CHO_DUYET', 'CHO_CTY_DUYET', 'KHO_XU_LY'].includes(formData.status) && (
                                    <button
                                        onClick={handleApproveStatus}
                                        disabled={isSaving}
                                        className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-lg hover:bg-emerald-700 transition-all font-bold text-sm disabled:opacity-50"
                                    >
                                        {isSaving ? <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" /> : <Save size={18} />}
                                        DUYỆT PHIẾU ({
                                            formData.status === 'CHO_DUYET' ? '1/3 - Leader' :
                                            formData.status === 'CHO_CTY_DUYET' ? '2/3 - Công ty' : '3/3 - Kho'
                                        })
                                    </button>
                                )}

                                {/* Nút Từ chối */}
                                {canApprove && ['CHO_DUYET', 'CHO_CTY_DUYET', 'KHO_XU_LY'].includes(formData.status) && (
                                    <button
                                        onClick={handleRejectStatus}
                                        disabled={isSaving}
                                        className="flex items-center justify-center gap-2 bg-rose-600 text-white px-6 py-3 rounded-xl shadow-lg hover:bg-rose-700 transition-all font-bold text-sm disabled:opacity-50"
                                    >
                                        {isSaving ? <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" /> : <EyeOff size={18} />}
                                        TỪ CHỐI
                                    </button>
                                )}
                            </div>
                        );
                    })()}
                    <button
                        onClick={handlePrint}
                        className="flex items-center justify-center gap-2 bg-slate-700 text-white px-8 py-3 rounded-xl shadow-lg shadow-slate-600/30 hover:bg-slate-800 transition-all font-bold text-sm transform active:scale-[0.98]"
                    >
                        <Printer size={20} />
                        IN PHIẾU PDF
                    </button>

                    {onClosePopup ? (
                        <button
                            onClick={onClosePopup}
                            className="flex items-center justify-center gap-2 bg-slate-200 text-slate-700 px-8 py-3 rounded-xl shadow-lg hover:bg-slate-300 transition-all font-bold text-sm"
                        >
                            ĐÓNG PHIẾU
                        </button>
                    ) : (
                        <button
                            onClick={() => navigate('/machines')}
                            className="flex items-center justify-center gap-2 bg-slate-200 text-slate-700 px-8 py-3 rounded-xl shadow-lg hover:bg-slate-300 transition-all font-bold text-sm"
                        >
                            THOÁT
                        </button>
                    )}
                </div>
            )}

            {/* PRINT VIEW (HIỆN KHI ẤN IN HOẶC KHI BẬT PREVIEW) */}
            <div id="print-area" className={clsx(
                "print:block text-black p-8 bg-white max-w-[210mm] mx-auto min-h-[297mm] shadow-2xl my-10",
                showPreview ? "block scale-90 origin-top" : "hidden"
            )} style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                {/* Header section */}
                <div className="flex justify-between items-start mb-6">
                    <div className="text-sm text-center">
                        <h2 className="font-bold text-blue-800 uppercase print:text-black">CÔNG TY TNHH DỊCH VỤ Y TẾ CỘNG ĐỒNG CHS</h2>
                        <p>ADD: Hải Âu 02-57 Vinhomes Ocean Park,</p>
                        <p>Xã Đa Tốn, Huyện Gia Lâm, Hà Nội</p>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center">
                            <span className="text-sm">Mẫu số: 02/XM-CHS</span>
                            <span className="italic text-sm">Đề nghị xuất máy</span>
                        </div>
                        <input
                            type="text"
                            value={formData.orangeNumber}
                            readOnly
                            className="bg-orange-400 font-bold px-2 py-1 border border-black w-20 text-center focus:outline-none focus:bg-orange-300 print:bg-transparent print:border-black"
                        />
                    </div>
                </div>

                {/* Title */}
                <div className="text-center mb-6">
                    <h1 className="text-xl font-bold uppercase mb-2">GIẤY ĐỀ NGHỊ XUẤT MÁY</h1>
                    <div className="text-center">
                        <span>Số: ĐNXM{formData.orangeNumber || ''}</span>
                    </div>
                </div>

                {/* Form Fields */}
                <div className="space-y-4 text-[15px] leading-relaxed">
                    <div className="flex items-center">
                        <span className="min-w-[200px]">1. Họ và tên người đề nghị:</span>
                        <input
                            type="text"
                            value={formData.requesterName}
                            readOnly
                            className="flex-1 focus:outline-none px-2 bg-transparent print:border-none text-red-700 print:text-black"
                            placeholder=""
                        />
                    </div>

                    <div className="flex items-center">
                        <span className="min-w-[200px]">2. Nhân viên phụ trách máy:</span>
                        <input
                            type="text"
                            value={formData.machineManager}
                            readOnly
                            className="flex-1 focus:outline-none px-2 bg-transparent print:border-none text-red-700 print:text-black"
                            placeholder=""
                        />
                    </div>

                    <div className="flex items-start md:items-center print:items-center flex-col md:flex-row print:flex-row gap-6 md:gap-0">
                        <div className="flex items-center flex-1 w-full">
                            <span className="min-w-[200px]">3. Tên khách hàng / Tên cơ sở:</span>
                            <input
                                type="text"
                                value={formData.customerName}
                                readOnly
                                className="flex-1 focus:outline-none px-2 bg-transparent print:border-none text-red-700 print:text-black"
                                placeholder=""
                            />
                        </div>
                        <div className="flex items-center w-full md:w-auto print:w-auto md:ml-4 print:ml-4">
                            <span className="whitespace-nowrap mr-2">Điện Thoại:</span>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={formData.phone}
                                    readOnly
                                    className="focus:outline-none px-2 py-1 w-40 bg-transparent print:border-none print:p-0 print:-ml-2"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center">
                        <span className="min-w-[200px]">4. Tên Cơ Sở:</span>
                        <input
                            type="text"
                            value={formData.facilityName}
                            readOnly
                            className="flex-1 focus:outline-none px-2 bg-transparent print:border-none text-red-700 print:text-black"
                            placeholder=""
                        />
                    </div>

                    <div className="flex items-center">
                        <span className="min-w-[200px]">5. Địa chỉ đặt máy:</span>
                        <input
                            type="text"
                            value={formData.placementAddress}
                            readOnly
                            className="flex-1 focus:outline-none px-2 bg-transparent print:border-none text-red-700 print:text-black"
                            placeholder=""
                        />
                    </div>

                    {/* Machine Type */}
                    <div className="flex flex-col md:flex-row print:flex-row md:items-center print:items-center mt-6">
                        <span className="min-w-[200px] mb-4 md:mb-0 print:mb-0">6. Loại máy đề xuất:</span>
                        <div className="flex flex-wrap gap-6 flex-1 items-center">
                            {Object.keys(formData.machineType).map(type => (
                                <label key={type} className="flex items-center gap-6 cursor-default">
                                    <div className={`w-4 h-4 border border-gray-500 flex items-center justify-center bg-white ${formData.machineType[type] ? 'bg-gray-100' : ''}`}>
                                        {formData.machineType[type] && <span className="text-gray-800 text-xs font-bold font-sans">v</span>}
                                    </div>
                                    <span className="font-medium">{type === 'Khac' ? 'Khác (NK, IoT)' : type}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Machine Color */}
                    <div className="mt-6 mb-2">
                        <span className="block mb-2 font-bold">7. Màu máy yêu cầu dành cho TM</span>
                        <div className="grid grid-cols-1 md:grid-cols-3 print:grid-cols-3 gap-y-1 gap-x-4 pl-8 md:pl-24 print:pl-24">
                            {Object.keys(formData.machineColor).map(color => (
                                <label key={color} className="flex items-center gap-6 cursor-default">
                                    <div className={`w-4 h-4 border border-gray-500 flex items-center justify-center shrink-0 bg-white ${formData.machineColor[color] ? 'bg-gray-100' : ''}`}>
                                        {formData.machineColor[color] && <span className="text-gray-800 text-xs font-bold font-sans">v</span>}
                                    </div>
                                    <span>{color}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Quantity and Code */}
                    <div className="flex flex-col md:flex-row print:flex-row md:items-center print:items-center gap-6 mt-4">
                        <div className="flex items-center">
                            <span className="mr-2">8. Số lượng máy:</span>
                            <input
                                type="text"
                                value={formData.quantity}
                                readOnly
                                className="focus:outline-none w-16 px-1 bg-transparent print:border-none print:p-0"
                            />
                        </div>
                        <div className="flex items-center flex-1">
                            <span className="mr-2">Mã máy:</span>
                            <input
                                type="text"
                                value={formData.machineCode}
                                readOnly
                                className="flex-1 focus:outline-none px-2 bg-transparent print:border-none print:p-0"
                            />
                        </div>
                    </div>

                    {/* Dates */}
                    <div className="flex items-center mt-4">
                        <span className="min-w-[200px]">9. Ngày CHS cần máy:</span>
                        <input
                            type="text"
                            value={ymdToDmy(formData.dateNeeded)}
                            readOnly
                            className="focus:outline-none w-32 px-2 bg-transparent print:border-none print:p-0"
                            placeholder="dd/MM/yyyy"
                        />
                    </div>

                    <div className="flex flex-col md:flex-row print:flex-row md:items-center print:items-center gap-6 mt-4">
                        <div className="flex items-center">
                            <span className="min-w-[200px]">10. Ngày giao cho Khách hàng:</span>
                            <input
                                type="text"
                                value={ymdToDmy(formData.dateDelivery)}
                                readOnly
                                className="focus:outline-none w-32 px-2 bg-transparent print:border-none print:p-0"
                                placeholder="dd/MM/yyyy"
                            />
                        </div>
                        {!formData.issueType['Bán'] && (
                            <div className="flex items-center">
                                <span className="mr-2">11. Thời gian thu hồi:</span>
                                <input
                                    type="text"
                                    value={ymdToDmy(formData.dateRecall)}
                                    readOnly
                                    className="focus:outline-none w-32 px-2 bg-transparent print:border-none print:p-0"
                                    placeholder="dd/MM/yyyy"
                                />
                            </div>
                        )}
                    </div>

                    {/* Shipping Method */}
                    <div className="flex flex-col md:flex-row print:flex-row md:items-center print:items-center mt-4">
                        <span className="min-w-[200px] mb-4 md:mb-0 print:mb-0">12. Phương thức vận chuyển:</span>
                        <div className="flex gap-10">
                            {Object.keys(formData.shippingMethod).map(method => (
                                <label key={method} className="flex items-center gap-6 cursor-default">
                                    <div className={`w-4 h-4 border border-gray-500 flex items-center justify-center bg-white ${formData.shippingMethod[method] ? 'bg-gray-100' : ''}`}>
                                        {formData.shippingMethod[method] && <span className="text-gray-800 text-xs font-bold font-sans">v</span>}
                                    </div>
                                    <span>{method}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Issue Type */}
                    <div className="flex flex-col md:flex-row print:flex-row md:items-center print:items-center mt-4">
                        <span className="min-w-[200px] mb-4 md:mb-0 print:mb-0">13. Dạng xuất:</span>
                        <div className="flex flex-wrap gap-10">
                            {Object.keys(formData.issueType).map(type => (
                                <label key={type} className="flex items-center gap-6 cursor-default">
                                    <div className={`w-4 h-4 border border-gray-500 flex items-center justify-center bg-white ${formData.issueType[type] ? 'bg-gray-100' : ''}`}>
                                        {formData.issueType[type] && <span className="text-gray-800 text-xs font-bold font-sans">v</span>}
                                    </div>
                                    <span>{type}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="mt-6 flex flex-col">
                        <span className="mb-2">14. Ghi chú khác (nếu có):</span>
                        <textarea
                            value={formData.notes}
                            readOnly
                            className="w-full border-b border-gray-400 focus:outline-none min-h-[60px] resize-none bg-transparent print:border-none print:min-h-0"
                            placeholder=""
                        />
                    </div>
                </div>

                {/* Separator */}

                {/* Signatures */}
                <div className="flex justify-between mt-4">
                    <div className="text-center w-[25%]">
                        <p className="mb-16">Người đề nghị</p>
                        <p className="italic text-red-700 print:text-black">{formData.requesterName || ''}</p>
                    </div>
                    <div className="text-center w-[25%]">
                        <p className="mb-16">Thủ kho</p>
                    </div>
                    <div className="text-center w-[50%]">
                        <p className="italic mb-1 whitespace-nowrap">Hà Nội, ngày {currentDay} tháng {currentMonth} năm {currentYear}</p>
                        <p className="mb-16">Giám đốc</p>
                        <p className="italic">Bùi Xuân Đức</p>
                    </div>
                </div>

                {/* Footer Notes */}
                <div className="mt-10 text-[13px] italic leading-tight border-t border-transparent print:border-transparent pt-4">
                    <p>Note :</p>
                    <p>Thời gian bàn giao máy đối với màu mặc định theo nhà sản xuất (Hồng nhạt, Ghi xám, Xanh Dương) là 10 ngày làm việc sau khi nhận được giấy ĐNXM</p>
                    <p>Thời gian bàn giao máy đối với màu cá nhân hóa theo thương hiệu là 15 ngày làm việc sau khi nhận được giấy ĐNXM</p>
                    <p>Đối với các trường hợp máy Demo/Thuê/Ngoại giao cần điền thông tin ngày thu hồi máy</p>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    #root { display: block !important; }
                    /* Reset parent layout containers that break print */
                    body, #root, .min-h-screen, .h-screen, .overflow-hidden, .overflow-y-auto, .noise-bg, main {
                        height: auto !important;
                        min-height: 0 !important;
                        overflow: visible !important;
                        position: static !important;
                        display: block !important;
                        font-family: Arial, Helvetica, sans-serif !important;
                    }
                    header, nav, aside, footer, .no-print { display: none !important; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #fff !important; margin: 0; }
                    @page { margin: 0; size: A4 portrait; }
                    
                    #print-area {
                        width: 100% !important;
                        max-width: none !important;
                        margin: 0 !important;
                        padding: 10mm 15mm !important;
                        background: white !important;
                        box-shadow: none !important;
                        display: block !important;
                    }
                    /* Hide mobile bottom bars just in case */
                    .fixed.bottom-0, [class*="bottom-navigation"] { display: none !important; }
                    input, textarea, span, p, div { color: black !important; }
                    
                    /* Tighter vertical spacing specifically for printing */
                    #print-area .space-y-4 > :not([hidden]) ~ :not([hidden]) { margin-top: 6px !important; }
                    #print-area .mt-4 { margin-top: 6px !important; }
                    #print-area .mt-6 { margin-top: 8px !important; }
                    #print-area .mb-2 { margin-bottom: 2px !important; }
                    #print-area .mb-4 { margin-bottom: 4px !important; }
                    #print-area .mb-6 { margin-bottom: 12px !important; }
                    #print-area .pt-4 { padding-top: 8px !important; }
                    #print-area .pb-4 { padding-bottom: 8px !important; }
                    #print-area .gap-6, #print-area .gap-8, #print-area .gap-10 { gap: 10px !important; }
                    
                    /* Shrink big margins for signatures and footers to fit on 1 page */
                    #print-area .mb-16 { margin-bottom: 30px !important; }
                    #print-area .mt-10 { margin-top: 15px !important; }
                    #print-area .text-\\[15px\\] { font-size: 14px !important; }
                    #print-area .mt-4 { margin-top: 8px !important; }
                    
                    /* Tighter line height for text wrapping */
                    #print-area, #print-area div, #print-area span, #print-area p {
                        line-height: 1.35 !important;
                    }
                }
            `}} />
        </>
    );
};

export default MachineIssueRequestForm;
