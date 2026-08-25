'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { apiRequest } from '../../../lib/api';
import { Ticket, Users, TrendingUp, Landmark, ChevronRight, ArrowRight, Package, CheckCircle, PlayCircle } from 'lucide-react';
import Link from 'next/link';

interface PartnerDashboardSummary {
  partnerName: string;
  totalCampaigns: number;
  activeCampaigns: number;
  soldVouchers: number;
  customerCount: number;
  revenue: number;
  usedVouchers?: number;
}

interface CampaignCategory {
  category: {
    nameVi: string;
    code: string;
  };
}

interface VoucherCampaign {
  campaignId: string;
  title: string;
  category: string | null;
  originalPrice: number;
  salePrice: number;
  capacity: number;
  soldQuantity: number;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'PAUSED' | 'EXPIRED' | 'SOLD_OUT';
  usedCount: number;
  revenue: number;
  campaignCategories?: CampaignCategory[];
}

const STATUS_CONFIG: Record<VoucherCampaign['status'], { label: string; badgeClass: string }> = {
  DRAFT:            { label: 'Bản nháp',        badgeClass: 'bg-slate-100 text-slate-700' },
  PENDING_APPROVAL: { label: 'Chờ duyệt',       badgeClass: 'bg-yellow-100 text-yellow-800' },
  APPROVED:         { label: 'Hoạt động',        badgeClass: 'bg-green-100 text-green-700' },
  REJECTED:         { label: 'Đã từ chối',       badgeClass: 'bg-red-100 text-red-700' },
  PAUSED:           { label: 'Tạm dừng',         badgeClass: 'bg-orange-100 text-orange-700' },
  EXPIRED:          { label: 'Hết hạn',          badgeClass: 'bg-slate-100 text-slate-500' },
  SOLD_OUT:         { label: 'Hết hàng',         badgeClass: 'bg-purple-100 text-purple-700' },
};

const formatMoney = (value: number) => new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
}).format(value);

export default function PartnerDashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<PartnerDashboardSummary | null>(null);
  const [campaigns, setCampaigns] = useState<VoucherCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [summaryData, campaignsData] = await Promise.all([
          apiRequest<PartnerDashboardSummary>('/partners/dashboard'),
          apiRequest<VoucherCampaign[]>('/vouchers/partner/list'),
        ]);
        setSummary(summaryData);
        setCampaigns(campaignsData);
      } catch (error) {
        console.error('Không thể tải dashboard đối tác:', error);
        setSummary({
          partnerName: user?.fullName || 'Đối tác',
          totalCampaigns: 0,
          activeCampaigns: 0,
          soldVouchers: 0,
          customerCount: 0,
          revenue: 0,
          usedVouchers: 0,
        });
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [user?.fullName]);

  const stats = useMemo(() => {
    const base = summary ?? {
      partnerName: user?.fullName || 'Đối tác',
      totalCampaigns: 0,
      activeCampaigns: 0,
      soldVouchers: 0,
      customerCount: 0,
      revenue: 0,
      usedVouchers: 0,
    };

    const overallUsageRate = base.soldVouchers > 0 
      ? Math.round(((base.usedVouchers ?? 0) / base.soldVouchers) * 100)
      : 0;

    return [
      { name: 'Voucher đã phát hành', value: String(base.totalCampaigns), icon: Ticket, change: `${base.activeCampaigns} đang hoạt động`, changeType: 'positive' },
      { name: 'Khách hàng mua', value: String(base.customerCount), icon: Users, change: 'Tổng khách hàng phát sinh', changeType: 'positive' },
      { name: 'Tổng voucher đã bán', value: String(base.soldVouchers), icon: Landmark, change: 'Đã bán thành công', changeType: 'neutral' },
      { name: 'Tỷ lệ sử dụng toàn bộ', value: `${overallUsageRate}%`, icon: CheckCircle, change: `Đã quét ${base.usedVouchers ?? 0}/${base.soldVouchers} voucher`, changeType: 'positive' },
      { name: 'Doanh thu tạm tính', value: formatMoney(base.revenue), icon: TrendingUp, change: 'Tổng giá trị bán ra', changeType: 'positive' },
    ];
  }, [summary, user?.fullName]);

  return (
    <div className="space-y-6">
      
      {/* BREADCRUMB */}
      <div className="flex items-center gap-2 text-xs text-muted">
        <span>Partner Portal</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-semibold text-foreground">Dashboard</span>
      </div>

      {/* HEADER */}
      <div className="pb-4 border-b border-border/60">
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
          Xin chào, {user?.fullName || summary?.partnerName || 'Đối tác'}!
        </h1>
        <p className="mt-1 text-xs text-muted">
          Chào mừng bạn quay lại hệ thống quản trị VoucherNow. Dưới đây là hiệu suất và báo cáo các chiến dịch voucher của bạn.
        </p>
      </div>

      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-border bg-card">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
        </div>
      ) : (
        <>
          {/* STATS BLOCKS */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {stats.map((item) => (
              <div
                key={item.name}
                className="overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between h-full"
              >
                <div className="flex items-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-primary">
                    <item.icon className="h-6 w-6" />
                  </div>
                  <div className="ml-4 flex-1">
                    <p className="text-xs font-semibold text-muted uppercase tracking-wider">{item.name}</p>
                    <p className="text-xl font-bold text-foreground mt-0.5">{item.value}</p>
                  </div>
                </div>
                <div className="mt-4 border-t border-border/60 pt-3">
                  <span className="text-xs font-semibold text-primary">{item.change}</span>
                </div>
              </div>
            ))}
          </div>

          {/* HIỆU QUẢ CHIẾN DỊCH VOUCHER (BR-PAR-07 Báo cáo đối tác) */}
          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground">Hiệu quả Chiến dịch Voucher</h3>
                <p className="text-[11px] text-muted mt-0.5">Theo dõi doanh thu, số lượng bán và tỷ lệ quét sử dụng chi tiết (BR-PAR-07).</p>
              </div>
              <Link
                href="/partner/vouchers"
                className="text-xs text-primary hover:underline font-semibold flex items-center gap-1"
              >
                Xem chi tiết
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            
            <div className="p-0">
              {campaigns.length === 0 ? (
                <div className="text-center py-12 text-sm text-muted">
                  <Ticket className="h-8 w-8 text-muted/60 mx-auto mb-2" />
                  <p>Bạn chưa có chiến dịch voucher nào. Hãy tạo chiến dịch đầu tiên để bắt đầu bán hàng.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-secondary/40 border-b border-border text-foreground/80 font-bold uppercase tracking-wider">
                        <th className="p-4">Tên chiến dịch</th>
                        <th className="p-4">Doanh thu</th>
                        <th className="p-4">Bán/Phát hành</th>
                        <th className="p-4">Đã sử dụng</th>
                        <th className="p-4">Tỷ lệ sử dụng</th>
                        <th className="p-4">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {campaigns.slice(0, 5).map((campaign) => {
                        const cfg = STATUS_CONFIG[campaign.status];
                        const salePercent = campaign.capacity > 0
                          ? Math.round((campaign.soldQuantity / campaign.capacity) * 100)
                          : 0;
                        const usagePercent = campaign.soldQuantity > 0
                          ? Math.round((campaign.usedCount / campaign.soldQuantity) * 100)
                          : 0;

                        return (
                          <tr key={campaign.campaignId} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4">
                              <p className="font-bold text-foreground line-clamp-1">{campaign.title}</p>
                              {campaign.campaignCategories && campaign.campaignCategories.length > 0 ? (
                                <span className="inline-block mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary bg-primary/5 px-1 py-0.2 rounded">
                                  {campaign.campaignCategories[0].category.nameVi}
                                </span>
                              ) : campaign.category ? (
                                <span className="inline-block mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted bg-secondary px-1 py-0.2 rounded">
                                  {campaign.category}
                                </span>
                              ) : null}
                            </td>
                            <td className="p-4 font-bold text-foreground whitespace-nowrap">
                              {Number(campaign.revenue).toLocaleString('vi-VN')} đ
                            </td>
                            <td className="p-4 whitespace-nowrap">
                              <span className="font-semibold text-foreground">{campaign.soldQuantity}</span> / {campaign.capacity}
                              <div className="text-[10px] text-muted mt-0.5">{salePercent}% đã bán</div>
                            </td>
                            <td className="p-4 whitespace-nowrap">
                              <span className="font-semibold text-foreground">{campaign.usedCount}</span> lượt
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 w-16 bg-secondary rounded-full overflow-hidden">
                                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${usagePercent}%` }} />
                                </div>
                                <span className="font-bold text-foreground">{usagePercent}%</span>
                              </div>
                            </td>
                            <td className="p-4 whitespace-nowrap">
                              <span className={`inline-block text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${cfg?.badgeClass || 'bg-slate-100'}`}>
                                {cfg?.label || campaign.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}

    </div>
  );
}
