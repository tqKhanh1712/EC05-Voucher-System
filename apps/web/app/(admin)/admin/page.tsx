'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { apiRequest } from '../../../lib/api';
import { 
  Shield, 
  Users, 
  Ticket, 
  ShoppingBag, 
  Coins, 
  UserCheck, 
  FolderTree, 
  AlertCircle,
  TrendingUp,
  FileCheck,
  Activity,
  Search,
  ArrowUpDown,
  ChevronRight
} from 'lucide-react';

interface PartnerPerformance {
  partnerId: string;
  companyName: string;
  totalCampaigns: number;
  vouchersSold: number;
  revenue: number;
  usageRate: number;
}

interface AdminDashboardSummary {
  totalPartners: number;
  totalCampaigns: number;
  totalSuccessfulOrders: number;
  totalRevenue: number;
  userStats: {
    totalCustomers: number;
    totalPartners: number;
    totalAdmins: number;
    totalStaffs: number;
  };
  campaignStats: {
    approved: number;
    pending: number;
    draft: number;
    rejected: number;
    expired: number;
  };
  partnerPerformance?: PartnerPerformance[];
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Mới: State phục vụ Tìm kiếm & Sắp xếp Hiệu suất Đối tác
  const [partnerSearchTerm, setPartnerSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'companyName' | 'totalCampaigns' | 'vouchersSold' | 'revenue' | 'usageRate'>('revenue');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const data = await apiRequest<AdminDashboardSummary>('/partners/admin/dashboard');
        setSummary(data);
      } catch (error) {
        console.error('Không thể tải dashboard admin:', error);
        setSummary({
          totalPartners: 0,
          totalCampaigns: 0,
          totalSuccessfulOrders: 0,
          totalRevenue: 0,
          userStats: {
            totalCustomers: 0,
            totalPartners: 0,
            totalAdmins: 0,
            totalStaffs: 0,
          },
          campaignStats: {
            approved: 0,
            pending: 0,
            draft: 0,
            rejected: 0,
            expired: 0,
          },
          partnerPerformance: []
        });
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const formatVND = (value: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
  };

  const getPercent = (value: number, total: number) => {
    if (!total) return '0%';
    return `${Math.round((value / total) * 100)}%`;
  };

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Tính toán danh sách đối tác được tìm kiếm & sắp xếp động
  const sortedPartners = useMemo(() => {
    if (!summary?.partnerPerformance) return [];
    
    let list = summary.partnerPerformance.filter(p => 
      p.companyName.toLowerCase().includes(partnerSearchTerm.toLowerCase())
    );

    list.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortDirection === 'asc' 
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      } else {
        return sortDirection === 'asc'
          ? (valA as number) - (valB as number)
          : (valB as number) - (valA as number);
      }
    });

    return list;
  }, [summary?.partnerPerformance, partnerSearchTerm, sortField, sortDirection]);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  // Tính tổng số lượng users từ stats
  const totalUsers = 
    (summary?.userStats.totalCustomers ?? 0) + 
    (summary?.userStats.totalPartners ?? 0) + 
    (summary?.userStats.totalAdmins ?? 0) + 
    (summary?.userStats.totalStaffs ?? 0);

  return (
    <div className="space-y-6">

      {/* BREADCRUMB */}
      <div className="flex items-center gap-2 text-xs text-muted">
        <span>Admin Portal</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-semibold text-foreground">Dashboard</span>
      </div>
      
      {/* TIÊU ĐỀ */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-foreground flex items-center gap-2">
            <Ticket className="h-6 w-6 text-primary" />
            Hệ thống Quản trị, {user?.fullName || 'Quản trị viên'}
          </h1>
          <p className="text-xs text-muted mt-1">
            Theo dõi doanh thu, số liệu tài khoản và phê duyệt nội dung trên toàn hệ thống thời gian thực.
          </p>
        </div>
      </div>

      {/* TỔNG QUAN STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        
        {/* Doanh thu (Gradient Card) */}
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-primary uppercase tracking-wider">Doanh thu sàn</p>
              <p className="text-2xl font-black text-foreground mt-2">{formatVND(summary?.totalRevenue ?? 0)}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow shadow-primary/20">
              <Coins className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
            <TrendingUp className="h-4 w-4" />
            <span>+15% so với tuần trước</span>
          </div>
        </div>

        {/* Khách hàng */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-muted uppercase tracking-wider">Đơn hàng thành công</p>
              <p className="text-2xl font-black text-foreground mt-2">{summary?.totalSuccessfulOrders ?? 0}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-primary">
              <ShoppingBag className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1 text-xs text-muted">
            <span className="font-semibold text-foreground">+{summary?.totalSuccessfulOrders}</span> đơn thanh toán hợp lệ
          </div>
        </div>

        {/* Đối tác */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-muted uppercase tracking-wider">Đối tác liên kết</p>
              <p className="text-2xl font-black text-foreground mt-2">{summary?.totalPartners ?? 0}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-primary">
              <Users className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1 text-xs text-muted">
            <span className="font-semibold text-foreground">{summary?.totalPartners}</span> pháp nhân đã phê duyệt
          </div>
        </div>

        {/* Voucher */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-muted uppercase tracking-wider">Tổng chiến dịch voucher</p>
              <p className="text-2xl font-black text-foreground mt-2">{summary?.totalCampaigns ?? 0}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-primary">
              <Ticket className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1 text-xs text-muted">
            <span className="font-semibold text-foreground">{summary?.campaignStats.pending}</span> chiến dịch chờ duyệt
          </div>
        </div>

      </div>

      {/* CHI TIẾT PHÂN BỔ SỐ LIỆU */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Phân bố người dùng */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-6">
            <UserCheck className="h-4.5 w-4.5 text-primary" />
            Phân bố tài khoản người dùng ({totalUsers})
          </h3>
          <div className="space-y-4">
            
            {/* Customer */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-foreground">Khách hàng mua sắm (Customer)</span>
                <span className="text-muted">{summary?.userStats.totalCustomers} ({getPercent(summary?.userStats.totalCustomers ?? 0, totalUsers)})</span>
              </div>
              <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 rounded-full transition-all duration-500" 
                  style={{ width: getPercent(summary?.userStats.totalCustomers ?? 0, totalUsers) }}
                />
              </div>
            </div>

            {/* Partner */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-foreground">Doanh nghiệp đối tác (Partner)</span>
                <span className="text-muted">{summary?.userStats.totalPartners} ({getPercent(summary?.userStats.totalPartners ?? 0, totalUsers)})</span>
              </div>
              <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-orange-500 rounded-full transition-all duration-500" 
                  style={{ width: getPercent(summary?.userStats.totalPartners ?? 0, totalUsers) }}
                />
              </div>
            </div>

            {/* Staff */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-foreground">Nhân viên chi nhánh (Staff)</span>
                <span className="text-muted">{summary?.userStats.totalStaffs} ({getPercent(summary?.userStats.totalStaffs ?? 0, totalUsers)})</span>
              </div>
              <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-amber-500 rounded-full transition-all duration-500" 
                  style={{ width: getPercent(summary?.userStats.totalStaffs ?? 0, totalUsers) }}
                />
              </div>
            </div>

            {/* Admin */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-foreground">Quản trị viên hệ thống (Admin)</span>
                <span className="text-muted">{summary?.userStats.totalAdmins} ({getPercent(summary?.userStats.totalAdmins ?? 0, totalUsers)})</span>
              </div>
              <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-rose-500 rounded-full transition-all duration-500" 
                  style={{ width: getPercent(summary?.userStats.totalAdmins ?? 0, totalUsers) }}
                />
              </div>
            </div>

          </div>
        </div>

        {/* Phân bố chiến dịch Voucher */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-6">
            <FileCheck className="h-4.5 w-4.5 text-primary" />
            Trạng thái các chương trình Voucher ({summary?.totalCampaigns})
          </h3>
          <div className="space-y-4">
            
            {/* Approved */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-foreground flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Đang hoạt động (Approved)
                </span>
                <span className="text-muted">{summary?.campaignStats.approved} ({getPercent(summary?.campaignStats.approved ?? 0, summary?.totalCampaigns ?? 0)})</span>
              </div>
              <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                  style={{ width: getPercent(summary?.campaignStats.approved ?? 0, summary?.totalCampaigns ?? 0) }}
                />
              </div>
            </div>

            {/* Pending */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-foreground flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-yellow-500" />
                  Đang chờ phê duyệt (Pending)
                </span>
                <span className="text-muted">{summary?.campaignStats.pending} ({getPercent(summary?.campaignStats.pending ?? 0, summary?.totalCampaigns ?? 0)})</span>
              </div>
              <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-yellow-500 rounded-full transition-all duration-500" 
                  style={{ width: getPercent(summary?.campaignStats.pending ?? 0, summary?.totalCampaigns ?? 0) }}
                />
              </div>
            </div>

            {/* Rejected */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-foreground flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                  Đã từ chối (Rejected)
                </span>
                <span className="text-muted">{summary?.campaignStats.rejected} ({getPercent(summary?.campaignStats.rejected ?? 0, summary?.totalCampaigns ?? 0)})</span>
              </div>
              <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-rose-500 rounded-full transition-all duration-500" 
                  style={{ width: getPercent(summary?.campaignStats.rejected ?? 0, summary?.totalCampaigns ?? 0) }}
                />
              </div>
            </div>

            {/* Expired */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-foreground flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-slate-400" />
                  Đã hết hạn sử dụng (Expired)
                </span>
                <span className="text-muted">{summary?.campaignStats.expired} ({getPercent(summary?.campaignStats.expired ?? 0, summary?.totalCampaigns ?? 0)})</span>
              </div>
              <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-slate-400 rounded-full transition-all duration-500" 
                  style={{ width: getPercent(summary?.campaignStats.expired ?? 0, summary?.totalCampaigns ?? 0) }}
                />
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* HIỆU SUẤT ĐỐI TÁC */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="h-4.5 w-4.5 text-primary" />
            Hiệu suất và Doanh thu của tất cả Đối tác liên kết
          </h3>
          
          {/* Ô Tìm kiếm đối tác */}
          <div className="relative w-full sm:w-64 bg-card border border-border rounded-lg shadow-sm">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted" />
            <input
              type="text"
              placeholder="Tìm đối tác..."
              value={partnerSearchTerm}
              onChange={(e) => setPartnerSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-transparent border-0 text-xs text-foreground focus:outline-none placeholder-slate-400"
            />
          </div>
        </div>
        
        {!summary?.partnerPerformance || summary.partnerPerformance.length === 0 ? (
          <p className="text-xs text-muted py-4 text-center">Chưa có dữ liệu hiệu suất đối tác.</p>
        ) : sortedPartners.length === 0 ? (
          <p className="text-xs text-muted py-4 text-center">Không tìm thấy đối tác phù hợp.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="border-b border-border bg-secondary/15 font-semibold text-muted uppercase">
                  <tr>
                    <th 
                      onClick={() => handleSort('companyName')} 
                      className="px-4 py-3 cursor-pointer hover:text-foreground transition-colors select-none"
                    >
                      <div className="flex items-center gap-1">
                        Đối tác
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('totalCampaigns')} 
                      className="px-4 py-3 cursor-pointer hover:text-foreground transition-colors select-none"
                    >
                      <div className="flex items-center gap-1">
                        Số chiến dịch
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('vouchersSold')} 
                      className="px-4 py-3 cursor-pointer hover:text-foreground transition-colors select-none"
                    >
                      <div className="flex items-center gap-1">
                        Voucher đã bán
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('revenue')} 
                      className="px-4 py-3 cursor-pointer hover:text-foreground transition-colors select-none"
                    >
                      <div className="flex items-center gap-1">
                        Doanh thu
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('usageRate')} 
                      className="px-4 py-3 cursor-pointer hover:text-foreground transition-colors select-none"
                    >
                      <div className="flex items-center gap-1">
                        Tỷ lệ quét sử dụng mã
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-foreground">
                  {sortedPartners.map((partner) => (
                    <tr key={partner.partnerId} className="hover:bg-secondary/5 transition-colors">
                      <td className="px-4 py-3 font-semibold">{partner.companyName}</td>
                      <td className="px-4 py-3 text-muted">{partner.totalCampaigns} chiến dịch</td>
                      <td className="px-4 py-3 font-medium">{partner.vouchersSold}</td>
                      <td className="px-4 py-3 font-bold text-primary">{formatVND(partner.revenue)}</td>
                      <td className="px-4 py-3 font-medium">
                        <div className="flex items-center gap-2">
                          <span className="w-8 shrink-0">{partner.usageRate}%</span>
                          <div className="h-1.5 w-16 bg-secondary rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-emerald-500 rounded-full" 
                              style={{ width: `${partner.usageRate}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* PANEL HƯỚNG DẪN */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm flex gap-4 items-start">
        <Activity className="h-6 w-6 text-primary shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-bold text-foreground mb-1">Hướng dẫn quản trị vận hành</h3>
          <p className="text-xs text-muted leading-relaxed">
            Hệ thống quản trị cung cấp các công cụ đầy đủ để bạn phê duyệt Đối tác liên kết và các chương trình Voucher mới. Bạn cũng có thể kiểm soát tài khoản người dùng của toàn bộ hệ thống bằng cách khóa/mở khóa hoặc phân lại quyền hạn phù hợp. Tất cả các hành động quản trị quan trọng (như phê duyệt/từ chối/khóa) đều được ghi vết tự động trong <strong>Nhật ký hệ thống</strong> phục vụ truy vết.
          </p>
        </div>
      </div>
    </div>
  );
}
