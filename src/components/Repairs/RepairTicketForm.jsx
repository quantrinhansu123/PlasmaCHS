import { clsx } from 'clsx';
import { Activity, Camera, ChevronDown, Edit3, HeartPulse, Image as ImageIcon, MapPin, Save, Search, Ticket, Trash2, User, Wrench, X, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import usePermissions from '../../hooks/usePermissions';
import { supabase } from '../../supabase/config';

export default function RepairTicketForm({ ticket, initialCustomer, onClose, onSuccess, fullPage = false }) {
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
    const [allUsers, setAllUsers] = useState([]);

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
        status: 'Mới',
        errorCategory: '' // Tên lỗi: Máy/Bình
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
                status: ticket.status || 'Mới',
                errorCategory: ticket.loai_loi || ''
            });
        } else {
            // New Ticket: Handle initial customer if provided
            if (initialCustomer) {
                setFormData(prev => ({
                    ...prev,
                    customerId: initialCustomer.id
                }));
                fetchCustomerDevices(initialCustomer.name);
            }

            // Auto assign if user is sales or technical
            if (user?.id) {
                if (role === 'kinh_doanh') setFormData(prev => ({ ...prev, salesId: user.id }));
                if (role === 'ky_thuat') setFormData(prev => ({ ...prev, technicianId: user.id }));
            }
        }
    }, [ticket, isEdit, user, role, initialCustomer]);

    useEffect(() => {
        if (isEdit && ticket && customers.length > 0) {
            const customer = customers.find(c => c.id === ticket.customer_id);
            if (customer) fetchCustomerDevices(customer.name);
        }
    }, [isEdit, ticket, customers]);

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
                setAllUsers(usrData);
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

    const fetchCustomerDevices = async (customerName) => {
        if (!customerName) return;
        try {
            const { data: orderData } = await supabase
                .from('orders')
                .select('department, assigned_cylinders, product_type')
                .eq('customer_name', customerName);

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
                    if (o.department?.trim()) {
                        serialMap.set(o.department.trim(), readableName || 'Máy');
                    }
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
                    name: name,
                    category: name.includes('Máy') ? 'Máy' : (name.includes('Bình') ? 'Bình' : '')
                })));
            }
        } catch (err) {
            console.error('Lỗi fetch đơn hàng:', err);
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
        fetchCustomerDevices(customer.name);
    };

    const cFilteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
        (c.phone && c.phone.includes(customerSearchTerm))
    );

    // Device Dropdown logic
    const handleMachineSelect = (m) => {
        setFormData(prev => ({ 
            ...prev, 
            machineSerial: m.serial_number, 
            machineName: m.name,
            errorCategory: m.category || prev.errorCategory 
        }));
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
                status: formData.status,
                loai_loi: formData.errorCategory
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

    const content = (
        <div className={fullPage ? "bg-slate-50 w-full" : "bg-slate-50 rounded-none sm:rounded-3xl shadow-2xl w-full max-w-[99.5%] overflow-hidden flex flex-col h-[100dvh] sm:h-auto sm:max-h-[98vh] border-0 sm:border sm:border-slate-200"}>

                {/* Header */}
                <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white sticky top-0 z-20">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 shadow-sm">
                            {isEdit ? <Edit3 className="w-6 h-6" /> : <Ticket className="w-6 h-6" />}
                        </div>
                        <div>
                            <h3 className="text-[20px] leading-tight font-bold text-slate-900 tracking-tight">
                                {isEdit ? `Cập nhật Ticket Sửa chữa #${ticket.stt}` : 'Tạo Ticket Sửa chữa mới'}
                            </h3>
                            <p className="text-slate-500 text-[12px] font-semibold mt-0.5">
                                {isEdit ? (
                                    <span>
                                        Báo lỗi bởi: <strong className="text-emerald-700">{allUsers.find(u => u.id === ticket.created_by)?.name || 'Hệ thống'}</strong> lúc <strong className="text-slate-700">{new Date(ticket.created_at).toLocaleString('vi-VN')}</strong>
                                    </span>
                                ) : 'Tạo mới phiếu yêu cầu bảo hành/sửa chữa'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all">
                        <X className="w-6 h-6" />
                    </button>
                </div>


                {/* Form Body - Single Page Scroll */}
                <div className={((fullPage && !isEdit) ? "p-4 sm:p-8" : "p-5 sm:p-6") + " overflow-y-auto bg-slate-50 custom-scrollbar flex-1 min-h-0 pb-32 form-body-scroll"}>
                    <div className="w-full px-2 sm:px-4">
                        {errorMsg && (
                            <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-[14px] font-bold text-rose-600 flex items-center gap-3 shadow-sm animate-in fade-in slide-in-from-top-2">
                                <X className="w-5 h-5 shrink-0" /> {errorMsg}
                            </div>
                        )}

                        <form id="ticketForm" onSubmit={handleSubmit} className="space-y-10">

                        {/* Section 1: Thông tin thiết bị */}
                        <div id="section-device" className="scroll-mt-6 rounded-3xl border border-emerald-100 bg-white p-5 sm:p-6 space-y-5 shadow-sm hover:shadow-md transition-shadow [&_label]:text-emerald-700 [&_label_svg]:text-emerald-600">
                            <h4 className="flex items-center gap-2.5 text-[18px] !font-extrabold !text-emerald-700 pb-3 border-b border-emerald-100">
                                <Ticket className="w-5 h-5 text-emerald-600" /> 1. Thông tin thiết bị
                            </h4>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {/* Khách hàng */}
                                <div className="space-y-2">
                                    <label className="flex items-center gap-1.5 text-[14px] font-bold text-emerald-700"><Search className="w-4 h-4 text-emerald-600" />Khách hàng <span className="text-red-500">*</span></label>
                                    <div className="relative" ref={customerDropdownRef}>
                                        <div
                                            className={`w-full h-12 px-5 border rounded-2xl text-[14px] transition-all cursor-pointer flex justify-between items-center ${isFetchingData ? 'bg-slate-50 text-slate-400 border-slate-200' : 'bg-slate-50 border-slate-200 text-slate-900 hover:border-emerald-400 hover:bg-white shadow-sm font-semibold'}`}
                                            onClick={() => !isFetchingData && setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
                                        >
                                            <span>
                                                {formData.customerId ? customers.find(c => c.id === formData.customerId)?.name : 'Chọn khách hàng...'}
                                            </span>
                                            <ChevronDown className="w-5 h-5 text-emerald-500" />
                                        </div>
                                        {isCustomerDropdownOpen && !isFetchingData && (
                                            <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 shadow-2xl max-h-64 overflow-hidden flex flex-col rounded-2xl animate-in fade-in zoom-in-95 duration-200">
                                                <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center gap-3 sticky top-0 z-10">
                                                    <Search className="w-4 h-4 text-emerald-400" />
                                                    <input
                                                        type="text" className="w-full bg-transparent border-none outline-none text-[14px] font-bold placeholder-slate-400" placeholder="Tìm kiếm khách hàng theo tên..."
                                                        value={customerSearchTerm} onChange={(e) => setCustomerSearchTerm(e.target.value)} onClick={(e) => e.stopPropagation()} autoFocus
                                                    />
                                                </div>
                                                <div className="overflow-y-auto custom-scrollbar flex-1 py-1">
                                                    {cFilteredCustomers.length > 0 ? cFilteredCustomers.map(customer => (
                                                        <div key={customer.id} className="px-5 py-3.5 cursor-pointer border-b border-slate-50 hover:bg-emerald-50 transition-colors group" onClick={() => handleCustomerSelect(customer)}>
                                                            <div className="font-bold text-[14px] text-slate-800 group-hover:text-emerald-700">{customer.name}</div>
                                                            <div className="text-[12px] text-slate-400 font-semibold">{customer.phone || 'Chưa cập nhật SĐT'}</div>
                                                        </div>
                                                    )) : <div className="px-5 py-6 text-center text-sm text-slate-500 font-semibold italic">Không tìm thấy khách hàng nào</div>}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Mã thiết bị */}
                                <div className="space-y-2">
                                    <label className="flex items-center gap-1.5 text-[14px] font-bold text-emerald-700"><MapPin className="w-4 h-4 text-emerald-600" />Mã thiết bị <span className="text-red-500">*</span></label>
                                    <div className="relative" ref={machineDropdownRef}>
                                        <div 
                                            className={`w-full h-12 px-5 border rounded-2xl text-[14px] transition-all cursor-pointer flex justify-between items-center ${!formData.customerId ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-slate-50 border-slate-200 text-slate-900 hover:border-emerald-400 hover:bg-white shadow-sm font-semibold'}`}
                                            onClick={() => formData.customerId && setIsMachineDropdownOpen(!isMachineDropdownOpen)}
                                        >
                                            <span>
                                                {formData.machineSerial || '-- Chọn mã thiết bị --'}
                                            </span>
                                            <ChevronDown className="w-5 h-5 text-emerald-500" />
                                        </div>

                                        {isMachineDropdownOpen && (
                                            <div className="absolute z-50 w-full mt-2 top-full bg-white border border-slate-200 shadow-2xl max-h-64 overflow-hidden flex flex-col rounded-2xl animate-in fade-in zoom-in-95 duration-200">
                                                <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center gap-3 sticky top-0 z-10">
                                                    <Search className="w-4 h-4 text-emerald-400" />
                                                    <input 
                                                        type="text" className="w-full bg-transparent border-none outline-none text-[14px] font-bold placeholder-slate-400" placeholder="Tìm mã hoặc tên máy..." 
                                                        value={machineSearchTerm} onChange={(e) => setMachineSearchTerm(e.target.value)} onClick={(e)=>e.stopPropagation()} autoFocus
                                                    />
                                                </div>
                                                <div className="overflow-y-auto custom-scrollbar flex-1 py-1">
                                                    {mFilteredMachines.length > 0 ? mFilteredMachines.map(m => (
                                                        <div key={m.serial_number} className="px-5 py-3.5 cursor-pointer border-b border-slate-100 hover:bg-emerald-50 transition-colors group" onClick={() => handleMachineSelect(m)}>
                                                            <div className="font-black text-[14px] text-slate-800 group-hover:text-emerald-600">{m.serial_number}</div>
                                                            <div className="text-[12px] text-slate-500 font-bold">{m.name}</div>
                                                        </div>
                                                    )) : <div className="px-5 py-6 text-center text-sm text-slate-500 font-semibold italic">Không tìm thấy thiết bị nào</div>}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Tên thiết bị (Auto fill) */}
                                <div className="space-y-2">
                                    <label className="flex items-center gap-1.5 text-[14px] font-bold text-emerald-700"><Edit3 className="w-4 h-4 text-emerald-600" />Tên thiết bị</label>
                                    <input
                                        name="machineName" value={formData.machineName} onChange={handleChange}
                                        placeholder="Tự động điền..." disabled
                                        className="w-full h-12 px-5 bg-slate-100 border border-slate-200 rounded-2xl text-[15px] font-bold text-slate-400 cursor-not-allowed"
                                    />
                            </div>
                        </div>
                    </div>
                        
                        {/* Section 1.5: Phân loại lỗi (Tên lỗi) */}
                        <div id="section-category" className="scroll-mt-6 rounded-3xl border border-emerald-100 bg-white p-5 sm:p-6 space-y-5 shadow-sm hover:shadow-md transition-shadow">
                             <h4 className="flex items-center gap-2.5 text-[16px] !font-bold !text-emerald-700 pb-2">
                                <Activity className="w-5 h-5 text-emerald-600" /> Tên lỗi (Máy/Bình)
                            </h4>
                            <div className="flex flex-wrap gap-4">
                                {['Máy', 'Bình'].map(cat => (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, errorCategory: cat }))}
                                        className={clsx(
                                            "px-6 py-2.5 rounded-2xl text-[14px] font-bold transition-all border-2",
                                            formData.errorCategory === cat 
                                                ? "bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-200" 
                                                : "bg-white border-slate-200 text-slate-500 hover:border-emerald-300 hover:text-emerald-600"
                                        )}
                                    >
                                        {cat}
                                    </button>
                                ))}
                                {!['Máy', 'Bình'].includes(formData.errorCategory) && formData.errorCategory && (
                                     <div className="px-6 py-2.5 rounded-2xl text-[14px] font-bold bg-emerald-600 border-2 border-emerald-600 text-white shadow-lg shadow-emerald-200">
                                        {formData.errorCategory}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Section 2: Tình trạng lỗi */}
                        <div id="section-error" className="scroll-mt-6 rounded-3xl border border-emerald-100 bg-white p-5 sm:p-6 space-y-5 shadow-sm hover:shadow-md transition-shadow [&_label]:text-emerald-700 [&_label_svg]:text-emerald-600">
                            <h4 className="flex items-center gap-2.5 text-[18px] !font-extrabold !text-emerald-700 pb-3 border-b border-emerald-100">
                                <HeartPulse className="w-5 h-5 text-emerald-600" /> 2. Tình trạng lỗi & Báo cáo
                            </h4>

                            <div className="space-y-6">
                                {/* Loại lỗi Custom Dropdown với Nút Add */}
                                <div className="space-y-2">
                                    <label className="text-[14px] font-bold text-emerald-700 flex items-center gap-1.5"><Activity className="w-4 h-4" />Loại lỗi <span className="text-red-500">*</span></label>
                                    <div className="relative" ref={errorTypeDropdownRef}>
                                        <div className="w-full h-12 px-5 border bg-slate-50 border-slate-200 rounded-2xl flex justify-between items-center cursor-pointer hover:border-emerald-400 hover:bg-white shadow-sm transition-all text-slate-900 font-semibold" onClick={() => setIsErrorTypeDropdownOpen(!isErrorTypeDropdownOpen)}>
                                            <span>
                                                {formData.errorTypeId ? errorTypes.find(e => e.id === formData.errorTypeId)?.name : '-- Chọn loại lỗi --'}
                                            </span>
                                            <ChevronDown className="w-5 h-5 text-emerald-500" />
                                        </div>
                                        {isErrorTypeDropdownOpen && (
                                            <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 shadow-2xl max-h-72 flex flex-col rounded-2xl animate-in fade-in zoom-in-95 duration-200">
                                                <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
                                                    <Search className="w-4 h-4 text-emerald-400" />
                                                    <input
                                                        type="text" className="w-full bg-transparent border-none outline-none text-[14px] font-bold placeholder-slate-400" placeholder="Tìm hoặc thêm mới lỗi..."
                                                        value={errorTypeSearchTerm} onChange={(e) => setErrorTypeSearchTerm(e.target.value)} onClick={(e) => e.stopPropagation()}
                                                    />
                                                </div>
                                                <div className="overflow-y-auto custom-scrollbar flex-1 py-1">
                                                    {errorTypes.filter(e => e.name.toLowerCase().includes(errorTypeSearchTerm.toLowerCase())).map(err => (
                                                        <div key={err.id} className="px-5 py-3 cursor-pointer hover:bg-emerald-50 text-[14px] font-bold text-slate-700 transition-colors" onClick={() => { setFormData(prev => ({ ...prev, errorTypeId: err.id })); setIsErrorTypeDropdownOpen(false); }}>
                                                            {err.name}
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="p-3 border-t border-slate-100 bg-emerald-50/30 flex items-center gap-2">
                                                    <input type="text" value={newErrorTypeName} onChange={(e) => setNewErrorTypeName(e.target.value)} placeholder="Nhập tên lỗi mới..." onClick={(e) => e.stopPropagation()} className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:border-emerald-300 transition-all" />
                                                    <button type="button" onClick={(e) => { e.stopPropagation(); handleAddErrorType(); }} className="h-10 w-10 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-200 flex items-center justify-center shrink-0 transition-all"><Plus size={20} /></button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Lỗi chi tiết (Long Text) */}
                                <div className="space-y-2">
                                    <label className="text-[14px] font-bold text-emerald-700 flex items-center gap-1.5"><Edit3 className="w-4 h-4" />Mô tả lỗi chi tiết</label>
                                    <textarea
                                        name="errorDetails" value={formData.errorDetails} onChange={handleChange} rows={4}
                                        placeholder="Mô tả cụ thể biểu hiện bệnh của máy, các mã lỗi hiển thị (nếu có)..."
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-3xl text-[14px] font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 transition-all placeholder:text-slate-400"
                                    />
                                </div>

                                {/* Upload ảnh lỗi */}
                                <div className="space-y-3">
                                    <label className="text-[14px] font-bold text-emerald-700 flex items-center gap-2"><ImageIcon className="w-4 h-4 text-emerald-600" />Hình ảnh chi tiết báo lỗi</label>

                                    <div className="flex flex-wrap gap-4">
                                        {/* Existing Images */}
                                        {formData.detailImages.map((img, idx) => (
                                            <div key={`od-${idx}`} className="relative w-24 h-24 rounded-2xl overflow-hidden border border-slate-100 shadow-sm transition-transform hover:scale-105">
                                                <img src={img} alt="detail" className="w-full h-full object-cover" />
                                                <button type="button" onClick={() => removeImage('detail', idx)} className="absolute top-1.5 right-1.5 p-1.5 bg-rose-600 text-white rounded-lg shadow-lg hover:bg-rose-700 transition-colors"><Trash2 size={12} /></button>
                                            </div>
                                        ))}
                                        {/* File Previews */}
                                        {newDetailFiles.map((file, idx) => (
                                            <div key={`nd-${idx}`} className="relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-emerald-200 shadow-sm transition-transform hover:scale-105">
                                                <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-full object-cover" />
                                                <button type="button" onClick={() => setNewDetailFiles(prev => prev.filter((_, i) => i !== idx))} className="absolute top-1.5 right-1.5 p-1.5 bg-rose-600 text-white rounded-lg shadow-lg hover:bg-rose-700 transition-colors"><Trash2 size={12} /></button>
                                            </div>
                                        ))}

                                        {/* Upload Button */}
                                        <label className="w-24 h-24 flex flex-col items-center justify-center border-2 border-dashed border-emerald-200 rounded-2xl bg-emerald-50/50 text-emerald-500 hover:bg-emerald-100/50 hover:border-emerald-400 cursor-pointer transition-all">
                                            <Camera size={24} />
                                            <span className="text-[11px] font-black mt-2 uppercase">Thêm ảnh</span>
                                            <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => {
                                                if (e.target.files) setNewDetailFiles(prev => [...prev, ...Array.from(e.target.files)]);
                                            }} />
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section 3: Xử lý Kỹ thuật */}
                        <div id="section-technical" className="scroll-mt-6 rounded-3xl border border-emerald-100 bg-white p-5 sm:p-6 space-y-5 shadow-sm hover:shadow-md transition-shadow [&_label]:text-emerald-700 [&_label_svg]:text-emerald-600">
                            <h4 className="flex items-center gap-2.5 text-[18px] !font-extrabold !text-emerald-700 pb-3 border-b border-emerald-100">
                                <Wrench className="w-5 h-5 text-emerald-600" /> 3. Phản hồi & Kỹ thuật
                            </h4>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[14px] font-bold text-emerald-700 flex items-center gap-1.5"><User className="w-4 h-4 text-emerald-600" />Nhân viên kinh doanh</label>
                                    <div className="relative">
                                        <select name="salesId" value={formData.salesId} onChange={handleChange} className="w-full h-12 px-5 bg-slate-50 border border-slate-200 rounded-2xl text-[14px] font-semibold text-slate-800 appearance-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 outline-none hover:bg-white shadow-sm transition-all cursor-pointer">
                                            <option value="">-- Chọn nhân viên --</option>
                                            {salesUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                        </select>
                                        <ChevronDown className="w-5 h-5 text-emerald-500 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[14px] font-bold text-emerald-700 flex items-center gap-1.5"><Wrench className="w-4 h-4 text-emerald-600" />Nhân viên kỹ thuật</label>
                                    <div className="relative">
                                        <select name="technicianId" value={formData.technicianId} onChange={handleChange} className="w-full h-12 px-5 bg-slate-50 border border-slate-200 rounded-2xl text-[14px] font-semibold text-slate-800 appearance-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 outline-none hover:bg-white shadow-sm transition-all cursor-pointer">
                                            <option value="">-- Chọn kỹ thuật --</option>
                                            {techUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                        </select>
                                        <ChevronDown className="w-5 h-5 text-emerald-500 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[14px] font-bold text-emerald-700 flex items-center gap-1.5"><Activity className="w-4 h-4 text-emerald-600" />Trạng thái phiếu</label>
                                    <div className="relative">
                                        <select
                                            name="status" value={formData.status} onChange={handleChange}
                                            className="w-full h-12 px-5 bg-slate-50 border border-slate-200 rounded-2xl text-[14px] font-semibold text-slate-800 appearance-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 outline-none hover:bg-white shadow-sm transition-all cursor-pointer"
                                        >
                                            {['Mới', 'Đang xử lý', 'Chờ linh kiện', 'Hoàn thành', 'Đã hủy'].map(s => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="w-5 h-5 text-emerald-500 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[14px] font-bold text-emerald-700 flex items-center gap-1.5"><Edit3 className="w-4 h-4 text-emerald-600" />Phản hồi từ kỹ thuật</label>
                                <textarea
                                    name="technicalFeedback" value={formData.technicalFeedback} onChange={handleChange} rows={3}
                                    placeholder="Ghi chú nội dung đã kiểm tra, phương án xử lý, linh kiện thay thế..."
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-3xl text-[14px] font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 transition-all placeholder:text-slate-400"
                                />
                            </div>

                            {/* Section: Ảnh kỹ thuật */}
                            <div className="space-y-3">
                                <label className="text-[14px] font-bold text-emerald-700 flex items-center gap-1.5"><ImageIcon className="w-4 h-4 text-emerald-600" />Hình ảnh xử lý kỹ thuật</label>
                                <div className="flex flex-wrap gap-4">
                                    {formData.technicalImages.map((img, idx) => (
                                        <div key={`ot-${idx}`} className="relative w-24 h-24 rounded-2xl overflow-hidden border border-slate-100 shadow-sm transition-transform hover:scale-105">
                                            <img src={img} alt="tech" className="w-full h-full object-cover" />
                                            <button type="button" onClick={() => removeImage('tech', idx)} className="absolute top-1.5 right-1.5 p-1.5 bg-rose-600 text-white rounded-lg shadow-lg hover:bg-rose-700 transition-colors"><Trash2 size={12} /></button>
                                        </div>
                                    ))}
                                    {newTechFiles.map((file, idx) => (
                                        <div key={`nt-${idx}`} className="relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-emerald-200 shadow-sm transition-transform hover:scale-105">
                                            <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-full object-cover" />
                                            <button type="button" onClick={() => setNewTechFiles(prev => prev.filter((_, i) => i !== idx))} className="absolute top-1.5 right-1.5 p-1.5 bg-rose-600 text-white rounded-lg shadow-lg hover:bg-rose-700 transition-colors"><Trash2 size={12} /></button>
                                        </div>
                                    ))}
                                    <label className="w-24 h-24 flex flex-col items-center justify-center border-2 border-dashed border-emerald-200 rounded-2xl bg-emerald-50/50 text-emerald-500 hover:bg-emerald-100/50 hover:border-emerald-400 cursor-pointer transition-all">
                                        <Camera size={24} />
                                        <span className="text-[11px] font-black mt-2 uppercase">Thêm ảnh</span>
                                        <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => {
                                            if (e.target.files) setNewTechFiles(prev => [...prev, ...Array.from(e.target.files)]);
                                        }} />
                                    </label>
                                </div>
                            </div>
                        </div>

                    </form>
                </div>
            </div>

            {/* Footer / Buttons */}
            <div className="px-4 py-3 bg-white border-t border-slate-200 shrink-0 flex items-center justify-end gap-3 sticky bottom-0 z-40">
                <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2.5 rounded-xl border border-slate-300 bg-slate-100 text-slate-500 hover:text-slate-700 font-semibold text-[15px] transition-colors outline-none"
                    disabled={isLoading}
                >
                    Hủy
                </button>
                <button
                    type="submit"
                    form="ticketForm"
                    disabled={isLoading}
                    className="px-8 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white text-[15px] font-bold rounded-2xl shadow-md shadow-emerald-200 transition-all flex items-center gap-2 border border-emerald-700/40 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                        <Save className="w-5 h-5" />
                    )}
                    {isEdit ? 'Lưu cập nhật' : 'Tạo phiếu sửa chữa'}
                </button>
            </div>
            </div>
        );

    if (fullPage) return content;

    return (
        <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-sm flex items-stretch sm:items-center justify-center z-[200000] p-0 sm:p-2 animate-in fade-in duration-200 [&_input]:text-slate-800 [&_select]:text-slate-800 [&_textarea]:text-slate-800 [&_input::placeholder]:text-slate-400 [&_textarea::placeholder]:text-slate-400">
            {content}
        </div>
    );
}
