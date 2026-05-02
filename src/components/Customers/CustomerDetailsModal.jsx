import {
    Activity,
    ArrowDownRight,
    ArrowUpRight,
    CreditCard,
    Cpu,
    Droplets,
    DollarSign,
    FileText,
    History,
    ImageIcon,
    MapPin,
    Package,
    Phone,
    Upload,
    UserCircle,
    X,
    Receipt,
    Mail,
    Building,
    Download,
    Edit,
    Trash2,
    MoreVertical,
    ChevronDown,
    ChevronRight,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { supabase } from '../../supabase/config';
import { getCustomerIdsForCareHistory } from '../../utils/customerCareHistory';
import {
    isOrderDeliveredCompleted,
    MACHINE_STATUSES_ENRICH_CUSTOMER_FROM_ORDERS,
    normalizeMachineSerialKey,
} from '../../utils/machineCustomerFromOrders';
import { collectMachineSerialsForOrder } from '../../utils/orderMachineSerials';
import * as XLSX from 'xlsx';

function escapeIlikeOrFragment(text) {
    return String(text || '')
        .replace(/\\/g, '\\\\')
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_')
        .replace(/,/g, '');
}

function chunkArray(arr, chunkSize) {
    const out = [];
    for (let i = 0; i < arr.length; i += chunkSize) out.push(arr.slice(i, i + chunkSize));
    return out;
}

function isCylinderProductType(productType) {
    const u = String(productType || '').trim().toUpperCase();
    if (!u) return false;
    return u.includes('BINH');
}

const CYLINDER_STATUSES_AT_CUSTOMER = new Set(['thuộc khách hàng', 'đang sử dụng']);

/** Biến thể để match `machines.serial_number` trong DB (.in phân biệt hoa thường). */
function serialVariantsForMachinesLookup(serialRaw) {
    const t = String(serialRaw || '').trim();
    if (!t) return [];
    const collapsed = t.replace(/\s+/g, '');
    return [
        ...new Set([
            t,
            collapsed,
            t.toUpperCase(),
            t.toLowerCase(),
            collapsed.toUpperCase(),
            collapsed.toLowerCase(),
        ]),
    ].filter(Boolean);
}

/** Chuẩn hóa số máy chủ Việt Nam để ghép đơn theo recipient_phone. */
function phoneDigitsForPhoneMatch(phone) {
    let d = String(phone || '').replace(/\D/g, '');
    if (!d || d.length < 9) return '';
    if (d.startsWith('84')) {
        d = `0${d.slice(2)}`;
    }
    return d.slice(-11);
}

/** Gợi ý serial từ cột khách machines_in_use (text / JSON đơn giản / comma). */
function machineSerialHintsFromCustomerRecord(cust) {
    const raw = cust?.machines_in_use;
    if (raw == null || raw === '') return [];
    if (typeof raw === 'number') return [String(raw)];
    let s = String(raw).trim();
    if (!s) return [];
    try {
        const j = JSON.parse(s);
        if (Array.isArray(j)) return j.map((x) => String(x).trim()).filter(Boolean);
        if (j && typeof j === 'object') {
            const arr = j.serials || j.machines || j.serial_numbers;
            if (Array.isArray(arr)) return arr.map((x) => String(x).trim()).filter(Boolean);
        }
    } catch {
        /* not JSON */
    }
    return s.split(/[\n,;/|]+/).map((x) => String(x).trim()).filter(Boolean);
}

export default function CustomerDetailsModal({ customer, onClose, hideCommerceTabs = false }) {
    const [activeTab, setActiveTab] = useState('overview'); // overview, assets_history, care_history, …
    const [loading, setLoading] = useState(true);
    const [isClosing, setIsClosing] = useState(false);

    const handleClose = useCallback(() => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
        }, 300);
    }, [onClose]);

    const [orders, setOrders] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [cylinders, setCylinders] = useState([]);
    const [careHistory, setCareHistory] = useState([]);
    const [careHistoryCount, setCareHistoryCount] = useState(0);

    // States for Payment Form
    const [showPaymentForm, setShowPaymentForm] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [paymentMethod, setPaymentMethod] = useState('CHUYEN_KHOAN');
    const [paymentNote, setPaymentNote] = useState('');
    const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
    const [billImageFile, setBillImageFile] = useState(null);
    const [previewImage, setPreviewImage] = useState(null);

    // Edit Transaction States
    const [editingTxId, setEditingTxId] = useState(null);
    const [editingTxCode, setEditingTxCode] = useState('');

    const [stats, setStats] = useState({
        totalOrderValue: 0,
        totalPaid: 0,
        currentDebt: 0
    });

    const defaultMachineRange = () => {
        const to = new Date();
        const from = new Date();
        from.setMonth(from.getMonth() - 3);
        return { from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0] };
    };
    const [machineRange, setMachineRange] = useState(defaultMachineRange);
    const [customerMachines, setCustomerMachines] = useState([]);
    const [customerCylinders, setCustomerCylinders] = useState([]);
    const [machineLogs, setMachineLogs] = useState([]);
    const [machinesHistoryLoading, setMachinesHistoryLoading] = useState(false);
    const [expandedMachineSerial, setExpandedMachineSerial] = useState(null);
    const [expandedCylinderSerial, setExpandedCylinderSerial] = useState(null);

    const logsByNormSerial = useMemo(() => {
        const map = new Map();
        (machineLogs || []).forEach((row) => {
            const sn = String(row?.serial_number || '').trim();
            if (!sn) return;
            const nk = normalizeMachineSerialKey(sn);
            if (!map.has(nk)) map.set(nk, []);
            map.get(nk).push(row);
        });
        return map;
    }, [machineLogs]);

    const logsForAssetSerial = (serial) =>
        logsByNormSerial.get(normalizeMachineSerialKey(serial)) || [];

    useEffect(() => {
        if (!customer) return;
        fetchCustomerData();
    }, [customer]);

    useEffect(() => {
        if (!customer || activeTab !== 'assets_history') return undefined;
        const nameTrim = String(customer.name || '').trim();
        const custId = customer.id;
        if (!custId && !nameTrim) return undefined;

        let cancelled = false;

        (async () => {
            setMachinesHistoryLoading(true);
            try {
                const machinesById = new Map();
                const cylindersById = new Map();
                const rawMachineSerialsFromOrders = new Set();
                const machineSerialNormFromOrders = new Set();
                const cylinderSerialRawFromOrders = new Set();
                const orderMap = new Map();

                const mergeOrderRow = (o) => {
                    if (!o?.id || orderMap.has(o.id)) return;
                    orderMap.set(o.id, o);
                };

                const addMachineHints = (serialRaw) => {
                    const base = String(serialRaw || '').trim();
                    if (!base) return;
                    serialVariantsForMachinesLookup(base).forEach((v) => rawMachineSerialsFromOrders.add(v));
                    machineSerialNormFromOrders.add(normalizeMachineSerialKey(base));
                };

                const orderSelect =
                    'id, status, department, note, delivery_checklist, customer_name, recipient_name, recipient_phone';
                if (custId) {
                    const { data: o1, error: e1 } = await supabase
                        .from('orders')
                        .select(orderSelect)
                        .eq('customer_id', custId);
                    if (e1) throw e1;
                    (o1 || []).forEach((o) => mergeOrderRow(o));
                }
                if (nameTrim) {
                    const { data: o2 } = await supabase
                        .from('orders')
                        .select(orderSelect)
                        .eq('customer_name', nameTrim);
                    (o2 || []).forEach((o) => mergeOrderRow(o));
                    if (nameTrim.length >= 3) {
                        const escRn = escapeIlikeOrFragment(nameTrim);
                        const { data: oRn } = await supabase
                            .from('orders')
                            .select(orderSelect)
                            .ilike('recipient_name', `%${escRn}%`);
                        (oRn || []).forEach((o) => mergeOrderRow(o));
                    }
                    const invoiceName = String(customer?.invoice_company_name || '').trim();
                    if (invoiceName.length >= 3 && invoiceName !== nameTrim) {
                        const escInv = escapeIlikeOrFragment(invoiceName);
                        const { data: oInv } = await supabase
                            .from('orders')
                            .select(orderSelect)
                            .ilike('customer_name', `%${escInv}%`);
                        (oInv || []).forEach((o) => mergeOrderRow(o));
                    }
                }

                const phoneCore = phoneDigitsForPhoneMatch(customer?.phone);
                if (phoneCore) {
                    const { data: oPh } = await supabase
                        .from('orders')
                        .select(orderSelect)
                        .ilike('recipient_phone', `%${phoneCore}%`);
                    (oPh || []).forEach((o) => mergeOrderRow(o));
                }

                for (const hint of machineSerialHintsFromCustomerRecord(customer)) addMachineHints(hint);

                const completedOrderIds = [...orderMap.values()]
                    .filter((o) => isOrderDeliveredCompleted(o.status))
                    .map((o) => o.id);

                const allOrderIds = [...orderMap.keys()];
                const itemsByOrderId = new Map();

                for (const part of chunkArray(allOrderIds, 100)) {
                    if (part.length === 0 || cancelled) continue;
                    const { data: items, error: ei } = await supabase
                        .from('order_items')
                        .select('order_id, serial_number, product_type')
                        .in('order_id', part);
                    if (ei) {
                        console.warn('order_items fetch', ei);
                        continue;
                    }
                    for (const it of items || []) {
                        const oid = it.order_id;
                        if (!oid) continue;
                        if (!itemsByOrderId.has(oid)) itemsByOrderId.set(oid, []);
                        itemsByOrderId.get(oid).push(it);
                    }
                }

                const checklistForOrder = (o) => {
                    const raw = o?.delivery_checklist;
                    if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
                    if (typeof raw === 'string' && raw.trim()) {
                        try {
                            const parsed = JSON.parse(raw);
                            if (parsed && typeof parsed === 'object') return parsed;
                        } catch {
                            /* ignore */
                        }
                    }
                    return {};
                };

                for (const o of orderMap.values()) {
                    if (cancelled) break;
                    const items = itemsByOrderId.get(o.id) || [];
                    const cl = checklistForOrder(o);
                    for (const sn of collectMachineSerialsForOrder(o, items, cl)) addMachineHints(sn);
                }

                for (const oid of completedOrderIds) {
                    if (cancelled) break;
                    const items = itemsByOrderId.get(oid) || [];
                    for (const it of items) {
                        const sn = String(it.serial_number || '').trim();
                        if (!sn) continue;
                        if (isCylinderProductType(it.product_type)) {
                            cylinderSerialRawFromOrders.add(sn);
                            cylinderSerialRawFromOrders.add(sn.replace(/\s+/g, ''));
                        }
                    }
                }

                const nameMatchedMachineIds = new Set();
                const markMachineNameMatched = (m) => {
                    machinesById.set(m.id, m);
                    nameMatchedMachineIds.add(m.id);
                };

                const machineSelectCols =
                    'id, serial_number, status, machine_type, warehouse, version, created_at, updated_at';

                if (nameTrim) {
                    const { data: m1 } = await supabase
                        .from('machines')
                        .select(machineSelectCols)
                        .eq('customer_name', nameTrim);
                    (m1 || []).forEach(markMachineNameMatched);

                    const esc = escapeIlikeOrFragment(nameTrim);
                    const { data: m2 } = await supabase
                        .from('machines')
                        .select(machineSelectCols)
                        .ilike('customer_name', `%${esc}%`);
                    (m2 || []).forEach(markMachineNameMatched);
                }
                const invoiceNameForMachines = String(customer?.invoice_company_name || '').trim();
                if (invoiceNameForMachines.length >= 3) {
                    const escMachInv = escapeIlikeOrFragment(invoiceNameForMachines);
                    const { data: mInvName } = await supabase
                        .from('machines')
                        .select(machineSelectCols)
                        .ilike('customer_name', `%${escMachInv}%`);
                    (mInvName || []).forEach(markMachineNameMatched);
                }

                for (const part of chunkArray([...rawMachineSerialsFromOrders], 60)) {
                    if (part.length === 0 || cancelled) continue;
                    const { data: m3 } = await supabase
                        .from('machines')
                        .select(machineSelectCols)
                        .in('serial_number', part);
                    (m3 || []).forEach((mm) => machinesById.set(mm.id, mm));
                }

                const nameMatchedCylinderIds = new Set();
                if (custId) {
                    const { data: c1 } = await supabase.from('cylinders').select('*').eq('customer_id', custId);
                    (c1 || []).forEach((c) => {
                        cylindersById.set(c.id, c);
                        nameMatchedCylinderIds.add(c.id);
                    });
                }
                if (nameTrim) {
                    const { data: c2 } = await supabase.from('cylinders').select('*').eq('customer_name', nameTrim);
                    (c2 || []).forEach((c) => {
                        cylindersById.set(c.id, c);
                        nameMatchedCylinderIds.add(c.id);
                    });
                    const esc = escapeIlikeOrFragment(nameTrim);
                    const { data: c3 } = await supabase
                        .from('cylinders')
                        .select('*')
                        .ilike('customer_name', `%${esc}%`);
                    (c3 || []).forEach((c) => {
                        cylindersById.set(c.id, c);
                        nameMatchedCylinderIds.add(c.id);
                    });
                }
                for (const part of chunkArray([...cylinderSerialRawFromOrders], 80)) {
                    if (part.length === 0 || cancelled) continue;
                    const { data: c4 } = await supabase.from('cylinders').select('*').in('serial_number', part);
                    (c4 || []).forEach((c) => cylindersById.set(c.id, c));
                }

                const machineList = [...machinesById.values()].filter((m) => {
                    if (nameMatchedMachineIds.has(m.id)) return true;
                    const st = String(m.status || '').trim();
                    if (MACHINE_STATUSES_ENRICH_CUSTOMER_FROM_ORDERS.has(st)) return true;
                    const snKey = normalizeMachineSerialKey(m.serial_number);
                    return machineSerialNormFromOrders.has(snKey);
                });

                const cylinderSerMatch = (c) => {
                    const rs = String(c.serial_number || '').trim();
                    return (
                        cylinderSerialRawFromOrders.has(rs) ||
                        cylinderSerialRawFromOrders.has(rs.replace(/\s+/g, ''))
                    );
                };
                const cylinderList = [...cylindersById.values()].filter((c) => {
                    if (nameMatchedCylinderIds.has(c.id)) return true;
                    const st = String(c.status || '').trim();
                    if (CYLINDER_STATUSES_AT_CUSTOMER.has(st)) return true;
                    return cylinderSerMatch(c);
                });

                machineList.sort((a, b) =>
                    String(a.serial_number || '').localeCompare(String(b.serial_number || ''), undefined, {
                        sensitivity: 'base',
                    }),
                );
                cylinderList.sort((a, b) =>
                    String(a.serial_number || '').localeCompare(String(b.serial_number || ''), undefined, {
                        sensitivity: 'base',
                    }),
                );

                if (cancelled) return;
                setCustomerMachines(machineList);
                setCustomerCylinders(cylinderList);

                const allSerialsRaw = [
                    ...machineList.map((m) => m.serial_number),
                    ...cylinderList.map((c) => c.serial_number),
                ]
                    .map((s) => String(s || '').trim())
                    .filter(Boolean);
                const uniqueSerials = [...new Set(allSerialsRaw)];
                if (uniqueSerials.length === 0) {
                    setMachineLogs([]);
                    return;
                }

                const start = new Date(machineRange.from);
                start.setHours(0, 0, 0, 0);
                const end = new Date(machineRange.to);
                end.setHours(23, 59, 59, 999);
                const startIso = start.toISOString();
                const endIso = end.toISOString();

                const mergedLogs = [];
                for (const part of chunkArray(uniqueSerials, 80)) {
                    if (cancelled) break;
                    const { data: logsChunk, error: errL } = await supabase
                        .from('cylinder_logs')
                        .select('id, serial_number, action, description, image_url, warehouse_id, created_at')
                        .in('serial_number', part)
                        .gte('created_at', startIso)
                        .lte('created_at', endIso)
                        .order('created_at', { ascending: false })
                        .limit(800);

                    if (errL) {
                        console.warn('cylinder_logs chunk', errL);
                        continue;
                    }
                    mergedLogs.push(...(logsChunk || []));
                }
                mergedLogs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                const capped = mergedLogs.slice(0, 800);
                if (!cancelled) setMachineLogs(capped);
            } catch (e) {
                console.error('Error loading machines / cylinders / history:', e);
                if (!cancelled) {
                    setCustomerMachines([]);
                    setCustomerCylinders([]);
                    setMachineLogs([]);
                }
            } finally {
                if (!cancelled) setMachinesHistoryLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [
        customer?.id,
        customer?.name,
        customer?.phone,
        customer?.invoice_company_name,
        JSON.stringify(customer?.machines_in_use ?? null),
        activeTab,
        machineRange.from,
        machineRange.to,
    ]);

    useEffect(() => {
        setExpandedMachineSerial(null);
        setExpandedCylinderSerial(null);
        setCustomerCylinders([]);
        setMachineRange(defaultMachineRange());
    }, [customer?.id]);

    useEffect(() => {
        if (!customer) return undefined;
        let cancelled = false;

        (async () => {
            try {
                const ids = await getCustomerIdsForCareHistory(customer);
                const validIds = (ids || []).filter(Boolean);
                const count = validIds.length > 0 ? validIds.length : (customer?.id ? 1 : 0);
                if (!cancelled) setCareHistoryCount(count);
            } catch (error) {
                console.error('Error loading care history count:', error);
                if (!cancelled) setCareHistoryCount(customer?.id ? 1 : 0);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [customer?.id, customer?.phone]);

    useEffect(() => {
        if (hideCommerceTabs && ['orders', 'transactions', 'cylinders'].includes(activeTab)) {
            setActiveTab('overview');
        }
    }, [hideCommerceTabs, activeTab]);

    useEffect(() => {
        if (!customer || activeTab !== 'care_history') return undefined;
        let cancelled = false;
        (async () => {
            try {
                const ids = await getCustomerIdsForCareHistory(customer);
                const validIds = (ids || []).filter(Boolean);

                let rows = [];
                if (validIds.length > 0) {
                    const { data, error } = await supabase
                        .from('customers')
                        .select('id, status, care_by, created_at')
                        .in('id', validIds)
                        .order('created_at', { ascending: false });

                    if (error) {
                        console.error('Error fetching care history customers:', error);
                    } else {
                        rows = data || [];
                    }
                }

                if ((!rows || rows.length === 0) && customer?.id) {
                    rows = [{
                        id: customer.id,
                        status: customer.status,
                        care_by: customer.care_by,
                        created_at: customer.created_at
                    }];
                }

                if (!cancelled) {
                    setCareHistory(rows);
                    setCareHistoryCount(rows.length);
                }
            } catch (error) {
                console.error('Error loading care history tab:', error);
                if (!cancelled) {
                    setCareHistory([]);
                    setCareHistoryCount(0);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [activeTab, customer?.id, customer?.phone]);

    const fetchCustomerData = async () => {
        setLoading(true);
        try {
            // Query orders: prefer customer_id, fallback to customer_name for legacy orders
            let ordersData = [];
            if (customer.id) {
                const { data: byId, error: errId } = await supabase
                    .from('orders')
                    .select('*')
                    .eq('customer_id', customer.id)
                    .order('created_at', { ascending: false });
                if (errId) throw errId;
                ordersData = byId || [];

                // Also fetch legacy orders that only have customer_name (no customer_id)
                if (customer.name) {
                    const { data: byName } = await supabase
                        .from('orders')
                        .select('*')
                        .eq('customer_name', customer.name)
                        .is('customer_id', null)
                        .order('created_at', { ascending: false });
                    if (byName && byName.length > 0) {
                        const existingIds = new Set(ordersData.map(o => o.id));
                        const uniqueLegacy = byName.filter(o => !existingIds.has(o.id));
                        ordersData = [...ordersData, ...uniqueLegacy];
                    }
                }
            } else if (customer.name) {
                const { data, error } = await supabase
                    .from('orders')
                    .select('*')
                    .eq('customer_name', customer.name)
                    .order('created_at', { ascending: false });
                if (error) throw error;
                ordersData = data || [];
            }

            const { data: txData, error: err2 } = await supabase
                .from('customer_transactions')
                .select('*')
                .eq('customer_id', customer.id)
                .order('created_at', { ascending: false });

            if (err2) throw err2;

            const cylById = new Map();
            if (customer.id) {
                const { data: cylByCustomerId, error: err3 } = await supabase
                    .from('cylinders')
                    .select('*')
                    .eq('customer_id', customer.id);
                if (err3) throw err3;
                (cylByCustomerId || []).forEach((c) => cylById.set(c.id, c));
            }
            if (customer.name) {
                const nt = String(customer.name).trim();
                if (nt) {
                    const { data: cEq } = await supabase.from('cylinders').select('*').eq('customer_name', nt);
                    (cEq || []).forEach((c) => cylById.set(c.id, c));
                    const esc = escapeIlikeOrFragment(nt);
                    const { data: cLike } = await supabase
                        .from('cylinders')
                        .select('*')
                        .ilike('customer_name', `%${esc}%`);
                    (cLike || []).forEach((c) => cylById.set(c.id, c));
                }
            }
            const mergedCylinders = [...cylById.values()];

            setOrders(ordersData || []);
            setTransactions(txData || []);
            setCylinders(mergedCylinders);

            const validOrders = (ordersData || []).filter(o =>
                !['HUY_DON'].includes(o.status)
            );
            const totalOrder = validOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

            let totalPaid = 0;
            let totalRefund = 0;

            (txData || []).forEach(tx => {
                const amt = Number(tx.amount) || 0;
                if (tx.transaction_type === 'THU') totalPaid += amt;
                else if (tx.transaction_type === 'CHI') totalRefund += amt;
            });

            const debt = totalOrder - (totalPaid - totalRefund);

            setStats({
                totalOrderValue: totalOrder,
                totalPaid: totalPaid,
                currentDebt: debt > 0 ? debt : 0
            });

        } catch (error) {
            console.error('Error fetching customer details:', error);
            alert('Lỗi tải dữ liệu chi tiết Khách hàng!');
        } finally {
            setLoading(false);
        }
    };

    const handlePaymentSubmit = async (e) => {
        e.preventDefault();
        const amountNum = parseFloat(paymentAmount.replace(/\./g, ''));
        if (!amountNum || amountNum <= 0) {
            alert('Vui lòng nhập số tiền hợp lệ!');
            return;
        }

        setIsSubmittingPayment(true);
        try {
            let nextCode = editingTxCode;

            if (!editingTxId) {
                const { data: latestTx } = await supabase
                    .from('customer_transactions')
                    .select('transaction_code')
                    .order('created_at', { ascending: false })
                    .limit(1);

                nextCode = 'PT00001';
                if (latestTx && latestTx.length > 0 && latestTx[0].transaction_code?.startsWith('PT')) {
                    const numStr = latestTx[0].transaction_code.replace(/[^0-9]/g, '');
                    const nextNum = numStr ? parseInt(numStr, 10) + 1 : 1;
                    nextCode = `PT${nextNum.toString().padStart(5, '0')}`;
                }
            }

            const payload = {
                customer_id: customer.id,
                customer_name: customer.name,
                amount: amountNum,
                transaction_date: paymentDate,
                payment_method: paymentMethod,
                note: paymentNote,
            };

            if (!editingTxId) {
                payload.transaction_code = nextCode;
                payload.transaction_type = 'THU';
                payload.created_by = 'Kế toán';
            }

            if (billImageFile) {
                const fileName = `bill_${nextCode}_${Date.now()}.${billImageFile.name.split('.').pop()}`;
                const { error: uploadError } = await supabase.storage
                    .from('bill-images')
                    .upload(fileName, billImageFile);
                if (!uploadError) {
                    const { data: urlData } = supabase.storage.from('bill-images').getPublicUrl(fileName);
                    payload.bill_image_url = urlData.publicUrl;
                }
            }

            if (editingTxId) {
                const { error } = await supabase.from('customer_transactions').update(payload).eq('id', editingTxId);
                if (error) throw error;
                alert('✅ Đã cập nhật giao dịch thành công!');
            } else {
                const { error } = await supabase.from('customer_transactions').insert([payload]);
                if (error) throw error;
                alert('✅ Đã lập Phiếu Thu tiền thành công!');
            }

            resetPaymentForm();
            fetchCustomerData();
        } catch (error) {
            console.error('Lỗi khi lập phiếu thu:', error);
            alert('❌ Có lỗi lập phiếu thu: ' + error.message);
        } finally {
            setIsSubmittingPayment(false);
        }
    };

    const resetPaymentForm = () => {
        setShowPaymentForm(false);
        setEditingTxId(null);
        setEditingTxCode('');
        setPaymentAmount('');
        setPaymentDate(new Date().toISOString().split('T')[0]);
        setPaymentMethod('CHUYEN_KHOAN');
        setPaymentNote('');
        setBillImageFile(null);
    };

    const handleEditTransaction = (tx) => {
        setEditingTxId(tx.id);
        setEditingTxCode(tx.transaction_code);
        setPaymentAmount(Math.round(tx.amount).toString());
        setPaymentDate(tx.transaction_date || new Date().toISOString().split('T')[0]);
        setPaymentMethod(tx.payment_method || 'CHUYEN_KHOAN');
        setPaymentNote(tx.note || '');
        setBillImageFile(null);
        
        setShowPaymentForm(true);
        setActiveTab('overview');
    };

    const handleDeleteTransaction = async (id, code) => {
        if (!window.confirm(`Bạn có chắc chắn muốn xóa giao dịch ${code} không?`)) return;
        try {
            const { error } = await supabase.from('customer_transactions').delete().eq('id', id);
            if (error) throw error;
            alert('✅ Đã xóa giao dịch thành công!');
            fetchCustomerData();
        } catch (error) {
            console.error('Lỗi khi xóa giao dịch:', error);
            alert('❌ Có lỗi xảy ra khi xóa giao dịch: ' + error.message);
        }
    };

    const handleExportTransactions = () => {
        if (!transactions || transactions.length === 0) {
            alert('Không có giao dịch nào để xuất!');
            return;
        }

        const exportData = transactions.map(tx => ({
            'Mã Giao Dịch': tx.transaction_code,
            'Ngày Giao Dịch': new Date(tx.transaction_date).toLocaleDateString('vi-VN'),
            'Loại Giao Dịch': tx.transaction_type === 'THU' ? 'Thu' : 'Chi',
            'Số Tiền': tx.amount,
            'Hình Thức': tx.payment_method,
            'Nội Dung': tx.note || ''
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Giao dịch");
        XLSX.writeFile(wb, `GiaoDich_${customer.name}.xlsx`);
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('vi-VN').format(amount || 0) + ' ₫';
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('vi-VN');
    };

    const formatDateTime = (dateStr) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return createPortal(
        <div className={clsx(
            "fixed inset-0 z-[100005] flex justify-end transition-all duration-300",
            isClosing ? "opacity-0 pointer-events-none" : "opacity-100"
        )}>
            <div
                className={clsx(
                    "absolute inset-0 bg-black/45 backdrop-blur-sm animate-in fade-in duration-300",
                    isClosing && "animate-out fade-out duration-300"
                )}
                onClick={handleClose}
            />

            <div
                className={clsx(
                    "relative bg-slate-50 shadow-2xl w-full max-w-4xl overflow-hidden h-full flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-500",
                    isClosing && "animate-out slide-out-to-right duration-300"
                )}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-white px-6 py-4 border-b border-slate-200 shrink-0">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-primary text-white shadow-lg">
                                <UserCircle className="w-7 h-7" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 tracking-tight">{customer.name}</h2>
                                <div className="flex items-center gap-4 text-sm font-bold text-slate-500">
                                    <span className="flex items-center gap-1.5"><Phone className="w-4 h-4" /> {customer.phone || '—'}</span>
                                    <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {customer.address || '—'}</span>
                                </div>
                            </div>
                        </div>
                        <button onClick={handleClose} className="p-2 bg-slate-100 text-slate-400 hover:text-rose-500 rounded-xl transition-colors">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="flex items-center gap-6 mt-5 border-b border-slate-200 overflow-x-auto scrollbar-hide scroll-smooth">
                        <button type="button" onClick={() => setActiveTab('overview')} className={clsx("pb-4 text-sm font-black transition-all border-b-2 whitespace-nowrap shrink-0", activeTab === 'overview' ? 'text-primary border-primary' : 'text-slate-400 border-transparent')}>Tổng quan</button>
                        <button type="button" onClick={() => setActiveTab('assets_history')} className={clsx("pb-4 text-sm font-black transition-all border-b-2 whitespace-nowrap shrink-0 max-w-[220px] text-left sm:text-center sm:max-w-none", activeTab === 'assets_history' ? 'text-primary border-primary' : 'text-slate-400 border-transparent')}>Máy, vỏ bình & lịch sử</button>
                        <button type="button" onClick={() => setActiveTab('care_history')} className={clsx("pb-4 text-sm font-black transition-all border-b-2 whitespace-nowrap shrink-0", activeTab === 'care_history' ? 'text-primary border-primary' : 'text-slate-400 border-transparent')}>Lịch sử chăm sóc ({careHistoryCount})</button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center h-40 font-bold text-slate-400">Đang tải...</div>
                    ) : (
                        <div className="space-y-6">
                            {activeTab === 'overview' && (
                                <div className="space-y-6">
                                    {customer.status === 'Thành công' && (
                                        <div className="grid grid-cols-3 gap-6 text-center">
                                            <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100">
                                                <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">Công Nợ</p>
                                                <h3 className="text-xl font-black text-rose-700">{formatCurrency(stats.currentDebt)}</h3>
                                            </div>
                                            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                                                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Tổng Tiền Hàng</p>
                                                <h3 className="text-xl font-black text-emerald-700">{formatCurrency(stats.totalOrderValue)}</h3>
                                            </div>
                                            <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Đã Thanh Toán</p>
                                                <h3 className="text-xl font-black text-indigo-700">{formatCurrency(stats.totalPaid)}</h3>
                                            </div>
                                        </div>
                                    )}

                                    {/* Care Info section */}
                                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                                        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <Activity className="w-3 h-3" /> Trạng thái chăm sóc (60 ngày)
                                        </h5>
                                        <div className="flex flex-col gap-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-bold text-slate-600">Thời hạn chăm sóc:</span>
                                                {(() => {
                                                    if (!customer.care_expiry_date) return <span className="text-sm font-bold text-slate-400">Chưa có dữ liệu</span>;
                                                    const diff = Math.ceil((new Date(customer.care_expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
                                                    if (diff <= 0) return <span className="text-sm font-black text-rose-600 uppercase">Quá hạn</span>;
                                                    if (diff <= 10) return <span className="text-sm font-black text-amber-500 animate-pulse uppercase">Cảnh báo (Còn {diff} ngày)</span>;
                                                    return <span className="text-sm font-black text-emerald-600 uppercase">Đang chăm sóc (Còn {diff} ngày)</span>;
                                                })()}
                                            </div>
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-slate-400">Ngày đăng ký:</span>
                                                <span className="font-bold text-slate-600">{formatDate(customer.care_assigned_at || customer.created_at)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-slate-400">Ngày hết hạn:</span>
                                                <span className="font-bold text-slate-600">{formatDate(customer.care_expiry_date)}</span>
                                            </div>
                                            {customer.status === 'Thành công' && (
                                                <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-200/80">
                                                    <span className="text-slate-400">Ngày thành công:</span>
                                                    <span className="font-bold text-emerald-700">
                                                        {customer.success_at
                                                            ? formatDate(customer.success_at)
                                                            : '—'}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 shadow-sm">
                                        <h4 className="flex items-center gap-2 text-sm font-black text-slate-800 uppercase tracking-widest border-b pb-3">
                                            <Receipt className="w-4 h-4" /> Thông tin xuất hóa đơn
                                        </h4>
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mã số thuế</p>
                                                <p className="font-bold text-slate-700">{customer.tax_code || '—'}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email hóa đơn</p>
                                                <p className="font-bold text-primary">{customer.invoice_email || '—'}</p>
                                            </div>
                                            <div className="col-span-2 space-y-1">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tên đơn vị</p>
                                                <p className="font-bold text-slate-800">{customer.invoice_company_name || '—'}</p>
                                            </div>
                                            <div className="col-span-2 space-y-1">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Địa chỉ xuất hóa đơn</p>
                                                <p className="font-bold text-slate-600">{customer.invoice_address || '—'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {!showPaymentForm ? (
                                        <button onClick={() => setShowPaymentForm(true)} className="w-full py-3 bg-slate-900 text-white rounded-xl font-black text-sm shadow-xl flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors">
                                            <CreditCard className="w-4 h-4" /> Nhận Tiền Khách Trả Nợ
                                        </button>
                                    ) : (
                                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Lập phiếu thu tiền</h3>
                                                <button onClick={resetPaymentForm} className="text-xs font-black text-slate-400 hover:text-rose-500 uppercase">Thoát</button>
                                            </div>
                                            <form onSubmit={handlePaymentSubmit} className="space-y-4">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Số tiền thu *</label>
                                                        <input type="text" required value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="0" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-black text-primary outline-none focus:border-primary/40" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Hình thức *</label>
                                                        <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-primary/40">
                                                            <option value="CHUYEN_KHOAN">Chuyển khoản</option>
                                                            <option value="TIEN_MAT">Tiền mặt</option>
                                                        </select>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Ngày lập phiếu *</label>
                                                        <input type="date" required value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-primary/40" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nội dung</label>
                                                        <input type="text" value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} placeholder="Nội dung nộp tiền..." className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-primary/40" />
                                                    </div>
                                                </div>
                                                <button type="submit" disabled={isSubmittingPayment} className="w-full py-3 bg-primary text-white font-black rounded-xl shadow-lg shadow-primary/20 hover:brightness-110 transition-all">Xác nhận Đã Nhận Tiền</button>
                                            </form>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'assets_history' && (
                                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                                    <div className="flex flex-col gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-end sm:justify-between">
                                        <h4 className="flex items-center gap-2 text-sm font-black text-slate-800 uppercase tracking-widest">
                                            <Cpu className="w-4 h-4 shrink-0 text-indigo-600" />
                                            Máy, vỏ bình & lịch sử
                                        </h4>
                                        <div className="flex flex-wrap items-end gap-2">
                                            <div className="space-y-0.5">
                                                <label className="block text-[9px] font-black uppercase tracking-wider text-slate-400">
                                                    Từ ngày
                                                </label>
                                                <input
                                                    type="date"
                                                    value={machineRange.from}
                                                    onChange={(e) =>
                                                        setMachineRange((r) => ({ ...r, from: e.target.value }))
                                                    }
                                                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-bold text-slate-800"
                                                />
                                            </div>
                                            <div className="space-y-0.5">
                                                <label className="block text-[9px] font-black uppercase tracking-wider text-slate-400">
                                                    Đến ngày
                                                </label>
                                                <input
                                                    type="date"
                                                    value={machineRange.to}
                                                    onChange={(e) =>
                                                        setMachineRange((r) => ({ ...r, to: e.target.value }))
                                                    }
                                                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-bold text-slate-800"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {!customer?.id &&
                                    !(customer?.name && String(customer.name).trim()) ? (
                                        <p className="text-sm font-medium text-slate-500 italic">
                                            Cần mã khách hoặc tên khách để tra máy, vỏ bình và nhật ký.
                                        </p>
                                    ) : machinesHistoryLoading ? (
                                        <p className="py-6 text-center text-sm font-bold text-slate-400">
                                            Đang tải máy, vỏ bình & nhật ký…
                                        </p>
                                    ) : customerMachines.length === 0 && customerCylinders.length === 0 ? (
                                        <p className="text-sm text-slate-600">
                                            Chưa thấy máy hay vỏ bình gán cho khách này: kiểm tra tên/SĐT khớp{' '}
                                            <span className="font-mono text-xs">
                                                machines.customer_name / cylinders.customer_*
                                            </span>
                                            , serial trên các đơn đã hoàn thành, và khoảng ngày lọc nhật ký.
                                        </p>
                                    ) : (
                                        <div
                                            className={clsx(
                                                'grid gap-6 lg:items-start',
                                                customerMachines.length > 0 && customerCylinders.length > 0
                                                    ? 'lg:grid-cols-2'
                                                    : 'grid-cols-1',
                                            )}
                                        >
                                            {customerMachines.length > 0 && (
                                                <div className="min-w-0 space-y-2">
                                                    <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                        <Cpu className="h-3.5 w-3.5 text-indigo-600" /> Máy (
                                                        {customerMachines.length})
                                                    </p>
                                                    {customerMachines.map((m) => {
                                                        const logs = logsForAssetSerial(m.serial_number);
                                                        const open = expandedMachineSerial === m.serial_number;
                                                        return (
                                                            <div
                                                                key={m.id}
                                                                className="overflow-hidden rounded-xl border border-slate-100 bg-slate-50/40"
                                                            >
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setExpandedMachineSerial(
                                                                            open ? null : m.serial_number,
                                                                        )
                                                                    }
                                                                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-white"
                                                                >
                                                                    {open ? (
                                                                        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                                                                    ) : (
                                                                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                                                                    )}
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="truncate font-black text-slate-900">
                                                                            {m.serial_number}
                                                                        </p>
                                                                        <p className="truncate text-[11px] font-bold text-slate-500">
                                                                            {m.machine_type || '—'} · {m.status || '—'}
                                                                            {m.warehouse ? ` · Kho ${m.warehouse}` : ''}
                                                                        </p>
                                                                    </div>
                                                                    <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-black text-slate-600">
                                                                        {logs.length} sự kiện
                                                                    </span>
                                                                </button>
                                                                {open && (
                                                                    <div className="border-t border-slate-100 bg-white px-2 py-2">
                                                                        {logs.length === 0 ? (
                                                                            <p className="px-2 py-3 text-center text-xs font-medium italic text-slate-400">
                                                                                Không có nhật ký trong khoảng thời gian đã
                                                                                chọn.
                                                                            </p>
                                                                        ) : (
                                                                            <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-100">
                                                                                <table className="w-full text-left text-[11px]">
                                                                                    <thead className="sticky top-0 bg-slate-50 text-[9px] font-black uppercase tracking-wider text-slate-400">
                                                                                        <tr>
                                                                                            <th className="px-2 py-1.5">
                                                                                                Thời điểm
                                                                                            </th>
                                                                                            <th className="px-2 py-1.5">
                                                                                                Hành động
                                                                                            </th>
                                                                                            <th className="px-2 py-1.5">
                                                                                                Mô tả
                                                                                            </th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody className="divide-y divide-slate-50">
                                                                                        {logs.map((log) => (
                                                                                            <tr
                                                                                                key={log.id}
                                                                                                className="align-top text-slate-700"
                                                                                            >
                                                                                                <td className="whitespace-nowrap px-2 py-1.5 font-semibold text-slate-500">
                                                                                                    {formatDateTime(
                                                                                                        log.created_at,
                                                                                                    )}
                                                                                                </td>
                                                                                                <td className="px-2 py-1.5 font-bold text-indigo-700">
                                                                                                    {log.action || '—'}
                                                                                                </td>
                                                                                                <td className="max-w-[200px] px-2 py-1.5 break-words text-slate-600">
                                                                                                    {log.description || '—'}
                                                                                                </td>
                                                                                            </tr>
                                                                                        ))}
                                                                                    </tbody>
                                                                                </table>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                            {customerCylinders.length > 0 && (
                                                <div className="min-w-0 space-y-2">
                                                    <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                        <Droplets className="h-3.5 w-3.5 text-sky-600" /> Vỏ bình (
                                                        {customerCylinders.length})
                                                    </p>
                                                    {customerCylinders.map((cyl) => {
                                                        const logs = logsForAssetSerial(cyl.serial_number);
                                                        const open =
                                                            expandedCylinderSerial === cyl.serial_number;
                                                        return (
                                                            <div
                                                                key={cyl.id}
                                                                className="overflow-hidden rounded-xl border border-slate-100 bg-sky-50/30"
                                                            >
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setExpandedCylinderSerial(
                                                                            open ? null : cyl.serial_number,
                                                                        )
                                                                    }
                                                                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-white"
                                                                >
                                                                    {open ? (
                                                                        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                                                                    ) : (
                                                                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                                                                    )}
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="truncate font-black text-slate-900 font-mono text-sm">
                                                                            {cyl.serial_number}
                                                                        </p>
                                                                        <p className="truncate text-[11px] font-bold text-slate-500">
                                                                            {(cyl.volume &&
                                                                                String(cyl.volume).trim()) ||
                                                                                '—'}{' '}
                                                                            · {cyl.status || '—'}
                                                                        </p>
                                                                    </div>
                                                                    <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-black text-slate-600">
                                                                        {logs.length} sự kiện
                                                                    </span>
                                                                </button>
                                                                {open && (
                                                                    <div className="border-t border-slate-100 bg-white px-2 py-2">
                                                                        {logs.length === 0 ? (
                                                                            <p className="px-2 py-3 text-center text-xs font-medium italic text-slate-400">
                                                                                Không có nhật ký trong khoảng thời gian đã
                                                                                chọn.
                                                                            </p>
                                                                        ) : (
                                                                            <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-100">
                                                                                <table className="w-full text-left text-[11px]">
                                                                                    <thead className="sticky top-0 bg-slate-50 text-[9px] font-black uppercase tracking-wider text-slate-400">
                                                                                        <tr>
                                                                                            <th className="px-2 py-1.5">
                                                                                                Thời điểm
                                                                                            </th>
                                                                                            <th className="px-2 py-1.5">
                                                                                                Hành động
                                                                                            </th>
                                                                                            <th className="px-2 py-1.5">
                                                                                                Mô tả
                                                                                            </th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody className="divide-y divide-slate-50">
                                                                                        {logs.map((log) => (
                                                                                            <tr
                                                                                                key={log.id}
                                                                                                className="align-top text-slate-700"
                                                                                            >
                                                                                                <td className="whitespace-nowrap px-2 py-1.5 font-semibold text-slate-500">
                                                                                                    {formatDateTime(
                                                                                                        log.created_at,
                                                                                                    )}
                                                                                                </td>
                                                                                                <td className="px-2 py-1.5 font-bold text-indigo-700">
                                                                                                    {log.action || '—'}
                                                                                                </td>
                                                                                                <td className="max-w-[200px] px-2 py-1.5 break-words text-slate-600">
                                                                                                    {log.description || '—'}
                                                                                                </td>
                                                                                            </tr>
                                                                                        ))}
                                                                                    </tbody>
                                                                                </table>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'care_history' && (
                                <div className="space-y-4">
                                    {careHistory.length === 0 ? (
                                        <div className="py-12 text-center font-bold text-slate-300 italic">Chưa có lịch sử chăm sóc</div>
                                    ) : (
                                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                                            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                                <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                    Danh sách đơn (Cùng SĐT: {customer.phone || 'Không có'})
                                                </h5>
                                            </div>
                                            <table className="w-full text-left text-sm">
                                                <thead className="bg-slate-50 border-b border-slate-100">
                                                    <tr>
                                                        <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest text-[10px]">Trạng thái</th>
                                                        <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest text-[10px]">Ngày tạo</th>
                                                        <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest text-[10px]">KD chăm sóc</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {careHistory.map((item) => (
                                                        <tr key={item.id} className={clsx("hover:bg-slate-50/50 transition-colors", item.id === customer.id && "bg-blue-50/30")}>
                                                            <td className="px-4 py-3">
                                                                <span className={clsx(
                                                                    "px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider",
                                                                    item.status === 'Thành công' ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                                                                )}>
                                                                    {item.status || 'Chưa thành công'}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 font-bold text-slate-500 italic">
                                                                {item.created_at ? new Date(item.created_at).toLocaleString('vi-VN', {
                                                                    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                                                }) : '—'}
                                                            </td>
                                                            <td className="px-4 py-3 font-bold text-slate-700">
                                                                <div className="flex items-center gap-2">
                                                                    <div className={clsx("w-2 h-2 rounded-full", item.id === customer.id ? "bg-primary" : "bg-slate-300")} />
                                                                    <span>{item.care_by || '—'}</span>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
