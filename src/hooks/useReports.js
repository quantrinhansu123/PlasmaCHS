import { useState, useEffect } from 'react';
import usePermissions from '../hooks/usePermissions';
import { supabase } from '../supabase/config';

export const useReports = () => {
  const { role, department } = usePermissions();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchDashboardSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('view_dashboard_summary')
        .select('*');

      // Apply warehouse filter for warehouse managers/staff (Non-Admin)
      if (role !== 'Admin' && department) {
        const userWhCode = department.includes('-') ? department.split('-')[0].trim() : department.trim();
        query = query.eq('kho', userWhCode);
      }

      const { data, error } = await query.maybeSingle();
      
      if (error) throw error;
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomerStats = async (filters = {}) => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('view_customer_stats')
        .select('*');

      // Apply warehouse filter for warehouse managers/staff (Non-Admin)
      if (role !== 'Admin' && department) {
        const userWhCode = department.includes('-') ? department.split('-')[0].trim() : department.trim();
        query = query.eq('warehouse_id', userWhCode);
      } else if (filters.warehouse_id) {
        query = query.eq('warehouse_id', filters.warehouse_id);
      }
      if (filters.customer_type) {
        query = query.eq('loai_khach_hang', filters.customer_type);
      }
      if (filters.care_by) {
        query = query.eq('nhan_vien_kinh_doanh', filters.care_by);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchSalespersonStats = async (filters = {}) => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('view_salesperson_stats')
        .select('*');

      // Apply warehouse filter for warehouse managers/staff (Non-Admin)
      if (role !== 'Admin' && department) {
        const userWhCode = department.includes('-') ? department.split('-')[0].trim() : department.trim();
        query = query.eq('warehouse_id', userWhCode);
      } else if (filters.warehouse_id) {
        query = query.eq('warehouse_id', filters.warehouse_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchCylinderExpiry = async (filters = {}) => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('view_cylinder_expiry')
        .select('*');

      // Apply warehouse filter for warehouse managers/staff (Non-Admin)
      if (role !== 'Admin' && department) {
        const userWhCode = department.includes('-') ? department.split('-')[0].trim() : department.trim();
        query = query.eq('kho', userWhCode);
      } else if (filters.warehouse_id) {
        query = query.eq('kho', filters.warehouse_id);
      }
      if (filters.min_days) {
        query = query.gte('so_ngay_ton', filters.min_days);
      }
      if (filters.startDate && filters.endDate) {
        query = query.gte('ngay_het_han', filters.startDate)
                     .lte('ngay_het_han', filters.endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomerExpiry = async (filters = {}) => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('view_customer_expiry')
        .select('*');

      // Apply warehouse filter for warehouse managers/staff (Non-Admin)
      if (role !== 'Admin' && department) {
        const userWhCode = department.includes('-') ? department.split('-')[0].trim() : department.trim();
        query = query.ilike('kho', `%${userWhCode}%`);
      } else if (filters.warehouse_id) {
        query = query.eq('kho', filters.warehouse_id);
      }
      if (filters.min_days) {
        query = query.gte('so_ngay_chua_phat_sinh', filters.min_days);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchCylinderErrors = async (filters = {}) => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('view_cylinder_errors')
        .select('*');

      // Apply warehouse filter for warehouse managers/staff (Non-Admin)
      if (role !== 'Admin' && department) {
        const userWhCode = department.includes('-') ? department.split('-')[0].trim() : department.trim();
        query = query.ilike('kho', `%${userWhCode}%`);
      } else if (filters.warehouse_id) {
        query = query.eq('kho', filters.warehouse_id);
      }
      if (filters.start_date && filters.end_date) {
        query = query.gte('ngay_phat_hien_loi', filters.start_date)
                     .lte('ngay_phat_hien_loi', filters.end_date);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchMachineStats = async (filters = {}) => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('view_machine_stats')
        .select('*');

      // Apply warehouse filter for warehouse managers/staff (Non-Admin)
      if (role !== 'Admin' && department) {
        const userWhCode = department.includes('-') ? department.split('-')[0].trim() : department.trim();
        query = query.ilike('kho', `%${userWhCode}%`);
      } else if (filters.warehouse) {
        query = query.eq('kho', filters.warehouse);
      }
      if (filters.machine_type) {
        query = query.eq('loai_may', filters.machine_type);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchMachineSummary = async (filters = {}) => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('view_machine_summary')
        .select('*');

      // Apply warehouse filter for warehouse managers/staff (Non-Admin)
      if (role !== 'Admin' && department) {
        const userWhCode = department.includes('-') ? department.split('-')[0].trim() : department.trim();
        query = query.ilike('kho', `%${userWhCode}%`);
      } else if (filters.kho) {
        query = query.eq('kho', filters.kho);
      }
      if (filters.machine_type) {
        query = query.eq('loai_may', filters.machine_type);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchOrdersMonthly = async (filters = {}) => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('view_orders_monthly')
        .select('*');

      if (filters.year) {
        const years = (Array.isArray(filters.year) ? filters.year : [filters.year])
          .map(y => parseInt(y))
          .filter(y => !isNaN(y));
        if (years.length > 0) query = query.in('nam', years);
      }
      if (filters.month) {
        const months = (Array.isArray(filters.month) ? filters.month : [filters.month])
          .map(m => parseInt(m))
          .filter(m => !isNaN(m));
        if (months.length > 0) query = query.in('thang', months);
      }
      
      // Apply warehouse filter for warehouse managers/staff (Non-Admin)
      if (role !== 'Admin' && department) {
        const userWhCode = department.includes('-') ? department.split('-')[0].trim() : department.trim();
        query = query.eq('kho', userWhCode);
      } else if (filters.warehouse) {
        const warehouses = Array.isArray(filters.warehouse) ? filters.warehouse : [filters.warehouse];
        if (warehouses.length > 0) query = query.in('kho', warehouses);
      }
      if (filters.customer_category) {
        const categories = Array.isArray(filters.customer_category) ? filters.customer_category : [filters.customer_category];
        if (categories.length > 0) query = query.in('loai_khach_hang', categories);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchMachineRevenue = async (filters = {}) => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('view_machine_revenue')
        .select('*');

      // Apply warehouse filter for warehouse managers/staff (Non-Admin)
      if (role !== 'Admin' && department) {
        const userWhCode = department.includes('-') ? department.split('-')[0].trim() : department.trim();
        query = query.eq('khoa', userWhCode);
      } else if (filters.khoa) {
        query = query.eq('khoa', filters.khoa);
      }
      if (filters.nhan_vien_kinh_doanh) {
        query = query.eq('nhan_vien_kinh_doanh', filters.nhan_vien_kinh_doanh);
      }
      if (filters.loai_khach_hang) {
        query = query.eq('loai_khach_hang', filters.loai_khach_hang);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomerCylinderReport = async (filters = {}) => {
    setLoading(true);
    setError(null);
    try {
      // Use RPC if date range is provided
      if (filters.startDate && filters.endDate) {
        const { data, error } = await supabase.rpc('get_customer_cylinder_balance_by_date', {
          p_start_date: filters.startDate,
          p_end_date: filters.endDate,
          p_warehouse: filters.warehouse || null,
          p_category: filters.customer_category || null
        });
        if (error) throw error;
        // Filter by customer name locally if needed
        if (filters.customer) {
          return data.filter(item => item.customer_name.toLowerCase().includes(filters.customer.toLowerCase()));
        }
        return data;
      }

      // Legacy Monthly View
      let query = supabase
        .from('view_customer_cylinder_monthly_balance')
        .select('*');

      if (filters.year) query = query.eq('nam', filters.year);
      if (filters.month) query = query.eq('thang', filters.month);
      
      // Apply warehouse filter for warehouse managers/staff (Non-Admin)
      if (role !== 'Admin' && department) {
        const userWhCode = department.includes('-') ? department.split('-')[0].trim() : department.trim();
        query = query.ilike('kho', `%${userWhCode}%`);
      } else if (filters.warehouse) {
        query = query.eq('kho', filters.warehouse);
      }
      
      if (filters.customer) query = query.ilike('customer_name', `%${filters.customer}%`);

      const { data, error } = await query.order('nam', { ascending: false }).order('thang', { ascending: false });
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching customer cylinder report:', error);
      setError('Lỗi khi tải báo cáo bình thuộc khách');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchMachineInventoryReport = async (filters = {}) => {
    setLoading(true);
    setError(null);
    try {
      // Use RPC if date range is provided
      if (filters.startDate && filters.endDate) {
        const { data, error } = await supabase.rpc('get_machine_balance_by_date', {
          p_start_date: filters.startDate,
          p_end_date: filters.endDate,
          p_warehouse: filters.warehouse || null
        });
        if (error) throw error;
        if (filters.customer) {
          return data.filter(item => item.customer_name.toLowerCase().includes(filters.customer.toLowerCase()));
        }
        return data;
      }

      let query = supabase
        .from('view_machine_monthly_balance')
        .select('*');

      if (filters.year) query = query.eq('nam', filters.year);
      if (filters.month) query = query.eq('thang', filters.month);

      // Apply warehouse filter for warehouse managers/staff (Non-Admin)
      if (role !== 'Admin' && department) {
        const userWhCode = department.includes('-') ? department.split('-')[0].trim() : department.trim();
        query = query.ilike('kho', `%${userWhCode}%`);
      } else if (filters.warehouse) {
        query = query.eq('kho', filters.warehouse);
      }

      if (filters.customer) query = query.ilike('customer_name', `%${filters.customer}%`);

      const { data, error } = await query.order('nam', { ascending: false }).order('thang', { ascending: false });
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching machine inventory report:', error);
      setError('Lỗi khi tải báo cáo máy thuộc khách');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchSalesReport = async (filters = {}) => {
    setLoading(true);
    try {
      let query = supabase
        .from('view_sales_summary_monthly')
        .select('*');

      if (filters.year) query = query.eq('nam', filters.year);
      if (filters.month) query = query.eq('thang', filters.month);

      // Apply warehouse filter for warehouse managers/staff (Non-Admin)
      if (role !== 'Admin' && department) {
        const userWhCode = department.includes('-') ? department.split('-')[0].trim() : department.trim();
        query = query.ilike('kho', `%${userWhCode}%`);
      } else if (filters.warehouse) {
        query = query.eq('kho', filters.warehouse);
      }

      if (filters.nvkd) query = query.eq('nvkd', filters.nvkd);
      if (filters.customer_category) query = query.eq('loai_khach', filters.customer_category);

      const { data, error } = await query.order('doanh_so', { ascending: false });
      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error fetching sales report:', err);
      toast.error('Lỗi tải báo cáo doanh số');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchErrorReport = async (filters = {}) => {
    setLoading(true);
    try {
      let query = supabase.from('view_error_summary_monthly').select('*');

      if (filters.year) query = query.eq('nam', filters.year);
      if (filters.month) query = query.eq('thang', filters.month);
      if (filters.quarter) query = query.eq('quy', filters.quarter);
      if (filters.category) query = query.eq('error_category', filters.category);

      // Apply warehouse filter for warehouse managers/staff (Non-Admin)
      if (role !== 'Admin' && department) {
        const userWhCode = department.includes('-') ? department.split('-')[0].trim() : department.trim();
        query = query.ilike('kho', `%${userWhCode}%`);
      } else if (filters.warehouse) {
        query = query.eq('kho', filters.warehouse);
      }

      const { data, error } = await query.order('ngay_bao_loi', { ascending: false });
      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error fetching error report:', err);
      toast.error('Lỗi tải báo cáo lỗi thiết bị');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomerCylinderDebt = async (customerId) => {
    if (!customerId) return [];
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('view_customer_cylinder_debt')
        .select('*')
        .eq('customer_id', customerId);
      
      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error fetching cylinder debt:', err);
      // toast.error('Lỗi tải thông tin nợ vỏ'); -- Don't show toast for every fetch
      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchCylinderAgingStats = async (filters = {}) => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('view_cylinder_aging_stats')
        .select('*');

      // Apply warehouse filter for warehouse managers/staff (Non-Admin)
      if (role !== 'Admin' && department) {
        const userWhCode = department.includes('-') ? department.split('-')[0].trim() : department.trim();
        query = query.ilike('kho', `%${userWhCode}%`);
      } else if (filters.warehouse_id) {
        query = query.eq('kho', filters.warehouse_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchCylinderAgingDetails = async (filters = {}) => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('view_cylinder_aging_details')
        .select('*');

      // Apply warehouse filter for warehouse managers/staff (Non-Admin)
      if (role !== 'Admin' && department) {
        const userWhCode = department.includes('-') ? department.split('-')[0].trim() : department.trim();
        query = query.ilike('kho', `%${userWhCode}%`);
      } else if (filters.warehouse_id) {
        query = query.eq('kho', filters.warehouse_id);
      }
      
      if (filters.limit) {
         query = query.limit(filters.limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchFilterOptions = async () => {
    setLoading(true);
    setError(null);
    try {
      const [warehousesRes, customerTypesRes, categoriesRes, salespersonsRes, machineTypesRes, yearsRes] = await Promise.all([
        supabase.from('warehouses').select('id, name').order('name'),
        supabase.from('customers').select('customer_type').not('customer_type', 'is', null).order('customer_type'),
        supabase.from('customers').select('category').not('category', 'is', null).order('category'),
        supabase.from('app_users').select('name').order('name'),
        supabase.from('machines').select('machine_type').order('machine_type'),
        supabase.rpc('get_distinct_years')
      ]);

      const warehouses = warehousesRes.data || [];
      const customerTypes = [...new Set((customerTypesRes.data || []).map(r => r.customer_type))];
      const categories = [...new Set((categoriesRes.data || []).map(r => r.category))];
      const salespersons = [...new Set((salespersonsRes.data || []).map(r => r.name))];
      const machineTypes = [...new Set((machineTypesRes.data || []).map(r => r.machine_type))];
      const currentYear = new Date().getFullYear();
      const defaultYears = Array.from({ length: currentYear - 2023 }, (_, i) => 2024 + i).reverse(); 
      const years = Array.isArray(yearsRes?.data) 
        ? yearsRes.data.map(r => typeof r === 'object' ? Object.values(r)[0] : r)
        : defaultYears;

      return {
        warehouses,
        customerTypes,
        categories,
        salespersons,
        machineTypes,
        years: [...new Set(years)].sort((a, b) => b - a)
      };
    } catch (err) {
      console.error('fetchFilterOptions error:', err);
      setError(err.message);
      return {
        warehouses: [],
        customerTypes: [],
        categories: [],
        salespersons: [],
        machineTypes: [],
        years: [new Date().getFullYear()]
      };
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    fetchDashboardSummary,
    fetchCustomerStats,
    fetchSalespersonStats,
    fetchCylinderExpiry,
    fetchCustomerExpiry,
    fetchCylinderErrors,
    fetchMachineStats,
    fetchMachineSummary,
    fetchOrdersMonthly,
    fetchCustomerCylinderReport,
    fetchMachineInventoryReport,
    fetchSalesReport,
    fetchErrorReport,
    fetchCustomerCylinderDebt,
    fetchMachineRevenue,
    fetchCylinderAgingStats,
    fetchCylinderAgingDetails,
    fetchFilterOptions
  };
};

export default useReports;
