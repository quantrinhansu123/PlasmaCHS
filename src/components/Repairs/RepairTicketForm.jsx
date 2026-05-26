import { clsx } from 'clsx';
import { Activity, AlertCircle, Camera, ChevronDown, Edit3, HeartPulse, Image as ImageIcon, MapPin, Save, Search, Ticket, Trash2, User, Wrench, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-toastify';
import { ERROR_LEVELS } from '../../constants/repairConstants';
import usePermissions from '../../hooks/usePermissions';
import { supabase } from '../../supabase/config';
import { notificationService } from '../../utils/notificationService';
import {
    appendRepairTicketImageFiles,
    normalizeRepairTicketImages,
    uploadRepairTicketImages,
} from '../../utils/repairTicketImages';
import RepairTicketImageThumb from './RepairTicketImageThumb';
import { fetchCustomerOwnedDevices } from '../../utils/customerOwnedDevices';
import { appendCustomerTextSearch, CUSTOMER_PICKER_FIELDS } from '../../utils/customerTextSearch';

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

    // Custom dropdown state for Device (Unified)
    const [isMachineDropdownOpen, setIsMachineDropdownOpen] = useState(false); // Renamed internally to Device later
    const [machineSearchTerm, setMachineSearchTerm] = useState('');
    const machineDropdownRef = useRef(null);
    const customersRef = useRef(customers);
    useEffect(() => { customersRef.current = customers; }, [customers]);

    const normalizeCustomerText = (value) =>
        String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();

    const getCustomerRepName = (customer) => String(customer?.legal_rep || '').trim();

    const getCustomerFacilityName = (customer) => String(customer?.name || '').trim();

    const formatCustomerLabel = (customer) => {
        if (!customer) return 'Chọn khách hàng...';
        const facility = getCustomerFacilityName(customer);
        const rep = getCustomerRepName(customer);
        if (facility && rep) return `${facility} · ${rep}`;
        return facility || rep || 'Chọn khách hàng...';
    };

    const customerMatchesSearch = (customer, rawTerm) => {
        const term = normalizeCustomerText(rawTerm);
        if (!term) return true;
        const haystack = [
            getCustomerFacilityName(customer),
            getCustomerRepName(customer),
            customer?.phone,
            customer?.address,
            customer?.invoice_company_name,
            customer?.agency_name,
            customer?.code,
        ]
            .filter(Boolean)
            .map(normalizeCustomerText)
            .join(' ');
        return haystack.includes(term);
    };

    const mergeCustomerPickerList = useCallback((incoming, keepId) => {
        const map = new Map();
        (incoming || []).forEach((c) => {
            if (c?.id) map.set(c.id, c);
        });
        if (keepId) {
            const existing = customersRef.current.find((c) => c.id === keepId);
            if (existing && !map.has(keepId)) map.set(keepId, existing);
        }
        return [...map.values()].sort((a, b) =>
            String(a.name || '').localeCompare(String(b.name || ''), 'vi', { sensitivity: 'base' }),
        );
    }, []);

    const fetchCustomersForPicker = async (searchTerm) => {
        const trimmed = String(searchTerm || '').trim();
        let query = supabase
            .from('customers')
            .select(CUSTOMER_PICKER_FIELDS)
            .order('name', { ascending: true })
            .limit(trimmed ? 100 : 400);
        query = appendCustomerTextSearch(query, trimmed);
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    };

    const ERROR_DEVICE_CATEGORIES = ['Máy', 'Bình', 'Nâng cấp'];

    const deviceMatchesErrorCategory = (device, category) => {
        if (!category || category === 'Nâng cấp') return false;
        if (category === 'Máy') return device?.category === 'Máy';
        if (category === 'Bình') return device?.category === 'Bình';
        return true;
    };

    // Close dropdowns on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target)) setIsCustomerDropdownOpen(false);
            if (machineDropdownRef.current && !machineDropdownRef.current.contains(event.target)) setIsMachineDropdownOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const defaultState = {
        customerId: '',
        machineSerial: '',
        machineName: '',
        errorTypeName: '',
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
    const techFileInputRef = useRef(null);

    useEffect(() => {
        fetchMasterData();
    }, []);

    useEffect(() => {
        if (isEdit && ticket) {
            setFormData({
                customerId: ticket.customer_id || '',
                machineSerial: ticket.machine_serial || '',
                machineName: ticket.machine_name || '',
                errorTypeName: '',
                errorDetails: ticket.error_details || '',
                detailImages: normalizeRepairTicketImages(ticket.error_images),
                salesId: ticket.sales_id || '',
                technicianId: ticket.technician_id || '',
                cskhId: ticket.cskh_id || ticket.created_by || '',
                technicalFeedback: ticket.technical_feedback || '',
                technicalImages: normalizeRepairTicketImages(ticket.technical_images),
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
        if (!isEdit || !ticket?.error_type_id || errorTypes.length === 0) return;
        const match = errorTypes.find((e) => e.id === ticket.error_type_id);
        if (match?.name) {
            setFormData((prev) => (prev.errorTypeName ? prev : { ...prev, errorTypeName: match.name }));
        }
    }, [isEdit, ticket, errorTypes]);

    const fetchMasterData = async () => {
        setIsFetchingData(true);
        try {
            const custData = await fetchCustomersForPicker('');
            let list = custData;
            if (
                initialCustomer?.id &&
                !custData.some((c) => c.id === initialCustomer.id)
            ) {
                list = [initialCustomer, ...custData];
            }
            setCustomers(
                mergeCustomerPickerList(
                    list,
                    formData.customerId || initialCustomer?.id || ticket?.customer_id,
                ),
            );

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

    useEffect(() => {
        if (!isCustomerDropdownOpen) return undefined;
        let cancelled = false;
        const timer = setTimeout(async () => {
            try {
                const list = await fetchCustomersForPicker(customerSearchTerm);
                if (!cancelled) {
                    setCustomers(mergeCustomerPickerList(list, formData.customerId));
                }
            } catch (err) {
                console.error('Lỗi tìm khách hàng:', err);
                if (!cancelled) {
                    toast.error('Không tải được danh sách cơ sở. Thử tìm lại hoặc kiểm tra kết nối.', {
                        position: 'top-center',
                    });
                }
            }
        }, 280);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [customerSearchTerm, isCustomerDropdownOpen, formData.customerId]);

    useEffect(() => {
        if (!formData.customerId || customers.length === 0) return;
        const customer = customers.find((item) => item.id === formData.customerId);
        if (customer) fetchCustomerDevices(customer);
    }, [formData.customerId, customers]);

    const fetchCustomerDevices = async (customer) => {
        if (!customer?.id && !customer?.name) {
            setAvailableDevices([]);
            return;
        }

        setIsFetchingDevices(true);
        try {
            const devices = await fetchCustomerOwnedDevices(supabase, customer);
            setAvailableDevices(devices);
        } catch (err) {
            console.error('Lỗi tải thiết bị của khách hàng:', err);
            setAvailableDevices([]);
        } finally {
            setIsFetchingDevices(false);
        }
    };

    const fetchAnyDeviceBySerial = async (serialPart) => {
        const customer = customersRef.current.find((item) => item.id === formData.customerId);
        if (!customer || !serialPart || serialPart.length < 2) return;

        setIsFetchingDevices(true);
        try {
            const all = await fetchCustomerOwnedDevices(supabase, customer);
            const query = serialPart.trim().toLowerCase();
            const filtered = all.filter(
                (device) =>
                    device.serial_number.toLowerCase().includes(query) ||
                    String(device.name || '').toLowerCase().includes(query) ||
                    String(device.site || '').toLowerCase().includes(query),
            );
            setAvailableDevices(filtered.length > 0 ? filtered : all);
        } catch (err) {
            console.error('Lỗi tìm kiếm thiết bị của khách hàng:', err);
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
        setAvailableDevices([]);
        fetchCustomerDevices(customer);
    };

    const cFilteredCustomers = customers.filter((c) => customerMatchesSearch(c, customerSearchTerm));

    // Device Dropdown logic
    const handleErrorCategorySelect = (cat) => {
        setFormData((prev) => {
            const selected = availableDevices.find((d) => d.serial_number === prev.machineSerial);
            const mustClearDevice = selected && !deviceMatchesErrorCategory(selected, cat);
            return {
                ...prev,
                errorCategory: cat,
                ...(mustClearDevice ? { machineSerial: '', machineName: '' } : {}),
            };
        });
        setIsMachineDropdownOpen(false);
        setMachineSearchTerm('');
    };

    const handleMachineSelect = (m) => {
        if (!deviceMatchesErrorCategory(m, formData.errorCategory)) return;
        setFormData((prev) => ({
            ...prev,
            machineSerial: m.serial_number,
            machineName: m.name,
            errorCategory: m.category || prev.errorCategory,
        }));
        setIsMachineDropdownOpen(false);
        setMachineSearchTerm('');
        toast.success(`Đã chọn: ${m.serial_number}`, { autoClose: 1000, position: 'top-center' });
    };

    const mFilteredMachines = availableDevices.filter((device) => {
        if (!deviceMatchesErrorCategory(device, formData.errorCategory)) return false;
        const query = machineSearchTerm.trim().toLowerCase();
        if (!query) return true;
        return (
            device.serial_number.toLowerCase().includes(query)
            || String(device.name || '').toLowerCase().includes(query)
            || String(device.site || '').toLowerCase().includes(query)
        );
    });

    const deviceSerialLabel =
        formData.errorCategory === 'Bình' ? 'Mã bình' : formData.errorCategory === 'Máy' ? 'Mã máy' : 'Mã thiết bị';

    const deviceSearchPlaceholder =
        formData.errorCategory === 'Bình'
            ? 'Tìm mã hoặc tên bình...'
            : formData.errorCategory === 'Máy'
              ? 'Tìm mã hoặc tên máy...'
              : 'Tìm mã thiết bị...';

    const resolveErrorTypeId = async (name) => {
        const trimmed = String(name || '').trim();
        if (!trimmed) return null;

        const normalized = normalizeCustomerText(trimmed);
        const existing = errorTypes.find((e) => normalizeCustomerText(e.name) === normalized);
        if (existing) return existing.id;

        const { data, error } = await supabase
            .from('repair_error_types')
            .insert([{ name: trimmed }])
            .select('id, name')
            .single();

        if (error) {
            if (error.code === '23505') {
                const { data: dup } = await supabase
                    .from('repair_error_types')
                    .select('id, name')
                    .ilike('name', trimmed)
                    .maybeSingle();
                if (dup?.id) return dup.id;
            }
            throw error;
        }

        if (data) {
            setErrorTypes((prev) =>
                [...prev, data].sort((a, b) => a.name.localeCompare(b.name, 'vi', { sensitivity: 'base' }))
            );
            return data.id;
        }
        return null;
    };

    const uploadSelectedImages = async (files, folder) => {
        const { urls, failures, fallbackWarnings } = await uploadRepairTicketImages(files, { folder });
        if (fallbackWarnings.length > 0) {
            toast.warn(
                `Bucket ảnh chưa sẵn sàng. Đã lưu ${fallbackWarnings.length} ảnh dạng tạm để tiếp tục.`,
            );
        }
        if (failures.length > 0) {
            toast.warn(`Chỉ tải được ${urls.length}/${files.length} ảnh.`);
        }
        if (urls.length === 0 && files.length > 0) {
            const firstError = failures[0]?.error;
            throw new Error(firstError?.message || 'Không tải được ảnh nào. Vui lòng thử lại.');
        }
        return urls;
    };

    const handleTechImageSelect = (fileList) => {
        if (!fileList?.length) return;
        setNewTechFiles((prev) => appendRepairTicketImageFiles(prev, fileList));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');

        if (!formData.errorCategory) {
            setErrorMsg('Vui lòng chọn loại lỗi (Máy / Bình / Nâng cấp).');
            return;
        }
        if (!formData.errorTypeName.trim()) {
            setErrorMsg('Vui lòng nhập loại lỗi.');
            return;
        }
        if (!formData.customerId || !formData.machineSerial) {
            setErrorMsg('Vui lòng chọn khách hàng và mã thiết bị.');
            return;
        }

        setIsLoading(true);

        try {
            const errorTypeId = await resolveErrorTypeId(formData.errorTypeName);

            // Upload selected files
            let newDetailImgUrls = formData.detailImages;
            if (newDetailFiles.length > 0) {
                const urls = await uploadSelectedImages(
                    newDetailFiles,
                    `error/${ticket?.id || 'new'}`
                );
                newDetailImgUrls = [...newDetailImgUrls, ...urls];
            }

            let newTechImgUrls = formData.technicalImages;
            if (newTechFiles.length > 0) {
                const urls = await uploadSelectedImages(
                    newTechFiles,
                    `technical/${ticket?.id || 'new'}`
                );
                newTechImgUrls = [...newTechImgUrls, ...urls];
            }

            const payload = {
                customer_id: formData.customerId,
                machine_serial: formData.machineSerial,
                machine_name: formData.machineName,
                error_type_id: errorTypeId,
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

                toast.success('Gửi yêu cầu sửa chữa thành công');
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

                            <div className="space-y-2 pb-1">
                                <label className="flex items-center gap-1.5 text-[14px] font-bold text-primary">
                                    <Activity className="w-4 h-4 text-primary/80" />
                                    Tên lỗi (Máy/Bình/Nâng cấp) <span className="text-red-500">*</span>
                                </label>
                                <div className="flex flex-wrap gap-3">
                                    {ERROR_DEVICE_CATEGORIES.map((cat) => (
                                        <button
                                            key={cat}
                                            type="button"
                                            onClick={() => handleErrorCategorySelect(cat)}
                                            className={clsx(
                                                'px-5 py-2 rounded-2xl text-[14px] font-bold transition-all border-2',
                                                formData.errorCategory === cat
                                                    ? 'bg-primary border-primary text-white shadow-md shadow-primary/20'
                                                    : 'bg-white border-slate-200 text-slate-500 hover:border-primary/40 hover:text-primary'
                                            )}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                    {!ERROR_DEVICE_CATEGORIES.includes(formData.errorCategory) && formData.errorCategory ? (
                                        <div className="px-5 py-2 rounded-2xl text-[14px] font-bold bg-primary border-2 border-primary text-white">
                                            {formData.errorCategory}
                                        </div>
                                    ) : null}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {/* Khách hàng */}
                                <div className="space-y-2">
                                    <label className="flex items-center gap-1.5 text-[14px] font-bold text-primary"><Search className="w-4 h-4 text-primary/80" />Khách hàng / Cơ sở <span className="text-red-500">*</span></label>
                                    <div className="relative" ref={customerDropdownRef}>
                                        <div
                                            className={`w-full h-12 px-5 border rounded-2xl text-[14px] transition-all cursor-pointer flex justify-between items-center ${isFetchingData ? 'bg-slate-50 text-slate-400 border-slate-200' : 'bg-slate-50 border-slate-200 text-slate-900 hover:border-primary/40 hover:bg-white shadow-sm font-semibold'}`}
                                            onClick={() => !isFetchingData && setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
                                        >
                                            <span className="truncate">
                                                {formData.customerId
                                                    ? formatCustomerLabel(customers.find((c) => c.id === formData.customerId))
                                                    : 'Chọn khách hàng...'}
                                            </span>
                                            <ChevronDown className="w-5 h-5 text-primary/60" />
                                        </div>
                                        {isCustomerDropdownOpen && !isFetchingData && (
                                            <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 shadow-2xl max-h-64 overflow-hidden flex flex-col rounded-2xl animate-in fade-in zoom-in-95 duration-200">
                                                <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center gap-3 sticky top-0 z-10">
                                                    <Search className="w-4 h-4 text-primary/40" />
                                                    <input
                                                        type="text" className="w-full bg-transparent border-none outline-none text-[14px] font-bold placeholder-slate-400" placeholder="Tìm tên cơ sở (BV, PK...), đại diện, SĐT..."
                                                        value={customerSearchTerm} onChange={(e) => setCustomerSearchTerm(e.target.value)} onClick={(e) => e.stopPropagation()} autoFocus
                                                    />
                                                </div>
                                                <div className="overflow-y-auto custom-scrollbar flex-1 py-1">
                                                    {cFilteredCustomers.length > 0 ? cFilteredCustomers.map(customer => (
                                                        <div key={customer.id} className="px-5 py-3.5 cursor-pointer border-b border-slate-50 hover:bg-primary/5 transition-colors group" onClick={() => handleCustomerSelect(customer)}>
                                                            <div className="font-bold text-[14px] text-slate-800 group-hover:text-primary truncate">
                                                                {getCustomerFacilityName(customer) || '—'}
                                                            </div>
                                                            <div className="text-[12px] text-slate-400 font-semibold truncate">
                                                                {[
                                                                    getCustomerRepName(customer)
                                                                        ? `Đại diện: ${getCustomerRepName(customer)}`
                                                                        : null,
                                                                    customer.phone,
                                                                ].filter(Boolean).join(' · ') || 'Chưa cập nhật SĐT / đại diện'}
                                                            </div>
                                                        </div>
                                                    )) : (
                                                        <div className="px-5 py-6 text-center text-sm text-slate-500 font-semibold italic">
                                                            {customerSearchTerm.trim()
                                                                ? 'Không tìm thấy cơ sở phù hợp — thử tên BV, phòng khám hoặc SĐT'
                                                                : 'Gõ tên cơ sở, người đại diện hoặc SĐT để tìm'}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Mã thiết bị */}
                                <div className="space-y-2">
                                    <label className="flex items-center gap-1.5 text-[14px] font-bold text-primary"><MapPin className="w-4 h-4 text-primary/80" />{deviceSerialLabel} <span className="text-red-500">*</span></label>
                                    <div className="relative" ref={machineDropdownRef}>
                                        <div
                                            className={clsx(
                                                'w-full h-12 px-5 border rounded-2xl text-[14px] transition-all flex justify-between items-center',
                                                !formData.errorCategory || formData.errorCategory === 'Nâng cấp' || !formData.customerId
                                                    ? 'bg-slate-50 border-slate-200 text-slate-400 font-medium cursor-not-allowed'
                                                    : 'bg-slate-50 border-slate-200 text-slate-900 hover:border-primary/40 hover:bg-white shadow-sm font-semibold cursor-pointer'
                                            )}
                                            onClick={() => {
                                                if (!formData.errorCategory) {
                                                    toast.info('Vui lòng chọn loại lỗi (Máy/Bình) trước', { position: 'top-center' });
                                                    return;
                                                }
                                                if (formData.errorCategory === 'Nâng cấp') {
                                                    toast.info('Nâng cấp không chọn mã từ danh sách máy/bình', { position: 'top-center' });
                                                    return;
                                                }
                                                if (!formData.customerId) {
                                                    toast.info('Vui lòng chọn khách hàng trước', { position: 'top-center' });
                                                    return;
                                                }
                                                setIsMachineDropdownOpen(!isMachineDropdownOpen);
                                            }}
                                        >
                                            <span className="flex items-center gap-2">
                                                {isFetchingDevices && <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>}
                                                {formData.machineSerial || `-- Chọn ${deviceSerialLabel.toLowerCase()} --`}
                                            </span>
                                            <ChevronDown className="w-5 h-5 text-primary/60" />
                                        </div>

                                        {isMachineDropdownOpen && formData.errorCategory && formData.errorCategory !== 'Nâng cấp' && (
                                            <div className="absolute z-50 w-full mt-2 top-full bg-white border border-slate-200 shadow-2xl max-h-64 overflow-hidden flex flex-col rounded-2xl animate-in fade-in zoom-in-95 duration-200">
                                                <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center gap-3 sticky top-0 z-10">
                                                    <Search className="w-4 h-4 text-primary/40" />
                                                    <div className="flex-1 flex items-center gap-2">
                                                        <input
                                                            type="text" className="w-full bg-transparent border-none outline-none text-[14px] font-bold placeholder-slate-400" placeholder={deviceSearchPlaceholder}
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
                                                                Tìm trong khách hàng
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="overflow-y-auto custom-scrollbar flex-1 py-1">
                                                    {mFilteredMachines.length > 0 ? mFilteredMachines.map(m => (
                                                        <div key={m.serial_number} className="px-5 py-3.5 cursor-pointer border-b border-slate-100 hover:bg-primary/5 transition-colors group" onClick={() => handleMachineSelect(m)}>
                                                            <div className="font-black text-[14px] text-slate-800 group-hover:text-primary">{m.serial_number}</div>
                                                            <div className="text-[12px] text-primary font-bold">{m.name}</div>
                                                            {m.site ? (
                                                                <div className="text-[11px] text-slate-500 font-semibold">{m.site}</div>
                                                            ) : null}
                                                        </div>
                                                    )) : (
                                                        <div className="px-5 py-6 text-center">
                                                            <p className="text-sm text-slate-500 font-semibold italic mb-2">
                                                                {formData.errorCategory === 'Máy'
                                                                    ? 'Không có máy nào của khách hàng / cơ sở này'
                                                                    : formData.errorCategory === 'Bình'
                                                                      ? 'Không có bình nào của khách hàng / cơ sở này'
                                                                      : 'Không tìm thấy thiết bị'}
                                                            </p>
                                                            {machineSearchTerm.length >= 2 && formData.errorCategory !== 'Nâng cấp' && (
                                                                <button 
                                                                    type="button"
                                                                    onClick={(e) => { e.stopPropagation(); fetchAnyDeviceBySerial(machineSearchTerm); }}
                                                                    className="text-xs font-black text-primary hover:underline"
                                                                >
                                                                    Thử tìm lại trong danh sách thiết bị của khách hàng?
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

                        {/* Section 2: Tình trạng lỗi */}
                        <div id="section-error" className="scroll-mt-6 rounded-2xl border border-primary/10 bg-white p-4 sm:p-5 space-y-4 shadow-sm hover:shadow-md transition-shadow [&_label]:text-primary [&_label_svg]:text-primary/80">
                            <h4 className="flex items-center gap-2 text-[16px] !font-black !text-primary pb-2 border-b border-primary/10">
                                <HeartPulse className="w-4 h-4 text-primary/80" /> 2. Tình trạng lỗi & Báo cáo
                            </h4>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[14px] font-bold text-primary flex items-center gap-1.5">
                                        <Activity className="w-4 h-4" />
                                        Loại lỗi <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            name="errorTypeName"
                                            value={formData.errorTypeName}
                                            onChange={handleChange}
                                            placeholder="Nhập loại lỗi..."
                                            className="w-full h-12 px-5 pr-10 border bg-white border-slate-200 rounded-2xl text-[14px] font-semibold text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                                        />
                                        {formData.errorTypeName ? (
                                            <button
                                                type="button"
                                                onClick={() => setFormData((prev) => ({ ...prev, errorTypeName: '' }))}
                                                className="!absolute !right-2 !top-1/2 !-translate-y-1/2 !h-8 !w-8 !min-h-0 !min-w-0 !p-0 !rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 inline-flex items-center justify-center"
                                                title="Xóa"
                                                aria-label="Xóa loại lỗi"
                                            >
                                                <X size={16} />
                                            </button>
                                        ) : null}
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
                                            <RepairTicketImageThumb
                                                key={`od-${idx}`}
                                                src={img}
                                                alt={`Chi tiết ${idx + 1}`}
                                                className="h-24 w-24 rounded-2xl border border-slate-100 shadow-sm transition-transform hover:scale-105"
                                                onRemove={() => removeImage('detail', idx)}
                                            />
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
                                                if (e.target.files?.length) {
                                                    setNewDetailFiles((prev) => appendRepairTicketImageFiles(prev, e.target.files));
                                                }
                                                e.target.value = '';
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
                                        <RepairTicketImageThumb
                                            key={`ot-${idx}`}
                                            src={img}
                                            alt={`Kỹ thuật ${idx + 1}`}
                                            className="h-24 w-24 rounded-2xl border border-slate-100 shadow-sm transition-transform hover:scale-105"
                                            onRemove={() => removeImage('tech', idx)}
                                        />
                                    ))}
                                    {newTechFiles.map((file, idx) => (
                                        <div key={`nt-${idx}`} className="relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-primary/20 shadow-sm transition-transform hover:scale-105">
                                            <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-full object-cover" />
                                            <button type="button" onClick={() => setNewTechFiles(prev => prev.filter((_, i) => i !== idx))} className="absolute top-1.5 right-1.5 p-1.5 bg-rose-600 text-white rounded-lg shadow-lg hover:bg-rose-700 transition-colors"><Trash2 size={12} /></button>
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => techFileInputRef.current?.click()}
                                        className="w-24 h-24 flex flex-col items-center justify-center border-2 border-dashed border-primary/20 rounded-2xl bg-primary/5 text-primary/60 hover:border-primary/40 hover:text-primary cursor-pointer transition-all"
                                    >
                                        <Camera size={24} />
                                        <span className="text-[11px] font-black mt-2 uppercase">Thêm ảnh</span>
                                    </button>
                                    <input
                                        ref={techFileInputRef}
                                        type="file"
                                        multiple
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                            handleTechImageSelect(e.target.files);
                                            e.target.value = '';
                                        }}
                                    />
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
