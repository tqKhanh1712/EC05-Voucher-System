'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { apiRequest } from '../../../../lib/api';
import { getErrorMessage } from '../../../../lib/errors';
import { 
  Users as UsersIcon, 
  UserCog, 
  Search, 
  ShieldAlert, 
  Mail, 
  Phone, 
  UserCheck, 
  UserX,
  Calendar,
  Lock,
  Unlock,
  Shield,
  Briefcase,
  UserCheck2,
  ChevronRight
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

interface User {
  userId: string;
  email: string | null;
  phone: string | null;
  fullName: string | null;
  role: 'CUSTOMER' | 'PARTNER' | 'PARTNER_STAFF' | 'ADMIN';
  status: 'ACTIVE' | 'LOCKED' | 'PENDING_VERIFICATION';
  createdAt: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Trạng thái modal
  const [statusAction, setStatusAction] = useState<{
    user: User;
    targetStatus: 'ACTIVE' | 'LOCKED';
  } | null>(null);
  const [roleAction, setRoleAction] = useState<{
    user: User;
    targetRole: 'CUSTOMER' | 'PARTNER' | 'PARTNER_STAFF' | 'ADMIN';
  } | null>(null);

  const loadUsers = async () => {
    try {
      const data = await apiRequest<User[]>('/users/admin/list');
      setUsers(data);
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, 'Không thể tải danh sách tài khoản người dùng.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleUpdateStatus = async (userId: string, status: 'ACTIVE' | 'LOCKED') => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await apiRequest<void>(`/users/admin/${userId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setSuccessMsg(`Đã ${status === 'ACTIVE' ? 'mở khóa' : 'khóa'} tài khoản thành công!`);
      loadUsers();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, 'Lỗi xảy ra khi cập nhật trạng thái tài khoản.'));
    }
  };

  const handleUpdateRole = async (userId: string, role: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await apiRequest<void>(`/users/admin/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      setSuccessMsg('Đã cập nhật vai trò người dùng thành công!');
      loadUsers();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, 'Lỗi xảy ra khi thay đổi vai trò tài khoản.'));
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      (u.fullName && u.fullName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.phone && u.phone.includes(searchTerm));
    
    const matchesRole = !roleFilter || u.role === roleFilter;
    const matchesStatus = !statusFilter || u.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-red-500/10 text-red-500 border border-red-500/20">
            <Shield className="h-3.5 w-3.5" />
            ADMIN
          </span>
        );
      case 'PARTNER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-orange-500/10 text-orange-500 border border-orange-500/20">
            <Briefcase className="h-3.5 w-3.5" />
            PARTNER
          </span>
        );
      case 'PARTNER_STAFF':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <UserCheck2 className="h-3.5 w-3.5" />
            STAFF
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20">
            <UsersIcon className="h-3.5 w-3.5" />
            CUSTOMER
          </span>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            Kích hoạt
          </span>
        );
      case 'LOCKED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
            Bị khóa
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-slate-500/10 text-slate-500 border border-slate-500/20">
            Chờ xác thực
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">

      {/* BREADCRUMB */}
      <div className="flex items-center gap-2 text-xs text-muted">
        <span>Admin Portal</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-semibold text-foreground">Quản lý tài khoản</span>
      </div>

      {/* TIÊU ĐỀ + TÌM KIẾM */}
      <div className="pb-4 border-b border-border/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-foreground flex items-center gap-2">
            <UserCog className="h-6 w-6 text-primary" />
            Danh sách tài khoản người dùng
          </h1>
          <p className="text-xs text-muted mt-1">Xem toàn bộ tài khoản, thay đổi quyền hạn và khóa/mở khóa tài khoản người dùng.</p>
        </div>
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm họ tên, email, số điện thoại..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-xs text-foreground placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
          />
        </div>
      </div>

      {/* THÔNG BÁO */}
      {successMsg && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-800 text-sm">
          <UserCheck className="h-5 w-5 shrink-0 text-emerald-600" />
          <p className="font-medium">{successMsg}</p>
        </div>
      )}
      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-800 text-xs p-4 rounded-xl flex items-center gap-3">
          <ShieldAlert className="h-5 w-5 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* THỐNG KÊ NHANH */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide">Tổng tài khoản</p>
          <p className="text-2xl font-bold text-foreground mt-1">{users.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide">Khách hàng</p>
          <p className="text-2xl font-bold text-blue-500 mt-1">{users.filter(u => u.role === 'CUSTOMER').length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide">Đối tác & Nhân viên</p>
          <p className="text-2xl font-bold text-orange-500 mt-1">{users.filter(u => u.role === 'PARTNER' || u.role === 'PARTNER_STAFF').length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide">Đang bị khóa</p>
          <p className="text-2xl font-bold text-rose-500 mt-1">{users.filter(u => u.status === 'LOCKED').length}</p>
        </div>
      </div>

      {/* BỘ LỌC DẠNG TAB PILL */}
      <div className="flex flex-wrap gap-4">
        <div className="flex flex-wrap gap-1.5">
          {[{ v: '', l: 'Tất cả vai trò' }, { v: 'CUSTOMER', l: 'Khách hàng' }, { v: 'PARTNER', l: 'Đối tác' }, { v: 'PARTNER_STAFF', l: 'Nhân viên' }, { v: 'ADMIN', l: 'Admin' }].map(f => (
            <button key={f.v} onClick={() => setRoleFilter(f.v)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                roleFilter === f.v ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-secondary text-foreground hover:bg-secondary/80'
              }`}>{f.l}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[{ v: '', l: 'Mọi trạng thái' }, { v: 'ACTIVE', l: 'Kích hoạt' }, { v: 'LOCKED', l: 'Bị khóa' }, { v: 'PENDING_VERIFICATION', l: 'Chờ xác thực' }].map(f => (
            <button key={f.v} onClick={() => setStatusFilter(f.v)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                statusFilter === f.v ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-secondary text-foreground hover:bg-secondary/80'
              }`}>{f.l}</button>
          ))}
        </div>
      </div>

      {/* BẢNG DỮ LIỆU */}
      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-3">
          <UserX className="h-10 w-10 text-muted mx-auto" />
          <h3 className="text-sm font-bold text-foreground">Không tìm thấy tài khoản phù hợp</h3>
          <p className="text-xs text-muted">Hãy thay đổi bộ lọc hoặc từ khóa tìm kiếm.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-secondary/40 border-b border-border text-foreground/80 font-bold uppercase tracking-wider">
                  <th className="p-4">Họ và Tên</th>
                  <th className="p-4">Liên hệ</th>
                  <th className="p-4">Vai trò</th>
                  <th className="p-4">Trạng thái</th>
                  <th className="p-4">Ngày tạo</th>
                  <th className="p-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredUsers.map((userItem) => (
                  <tr key={userItem.userId} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                          {userItem.fullName?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground text-xs">{userItem.fullName || 'Chưa cập nhật'}</p>
                          <p className="text-[10px] text-muted truncate max-w-[150px]">{userItem.userId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 space-y-1">
                      {userItem.email && (
                        <div className="flex items-center gap-1.5 text-[11px] text-muted">
                          <Mail className="h-3.5 w-3.5 shrink-0" />
                          <span>{userItem.email}</span>
                        </div>
                      )}
                      {userItem.phone && (
                        <div className="flex items-center gap-1.5 text-[11px] text-muted">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          <span>{userItem.phone}</span>
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      {getRoleBadge(userItem.role)}
                    </td>
                    <td className="p-4">
                      {getStatusBadge(userItem.status)}
                    </td>
                    <td className="p-4 text-[11px] text-muted whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        <span>{new Date(userItem.createdAt).toLocaleDateString('vi-VN')}</span>
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Thay đổi vai trò */}
                        <select
                          value={userItem.role}
                          onChange={(e) => {
                            const newRole = e.target.value as any;
                            if (newRole !== userItem.role) {
                              setRoleAction({ user: userItem, targetRole: newRole });
                            }
                          }}
                          className="px-2 py-1 text-xs border border-border rounded bg-background text-foreground"
                        >
                          <option value="CUSTOMER">CUSTOMER</option>
                          <option value="PARTNER">PARTNER</option>
                          <option value="PARTNER_STAFF">STAFF</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>

                        {/* Toggle Status */}
                        {userItem.status === 'LOCKED' ? (
                          <button
                            onClick={() => setStatusAction({ user: userItem, targetStatus: 'ACTIVE' })}
                            className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                            title="Mở khóa tài khoản"
                          >
                            <Unlock className="h-4.5 w-4.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => setStatusAction({ user: userItem, targetStatus: 'LOCKED' })}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors"
                            title="Khóa tài khoản"
                          >
                            <Lock className="h-4.5 w-4.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Alert Dialog xác nhận khóa/mở khóa */}
      <AlertDialog open={!!statusAction} onOpenChange={(open) => !open && setStatusAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-500" />
              Xác nhận thay đổi trạng thái tài khoản?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Bạn đang chuẩn bị {statusAction?.targetStatus === 'LOCKED' ? 'KHÓA' : 'MỞ KHÓA'} tài khoản của{' '}
              <strong>{statusAction?.user.fullName || statusAction?.user.email}</strong>. 
              {statusAction?.targetStatus === 'LOCKED' && ' Người dùng bị khóa sẽ không thể đăng nhập hoặc thực hiện bất kỳ giao dịch nào trên hệ thống.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy bỏ</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (statusAction) {
                  handleUpdateStatus(statusAction.user.userId, statusAction.targetStatus);
                  setStatusAction(null);
                }
              }}
              className={statusAction?.targetStatus === 'LOCKED' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}
            >
              Xác nhận
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Alert Dialog xác nhận đổi vai trò */}
      <AlertDialog open={!!roleAction} onOpenChange={(open) => !open && setRoleAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              Thay đổi vai trò người dùng?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn thay đổi vai trò của <strong>{roleAction?.user.fullName || roleAction?.user.email}</strong> từ{' '}
              <span className="font-bold text-foreground">{roleAction?.user.role}</span> sang{' '}
              <span className="font-bold text-primary">{roleAction?.targetRole}</span>? Việc này sẽ trực tiếp thay đổi quyền hạn truy cập của người dùng trên toàn hệ thống.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy bỏ</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (roleAction) {
                  handleUpdateRole(roleAction.user.userId, roleAction.targetRole);
                  setRoleAction(null);
                }
              }}
              className="bg-primary hover:bg-primary-hover text-primary-foreground"
            >
              Xác nhận thay đổi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
