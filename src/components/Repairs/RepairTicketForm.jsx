import { clsx } from 'clsx';
import { Activity, AlertCircle, Camera, ChevronDown, Edit3, HeartPulse, Image as ImageIcon, MapPin, Plus, Save, Search, Ticket, Trash2, User, Wrench, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-toastify';
import { ERROR_LEVELS } from '../../constants/repairConstants';
import usePermissions from '../../hooks/usePermissions';
import { supabase } from '../../supabase/config';
import { notificationService } from '../../utils/notificationService';

export default function RepairTicketForm({ ticket, initialCustomer, onClose, onSuccess, fullPage = false }) {
    const { role, user } = usePermissions();
    const isEdit = !!ticket;
    const [isLoading, setIsLoading] = useState(false);
    const [isClosing, setIsClosing] = useState(false);

    const handleClose = useCallback(() => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
        }, 300);
    }, [onClose]);
    const [isFetchingData, setIsFetchingData] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    // Master Data
    const [customers, setCustomers] = useState([]);
    const [availableDevices, setAvailableDevices] = useState([]); // Unique serials from orders
    const [errorTypes, setErrorTypes] = useState([]);
    const [salesUsers, setSalesUsers] = useState([]);
    const [techUsers, setTechUsers] = useState([]);
    const [cskhUsers, setCskhUsers] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [isFetchingDevices, setIsFetchingDevices] = useState(false);

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
        cskhId: '',
        technicalFeedback: '',
        technicalImages: [],
        status: 'Mới',
        errorCategory: '', // Tên lỗi: Máy / Bình / Nâng cấp
        expectedCompletionDate: '',
        errorLevel: 'Trung bình'
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
                cskhId: ticket.cskh_id || ticket.created_by || '',
                technicalFeedback: ticket.technical_feedback || '',
                technicalImages: ticket.technical_images || [],
                status: ticket.status || 'Mới',
                errorCategory: ticket.loai_loi || '',
                expectedCompletionDate: ticket.expected_completion_date || '',
                errorLevel: ticket.error_level || 'Trung bình'
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

            // Auto assign creator: KD + CSKH (có thể đổi trong form); kỹ thuật nếu đúng role
            if (user?.id) {
                setFormData(prev => ({
                    ...prev,
                    salesId: user.id,
                    cskhId: user.id,
                    ...(role === 'Nhân viên kỹ thuật' ? { technicianId: user.id } : {}),
                }));
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
                setCskhUsers(usrData.filter(u => u.role === 'Nhân viên CSKH'));
            }

        } catch (error) {
            console.error('Lỗi tải dữ liệu:', error);
            setErrorMsg('Không thể tải dữ liệu phụ trợ.');
        } finally {
            setIsFetchingData(false);
        }
    };

    // Sync salesUsers with current user to ensure their name displays when auto-assigned
    useEffect(() => {
        if (allUsers.length > 0) {
            let salesList = allUsers.filter(u => u.role === 'Nhân viên kinh doanh');
            
            // If current user is not in the salesList (e.g. they are Admin/Tech), 
            // add them to the list so their name displays correctly in the select.
            if (user?.id && !salesList.find(u => u.id === user.id)) {
                salesList = [...salesList, user];
            }
            setSalesUsers(salesList);
        }
    }, [user, allUsers]);

    // CSKH: danh sách role CSKH + người đang đăng nhập + (khi sửa) người đã gán / người tạo phiếu — để select hiển thị đúng khi auto điền
    useEffect(() => {
        if (allUsers.length === 0) return;
        let cskhList = allUsers.filter((u) => u.role === 'Nhân viên CSKH');
        const pushIfMissing = (u) => {
            if (u?.id && !cskhList.find((x) => x.id === u.id)) {
                cskhList = [...cskhList, u];
            }
        };
        pushIfMissing(user);
        if (isEdit && ticket) {
            const extraId = ticket.cskh_id || ticket.created_by;
            if (extraId) pushIfMissing(allUsers.find((u) => u.id === extraId));
        }
        cskhList.sort((a, b) => a.name.localeCompare(b.name, 'vi', { sensitivity: 'base' }));
        setCskhUsers(cskhList);
    }, [user, allUsers, isEdit, ticket]);

    const fetchCustomerDevices = async (customerName) => {
        if (!customerName) return;
        setIsFetchingDevices(true);
        try {
            const trimmedName = customerName.trim();
            const { data: orderData } = await supabase
                .from('orders')
                .select('department, assigned_cylinders, product_type')
                .ilike('customer_name', `%${trimmedName}%`);

            if (orderData) {
                const formatProdName = (name) => {
                    if (!name) return '';
                    let f = name.toString().replace(/_/g, ' ');
                    if (f.toUpperCase().startsWith('BINH')) f = f.replace(/BINH/i, 'Bình');
                    if (f.toUpperCase().startsWith('MAY')) f = f.replace(/MAY/i, 'Máy');
                    return f;
                };

                const serialMap = new Map(); // serial -> {name, category}
                orderData.forEach(o => {
                    const readableName = formatProdName(o.product_type);
                    if (o.department?.trim()) {
                        serialMap.set(o.department.trim(), {
                            name: readableName || 'Máy',
                            category: (readableName || 'Máy').includes('Máy') ? 'Máy' : 'Bình'
                        });
                    }
                    if (o.assigned_cylinders) {
                        o.assigned_cylinders.forEach(s => {
                            if (s?.trim()) {
                                serialMap.set(s.trim(), {
                                    name: readableName || 'Bình',
                                    category: (readableName || 'Bình').includes('Máy') ? 'Máy' : 'Bình'
                                });
                            }
                        });
                    }
                });

                setAvailableDevices(Array.from(serialMap.entries()).map(([s, info]) => ({
                    serial_number: s,
                    name: info.name,
                    category: info.category
                })));
            }
        } catch (err) {
            console.error('Lỗi fetch đơn hàng:', err);
        } finally {
            setIsFetchingDevices(false);
        }
    };

    const fetchAnyDeviceBySerial = async (serialPart) => {
        if (!serialPart || serialPart.length < 2) return;
        setIsFetchingDevices(true);
        try {
            const { data: orderData } = await supabase
                .from('orders')
                .select('department, assigned_cylinders, product_type')
                .or(`department.ilike.%${serialPart}%,assigned_cylinders.cs.{${serialPart.toUpperCase()}}`)
                .limit(20);

            if (orderData) {
                const serialMap = new Map();
                // Add existing ones first to avoid duplicates
                availableDevices.forEach(d => serialMap.set(d.serial_number, { name: d.name, category: d.category }));

                orderData.forEach(o => {
                    const formatProdName = (name) => {
                        if (!name) return '';
                        let f = name.toString().replace(/_/g, ' ');
                        if (f.toUpperCase().startsWith('BINH')) f = f.replace(/BINH/i, 'Bình');
                        if (f.toUpperCase().startsWith('MAY')) f = f.replace(/MAY/i, 'Máy');
                        return f;
                    };
                    const readableName = formatProdName(o.product_type);

                    if (o.department?.trim() && o.department.toUpperCase().includes(serialPart.toUpperCase())) {
                        serialMap.set(o.department.trim(), {
                            name: readableName || 'Máy',
                            category: (readableName || 'Máy').includes('Máy') ? 'Máy' : 'Bình'
                        });
                    }
                    if (o.assigned_cylinders) {
                        o.assigned_cylinders.forEach(s => {
                            if (s?.trim() && s.toUpperCase().includes(serialPart.toUpperCase())) {
                                serialMap.set(s.trim(), {
                                    name: readableName || 'Bình',
                                    category: (readableName || 'Bình').includes('Máy') ? 'Máy' : 'Bình'
                                });
                            }
                        });
                    }
                });

                setAvailableDevices(Array.from(serialMap.entries()).map(([s, info]) => ({
                    serial_number: s,
                    name: info.name,
                    category: info.category
                })));
            }
        } catch (err) {
            console.error('Lỗi tìm kiếm thiết bị mở rộng:', err);
        } finally {
            setIsFetchingDevices(false);
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
        toast.success(`Đã chọn: ${m.serial_number}`, { autoClose: 1000, position: 'top-center' });
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
                cskh_id: formData.cskhId || null,
                technical_feedback: formData.technicalFeedback,
                technical_images: newTechImgUrls,
                status: formData.status,
                loai_loi: formData.errorCategory,
                expected_completion_date: formData.expectedCompletionDate || null,
                error_level: formData.errorLevel
            };

            if (isEdit) {
                payload.updated_at = new Date().toISOString();
                const { error } = await supabase.from('repair_tickets').update(payload).eq('id', ticket.id);
                if (error) throw error;
                toast.success('Cập nhật phiếu thành công');
            } else {
                if (user?.id) payload.created_by = user.id;
                const { data: newTicket, error } = await supabase.from('repair_tickets').insert([payload]).select().single();
                if (error) throw error;

                // Create system notification
                const customerName = customers.find(c => c.id === formData.customerId)?.name || 'Khách hàng';
                notificationService.add({
                    title: `🎫 Ticket mới: #${newTicket.stt || ''}`,
                    description: `${customerName} - ${formData.machineSerial} - ${formData.errorLevel}`,
                    type: 'info',
                    link: '/phieu-sua-chua'
                });

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
        <div className={clsx(
            fullPage ? "bg-slate-50 w-full" : "bg-slate-50 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col h-full border-l border-slate-200 animate-in slide-in-from-right duration-300",
            isClosing && "animate-out slide-out-to-right duration-300"
        )}>

            {/* Header */}
            <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary shadow-sm">
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
                <button onClick={handleClose} className="p-2 text-primary hover:text-primary hover:bg-primary/5 rounded-xl transition-all">
                    <X className="w-6 h-6" />
                </button>
            </div>


            {/* Form Body - Single Page Scroll */}
            <div className={((fullPage && !isEdit) ? "p-3 sm:p-5" : "p-4 sm:p-5") + " overflow-y-auto bg-slate-50 custom-scrollbar flex-1 min-h-0 pb-20 form-body-scroll"}>
                <div className="w-full px-1 sm:px-2">
                    {errorMsg && (
                        <div className="mb-4 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-[14px] font-bold text-primary flex items-center gap-2 shadow-sm animate-in fade-in slide-in-from-top-2">
                            <X className="w-5 h-5 shrink-0" /> {errorMsg}
                        </div>
                    )}

                    <form id="ticketForm" onSubmit={handleSubmit} className="space-y-6">

                        {/* Section 0: Nhân viên phụ trách - PINNED TO TOP */}
                        <div className="scroll-mt-6 rounded-2xl border-2 border-primary/20 bg-primary/5 p-4 sm:p-5 space-y-4 shadow-md hover:shadow-lg transition-all animate-in zoom-in-95">
                            <h4 className="flex items-center gap-2 text-[16px] !font-black !text-primary pb-2 border-b border-primary/20">
                                <User className="w-5 h-5 text-primary" /> PHỤ TRÁCH KINH DOANH
                            </h4>
                            <div className="space-y-2">
                                <label className="text-[14px] font-black text-primary flex items-center gap-1.5 uppercase tracking-wider">Nhân viên kinh doanh phụ trách <span className="text-red-500 font-black">*</span></label>
                                <div className="relative">
                                    <select
                                        name="salesId"
                                        value={formData.salesId}
                                        onChange={handleChange}
                                            className={clsx(
                                                "w-full h-14 px-6 border-2 rounded-2xl text-[16px] font-black appearance-none focus:ring-8 outline-none shadow-xl transition-all ring-4 ring-primary/5",
                                                "bg-white border-primary/40 text-primary hover:shadow-primary/5 cursor-pointer focus:border-primary focus:ring-primary/10"
                                            )}
                                        >
                                        <option value="">-- CHỌN NHÂN VIÊN KINH DOANH --</option>
                                        {salesUsers.map(u => <option key={u.id} value={u.id} className="font-bold text-slate-800">{u.name}</option>)}
                                    </select>
                                    <ChevronDown className="w-6 h-6 text-primary absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                </div>
                            </div>
                        </div>

                        {/* Section 1: Thông tin thiết bị */}
                        <div id="section-device" className="scroll-mt-6 rounded-2xl border border-primary/10 bg-white p-4 sm:p-5 space-y-4 shadow-sm hover:shadow-md transition-shadow [&_label]:text-primary [&_label_svg]:text-primary/80">
                            <h4 className="flex items-center gap-2 text-[16px] !font-black !text-primary pb-2 border-b border-primary/10">
                                <Ticket className="w-4 h-4 text-primary/80" /> 1. Thông tin thiết bị
                            </h4>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {/* Khách hàng */}
                                <div className="space-y-2">
                                    <label className="flex items-center gap-1.5 text-[14px] font-bold text-primary"><Search className="w-4 h-4 text-primary/80" />Khách hàng / Cơ sở <span className="text-red-500">*</span></label>
                                    <div className="relative" ref={customerDropdownRef}>
                                        <div
                                            className={`w-full h-12 px-5 border rounded-2xl text-[14px] transition-all cursor-pointer flex justify-between items-center ${isFetchingData ? 'bg-slate-50 text-slate-400 border-slate-200' : 'bg-slate-50 border-slate-200 text-slate-900 hover:border-primary/40 hover:bg-white shadow-sm font-semibold'}`}
                                            onClick={() => !isFetchingData && setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
                                        >
                                            <span>
                                                {formData.customerId ? customers.find(c => c.id === formData.customerId)?.name : 'Chọn khách hàng...'}
                                            </span>
                                            <ChevronDown className="w-5 h-5 text-primary/60" />
                                        </div>
                                        {isCustomerDropdownOpen && !isFetchingData && (
                                            <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 shadow-2xl max-h-64 overflow-hidden flex flex-col rounded-2xl animate-in fade-in zoom-in-95 duration-200">
                                                <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center gap-3 sticky top-0 z-10">
                                                    <Search className="w-4 h-4 text-primary/40" />
                                                    <input
                                                        type="text" className="w-full bg-transparent border-none outline-none text-[14px] font-bold placeholder-slate-400" placeholder="Tìm kiếm khách hàng theo tên..."
                                                        value={customerSearchTerm} onChange={(e) => setCustomerSearchTerm(e.target.value)} onClick={(e) => e.stopPropagation()} autoFocus
                                                    />
                                                </div>
                                                <div className="overflow-y-auto custom-scrollbar flex-1 py-1">
                                                    {cFilteredCustomers.length > 0 ? cFilteredCustomers.map(customer => (
                                                        <div key={customer.id} className="px-5 py-3.5 cursor-pointer border-b border-slate-50 hover:bg-primary/5 transition-colors group" onClick={() => handleCustomerSelect(customer)}>
                                                            <div className="font-bold text-[14px] text-slate-800 group-hover:text-primary">{customer.name}</div>
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
                                    <label className="flex items-center gap-1.5 text-[14px] font-bold text-primary"><MapPin className="w-4 h-4 text-primary/80" />Mã thiết bị <span className="text-red-500">*</span></label>
                                    <div className="relative" ref={machineDropdownRef}>
                                        <div
                                            className={`w-full h-12 px-5 border rounded-2xl text-[14px] transition-all cursor-pointer flex justify-between items-center ${!formData.customerId ? 'bg-slate-50 border-slate-200 text-slate-400 font-medium' : 'bg-slate-50 border-slate-200 text-slate-900 hover:border-primary/40 hover:bg-white shadow-sm font-semibold'}`}
                                            onClick={() => {
                                                if (!formData.customerId) {
                                                    toast.info('Vui lòng chọn khách hàng trước', { position: 'top-center' });
                                                    return;
                                                }
                                                setIsMachineDropdownOpen(!isMachineDropdownOpen);
                                            }}
                                        >
                                            <span className="flex items-center gap-2">
                                                {isFetchingDevices && <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>}
                                                {formData.machineSerial || '-- Chọn mã thiết bị --'}
                                            </span>
                                            <ChevronDown className="w-5 h-5 text-primary/60" />
                                        </div>

                                        {isMachineDropdownOpen && (
                                            <div className="absolute z-50 w-full mt-2 top-full bg-white border border-slate-200 shadow-2xl max-h-64 overflow-hidden flex flex-col rounded-2xl animate-in fade-in zoom-in-95 duration-200">
                                                <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center gap-3 sticky top-0 z-10">
                                                    <Search className="w-4 h-4 text-primary/40" />
                                                    <div className="flex-1 flex items-center gap-2">
                                                        <input
                                                            type="text" className="w-full bg-transparent border-none outline-none text-[14px] font-bold placeholder-slate-400" placeholder="Tìm mã hoặc tên máy..."
                                                            value={machineSearchTerm} 
                                                            onChange={(e) => setMachineSearchTerm(e.target.value)} 
                                                            onClick={(e) => e.stopPropagation()} autoFocus
                                                        />
                                                        {machineSearchTerm.length >= 2 && (
                                                            <button 
                                                                type="button"
                                                                onClick={(e) => { e.stopPropagation(); fetchAnyDeviceBySerial(machineSearchTerm); }}
                                                                className="px-2 py-1 bg-primary/10 text-primary text-[10px] font-black rounded-lg hover:bg-primary hover:text-white transition-all shrink-0"
                                                            >
                                                                Tìm toàn hệ thống
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="overflow-y-auto custom-scrollbar flex-1 py-1">
                                                    {mFilteredMachines.length > 0 ? mFilteredMachines.map(m => (
                                                        <div key={m.serial_number} className="px-5 py-3.5 cursor-pointer border-b border-slate-100 hover:bg-primary/5 transition-colors group" onClick={() => handleMachineSelect(m)}>
                                                            <div className="font-black text-[14px] text-slate-800 group-hover:text-primary">{m.serial_number}</div>
                                                            <div className="text-[12px] text-primary font-bold">{m.name}</div>
                                                        </div>
                                                    )) : (
                                                        <div className="px-5 py-6 text-center">
                                                            <p className="text-sm text-slate-500 font-semibold italic mb-2">Không tìm thấy thiết bị nào của khách hàng này</p>
                                                            {machineSearchTerm.length >= 2 && (
                                                                <button 
                                                                    type="button"
                                                                    onClick={(e) => { e.stopPropagation(); fetchAnyDeviceBySerial(machineSearchTerm); }}
                                                                    className="text-xs font-black text-primary hover:underline"
                                                                >
                                                                    Thử tìm kiếm trên toàn bộ đơn hàng?
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Tên thiết bị (Auto fill) */}
                                <div className="space-y-2">
                                    <label className="flex items-center gap-1.5 text-[14px] font-bold text-primary"><Edit3 className="w-4 h-4 text-primary/80" />Tên thiết bị</label>
                                    <input
                                        name="machineName" value={formData.machineName} onChange={handleChange}
                                        placeholder="Tự động điền..." disabled
                                        className="w-full h-12 px-5 bg-slate-100 border border-slate-200 rounded-2xl text-[15px] font-bold text-slate-400 cursor-not-allowed"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section 1.5: Phân loại lỗi (Tên lỗi) */}
                        <div id="section-category" className="scroll-mt-6 rounded-2xl border border-primary/10 bg-white p-4 sm:p-5 space-y-4 shadow-sm hover:shadow-md transition-shadow">
                            <h4 className="flex items-center gap-2 text-[16px] !font-black !text-primary pb-1">
                                <Activity className="w-4 h-4 text-primary/80" /> Tên lỗi (Máy/Bình/Nâng cấp)
                            </h4>
                            <div className="flex flex-wrap gap-4">
                                {['Máy', 'Bình', 'Nâng cấp'].map(cat => (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, errorCategory: cat }))}
                                        className={clsx(
                                            "px-6 py-2.5 rounded-2xl text-[14px] font-bold transition-all border-2",
                                            formData.errorCategory === cat
                                                ? "bg-primary border-primary text-white shadow-lg shadow-primary/20"
                                                : "bg-white border-slate-200 text-slate-500 hover:border-primary/40 hover:text-primary"
                                        )}
                                    >
                                        {cat}
                                    </button>
                                ))}
                                {!['Máy', 'Bình', 'Nâng cấp'].includes(formData.errorCategory) && formData.errorCategory && (
                                    <div className="px-6 py-2.5 rounded-2xl text-[14px] font-bold bg-primary border-primary text-white shadow-lg shadow-primary/20">
                                        {formData.errorCategory}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Section 2: Tình trạng lỗi */}
                        <div id="section-error" className="scroll-mt-6 rounded-2xl border border-primary/10 bg-white p-4 sm:p-5 space-y-4 shadow-sm hover:shadow-md transition-shadow [&_label]:text-primary [&_label_svg]:text-primary/80">
                            <h4 className="flex items-center gap-2 text-[16px] !font-black !text-primary pb-2 border-b border-primary/10">
                                <HeartPulse className="w-4 h-4 text-primary/80" /> 2. Tình trạng lỗi & Báo cáo
                            </h4>

                            <div className="space-y-4">
                                {/* Loại lỗi Custom Dropdown với Nút Add */}
                                <div className="space-y-2">
                                    <label className="text-[14px] font-bold text-primary flex items-center gap-1.5"><Activity className="w-4 h-4" />Loại lỗi <span className="text-red-500">*</span></label>
                                    <div className="relative" ref={errorTypeDropdownRef}>
                                        <div className="w-full h-12 px-5 border bg-slate-50 border-slate-200 rounded-2xl flex justify-between items-center cursor-pointer hover:border-primary/40 hover:bg-white shadow-sm transition-all text-slate-900 font-semibold" onClick={() => setIsErrorTypeDropdownOpen(!isErrorTypeDropdownOpen)}>
                                            <span>
                                                {formData.errorTypeId ? errorTypes.find(e => e.id === formData.errorTypeId)?.name : '-- Chọn loại lỗi --'}
                                            </span>
                                            <ChevronDown className="w-5 h-5 text-primary/60" />
                                        </div>
                                        {isErrorTypeDropdownOpen && (
                                            <div className="absolute z-50 w-full min-w-0 mt-2 bg-white border border-slate-200 shadow-2xl max-h-72 flex flex-col rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                                <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
                                                    <Search className="w-4 h-4 text-primary/40" />
                                                    <input
                                                        type="text" className="w-full bg-transparent border-none outline-none text-[14px] font-bold placeholder-slate-400" placeholder="Tìm hoặc thêm mới lỗi..."
                                                        value={errorTypeSearchTerm} onChange={(e) => setErrorTypeSearchTerm(e.target.value)} onClick={(e) => e.stopPropagation()}
                                                    />
                                                </div>
                                                <div className="overflow-y-auto custom-scrollbar flex-1 py-1">
                                                    {errorTypes.filter(e => e.name.toLowerCase().includes(errorTypeSearchTerm.toLowerCase())).map(err => (
                                                        <div key={err.id} className="px-5 py-3 cursor-pointer hover:bg-primary/5 text-[14px] font-bold text-primary transition-colors" onClick={() => { setFormData(prev => ({ ...prev, errorTypeId: err.id })); setIsErrorTypeDropdownOpen(false); }}>
                                                            {err.name}
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="p-3 border-t border-slate-100 bg-primary/5 flex items-center gap-2 min-w-0">
                                                    <input type="text" value={newErrorTypeName} onChange={(e) => setNewErrorTypeName(e.target.value)} placeholder="Nhập tên lỗi mới..." onClick={(e) => e.stopPropagation()} className="min-w-0 flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:border-primary/40 transition-all" />
                                                    <button
                                                        type="button"
                                                        aria-label="Thêm loại lỗi mới"
                                                        onClick={(e) => { e.stopPropagation(); handleAddErrorType(); }}
                                                        className="!h-10 !w-10 !min-w-10 !max-w-10 !p-0 !m-0 bg-primary text-white rounded-xl hover:bg-primary/90 shadow-lg shadow-primary/20 inline-flex items-center justify-center shrink-0 transition-all"
                                                    >
                                                        <Plus className="text-white" size={20} strokeWidth={2.25} aria-hidden />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Cấp độ lỗi */}
                                <div className="space-y-2">
                                    <label className="text-[14px] font-bold text-primary flex items-center gap-1.5"><AlertCircle className="w-4 h-4" />Cấp độ lỗi <span className="text-red-500">*</span></label>
                                    <div className="flex flex-wrap gap-2">
                                        {ERROR_LEVELS.map(level => (
                                            <button
                                                key={level.id}
                                                type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, errorLevel: level.id }))}
                                                className={clsx(
                                                    "px-4 py-2 rounded-xl text-[12px] font-bold transition-all border-2",
                                                    formData.errorLevel === level.id
                                                        ? `${level.color.replace('bg-', 'bg-').replace('text-', 'text-')} border-transparent shadow-md scale-105`
                                                        : "bg-white border-slate-100 text-slate-400 hover:border-slate-200 hover:text-slate-600"
                                                )}
                                            >
                                                {level.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Lỗi chi tiết (Long Text) */}
                                <div className="space-y-2">
                                    <label className="text-[14px] font-bold text-primary flex items-center gap-1.5"><Edit3 className="w-4 h-4" />Mô tả lỗi chi tiết</label>
                                    <textarea
                                        name="errorDetails" value={formData.errorDetails} onChange={handleChange} rows={4}
                                        placeholder="Mô tả cụ thể biểu hiện bệnh của máy, các mã lỗi hiển thị (nếu có)..."
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-3xl text-[14px] font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 transition-all placeholder:text-slate-400"
                                    />
                                </div>

                                {/* Upload ảnh lỗi */}
                                <div className="space-y-3">
                                    <label className="text-[14px] font-bold text-primary flex items-center gap-2"><ImageIcon className="w-4 h-4 text-primary/80" />Hình ảnh chi tiết báo lỗi</label>

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
                                            <div key={`nd-${idx}`} className="relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-primary/10 shadow-sm transition-transform hover:scale-105">
                                                <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-full object-cover" />
                                                <button type="button" onClick={() => setNewDetailFiles(prev => prev.filter((_, i) => i !== idx))} className="absolute top-1.5 right-1.5 p-1.5 bg-rose-600 text-white rounded-lg shadow-lg hover:bg-rose-700 transition-colors"><Trash2 size={12} /></button>
                                            </div>
                                        ))}

                                        {/* Upload Button */}
                                        <label className="w-24 h-24 flex flex-col items-center justify-center border-primary/20 rounded-2xl bg-primary/5 text-primary hover:bg-primary/10 hover:border-primary/40 cursor-pointer transition-all">
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
                        <div id="section-technical" className="scroll-mt-6 rounded-2xl border border-primary/10 bg-white p-4 sm:p-5 space-y-4 shadow-sm hover:shadow-md transition-shadow [&_label]:text-primary [&_label_svg]:text-primary/80">
                            <h4 className="flex items-center gap-2 text-[16px] !font-black !text-primary pb-2 border-b border-primary/10">
                                <Wrench className="w-4 h-4 text-primary/80" /> 3. Phân công & Xử lý
                            </h4>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[14px] font-bold text-primary flex items-center gap-1.5"><Wrench className="w-4 h-4 text-primary/80" />Nhân viên kỹ thuật</label>
                                    <div className="relative">
                                        <select name="technicianId" value={formData.technicianId} onChange={handleChange} className="w-full h-12 px-5 bg-slate-50 border border-slate-200 rounded-2xl text-[14px] font-semibold text-slate-800 appearance-none focus:border-primary/40 focus:ring-4 focus:ring-primary/10 outline-none hover:bg-white shadow-sm transition-all cursor-pointer">
                                            <option value="">-- Chọn kỹ thuật --</option>
                                            {techUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                        </select>
                                        <ChevronDown className="w-5 h-5 text-primary/60 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[14px] font-bold text-primary flex items-center gap-1.5"><User className="w-4 h-4 text-primary/80" />Nhân viên CSKH</label>
                                    <div className="relative">
                                        <select name="cskhId" value={formData.cskhId} onChange={handleChange} className="w-full h-12 px-5 bg-slate-50 border border-slate-200 rounded-2xl text-[14px] font-semibold text-slate-800 appearance-none focus:border-primary/40 focus:ring-4 focus:ring-primary/10 outline-none hover:bg-white shadow-sm transition-all cursor-pointer">
                                            <option value="">-- Chọn nhân viên CSKH --</option>
                                            {cskhUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                        </select>
                                        <ChevronDown className="w-5 h-5 text-primary/60 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[14px] font-bold text-primary flex items-center gap-1.5"><Activity className="w-4 h-4 text-primary/80" />Trạng thái phiếu</label>
                                    <div className="relative">
                                        <select
                                            name="status" value={formData.status} onChange={handleChange}
                                            className="w-full h-12 px-5 bg-slate-50 border border-slate-200 rounded-2xl text-[14px] font-semibold text-slate-800 appearance-none focus:border-primary/40 focus:ring-4 focus:ring-primary/10 outline-none hover:bg-white shadow-sm transition-all cursor-pointer"
                                        >
                                            {['Mới', 'Đang xử lý', 'Chờ linh kiện', 'Hoàn thành', 'Đã hủy'].map(s => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="w-5 h-5 text-primary/60 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[14px] font-bold text-primary flex items-center gap-1.5"><Activity className="w-4 h-4 text-primary/80" />Ngày dự kiến hoàn thành</label>
                                    <input
                                        type="date"
                                        name="expectedCompletionDate"
                                        value={formData.expectedCompletionDate}
                                        onChange={handleChange}
                                        className="w-full h-12 px-5 bg-emerald-50 border border-emerald-200 rounded-2xl text-[14px] font-bold text-emerald-800 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 outline-none hover:bg-white shadow-sm transition-all cursor-pointer"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[14px] font-bold text-primary flex items-center gap-1.5"><Edit3 className="w-4 h-4 text-primary/80" />Phản hồi từ kỹ thuật</label>
                                <textarea
                                    name="technicalFeedback" value={formData.technicalFeedback} onChange={handleChange} rows={2}
                                    placeholder="Ghi chú nội dung đã kiểm tra, phương án xử lý, linh kiện thay thế..."
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-[14px] font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 transition-all placeholder:text-slate-400"
                                />
                            </div>

                            {/* Section: Ảnh kỹ thuật */}
                            <div className="space-y-3">
                                <label className="text-[14px] font-bold text-primary flex items-center gap-1.5"><ImageIcon className="w-4 h-4 text-primary/80" />Hình ảnh xử lý kỹ thuật</label>
                                <div className="flex flex-wrap gap-4">
                                    {formData.technicalImages.map((img, idx) => (
                                        <div key={`ot-${idx}`} className="relative w-24 h-24 rounded-2xl overflow-hidden border border-slate-100 shadow-sm transition-transform hover:scale-105">
                                            <img src={img} alt="tech" className="w-full h-full object-cover" />
                                            <button type="button" onClick={() => removeImage('tech', idx)} className="absolute top-1.5 right-1.5 p-1.5 bg-rose-600 text-white rounded-lg shadow-lg hover:bg-rose-700 transition-colors"><Trash2 size={12} /></button>
                                        </div>
                                    ))}
                                    {newTechFiles.map((file, idx) => (
                                        <div key={`nt-${idx}`} className="relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-primary/20 shadow-sm transition-transform hover:scale-105">
                                            <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-full object-cover" />
                                            <button type="button" onClick={() => setNewTechFiles(prev => prev.filter((_, i) => i !== idx))} className="absolute top-1.5 right-1.5 p-1.5 bg-rose-600 text-white rounded-lg shadow-lg hover:bg-rose-700 transition-colors"><Trash2 size={12} /></button>
                                        </div>
                                    ))}
                                    <label className="w-24 h-24 flex flex-col items-center justify-center border-2 border-dashed border-primary/20 rounded-2xl bg-primary/5 text-primary/60 hover:border-primary/40 hover:text-primary cursor-pointer transition-all">
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
            <div className="px-4 py-2.5 bg-white border-t border-slate-200 shrink-0 flex items-center justify-end gap-3 sticky bottom-0 z-40">
                <button
                    type="button"
                    onClick={handleClose}
                    className="px-5 py-2.5 rounded-xl border border-slate-300 bg-slate-100 text-slate-500 hover:text-slate-700 font-semibold text-[15px] transition-colors outline-none"
                    disabled={isLoading}
                >
                    Hủy
                </button>
                <button
                    type="submit"
                    form="ticketForm"
                    disabled={isLoading}
                    className="px-6 py-2 bg-primary hover:bg-primary/90 text-white text-[15px] font-bold rounded-xl shadow-md shadow-primary/20 transition-all flex items-center gap-2 border border-primary/40 disabled:opacity-50 disabled:cursor-not-allowed"
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

    return createPortal(
        <div className={clsx(
            "fixed inset-0 z-[100005] flex justify-end transition-all duration-300",
            isClosing ? "opacity-0 pointer-events-none" : "opacity-100"
        )}>
            {/* Backdrop */}
            <div
                className={clsx(
                    "absolute inset-0 bg-black/45 backdrop-blur-sm animate-in fade-in duration-300",
                    isClosing && "animate-out fade-out duration-300"
                )}
                onClick={handleClose}
            />

            {/* Panel */}
            <div
                className={clsx(
                    "relative bg-slate-50 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col h-full border-l border-slate-200 animate-in slide-in-from-right duration-500",
                    isClosing && "animate-out slide-out-to-right duration-300"
                )}
                onClick={(e) => e.stopPropagation()}
            >
                {content}
            </div>
        </div>,
        document.body
    );
}
