import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { supabase } from '../../supabase/config';

const GlobalNotifications = () => {
    const navigate = useNavigate();

    useEffect(() => {
        const channel = supabase
            .channel('repair_tickets_changes')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'repair_tickets',
                },
                async (payload) => {
                    const newTicket = payload.new;

                    // Fetch customer name for better context
                    const { data: customerData } = await supabase
                        .from('customers')
                        .select('name')
                        .eq('id', newTicket.customer_id)
                        .single();

                    const customerName = customerData?.name || 'Khách hàng mới';

                    toast.info(
                        <div onClick={() => navigate('/phieu-sua-chua')} className="cursor-pointer">
                            <p className="font-bold text-[14px]">🎫 Ticket mới: #{newTicket.stt || ''}</p>
                            <p className="text-[12px] opacity-90">{customerName} - {newTicket.machine_serial}</p>
                        </div>,
                        {
                            position: "top-right",
                            autoClose: 5000,
                            hideProgressBar: false,
                            closeOnClick: true,
                            pauseOnHover: true,
                            draggable: true,
                        }
                    );
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [navigate]);

    return null;
};

export default GlobalNotifications;
