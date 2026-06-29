import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import GoodsReceiptPrintTemplate from '../components/GoodsReceiptPrintTemplate';
import { supabase } from '../supabase/config';

/**
 * In phiếu nhập kho — dùng chung trang Nhập hàng, ĐNXM, OrderStatusUpdater.
 */
export function useGoodsReceiptPrint(warehousesList = []) {
    const [printData, setPrintData] = useState(null);

    const printReceipt = useCallback(async (receiptOrId, prefetchedItems = null) => {
        let receipt = receiptOrId;
        if (!receipt) {
            throw new Error('Thiếu phiếu nhập kho');
        }

        if (typeof receipt === 'string') {
            const { data, error } = await supabase
                .from('goods_receipts')
                .select('*')
                .eq('id', receipt)
                .single();
            if (error) throw error;
            receipt = data;
        }

        let items = prefetchedItems;
        if (!items) {
            const { data, error } = await supabase
                .from('goods_receipt_items')
                .select('*')
                .eq('receipt_id', receipt.id);
            if (error) throw error;
            items = data || [];
        }

        setPrintData({ receipt, items });
        setTimeout(() => {
            window.print();
        }, 350);
    }, []);

    const PrintPortal = () => {
        if (!printData) return null;
        return createPortal(
            <div className="print-only-content">
                <GoodsReceiptPrintTemplate
                    receipt={printData.receipt}
                    items={printData.items}
                    warehousesList={warehousesList}
                />
            </div>,
            document.body,
        );
    };

    return { printReceipt, PrintPortal };
}
