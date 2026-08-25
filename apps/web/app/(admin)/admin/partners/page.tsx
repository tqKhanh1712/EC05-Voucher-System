'use client';

import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../../../lib/api';
import { getErrorMessage } from '../../../../lib/errors';
import { Users, Check, X, AlertCircle, CheckCircle, Search, Mail, Phone, Lock, Unlock, Building2, ChevronRight } from 'lucide-react';
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

interface Partner {
  partnerId: string;
  companyName: string;
  taxCode: string;
  representative: string | null;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  accountStatus: 'ACTIVE' | 'LOCKED';
  createdAt: string;
  user: {
    email: string | null;
    phone: string | null;
    fullName: string | null;
    status: string;
  };
}

interface Branch {
  branchId: string;
  name: string;
  address: string;
}

export default function AdminPartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [partnerAction, setPartnerAction] = useState<{
    partner: Partner;
    type: 'approve' | 'reject';
  } | null>(null);

  // Mới bổ sung: xem chi nhánh & thay đổi trạng thái đối tác
  const [selectedPartnerForBranches, setSelectedPartnerForBranches] = useState<Partner | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [statusAction, setStatusAction] = useState<{
    partner: Partner;
    targetStatus: 'ACTIVE' | 'LOCKED';
  } | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  const loadPartners = async () => {
    try {
      const data = await apiRequest<Partner[]>('/partners/admin/list');
      setPartners(data);
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, 'Không thể tải danh sách đối tác.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void loadPartners();
    });
  }, []);

  const handleApprove = async (partnerId: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await apiRequest<void>(`/partners/admin/${partnerId}/approve`, {
        method: 'PATCH',
      });
      setSuccessMsg('Đã phê duyệt đối tác và kích hoạt tài khoản thành công!');
      loadPartners();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, 'Lỗi xảy ra khi duyệt đối tác.'));
    }
  };

  const handleReject = async (partnerId: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await apiRequest<void>(`/partners/admin/${partnerId}/reject`, {
        method: 'PATCH',
      });
      setSuccessMsg('Đã từ chối đối tác thành công.');
      loadPartners();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, 'Lỗi xảy ra khi từ chối đối tác.'));
    }
  };

  const handleToggleStatus = async (partnerId: string, status: 'ACTIVE' | 'LOCKED') => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await apiRequest<void>(`/partners/admin/${partnerId}/toggle-status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setSuccessMsg(`Đã ${status === 'ACTIVE' ? 'mở khóa' : 'khóa'} đối tác thành công!`);
      loadPartners();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, 'Lỗi xảy ra khi đổi trạng thái đối tác.'));
    }
  };

  const handleViewBranches = async (partner: Partner) => {
    setSelectedPartnerForBranches(partner);
    setLoadingBranches(true);
    setBranches([]);
    try {
      const data = await apiRequest<Branch[]>(`/partners/admin/${partner.partnerId}/branches`);
      setBranches(data);
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, 'Không thể tải danh sách chi nhánh của đối tác.'));
    } finally {
      setLoadingBranches(false);
    }
  };

  const filteredPartners = partners.filter(p => {
    const matchesSearch = 
      p.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.taxCode.includes(searchTerm) ||
      (p.representative && p.representative.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = 
      !statusFilter ? true :
      statusFilter === 'LOCKED' ? p.accountStatus === 'LOCKED' :
      p.approvalStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* BREADCRUMB */}
      <div className="flex items-center gap-2 text-xs text-muted">
        <span>Admin Portal</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-semibold text-foreground">Quản lý Đối tác</span>
      </div>

      {/* TIÊU ĐỀ + TÌM KIẾM */}
      <div className="pb-4 border-b border-border/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Danh sách đối tác liên kết
          </h1>
          <p className="text-xs text-muted mt-1">Xét duyệt hồ sơ đăng ký đối tác mới, xem danh sách chi nhánh và khóa/mở khóa đối tác đang hoạt động.</p>
        </div>
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm tên công ty, MST, đại diện..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-xs text-foreground placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
          />
        </div>
      </div>

      {/* THÔNG BÁO */}
      {successMsg && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-800 text-sm">
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

      {/* BỘ LỌC DẠNG TAB PILL */}
      <div className="flex flex-wrap gap-1.5">
        {[
          { v: '', l: 'Tất cả' },
          { v: 'PENDING', l: 'Chờ xét duyệt' },
          { v: 'APPROVED', l: 'Đã phê duyệt' },
          { v: 'REJECTED', l: 'Đã từ chối' },
          { v: 'LOCKED', l: 'Bị khóa' }
        ].map(f => (
          <button
            key={f.v}
            onClick={() => setStatusFilter(f.v)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              statusFilter === f.v
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-secondary text-foreground hover:bg-secondary/80'
            }`}
          >
            {f.l}
          </button>
        ))}
      </div>

      {/* BẢNG DANH SÁCH ĐỐI TÁC */}
      {filteredPartners.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-3">
          <Users className="h-10 w-10 text-muted mx-auto" />
          <h3 className="text-sm font-bold text-foreground">Không tìm thấy đối tác</h3>
          <p className="text-xs text-muted">Hệ thống hiện tại chưa ghi nhận yêu cầu đối tác nào khớp với bộ lọc.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-secondary/40 border-b border-border text-foreground/80 font-bold uppercase tracking-wider">
                  <th className="p-4">Tên Doanh nghiệp</th>
                  <th className="p-4">Mã số thuế / Đại diện</th>
                  <th className="p-4">Tài khoản Liên hệ</th>
                  <th className="p-4">Trạng thái duyệt</th>
                  <th className="p-4">Tài khoản</th>
                  <th className="p-4 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredPartners.map((partner) => (
                  <tr key={partner.partnerId} className="hover:bg-slate-50 transition-colors">
                    
                    {/* Tên Doanh nghiệp */}
                    <td className="p-4">
                      <div className="font-bold text-foreground">{partner.companyName}</div>
                      <div className="text-[10px] text-muted mt-0.5">
                        Ngày tạo: {new Date(partner.createdAt).toLocaleDateString('vi-VN')}
                      </div>
                    </td>

                    {/* MST / Người đại diện */}
                    <td className="p-4">
                      <div className="text-foreground font-semibold">MST: {partner.taxCode}</div>
                      <div className="text-[10px] text-muted mt-0.5">ĐD: {partner.representative || 'Chưa rõ'}</div>
                    </td>

                    {/* Tài khoản đăng ký */}
                    <td className="p-4 space-y-1">
                      <div className="text-[11px] text-foreground font-medium flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-muted shrink-0" />
                        <span>{partner.user.email || 'N/A'}</span>
                      </div>
                      <div className="text-[11px] text-muted flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-muted shrink-0" />
                        <span>{partner.user.phone || 'N/A'}</span>
                      </div>
                    </td>

                    {/* Trạng thái duyệt */}
                    <td className="p-4 whitespace-nowrap">
                      {partner.approvalStatus === 'PENDING' && (
                        <span className="inline-flex items-center rounded bg-yellow-100 px-2 py-0.5 text-[10px] font-extrabold uppercase text-yellow-800">
                          Chờ xét duyệt
                        </span>
                      )}
                      {partner.approvalStatus === 'APPROVED' && (
                        <span className="inline-flex items-center rounded bg-green-100 px-2 py-0.5 text-[10px] font-extrabold uppercase text-green-800">
                          Đã phê duyệt
                        </span>
                      )}
                      {partner.approvalStatus === 'REJECTED' && (
                        <span className="inline-flex items-center rounded bg-red-100 px-2 py-0.5 text-[10px] font-extrabold uppercase text-red-800">
                          Đã từ chối
                        </span>
                      )}
                    </td>

                    {/* Trạng thái tài khoản */}
                    <td className="p-4 whitespace-nowrap">
                      {partner.approvalStatus === 'APPROVED' ? (
                        partner.accountStatus === 'ACTIVE' ? (
                          <span className="inline-flex items-center rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold uppercase text-emerald-800">
                            Hoạt động
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded bg-rose-100 px-2 py-0.5 text-[10px] font-extrabold uppercase text-rose-800">
                            Bị khóa
                          </span>
                        )
                      ) : (
                        <span className="text-[10px] text-muted italic">-</span>
                      )}
                    </td>

                    {/* Hành động phê duyệt */}
                    <td className="p-4 text-right whitespace-nowrap">
                      {partner.approvalStatus === 'PENDING' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setPartnerAction({ partner, type: 'approve' })}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors"
                            title="Phê duyệt"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Duyệt
                          </button>
                          <button
                            onClick={() => setPartnerAction({ partner, type: 'reject' })}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
                            title="Từ chối"
                          >
                            <X className="h-3.5 w-3.5" />
                            Từ chối
                          </button>
                        </div>
                      ) : partner.approvalStatus === 'APPROVED' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleViewBranches(partner)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold border border-border bg-card text-foreground hover:bg-secondary/35 rounded-md transition-colors"
                            title="Xem các chi nhánh"
                          >
                            <Building2 className="h-3.5 w-3.5" />
                            Chi nhánh
                          </button>
                          {partner.accountStatus === 'ACTIVE' ? (
                            <button
                              onClick={() => setStatusAction({ partner, targetStatus: 'LOCKED' })}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent"
                              title="Khóa đối tác"
                            >
                              <Lock className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => setStatusAction({ partner, targetStatus: 'ACTIVE' })}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-transparent"
                              title="Mở khóa đối tác"
                            >
                              <Unlock className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted italic">Đã từ chối</span>
                      )}
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Duyệt/Từ chối */}
      <AlertDialog
        open={Boolean(partnerAction)}
        onOpenChange={(open) => {
          if (!open) setPartnerAction(null);
        }}
      >
        {partnerAction && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {partnerAction.type === 'approve' ? 'Phê duyệt' : 'Từ chối'} đối tác
                &nbsp;&quot;{partnerAction.partner.companyName}&quot;?
              </AlertDialogTitle>
              <AlertDialogDescription>
                {partnerAction.type === 'approve'
                  ? 'Hồ sơ đối tác sẽ được phê duyệt và tài khoản đăng nhập được kích hoạt.'
                  : 'Hồ sơ đối tác sẽ bị từ chối và tài khoản đăng nhập bị khóa.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Quay lại kiểm tra</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (partnerAction) {
                    void (partnerAction.type === 'approve'
                      ? handleApprove(partnerAction.partner.partnerId)
                      : handleReject(partnerAction.partner.partnerId));
                    setPartnerAction(null);
                  }
                }}
                className={partnerAction.type === 'approve' ? 'bg-primary hover:bg-primary-hover' : 'bg-red-600 hover:bg-red-700'}
              >
                {partnerAction.type === 'approve' ? 'Phê duyệt đối tác' : 'Từ chối đối tác'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>

      {/* Modal Khóa/Mở khóa */}
      <AlertDialog
        open={Boolean(statusAction)}
        onOpenChange={(open) => {
          if (!open) setStatusAction(null);
        }}
      >
        {statusAction && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {statusAction.targetStatus === 'LOCKED' ? 'Khóa' : 'Mở khóa'} tài khoản đối tác
                &nbsp;&quot;{statusAction.partner.companyName}&quot;?
              </AlertDialogTitle>
              <AlertDialogDescription>
                {statusAction.targetStatus === 'LOCKED'
                  ? 'Khi đối tác bị khóa, tất cả tài khoản nhân viên của họ cũng không thể quét/redeem mã và các chiến dịch voucher của họ có thể bị ảnh hưởng.'
                  : 'Tài khoản đối tác và quyền quản lý chiến dịch của họ sẽ hoạt động bình thường trở lại.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Hủy bỏ</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (statusAction) {
                    void handleToggleStatus(statusAction.partner.partnerId, statusAction.targetStatus);
                    setStatusAction(null);
                  }
                }}
                className={statusAction.targetStatus === 'LOCKED' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}
              >
                Xác nhận
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>

      {/* Custom branches dialog modal overlay */}
      {selectedPartnerForBranches && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-200">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Chi nhánh áp dụng ({selectedPartnerForBranches.companyName})
              </h3>
              <button 
                onClick={() => setSelectedPartnerForBranches(null)}
                className="p-1.5 rounded-md hover:bg-secondary/20 transition-colors text-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 max-h-[350px] overflow-y-auto space-y-3">
              {loadingBranches ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                </div>
              ) : branches.length === 0 ? (
                <p className="text-center py-6 text-sm text-muted">Chưa đăng ký chi nhánh nào.</p>
              ) : (
                branches.map((b) => (
                  <div key={b.branchId} className="p-3 border border-border bg-secondary/5 rounded-xl">
                    <p className="font-semibold text-foreground text-sm">{b.name}</p>
                    <p className="text-xs text-muted mt-1">{b.address}</p>
                  </div>
                ))
              )}
            </div>
            <div className="p-6 border-t border-border bg-secondary/10 flex justify-end">
              <button
                onClick={() => setSelectedPartnerForBranches(null)}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-secondary text-foreground hover:bg-secondary/80 transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
