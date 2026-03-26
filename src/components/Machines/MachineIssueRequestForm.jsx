import { clsx } from 'clsx';
import { Printer, Save, Eye, EyeOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../../supabase/config';
import { toast } from 'react-toastify';

const MachineIssueRequestForm = () => {
    const [formData, setFormData] = useState({
        orangeNumber: '',
        formNumber: '',
        requesterName: '',
        machineManager: '',
        customerName: '',
        phone: '',
        facilityName: '',
        placementAddress: '',
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

    const [isSearching, setIsSearching] = useState(false);

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
                        customerName: customer.name || '',
                        facilityName: customer.agency_name || customer.invoice_company_name || customer.name || '',
                        placementAddress: customer.address || '',
                        requesterName: customer.care_by || prev.requesterName,
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
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
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
            // Determine machine type from checkboxes
            const selectedMachineTypes = Object.entries(formData.machineType)
                .filter(([_, checked]) => checked)
                .map(([type]) => type)
                .join(', ');

            const selectedColors = Object.entries(formData.machineColor)
                .filter(([_, checked]) => checked)
                .map(([color]) => color)
                .join(', ');

            const issueTypes = Object.entries(formData.issueType)
                .filter(([_, checked]) => checked)
                .map(([type]) => type)
                .join(', ');

            // Map ĐNXM fields to orders table
            const orderData = {
                order_code: formData.orangeNumber || `DNXM-${Date.now().toString().slice(-6)}`,
                customer_name: formData.customerName,
                recipient_address: formData.placementAddress || '',
                product_type: selectedMachineTypes || 'MAY',
                quantity: parseInt(formData.quantity) || 1,
                order_type: issueTypes || 'ĐNXM',
                note: `Màu máy: ${selectedColors}. 
                       Ngày cần: ${formData.dateNeeded}. 
                       Giao: ${formData.dateDelivery}. 
                       Thu hồi dự kiến: ${formData.dateRecall}. 
                       Ghi chú: ${formData.notes}`,
                status: 'CHO_DUYET',
                ordered_by: formData.requesterName,
                created_at: new Date().toISOString(),
                customer_category: 'TM' 
            };

            const { data, error } = await supabase
                .from('orders')
                .insert([orderData]);

            if (error) throw error;
            toast.success('Đã lưu Phiếu Đề Nghị Xuất Máy vào hệ thống!');
            setShowPreview(false);
        } catch (error) {
            console.error('Error saving DNXM:', error);
            toast.error('Lỗi khi lưu phiếu: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <>
            {/* DATA ENTRY FORM (MÀN HÌNH CHUẨN) */}
            <div className="max-w-4xl mx-auto mb-10 print:hidden space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
                                    onChange={(e) => handleInputChange('orangeNumber', e.target.value)}
                                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    placeholder="Điền số thứ tự"
                                />
                            </div>
                        </div>

                        {/* Người phụ trách */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">Người đề nghị</label>
                                <input
                                    type="text"
                                    value={formData.requesterName}
                                    onChange={(e) => handleInputChange('requesterName', e.target.value)}
                                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">Nhân viên phụ trách máy</label>
                                <input
                                    type="text"
                                    value={formData.machineManager}
                                    onChange={(e) => handleInputChange('machineManager', e.target.value)}
                                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
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
                                    <label className="block text-sm font-medium text-foreground mb-1.5">Tên khách hàng</label>
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
                                        <label className="block text-sm font-medium text-foreground mb-1.5">Mã máy</label>
                                        <input
                                            type="text"
                                            value={formData.machineCode}
                                            onChange={(e) => handleInputChange('machineCode', e.target.value)}
                                            className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                                    type="text"
                                    value={formData.dateNeeded}
                                    onChange={(e) => handleInputChange('dateNeeded', e.target.value)}
                                    placeholder="dd/MM/yyyy"
                                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">Ngày giao</label>
                                <input
                                    type="text"
                                    value={formData.dateDelivery}
                                    onChange={(e) => handleInputChange('dateDelivery', e.target.value)}
                                    placeholder="dd/MM/yyyy"
                                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">Thu hồi dự kiến</label>
                                <input
                                    type="text"
                                    value={formData.dateRecall}
                                    onChange={(e) => handleInputChange('dateRecall', e.target.value)}
                                    placeholder="dd/MM/yyyy"
                                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
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
                        LƯU HỆ THỐNG
                    </button>

                    <button
                        onClick={handlePrint}
                        className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-8 py-3 rounded-xl shadow-lg shadow-emerald-600/30 hover:bg-emerald-700 transition-all font-bold text-sm transform active:scale-[0.98]"
                    >
                        <Printer size={20} />
                        IN PHIẾU
                    </button>
                </div>
                {/* Spacer to allow scrolling past the button on mobile with bottom nav */}
                <div className="h-32 md:h-10 w-full no-print"></div>
            </div>

            {/* PRINT VIEW (HIỆN KHI ẤN IN HOẶC KHI BẬT PREVIEW) */}
            <div id="print-area" className={clsx(
                "print:block font-serif text-black p-8 bg-white max-w-[210mm] mx-auto min-h-[297mm] shadow-2xl my-10",
                showPreview ? "block scale-90 origin-top" : "hidden"
            )}>
                {/* Header section */}
                <div className="flex justify-between items-start mb-6">
                    <div className="text-sm text-center">
                        <h2 className="font-bold text-blue-800 uppercase print:text-black">CÔNG TY TNHH DỊCH VỤ Y TẾ CỘNG ĐỒNG CHS</h2>
                        <p>ADD: Hải Âu 02-57 Vinhomes Ocean Park,</p>
                        <p>Xã Gia Lâm, Hà Nội</p>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center">
                            <span className="font-medium text-sm">Mẫu số: 02/XM-CHS</span>
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
                        <span className="font-bold">Số: ĐNXM</span>
                    </div>
                </div>

                {/* Form Fields */}
                <div className="space-y-4 text-[15px] leading-relaxed">
                    <div className="flex items-center">
                        <span className="font-bold min-w-[200px]">1. Họ và tên người đề nghị:</span>
                        <input
                            type="text"
                            value={formData.requesterName}
                            readOnly
                            className="flex-1 focus:outline-none px-2 bg-transparent print:border-none text-red-700 font-medium print:text-black"
                            placeholder=""
                        />
                    </div>

                    <div className="flex items-center">
                        <span className="font-bold min-w-[200px]">2. Nhân viên phụ trách máy:</span>
                        <input
                            type="text"
                            value={formData.machineManager}
                            readOnly
                            className="flex-1 focus:outline-none px-2 bg-transparent print:border-none text-red-700 font-medium print:text-black"
                            placeholder=""
                        />
                    </div>

                    <div className="flex items-start md:items-center print:items-center flex-col md:flex-row print:flex-row gap-6 md:gap-0">
                        <div className="flex items-center flex-1 w-full">
                            <span className="font-bold min-w-[200px]">3. Tên khách hàng:</span>
                            <input
                                type="text"
                                value={formData.customerName}
                                readOnly
                                className="flex-1 focus:outline-none px-2 bg-transparent print:border-none text-red-700 font-medium print:text-black"
                                placeholder=""
                            />
                        </div>
                        <div className="flex items-center w-full md:w-auto print:w-auto md:ml-4 print:ml-4">
                            <span className="font-bold whitespace-nowrap mr-2">Điện Thoại:</span>
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
                        <span className="font-bold min-w-[200px]">4. Tên Cơ Sở:</span>
                        <input
                            type="text"
                            value={formData.facilityName}
                            readOnly
                            className="flex-1 focus:outline-none px-2 bg-transparent print:border-none text-red-700 font-medium print:text-black"
                            placeholder=""
                        />
                    </div>

                    <div className="flex items-center">
                        <span className="font-bold min-w-[200px]">5. Địa chỉ đặt máy:</span>
                        <input
                            type="text"
                            value={formData.placementAddress}
                            readOnly
                            className="flex-1 focus:outline-none px-2 bg-transparent print:border-none text-red-700 font-medium print:text-black"
                            placeholder=""
                        />
                    </div>

                    {/* Machine Type */}
                    <div className="flex flex-col md:flex-row print:flex-row md:items-center print:items-center mt-6">
                        <span className="font-bold min-w-[200px] mb-4 md:mb-0 print:mb-0">6. Loại máy đề xuất:</span>
                        <div className="flex flex-wrap gap-6 flex-1 items-center">
                            {Object.keys(formData.machineType).map(type => (
                                <label key={type} className="flex items-center gap-6 cursor-default">
                                    <div className={`w-4 h-4 border border-gray-500 flex items-center justify-center bg-white ${formData.machineType[type] ? 'bg-gray-100' : ''}`}>
                                        {formData.machineType[type] && <span className="text-gray-800 text-xs font-bold font-sans">v</span>}
                                    </div>
                                    <span className="font-medium">{type === 'Khac' ? 'Khác(NK, IoT)' : type}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Machine Color */}
                    <div className="mt-6 mb-2">
                        <span className="font-bold block mb-2">7. Màu máy yêu cầu dành cho TM</span>
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
                            <span className="font-bold mr-2">8. Số lượng máy:</span>
                            <input
                                type="text"
                                value={formData.quantity}
                                readOnly
                                className="focus:outline-none w-16 px-1 font-bold bg-transparent print:border-none print:p-0"
                            />
                        </div>
                        <div className="flex items-center flex-1">
                            <span className="font-bold mr-2">Mã máy:</span>
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
                        <span className="font-bold min-w-[200px]">9. Ngày CHS cần máy:</span>
                        <input
                            type="text"
                            value={formData.dateNeeded}
                            readOnly
                            className="focus:outline-none w-32 px-2 font-bold bg-transparent print:border-none print:p-0"
                            placeholder="dd/MM/yyyy"
                        />
                    </div>

                    <div className="flex flex-col md:flex-row print:flex-row md:items-center print:items-center gap-6 mt-4">
                        <div className="flex items-center">
                            <span className="font-bold min-w-[200px]">10. Ngày giao cho Khách hàng:</span>
                            <input
                                type="text"
                                value={formData.dateDelivery}
                                readOnly
                                className="focus:outline-none w-32 px-2 font-bold bg-transparent print:border-none print:p-0"
                                placeholder="dd/MM/yyyy"
                            />
                        </div>
                        <div className="flex items-center">
                            <span className="font-bold mr-2">11. Thời gian thu hồi:</span>
                            <input
                                type="text"
                                value={formData.dateRecall}
                                readOnly
                                className="focus:outline-none w-32 px-2 font-bold bg-transparent print:border-none print:p-0"
                                placeholder="dd/MM/yyyy"
                            />
                        </div>
                    </div>

                    {/* Shipping Method */}
                    <div className="flex flex-col md:flex-row print:flex-row md:items-center print:items-center mt-4">
                        <span className="font-bold min-w-[200px] mb-4 md:mb-0 print:mb-0">12. Phương thức vận chuyển:</span>
                        <div className="flex gap-10">
                            {Object.keys(formData.shippingMethod).map(method => (
                                <label key={method} className="flex items-center gap-6 cursor-default">
                                    <div className={`w-4 h-4 border border-gray-500 flex items-center justify-center bg-white ${formData.shippingMethod[method] ? 'bg-gray-100' : ''}`}>
                                        {formData.shippingMethod[method] && <span className="text-gray-800 text-xs font-bold font-sans">v</span>}
                                    </div>
                                    <span className={method === 'KD tự vận chuyển' ? 'font-medium' : ''}>{method}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Issue Type */}
                    <div className="flex flex-col md:flex-row print:flex-row md:items-center print:items-center mt-4">
                        <span className="font-bold min-w-[200px] mb-4 md:mb-0 print:mb-0">13. Dạng xuất:</span>
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
                        <span className="font-bold mb-2">14. Ghi chú khác (nếu có):</span>
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
                        <p className="font-bold mb-16">Người đề nghị</p>
                        <p className="font-bold italic text-red-700 print:text-black"></p>
                    </div>
                    <div className="text-center w-[25%]">
                        <p className="font-bold mb-16">Thủ kho</p>
                    </div>
                    <div className="text-center w-[50%]">
                        <p className="italic mb-1 whitespace-nowrap">Hà Nội, ngày {currentDay} tháng {currentMonth} năm {currentYear}</p>
                        <p className="font-bold mb-16">Giám đốc</p>
                        <p className="font-bold italic">Bùi Xuân Đức</p>
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
