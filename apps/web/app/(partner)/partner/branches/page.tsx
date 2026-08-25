'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { apiRequest } from '../../../../lib/api';
import { getErrorMessage } from '../../../../lib/errors';
import { MapPin, Plus, Edit2, Trash2, AlertCircle, CheckCircle, ChevronRight, Search } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '../../../../components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui/dialog';
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

const branchSchema = z.object({
  name: z.string().min(1, 'Tên chi nhánh không được để trống.'),
  address: z.string().min(1, 'Địa chỉ không được để trống.'),
});

type BranchSchemaType = z.infer<typeof branchSchema>;

interface Branch {
  branchId: string;
  name: string;
  address: string | null;
}

export default function PartnerBranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [branchToDelete, setBranchToDelete] = useState<Branch | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<BranchSchemaType>({
    resolver: zodResolver(branchSchema),
  });

  const loadBranches = async () => {
    try {
      const data = await apiRequest<Branch[]>('/partners/branches');
      setBranches(data);
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, 'Không thể tải danh sách chi nhánh.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void loadBranches();
    });
  }, []);

  const openAddModal = () => {
    setEditingBranch(null);
    reset({
      name: '',
      address: '',
    });
    setErrorMsg(null);
    setModalOpen(true);
  };

  const openEditModal = (branch: Branch) => {
    setEditingBranch(branch);
    setValue('name', branch.name);
    setValue('address', branch.address || '');
    setErrorMsg(null);
    setModalOpen(true);
  };

  const onSubmit = async (data: BranchSchemaType) => {
    setErrorMsg(null);
    const payload = {
      name: data.name,
      address: data.address,
    };
    try {
      if (editingBranch) {
        await apiRequest<void>(`/partners/branches/${editingBranch.branchId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        setSuccessMsg('Cập nhật chi nhánh thành công!');
      } else {
        await apiRequest<void>('/partners/branches', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setSuccessMsg('Thêm chi nhánh mới thành công!');
      }
      setModalOpen(false);
      loadBranches();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, 'Có lỗi xảy ra.'));
    }
  };

  const handleDelete = async (branchId: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await apiRequest<void>(`/partners/branches/${branchId}`, {
        method: 'DELETE',
      });
      setSuccessMsg('Xóa chi nhánh thành công!');
      loadBranches();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, 'Không thể xóa chi nhánh này.'));
    }
  };

  const filteredBranches = useMemo(() => {
    return branches.filter(b => 
      b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.address && b.address.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [branches, searchTerm]);

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
        <span>Partner Portal</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-semibold text-foreground">Chi nhánh cửa hàng</span>
      </div>

      {/* TIÊU ĐỀ & TÌM KIẾM */}
      <div className="pb-4 border-b border-border/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-foreground flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            Chi nhánh Cửa hàng
          </h1>
          <p className="text-xs text-muted mt-1">
            Quản lý vị trí địa lý và các chi nhánh hoạt động áp dụng voucher.
          </p>
        </div>

        <div className="flex items-center gap-2 max-w-md w-full sm:justify-end">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm chi nhánh..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-xs text-foreground placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
            />
          </div>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary hover:bg-primary/90 px-3 py-2 text-xs font-semibold text-primary-foreground transition shadow shadow-primary/10 shrink-0"
          >
            <Plus className="h-4 w-4" />
            Thêm chi nhánh
          </button>
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

      {/* DANH SÁCH CHI NHÁNH */}
      {filteredBranches.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-3">
          <MapPin className="h-10 w-10 text-muted mx-auto" />
          <h3 className="text-sm font-bold text-foreground">Không tìm thấy chi nhánh</h3>
          <p className="text-xs text-muted">Bấm nút &quot;Thêm chi nhánh&quot; ở trên hoặc thay đổi bộ lọc tìm kiếm.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-secondary/40 border-b border-border text-foreground/80 font-bold uppercase tracking-wider">
                  <th className="p-4">Tên chi nhánh / Cửa hàng</th>
                  <th className="p-4">Địa chỉ chi tiết</th>
                  <th className="p-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredBranches.map((branch) => (
                  <tr key={branch.branchId} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-bold text-foreground">{branch.name}</td>
                    <td className="p-4 text-muted leading-relaxed max-w-md">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>{branch.address || 'Chưa cập nhật địa chỉ'}</span>
                      </div>
                    </td>
                    <td className="p-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditModal(branch)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold border border-border bg-card text-foreground hover:bg-secondary/35 rounded-md transition-colors"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          Sửa
                        </button>
                        <button
                          onClick={() => setBranchToDelete(branch)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold bg-red-500/10 text-red-600 hover:bg-red-500/20 rounded-md transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DIALOG THÊM / SỬA CHI NHÁNH */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="border-b border-border pb-4 pr-8">
            <DialogTitle>
              {editingBranch ? 'Cập nhật chi nhánh' : 'Thêm chi nhánh mới'}
            </DialogTitle>
            <DialogDescription>
              {editingBranch
                ? 'Điều chỉnh tên và địa chỉ đang được sử dụng cho chi nhánh này.'
                : 'Thêm địa điểm áp dụng để có thể gán chi nhánh cho chiến dịch voucher.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label htmlFor="branch-name" className="mb-1.5 block text-xs font-semibold text-foreground">
                Tên chi nhánh / Cửa hàng
              </label>
              <input
                id="branch-name"
                type="text"
                {...register('name')}
                placeholder="Ví dụ: Chi nhánh Quận 1"
                aria-invalid={Boolean(errors.name)}
                className="block w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
              />
              {errors.name && (
                <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="branch-address" className="mb-1.5 block text-xs font-semibold text-foreground">
                Địa chỉ chi tiết
              </label>
              <textarea
                id="branch-address"
                rows={3}
                {...register('address')}
                placeholder="Ví dụ: 123 Nguyễn Trãi, Phường Bến Thành, Quận 1, TP. HCM"
                aria-invalid={Boolean(errors.address)}
                className="block w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
              />
              {errors.address && (
                <p className="mt-1 text-xs text-red-500">{errors.address.message}</p>
              )}
            </div>

            <DialogFooter className="mt-6">
              <DialogClose render={<Button type="button" variant="outline" size="sm" />}>
                Hủy bỏ
              </DialogClose>
              <Button type="submit" size="sm">
                {editingBranch ? 'Lưu thay đổi' : 'Thêm mới'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ALERT DIALOG XÓA CHI NHÁNH */}
      <AlertDialog
        open={Boolean(branchToDelete)}
        onOpenChange={(open) => {
          if (!open) setBranchToDelete(null);
        }}
      >
        {branchToDelete && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Xóa chi nhánh &quot;{branchToDelete.name}&quot;?</AlertDialogTitle>
              <AlertDialogDescription>
                Chi nhánh sẽ bị xóa khỏi danh sách địa điểm áp dụng voucher. Thao tác này
                không thể hoàn tác.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Hủy bỏ</AlertDialogCancel>
              <AlertDialogAction onClick={() => void handleDelete(branchToDelete.branchId)}>
                Xóa chi nhánh
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>

    </div>
  );
}
