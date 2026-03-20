import { Camera, ChevronDown, Edit3, HeartPulse, Image as ImageIcon, MapPin, Search, Ticket, Trash2, User, Wrench, X, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import usePermissions from '../../hooks/usePermissions';
import { supabase } from '../../supabase/config';

export default function RepairTicketForm({ ticket, onClose, onSuccess }) {
    const { role, user } = usePermissions();
    const isEdit = !!ticket;
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingData, setIsFetchingData] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    // Master Data
    const [customers, setCustomers] = useState([]);
    const [availableDevices, setAvailableDevices] = useState([]); // Unique serials from orders
    const [errorTypes, setErrorTypes] = useState([]);
    const [salesUsers, setSalesUsers] = useState([]);
    const [techUsers, setTechUsers] = useState([]);

    // Custom dropdown states for Customer
    const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
    const [customerSearchTerm, setCustomerSearchTerm] = useState('');
    const customerDropdownRef = useRef(null);

    // Custom dropdown state for Error Types
    const [isErrorTypeDropdownOpen, setIsErrorTypeDropdownOpen] = useState(false);
    const [errorTypeSearchTerm, setErrorTypeSearchTerm] = useState('');
    const [newErrorTypeName, setNewErrorTypeName] = useState('');
    const errorTypeDropdownRef = useRef(null);

    // Custom dropdown state for Device (Unified)
    const [isMachineDropdownOpen, setIsMachineDropdownOpen] = useState(false); // Renamed internally to Device later
    const [machineSearchTerm, setMachineSearchTerm] = useState('');
    const machineDropdownRef = useRef(null);

    // Close dropdowns on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target)) setIsCustomerDropdownOpen(false);
            if (errorTypeDropdownRef.current && !errorTypeDropdownRef.current.contains(event.target)) setIsErrorTypeDropdownOpen(false);
            if (machineDropdownRef.current && !machineDropdownRef.current.contains(event.target)) setIsMachineDropdownOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const defaultState = {
        customerId: '',
        machineSerial: '',
        machineName: '',
        errorTypeId: '',
        errorDetails: '',
        detailImages: [],
        salesId: '',
        technicianId: '',
        technicalFeedback: '',
        technicalImages: [],
        status: 'Mới'
    };

    const [formData, setFormData] = useState(defaultState);

    // Image Upload states
    const [newDetailFiles, setNewDetailFiles] = useState([]);
    const [newTechFiles, setNewTechFiles] = useState([]);

    useEffect(() => {
        fetchMasterData();
    }, []);

    useEffect(() => {
        if (isEdit && ticket) {
            setFormData({
                customerId: ticket.customer_id || '',
                machineSerial: ticket.machine_serial || '',
                machineName: ticket.machine_name || '',
                errorTypeId: ticket.error_type_id || '',
                errorDetails: ticket.error_details || '',
                detailImages: ticket.error_images || [],
                salesId: ticket.sales_id || '',
                technicianId: ticket.technician_id || '',
                technicalFeedback: ticket.technical_feedback || '',
                technicalImages: ticket.technical_images || [],
                status: ticket.status || 'Mới'
            });
        } else if (user?.id && !isEdit) {
            // Auto assign if user is sales or technical
            if (role === 'kinh_doanh') setFormData(prev => ({ ...prev, salesId: user.id }));
            if (role === 'ky_thuat') setFormData(prev => ({ ...prev, technicianId: user.id }));
        }
    }, [ticket, isEdit, user, role]);

    const fetchMasterData = async () => {
        setIsFetchingData(true);
        try {
            // 1. Fetch Customers
            const { data: custData } = await supabase.from('customers').select('id, name, address, phone').order('name');
            if (custData) setCustomers(custData);

            // 2. Fetch Error Types
            const { data: errData } = await supabase.from('repair_error_types').select('*').order('name');
            if (errData) setErrorTypes(errData);

            // 3. Fetch Users
            const { data: usrData } = await supabase.from('app_users').select('id, name, role');
            if (usrData) {
                // Filter by the user's requested role labels
                setSalesUsers(usrData.filter(u => u.role === 'Nhân viên kinh doanh'));
                setTechUsers(usrData.filter(u => u.role === 'Nhân viên kỹ thuật'));
            }

        } catch (error) {
            console.error('Lỗi tải dữ liệu:', error);
            setErrorMsg('Không thể tải dữ liệu phụ trợ.');
        } finally {
            setIsFetchingData(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // Customer Dropdown logic
    const handleCustomerSelect = async (customer) => {
        setFormData(prev => ({ ...prev, customerId: customer.id, machineSerial: '', machineName: '' }));
        setIsCustomerDropdownOpen(false);
        setCustomerSearchTerm('');
        setAvailableDevices([]); // Reset

        // Fetch devices from Order History for this specific customer
        try {
            const { data: orderData } = await supabase
                .from('orders')
                .select('department, assigned_cylinders, product_type')
                .eq('customer_name', customer.name);

            if (orderData) {
                const formatProdName = (name) => {
                    if (!name) return '';
                    let f = name.toString().replace(/_/g, ' ');
                    if (f.toUpperCase().startsWith('BINH')) f = f.replace(/BINH/i, 'Bình');
                    if (f.toUpperCase().startsWith('MAY')) f = f.replace(/MAY/i, 'Máy');
                    return f;
                };

                const serialMap = new Map(); // serial -> product_type
                orderData.forEach(o => {
                    const readableName = formatProdName(o.product_type);
                    // machineSerial is stored in 'department'
                    if (o.department?.trim()) {
                        serialMap.set(o.department.trim(), readableName || 'Máy');
                    }
                    // assigned_cylinders is an array of serials
                    if (o.assigned_cylinders) {
                        o.assigned_cylinders.forEach(s => {
                            if (s?.trim()) {
                                serialMap.set(s.trim(), readableName || 'Bình');
                            }
                        });
                    }
                });
                
                setAvailableDevices(Array.from(serialMap.entries()).map(([s, name]) => ({
                    serial_number: s,
                    name: name
                })));
            }
        } catch (err) {
            console.error('Lỗi fetch đơn hàng:', err);
        }
    };

    const cFilteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
        (c.phone && c.phone.includes(customerSearchTerm))
    );

    // Device Dropdown logic
    const handleMachineSelect = (m) => {
        setFormData(prev => ({ ...prev, machineSerial: m.serial_number, machineName: m.name }));
        setIsMachineDropdownOpen(false);
        setMachineSearchTerm('');
    };

    const mFilteredMachines = availableDevices.filter(m => 
        m.serial_number.toLowerCase().includes(machineSearchTerm.toLowerCase())
    );

    // Error Type Add New logic
    const handleAddErrorType = async () => {
        if (!newErrorTypeName.trim()) return;
        setIsLoading(true);
        try {
            const { data, error } = await supabase.from('repair_error_types').insert([{ name: newErrorTypeName.trim() }]).select();
            if (error) throw error;
            if (data && data[0]) {
                setErrorTypes(prev => [...prev, data[0]].sort((a, b) => a.name.localeCompare(b.name)));
                setFormData(prev => ({ ...prev, errorTypeId: data[0].id }));
                setNewErrorTypeName('');
                setIsErrorTypeDropdownOpen(false);
            }
        } catch (error) {
            toast.error('Lỗi thêm loại lỗi: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    // File Upload Handlers
    const uploadImagesToStorage = async (files) => {
        const urls = [];
        for (const file of files) {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `${Date.now()}_${fileName}`;

            const { data, error } = await supabase.storage
                .from('repair-tickets')
                .upload(filePath, file);

            if (error) {
                console.error("Lỗi upload ảnh:", error);
                continue;
            }

            const { data: publicUrlData } = supabase.storage
                .from('repair-tickets')
                .getPublicUrl(filePath);

            urls.push(publicUrlData.publicUrl);
        }
        return urls;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');

        if (!formData.customerId || !formData.machineSerial) {
            setErrorMsg('Vui lòng chọn khách hàng và thiết bị.');
            return;
        }

        setIsLoading(true);

        try {
            // Upload selected files
            let newDetailImgUrls = formData.detailImages;
            if (newDetailFiles.length > 0) {
                const urls = await uploadImagesToStorage(newDetailFiles);
                newDetailImgUrls = [...newDetailImgUrls, ...urls];
            }

            let newTechImgUrls = formData.technicalImages;
            if (newTechFiles.length > 0) {
                const urls = await uploadImagesToStorage(newTechFiles);
                newTechImgUrls = [...newTechImgUrls, ...urls];
            }

            const payload = {
                customer_id: formData.customerId,
                machine_serial: formData.machineSerial,
                machine_name: formData.machineName,
                error_type_id: formData.errorTypeId || null,
                error_details: formData.errorDetails,
                error_images: newDetailImgUrls,
                sales_id: formData.salesId || null,
                technician_id: formData.technicianId || null,
                technical_feedback: formData.technicalFeedback,
                technical_images: newTechImgUrls,
                status: formData.status
            };

            if (isEdit) {
                payload.updated_at = new Date().toISOString();
                const { error } = await supabase.from('repair_tickets').update(payload).eq('id', ticket.id);
                if (error) throw error;
                toast.success('Cập nhật phiếu thành công');
            } else {
                if (user?.id) payload.created_by = user.id;
                const { error } = await supabase.from('repair_tickets').insert([payload]);
                if (error) throw error;
                toast.success('Tạo phiếu sửa chữa mới thành công');
            }
            onSuccess();
        } catch (error) {
            console.error('Lỗi khi lưu phiếu:', error);
            setErrorMsg(error.message || 'Có lỗi xảy ra khi lưu phiếu sửa chữa.');
        } finally {
            setIsLoading(false);
        }
    };

    // Delete image handler
    const removeImage = (type, index) => {
        if (type === 'detail') {
            setFormData(prev => {
                const arr = [...prev.detailImages];
                arr.splice(index, 1);
                return { ...prev, detailImages: arr };
            });
        } else {
            setFormData(prev => {
                const arr = [...prev.technicalImages];
                arr.splice(index, 1);
                return { ...prev, technicalImages: arr };
            });
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-sm flex items-stretch sm:items-start sm:pt-16 justify-center z-[100] p-0 sm:p-4 animate-in fade-in duration-200 [&_input]:!font-[600] [&_select]:!font-[600] [&_textarea]:!font-[600] [&_input]:!text-slate-800 [&_select]:!text-slate-800 [&_textarea]:!text-slate-800 [&_input::placeholder]:!text-slate-400 [&_textarea::placeholder]:!text-slate-400">
            <div className="bg-slate-50 rounded-none sm:rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col h-[100dvh] sm:h-auto sm:max-h-[92vh] border-0 sm:border sm:border-slate-200">

                {/* Header */}
                <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white sticky top-0 z-20">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
                            {isEdit ? <Edit3 className="w-5 h-5" /> : <Ticket className="w-5 h-5" />}
                        </div>
                        <div>
                            <h3 className="text-[20px] leading-tight font-bold text-slate-900 tracking-tight">
                                {isEdit ? 'Cập nhật Ticket Sửa chữa' : 'Tạo Ticket Sửa chữa mới'}
                            </h3>
                            <p className="text-slate-500 text-[12px] font-semibold mt-0.5">
                                {isEdit ? `Mã phiếu: #${ticket.stt}` : 'Tạo mới phiếu yêu cầu bảo hành/sửa chữa'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-xl transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form Body */}
                <div className="p-5 sm:p-6 overflow-y-auto bg-slate-50 custom-scrollbar flex-1 min-h-0 pb-20 sm:pb-6">
                    {errorMsg && (
                        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-[13px] font-semibold text-rose-600 flex items-center gap-2">
                            <X className="w-4 h-4 shrink-0" /> {errorMsg}
                        </div>
                    )}

                    <form id="ticketForm" onSubmit={handleSubmit} className="space-y-6">

                        {/* Khu vực Thông tin cơ bản */}
                        <div className="rounded-3xl border border-amber-100 bg-white p-5 sm:p-6 space-y-5 shadow-sm [&_label]:text-amber-700 [&_label_svg]:text-amber-600">
                            <div className="flex items-center gap-2.5 pb-3 border-b border-amber-100">
                                <Ticket className="w-4 h-4 text-amber-600" />
                                <h4 className="text-[18px] !font-extrabold !text-amber-700">Thông tin thiết bị</h4>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Khách hàng Dropdown */}
                                <div className="space-y-1.5 sm:col-span-2">
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800"><User className="w-4 h-4 text-amber-500" />Khách hàng <span className="text-red-500">*</span></label>
                                    <div className="relative" ref={customerDropdownRef}>
                                        <div
                                            className={`w-full h-12 px-4 border rounded-2xl text-[13px] transition-all cursor-pointer flex justify-between items-center ${isFetchingData ? 'bg-slate-50 text-slate-400 border-slate-200' : 'bg-slate-50 border-slate-200 text-slate-900 hover:border-amber-300'}`}
                                            onClick={() => !isFetchingData && setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
                                        >
                                            <span className={formData.customerId ? 'font-semibold text-[13px]' : 'text-slate-500 font-semibold text-[13px]'}>
                                                {formData.customerId ? customers.find(c => c.id === formData.customerId)?.name : 'Chọn khách hàng'}
                                            </span>
                                            <ChevronDown className="w-4 h-4 text-amber-500" />
                                        </div>
                                        {isCustomerDropdownOpen && !isFetchingData && (
                                            <div className="absolute z-50 w-full mt-1 bg-white border border-slate-300 shadow-xl max-h-56 overflow-hidden flex flex-col rounded-xl">
                                                <div className="p-2 border-b border-slate-200 bg-slate-50 flex items-center gap-2 sticky top-0 z-10">
                                                    <Search className="w-4 h-4 text-amber-400" />
                                                    <input
                                                        type="text" className="w-full bg-transparent border-none outline-none text-sm font-semibold placeholder-slate-400" placeholder="Tìm kiếm khách hàng..."
                                                        value={customerSearchTerm} onChange={(e) => setCustomerSearchTerm(e.target.value)} onClick={(e) => e.stopPropagation()} autoFocus
                                                    />
                                                </div>
                                                <div className="overflow-y-auto custom-scrollbar flex-1 py-1">
                                                    {cFilteredCustomers.length > 0 ? cFilteredCustomers.map(customer => (
                                                        <div key={customer.id} className="px-4 py-2.5 cursor-pointer border-b border-slate-100 hover:bg-slate-50" onClick={() => handleCustomerSelect(customer)}>
                                                            <div className="font-semibold text-sm text-slate-800">{customer.name}</div>
                                                        </div>
                                                    )) : <div className="px-4 py-4 text-center text-sm text-slate-500">Không tìm thấy kết quả</div>}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Mã thiết bị */}
                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800"><MapPin className="w-4 h-4 text-amber-500" />Mã thiết bị <span className="text-red-500">*</span></label>
                                    <div className="relative" ref={machineDropdownRef}>
                                        <div 
                                            className={`w-full h-12 px-4 border rounded-2xl text-[13px] transition-all cursor-pointer flex justify-between items-center ${!formData.customerId ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-slate-50 border-slate-200 text-slate-900 hover:border-amber-300'}`}
                                            onClick={() => formData.customerId && setIsMachineDropdownOpen(!isMachineDropdownOpen)}
                                        >
                                            <span className={formData.machineSerial ? 'font-semibold text-[13px]' : 'text-slate-500 font-semibold text-[13px]'}>
                                                {formData.machineSerial || '-- Chọn mã thiết bị --'}
                                            </span>
                                            <ChevronDown className="w-4 h-4 text-amber-500" />
                                        </div>

                                        {isMachineDropdownOpen && (
                                            <div className="absolute z-50 w-full mt-1 top-full bg-white border border-slate-300 shadow-xl max-h-56 overflow-hidden flex flex-col rounded-xl">
                                                <div className="p-2 border-b border-slate-200 bg-slate-50 flex items-center gap-2 sticky top-0 z-10">
                                                    <Search className="w-4 h-4 text-amber-400" />
                                                    <input 
                                                        type="text" className="w-full bg-transparent border-none outline-none text-sm font-semibold placeholder-slate-400" placeholder="Tìm mã hoặc tên máy..." 
                                                        value={machineSearchTerm} onChange={(e) => setMachineSearchTerm(e.target.value)} onClick={(e)=>e.stopPropagation()} autoFocus
                                                    />
                                                </div>
                                                <div className="overflow-y-auto custom-scrollbar flex-1 py-1">
                                                    {mFilteredMachines.length > 0 ? mFilteredMachines.map(m => (
                                                        <div key={m.serial_number} className="px-4 py-2.5 cursor-pointer border-b border-slate-100 hover:bg-slate-50" onClick={() => handleMachineSelect(m)}>
                                                            <div className="font-bold text-sm text-slate-800 group-hover:text-amber-600 transition-colors">{m.serial_number}</div>
                                                            <div className="text-[11px] text-slate-500 font-semibold">{m.name}</div>
                                                        </div>
                                                    )) : <div className="px-4 py-4 text-center text-sm text-slate-500">Không tìm thấy thiết bị nào</div>}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Tên thiết bị (Auto fill) */}
                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800"><Edit3 className="w-4 h-4 text-amber-500" />Tên thiết bị</label>
                                    <input
                                        name="machineName" value={formData.machineName} onChange={handleChange}
                                        placeholder="Tự động điền..." disabled
                                        className="w-full h-12 px-4 bg-slate-100 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-600 cursor-not-allowed"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Khu vực Lỗi chi tiết */}
                        <div className="rounded-3xl border border-rose-100 bg-white p-5 sm:p-6 space-y-5 shadow-sm [&_label]:text-rose-700 [&_label_svg]:text-rose-600">
                            <div className="flex items-center gap-2.5 pb-3 border-b border-rose-100">
                                <HeartPulse className="w-4 h-4 text-rose-600" />
                                <h4 className="text-[18px] !font-extrabold !text-rose-700">Tình trạng lỗi</h4>
                            </div>

                            <div className="space-y-4">
                                {/* Loại lỗi Custom Dropdown với Nút Add */}
                                <div className="space-y-1.5">
                                    <label className="text-[14px] font-semibold text-slate-800">Loại lỗi</label>
                                    <div className="relative" ref={errorTypeDropdownRef}>
                                        <div className="w-full h-12 px-4 border bg-slate-50 border-slate-200 rounded-2xl flex justify-between items-center cursor-pointer" onClick={() => setIsErrorTypeDropdownOpen(!isErrorTypeDropdownOpen)}>
                                            <span className="font-semibold text-slate-800 text-[13px]">
                                                {formData.errorTypeId ? errorTypes.find(e => e.id === formData.errorTypeId)?.name : '-- Chọn loại lỗi --'}
                                            </span>
                                            <ChevronDown className="w-4 h-4 text-rose-500" />
                                        </div>
                                        {isErrorTypeDropdownOpen && (
                                            <div className="absolute z-50 w-full mt-1 bg-white border border-slate-300 shadow-xl max-h-60 flex flex-col rounded-xl">
                                                <div className="p-2 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
                                                    <Search className="w-4 h-4 text-rose-400" />
                                                    <input
                                                        type="text" className="w-full bg-transparent border-none outline-none text-sm font-semibold placeholder-slate-400" placeholder="Tìm hoặc thêm mới..."
                                                        value={errorTypeSearchTerm} onChange={(e) => setErrorTypeSearchTerm(e.target.value)} onClick={(e) => e.stopPropagation()}
                                                    />
                                                </div>
                                                <div className="overflow-y-auto flex-1">
                                                    {errorTypes.filter(e => e.name.toLowerCase().includes(errorTypeSearchTerm.toLowerCase())).map(err => (
                                                        <div key={err.id} className="px-4 py-2 cursor-pointer hover:bg-slate-50 text-sm font-semibold" onClick={() => { setFormData(prev => ({ ...prev, errorTypeId: err.id })); setIsErrorTypeDropdownOpen(false); }}>
                                                            {err.name}
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="p-2 border-t border-slate-200 bg-rose-50/50 flex items-center gap-2">
                                                    <input type="text" value={newErrorTypeName} onChange={(e) => setNewErrorTypeName(e.target.value)} placeholder="Nhập lỗi mới..." onClick={(e) => e.stopPropagation()} className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-sm outline-none focus:border-rose-300" />
                                                    <button type="button" onClick={(e) => { e.stopPropagation(); handleAddErrorType(); }} className="p-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 shrink-0"><Plus size={16} /></button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Lỗi chi tiết (Long Text) */}
                                <div className="space-y-1.5">
                                    <label className="text-[14px] font-semibold text-slate-800">Mô tả lỗi chi tiết</label>
                                    <textarea
                                        name="errorDetails" value={formData.errorDetails} onChange={handleChange} rows={3}
                                        placeholder="Mô tả cụ thể biểu hiện bệnh của máy..."
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-[14px] font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-rose-100 focus:border-rose-400"
                                    />
                                </div>

                                {/* Upload ảnh lỗi */}
                                <div className="space-y-2">
                                    <label className="text-[14px] font-semibold text-slate-800 flex items-center gap-2"><ImageIcon className="w-4 h-4 text-rose-500" />Hình ảnh chi tiết báo lỗi</label>

                                    <div className="flex flex-wrap gap-3">
                                        {/* Existing Images */}
                                        {formData.detailImages.map((img, idx) => (
                                            <div key={`od-${idx}`} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 hidden sm:block">
                                                <img src={img} alt="detail" className="w-full h-full object-cover" />
                                                <button type="button" onClick={() => removeImage('detail', idx)} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full bg-opacity-80 hover:bg-opacity-100"><Trash2 size={12} /></button>
                                            </div>
                                        ))}
                                        {/* File Previews */}
                                        {newDetailFiles.map((file, idx) => (
                                            <div key={`nd-${idx}`} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200">
                                                <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-full object-cover" />
                                                <button type="button" onClick={() => setNewDetailFiles(prev => prev.filter((_, i) => i !== idx))} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full bg-opacity-80 hover:bg-opacity-100"><Trash2 size={12} /></button>
                                            </div>
                                        ))}

                                        {/* Upload Button */}
                                        <label className="w-20 h-20 flex flex-col items-center justify-center border-2 border-dashed border-rose-300 rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-100 cursor-pointer transition-all">
                                            <Camera size={20} />
                                            <span className="text-[10px] font-bold mt-1">Thêm ảnh</span>
                                            <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => {
                                                if (e.target.files) setNewDetailFiles(prev => [...prev, ...Array.from(e.target.files)]);
                                            }} />
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Khu vực Xử lý Kỹ thuật */}
                        <div className="rounded-3xl border border-blue-100 bg-white p-5 sm:p-6 space-y-5 shadow-sm [&_label]:text-blue-700 [&_label_svg]:text-blue-600">
                            <div className="flex items-center gap-2.5 pb-3 border-b border-blue-100">
                                <Wrench className="w-4 h-4 text-blue-600" />
                                <h4 className="text-[18px] !font-extrabold !text-blue-700">Phản hồi & Xử lý (Kỹ thuật)</h4>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[14px] font-semibold text-slate-800">Nhân viên kinh doanh</label>
                                    <div className="relative">
                                        <select name="salesId" value={formData.salesId} onChange={handleChange} className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[14px] font-semibold text-slate-800 appearance-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 outline-none">
                                            <option value="">-- Chọn nhân viên --</option>
                                            {salesUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                        </select>
                                        <ChevronDown className="w-4 h-4 text-blue-500 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[14px] font-semibold text-slate-800">Nhân viên kỹ thuật</label>
                                    <div className="relative">
                                        <select name="technicianId" value={formData.technicianId} onChange={handleChange} className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[14px] font-semibold text-slate-800 appearance-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 outline-none">
                                            <option value="">-- Chọn kỹ thuật --</option>
                                            {techUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                        </select>
                                        <ChevronDown className="w-4 h-4 text-blue-500 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[14px] font-semibold text-slate-800">Trạng thái phiếu</label>
                                    <div className="relative">
                                        <select
                                            name="status" value={formData.status} onChange={handleChange}
                                            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[14px] font-semibold text-slate-800 appearance-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 outline-none"
                                        >
                                            {['Mới', 'Đang xử lý', 'Chờ linh kiện', 'Hoàn thành', 'Đã hủy'].map(s => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="w-4 h-4 text-blue-500 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[14px] font-semibold text-slate-800">Phản hồi từ kỹ thuật</label>
                                <textarea
                                    name="technicalFeedback" value={formData.technicalFeedback} onChange={handleChange} rows={2}
                                    placeholder="Ghi chú sau khi kiểm tra hoặc xử lý xong..."
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-[14px] font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
                                />
                            </div>

                            {/* Tech Upload */}
                            <div className="space-y-2">
                                <label className="text-[14px] font-semibold text-slate-800 flex items-center gap-2"><ImageIcon className="w-4 h-4 text-blue-500" />Hình ảnh kỹ thuật</label>

                                <div className="flex flex-wrap gap-3">
                                    {/* Existing Images */}
                                    {formData.technicalImages.map((img, idx) => (
                                        <div key={`ot-${idx}`} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200">
                                            <img src={img} alt="tech" className="w-full h-full object-cover" />
                                            <button type="button" onClick={() => removeImage('tech', idx)} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full bg-opacity-80 hover:bg-opacity-100"><Trash2 size={12} /></button>
                                        </div>
                                    ))}
                                    {/* File Previews */}
                                    {newTechFiles.map((file, idx) => (
                                        <div key={`nt-${idx}`} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200">
                                            <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-full object-cover" />
                                            <button type="button" onClick={() => setNewTechFiles(prev => prev.filter((_, i) => i !== idx))} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full bg-opacity-80 hover:bg-opacity-100"><Trash2 size={12} /></button>
                                        </div>
                                    ))}

                                    {/* Upload Button */}
                                    <label className="w-20 h-20 flex flex-col items-center justify-center border-2 border-dashed border-blue-300 rounded-xl bg-blue-50 text-blue-500 hover:bg-blue-100 cursor-pointer transition-all">
                                        <Camera size={20} />
                                        <span className="text-[10px] font-bold mt-1">Thêm ảnh</span>
                                        <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => {
                                            if (e.target.files) setNewTechFiles(prev => [...prev, ...Array.from(e.target.files)]);
                                        }} />
                                    </label>
                                </div>
                            </div>
                        </div>

                        </form>
                    </div>

                {/* Footer / Buttons */}
                <div className="fixed bottom-0 left-0 right-0 sm:static bg-white border-t border-slate-200 p-4 shrink-0 z-30 flex items-center justify-end gap-3 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] sm:shadow-none">
                    <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all text-sm">
                        Hủy
                    </button>
                    <button
                        type="submit" form="ticketForm" disabled={isLoading}
                        className="px-6 py-2.5 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-700 transition-all shadow-lg shadow-amber-600/30 flex items-center gap-2 text-sm disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : null}
                        {isEdit ? 'Lưu cập nhật' : 'Tạo phiếu sửa chữa'}
                    </button>
                </div>
            </div>
        </div>
    );
}
