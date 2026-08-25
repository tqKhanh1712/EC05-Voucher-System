'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { apiRequest } from '../../../../lib/api';
import { getErrorMessage } from '../../../../lib/errors';
import { hasDiscount, resolveSellingPrice } from '../../../../lib/pricing';
import {
  Ticket, Check, X, AlertCircle, CheckCircle,
  Building, Search, Filter,
  PauseCircle, PlayCircle, Archive, ChevronRight,
  Package
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../components/ui/alert-dialog';

type VoucherStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'PAUSED' | 'EXPIRED' | 'SOLD_OUT';

interface Branch {
  branchId: string;
  name: string;
}

interface CampaignBranch {
  branch: Branch;
}

interface Partner {
  companyName: string;
  representative: string | null;
}

interface CampaignCategory {
  isPrimary: boolean;
  category: {
    nameVi: string;
    code: string;
  };
}

interface VoucherCampaign {
  campaignId: string;
  title: string;
  description: string | null;
  category: string | null;
  originalPrice: number;
  salePrice: number | null;
  capacity: number;
  soldQuantity: number;
  saleStartTime: string;
  saleEndTime: string;
  usageStartTime: string;
  usageEndTime: string;
  status: VoucherStatus;
  partner: Partner;
  campaignBranches: CampaignBranch[];
  campaignCategories: CampaignCategory[];
}

const STATUS_CONFIG: Record<VoucherStatus, { label: string; badgeClass: string }> = {
  DRAFT:            { label: 'Bản nháp',        badgeClass: 'bg-slate-100 text-slate-700' },
  PENDING_APPROVAL: { label: 'Chờ duyệt',       badgeClass: 'bg-yellow-100 text-yellow-800' },
  APPROVED:         { label: 'Hoạt động',        badgeClass: 'bg-green-100 text-green-700' },
  REJECTED:         { label: 'Đã từ chối',       badgeClass: 'bg-red-100 text-red-700' },
  PAUSED:           { label: 'Tạm dừng',         badgeClass: 'bg-orange-100 text-orange-700' },
  EXPIRED:          { label: 'Hết hạn',          badgeClass: 'bg-slate-100 text-slate-500' },
  SOLD_OUT:         { label: 'Hết hàng',         badgeClass: 'bg-purple-100 text-purple-700' },
};

const STATUS_FILTERS = [
  { value: '',                label: 'Tất cả' },
  { value: 'PENDING_APPROVAL',label: 'Chờ duyệt' },
  { value: 'APPROVED',        label: 'Hoạt động' },
  { value: 'PAUSED',          label: 'Tạm dừng' },
  { value: 'REJECTED',        label: 'Đã từ chối' },
  { value: 'EXPIRED',         label: 'Hết hạn' },
  { value: 'SOLD_OUT',        label: 'Hết hàng' },
  { value: 'DRAFT',           label: 'Bản nháp' },
];

type ActionType = 'approve' | 'reject' | 'pause' | 'reactivate' | 'expire';

interface ConfirmAction {
  campaign: VoucherCampaign;
  type: ActionType;
  targetStatus: VoucherStatus;
}

const ACTION_CONFIG: Record<ActionType, {
  title: string;
  description: string;
  confirmLabel: string;
  confirmClass: string;
}> = {
  approve: {
    title: 'Phê duyệt chiến dịch',
    description: 'Chiến dịch sẽ được đăng bán công khai và khách hàng có thể mua voucher ngay lập tức.',
    confirmLabel: 'Phê duyệt đăng tải',
    confirmClass: 'bg-emerald-600 hover:bg-emerald-700',
  },
  reject: {
    title: 'Từ chối chiến dịch',
    description: 'Chiến dịch sẽ bị từ chối. Đối tác sẽ cần chỉnh sửa và gửi lại để xét duyệt.',
    confirmLabel: 'Xác nhận từ chối',
    confirmClass: 'bg-red-600 hover:bg-red-700',
  },
  pause: {
    title: 'Tạm dừng chiến dịch',
    description: 'Chiến dịch sẽ bị ẩn khỏi trang công khai. Bạn có thể kích hoạt lại bất cứ lúc nào.',
    confirmLabel: 'Tạm dừng ngay',
    confirmClass: 'bg-orange-600 hover:bg-orange-700',
  },
  reactivate: {
    title: 'Kích hoạt lại chiến dịch',
    description: 'Chiến dịch sẽ được đăng tải trở lại và khách hàng có thể tiếp tục mua voucher.',
    confirmLabel: 'Kích hoạt lại',
    confirmClass: 'bg-emerald-600 hover:bg-emerald-700',
  },
  expire: {
    title: 'Đánh dấu hết hạn',
    description: 'Chiến dịch sẽ chuyển sang trạng thái hết hạn vĩnh viễn và không thể khôi phục.',
    confirmLabel: 'Đánh dấu hết hạn',
    confirmClass: 'bg-slate-600 hover:bg-slate-700',
  },
};

export default function AdminVouchersPage() {
  const [campaigns, setCampaigns] = useState<VoucherCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const [filterStatus, setFilterStatus] = useState<string>('PENDING_APPROVAL');
  const [keyword, setKeyword] = useState('');

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      if (keyword) params.set('keyword', keyword);
      const data = await apiRequest<VoucherCampaign[]>(`/vouchers/admin/list?${params.toString()}`);
      setCampaigns(data);
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, 'Không thể tải danh sách chiến dịch voucher.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void loadCampaigns();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus]);

  const summary = useMemo(() => ({
    total: campaigns.length,
    totalCapacity: campaigns.reduce((sum, c) => sum + c.capacity, 0),
    totalSold: campaigns.reduce((sum, c) => sum + c.soldQuantity, 0),
  }), [campaigns]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    void loadCampaigns();
  };

  const handleStatusUpdate = async (action: ConfirmAction) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await apiRequest<void>(`/vouchers/admin/${action.campaign.campaignId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: action.targetStatus }),
      });
      setSuccessMsg(`Đã ${ACTION_CONFIG[action.type].confirmLabel.toLowerCase()} chiến dịch "${action.campaign.title}" thành công!`);
      setTimeout(() => setSuccessMsg(null), 4000);
      void loadCampaigns();
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, 'Có lỗi xảy ra khi cập nhật trạng thái chiến dịch.'));
    }
  };

  const getAvailableActions = (campaign: VoucherCampaign) => {
    const s = campaign.status;
    const actions: { type: ActionType; targetStatus: VoucherStatus; label: string; icon: React.ReactNode; btnClass: string }[] = [];
    if (s === 'PENDING_APPROVAL') {
      actions.push({ type: 'approve', targetStatus: 'APPROVED',  label: 'Duyệt',     icon: <Check className="h-3.5 w-3.5" />,      btnClass: 'bg-green-600 hover:bg-green-700 text-white' });
      actions.push({ type: 'reject',  targetStatus: 'REJECTED',  label: 'Từ chối',   icon: <X className="h-3.5 w-3.5" />,          btnClass: 'bg-red-600 hover:bg-red-700 text-white' });
    }
    if (s === 'APPROVED') {
      actions.push({ type: 'pause',   targetStatus: 'PAUSED',    label: 'Tạm dừng',  icon: <PauseCircle className="h-3.5 w-3.5" />, btnClass: 'border border-orange-300 text-orange-700 hover:bg-orange-50' });
      actions.push({ type: 'expire',  targetStatus: 'EXPIRED',   label: 'Hết hạn',   icon: <Archive className="h-3.5 w-3.5" />,    btnClass: 'border border-slate-300 text-slate-600 hover:bg-slate-50' });
    }
    if (s === 'PAUSED') {
      actions.push({ type: 'reactivate', targetStatus: 'APPROVED', label: 'Kích hoạt', icon: <PlayCircle className="h-3.5 w-3.5" />, btnClass: 'bg-green-600 hover:bg-green-700 text-white' });
      actions.push({ type: 'expire',     targetStatus: 'EXPIRED',  label: 'Hết hạn',   icon: <Archive className="h-3.5 w-3.5" />,   btnClass: 'border border-slate-300 text-slate-600 hover:bg-slate-50' });
    }
    if (s === 'REJECTED') {
      actions.push({ type: 'approve', targetStatus: 'APPROVED', label: 'Duyệt lại', icon: <Check className="h-3.5 w-3.5" />, btnClass: 'border border-green-300 text-green-700 hover:bg-green-50' });
    }
    return actions;
  };

  return (
    <div className="space-y-6">

      {/* BREADCRUMB */}
      <div className="flex items-center gap-2 text-xs text-muted">
        <span>Admin Portal</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-semibold text-foreground">Quản lý Voucher</span>
      </div>

      {/* TIÊU ĐỀ + TÌM KIẾM */}
      <div className="pb-4 border-b border-border/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-foreground flex items-center gap-2">
            <Ticket className="h-6 w-6 text-primary" />
            Danh sách Chiến dịch Voucher
          </h1>
          <p className="text-xs text-muted mt-1">
            Phê duyệt, từ chối, tạm dừng, kích hoạt và kiểm soát vòng đời toàn bộ chiến dịch trên hệ thống.
          </p>
        </div>

        <form onSubmit={handleSearch} className="relative flex gap-2 max-w-xs w-full">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="Tìm tên voucher, đối tác..."
              className="block w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-xs text-foreground placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
            />
          </div>
          <button type="submit" className="px-3 py-2 text-xs font-semibold bg-secondary border border-border rounded-lg hover:bg-secondary/80 flex items-center gap-1.5 shrink-0">
            <Filter className="h-3.5 w-3.5" /> Lọc
          </button>
        </form>
      </div>

      {/* THÔNG BÁO */}
      {successMsg && (
        <div className="flex items-center gap-3 rounded-lg bg-green-500/10 p-4 border border-green-500/20 text-green-800 text-sm">
          <CheckCircle className="h-5 w-5 shrink-0 text-green-600" />
          <p className="font-medium">{successMsg}</p>
        </div>
      )}
      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-800 text-xs p-4 rounded-xl flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* TAB LỌC TRẠNG THÁI */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => { setFilterStatus(f.value); setKeyword(''); }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              filterStatus === f.value
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-secondary text-foreground hover:bg-secondary/80'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* THỐNG KÊ NHANH */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Chiến dịch tìm thấy', value: summary.total,         icon: <Ticket className="h-4 w-4 text-primary" /> },
          { label: 'Tổng khối lượng',      value: summary.totalCapacity, icon: <Package className="h-4 w-4 text-primary" /> },
          { label: 'Tổng đã bán',          value: summary.totalSold,     icon: <CheckCircle className="h-4 w-4 text-primary" /> },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">{stat.label}</span>
              {stat.icon}
            </div>
            <div className="mt-3 text-2xl font-bold text-foreground">{stat.value.toLocaleString('vi-VN')}</div>
          </div>
        ))}
      </div>

      {/* BẢNG DANH SÁCH */}
      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-3">
          <Ticket className="h-10 w-10 text-muted mx-auto" />
          <h3 className="text-sm font-bold text-foreground">Không tìm thấy chiến dịch nào</h3>
          <p className="text-xs text-muted">Không có chiến dịch nào phù hợp với bộ lọc hiện tại.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-secondary/40 border-b border-border text-foreground/80 font-bold uppercase tracking-wider">
                  <th className="p-4">Chiến dịch</th>
                  <th className="p-4">Đối tác</th>
                  <th className="p-4">Giá bán</th>
                  <th className="p-4">Tiến độ bán</th>
                  <th className="p-4">Thời hạn</th>
                  <th className="p-4">Trạng thái</th>
                  <th className="p-4 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {campaigns.map((campaign) => {
                  const cfg = STATUS_CONFIG[campaign.status];
                  const actions = getAvailableActions(campaign);
                  const saleRate = campaign.capacity > 0
                    ? Math.round((campaign.soldQuantity / campaign.capacity) * 100)
                    : 0;

                  return (
                    <tr key={campaign.campaignId} className="hover:bg-slate-50 transition-colors">

                      {/* Chiến dịch */}
                      <td className="p-4 max-w-[220px]">
                        <p className="font-bold text-foreground line-clamp-2 leading-snug">{campaign.title}</p>
                        {/* Hiển thị danh mục tiếng Việt từ quan hệ CampaignCategory */}
                        {campaign.campaignCategories.length > 0 ? (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {campaign.campaignCategories.slice(0, 2).map(cc => (
                              <span
                                key={cc.category.code}
                                className={`inline-block text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                  cc.isPrimary
                                    ? 'text-primary bg-primary/5'
                                    : 'text-muted bg-secondary/50'
                                }`}
                              >
                                {cc.category.nameVi}
                              </span>
                            ))}
                            {campaign.campaignCategories.length > 2 && (
                              <span className="text-[10px] text-muted">+{campaign.campaignCategories.length - 2}</span>
                            )}
                          </div>
                        ) : campaign.category ? (
                          <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted bg-secondary/50 px-1.5 py-0.5 rounded">
                            {campaign.category}
                          </span>
                        ) : null}
                      </td>

                      {/* Đối tác */}
                      <td className="p-4 whitespace-nowrap">
                        <div className="font-semibold text-foreground flex items-center gap-1">
                          <Building className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          {campaign.partner.companyName}
                        </div>
                        {campaign.partner.representative && (
                          <span className="text-[10px] text-muted">ĐD: {campaign.partner.representative}</span>
                        )}
                      </td>

                      {/* Giá bán */}
                      <td className="p-4 whitespace-nowrap">
                        <span className="font-bold text-foreground">
                          {resolveSellingPrice(campaign).toLocaleString('vi-VN')} đ
                        </span>
                        {hasDiscount(campaign) ? (
                          <div className="mt-0.5 text-[10px] text-muted line-through">
                            {Number(campaign.originalPrice).toLocaleString('vi-VN')} đ
                          </div>
                        ) : null}
                      </td>

                      {/* Tiến độ */}
                      <td className="p-4">
                        <div className="text-muted mb-1">
                          <span className="font-semibold text-foreground">{campaign.soldQuantity}</span>/{campaign.capacity} chiếc
                        </div>
                        <div className="h-1.5 w-24 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${saleRate}%` }} />
                        </div>
                        <div className="text-[10px] text-muted mt-0.5">{saleRate}% đã bán</div>
                      </td>

                      {/* Thời hạn */}
                      <td className="p-4 whitespace-nowrap text-muted">
                        <div>Mở bán: <span className="text-foreground font-medium">{new Date(campaign.saleStartTime).toLocaleDateString('vi-VN')}</span></div>
                        <div>Hết hạn: <span className="text-foreground font-medium">{new Date(campaign.saleEndTime).toLocaleDateString('vi-VN')}</span></div>
                      </td>

                      {/* Trạng thái */}
                      <td className="p-4 whitespace-nowrap">
                        <span className={`inline-block text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${cfg.badgeClass}`}>
                          {cfg.label}
                        </span>
                      </td>

                      {/* Hành động */}
                      <td className="p-4 text-right whitespace-nowrap">
                        {actions.length > 0 ? (
                          <div className="flex items-center justify-end gap-1.5">
                            {actions.map(action => (
                              <button
                                key={action.type}
                                onClick={() => setConfirmAction({ campaign, type: action.type, targetStatus: action.targetStatus })}
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-md transition-colors ${action.btnClass}`}
                              >
                                {action.icon}
                                {action.label}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted text-[10px] italic">Không có</span>
                        )}
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* HỘP THOẠI XÁC NHẬN */}
      <AlertDialog
        open={Boolean(confirmAction)}
        onOpenChange={(open) => { if (!open) setConfirmAction(null); }}
      >
        {confirmAction && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {ACTION_CONFIG[confirmAction.type].title}&nbsp;&quot;{confirmAction.campaign.title}&quot;?
              </AlertDialogTitle>
              <AlertDialogDescription>
                {ACTION_CONFIG[confirmAction.type].description}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Hủy bỏ</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  void handleStatusUpdate(confirmAction);
                  setConfirmAction(null);
                }}
                className={ACTION_CONFIG[confirmAction.type].confirmClass}
              >
                {ACTION_CONFIG[confirmAction.type].confirmLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>

    </div>
  );
}
