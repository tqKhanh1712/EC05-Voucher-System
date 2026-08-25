'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { apiRequest } from '../../../../lib/api';
import { getErrorMessage } from '../../../../lib/errors';
import { Building, FileText, User, AlertCircle, CheckCircle, ChevronRight } from 'lucide-react';

const profileSchema = z.object({
  companyName: z.string().min(1, 'Tên công ty không được để trống.'),
  taxCode: z.string().min(1, 'Mã số thuế không được để trống.'),
  representative: z.string().min(1, 'Người đại diện không được để trống.'),
});

type ProfileSchemaType = z.infer<typeof profileSchema>;

interface PartnerProfile {
  companyName: string;
  taxCode: string;
  representative: string | null;
}

export default function PartnerProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ProfileSchemaType>({
    resolver: zodResolver(profileSchema),
  });

  useEffect(() => {
    async function loadProfile() {
      try {
        const data = await apiRequest<PartnerProfile>('/partners/profile');
        setValue('companyName', data.companyName);
        setValue('taxCode', data.taxCode);
        setValue('representative', data.representative || '');
      } catch (error: unknown) {
        setErrorMsg(getErrorMessage(error, 'Không thể tải thông tin hồ sơ.'));
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [setValue]);

  const onSubmit = async (data: ProfileSchemaType) => {
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      await apiRequest<void>('/partners/profile', {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      setSuccessMsg('Cập nhật hồ sơ doanh nghiệp thành công!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, 'Lỗi xảy ra trong quá trình lưu hồ sơ.'));
    } finally {
      setSaving(false);
    }
  };

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
        <span className="font-semibold text-foreground">Hồ sơ Doanh nghiệp</span>
      </div>

      {/* TIÊU ĐỀ */}
      <div className="pb-4 border-b border-border/60">
        <h1 className="text-xl sm:text-2xl font-extrabold text-foreground flex items-center gap-2">
          <Building className="h-6 w-6 text-primary" />
          Hồ sơ Doanh nghiệp
        </h1>
        <p className="text-xs text-muted mt-1">
          Quản lý thông tin pháp lý và thông tin liên hệ của doanh nghiệp đối tác.
        </p>
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

      {/* FORM HỒ SƠ */}
      <div className="max-w-2xl mx-auto rounded-2xl border border-border bg-card p-6 shadow-sm">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          
          {/* TÊN CÔNG TY */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wider">
              Tên công ty / Cửa hàng
            </label>
            <div className="relative">
              <Building className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                {...register('companyName')}
                className="block w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-xs text-foreground placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                placeholder="Công ty TNHH Dịch vụ ABC"
              />
            </div>
            {errors.companyName && (
              <p className="mt-1 text-xs text-red-500">{errors.companyName.message}</p>
            )}
          </div>

          {/* MÃ SỐ THUẾ */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wider">
              Mã số thuế doanh nghiệp
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                {...register('taxCode')}
                className="block w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-xs text-foreground placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                placeholder="0101234567"
              />
            </div>
            {errors.taxCode && (
              <p className="mt-1 text-xs text-red-500">{errors.taxCode.message}</p>
            )}
          </div>

          {/* NGƯỜI ĐẠI DIỆN PHÁP LUẬT */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wider">
              Người đại diện pháp luật
            </label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                {...register('representative')}
                className="block w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-xs text-foreground placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                placeholder="Nguyễn Văn Đại Diện"
              />
            </div>
            {errors.representative && (
              <p className="mt-1 text-xs text-red-500">{errors.representative.message}</p>
            )}
          </div>

          {/* NÚT SUBMIT */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-primary hover:bg-primary/95 py-2 px-5 text-xs font-semibold text-white disabled:opacity-50 transition-colors shadow-sm"
            >
              {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>

        </form>
      </div>

    </div>
  );
}
