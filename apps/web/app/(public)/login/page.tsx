'use client';

import React, { useState, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '../../../context/AuthContext';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Mail, Lock, Ticket, ArrowRight, AlertCircle, Info, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { getErrorMessage } from '../../../lib/errors';
import { getSafeInternalRedirect } from '../../../lib/navigation';

const loginSchema = z.object({
  identifier: z.string().min(1, 'Vui lòng nhập Email hoặc Số điện thoại.'),
  password: z.string().min(6, 'Mật khẩu phải chứa ít nhất 6 ký tự.'),
});

type LoginSchemaType = z.infer<typeof loginSchema>;

function LoginForm() {
  const { login, loading } = useAuth();
  const searchParams = useSearchParams();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const showPartnerInfo = searchParams.get('registered') === 'partner';
  const redirectTo = getSafeInternalRedirect(searchParams.get('redirect'));

  const {
    register: formRegister,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginSchemaType>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginSchemaType) => {
    setErrorMsg(null);
    const isEmail = data.identifier.includes('@');
    
    const payload = {
      [isEmail ? 'email' : 'phone']: data.identifier,
      password: data.password,
    };

    try {
      await login(payload, redirectTo);
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.'));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8 font-sans">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-card p-8 border border-border shadow-xl">
        
        {/* LOGO & TIÊU ĐỀ */}
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white shadow shadow-primary/20">
            <Ticket className="h-6 w-6" />
          </div>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-foreground">
            VoucherNow
          </h2>
          <p className="mt-2 text-sm text-muted">
            Trải nghiệm mua sắm và đổi voucher tiện lợi
          </p>
        </div>

        {/* THÔNG BÁO CHO ĐỐI TÁC VỪA ĐĂNG KÝ */}
        {showPartnerInfo && (
          <div className="flex items-start gap-3 rounded-lg bg-secondary p-4 border border-primary/20 text-primary text-sm leading-relaxed">
            <Info className="h-5 w-5 shrink-0 text-primary mt-0.5" />
            <div>
              <span className="font-semibold">Đăng ký đối tác thành công!</span>
              <p className="mt-1 text-xs text-muted">
                Hồ sơ doanh nghiệp đang chờ Admin phê duyệt. Hệ thống sẽ kích hoạt tài khoản ngay sau khi phê duyệt hoàn tất.
              </p>
            </div>
          </div>
        )}

        {/* THÔNG BÁO LỖI NẾU ĐĂNG NHẬP THẤT BẠI */}
        {errorMsg && (
          <div className="flex items-center gap-3 rounded-lg bg-red-500/10 p-4 border border-red-500/20 text-red-800 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
            <p className="font-medium">{errorMsg}</p>
          </div>
        )}

        {/* FORM ĐĂNG NHẬP */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            
            {/* EMAIL / SỐ ĐIỆN THOẠI */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Email hoặc Số điện thoại
              </label>
              <div className="relative rounded-lg">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Mail className="h-5 w-5 text-muted/70" />
                </div>
                <input
                  type="text"
                  {...formRegister('identifier')}
                  className="block w-full rounded-lg border border-border bg-card py-3 pl-10 pr-3 text-foreground placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-sm transition-all"
                  placeholder="name@example.com hoặc 0901234567"
                />
              </div>
              {errors.identifier && (
                <p className="mt-1.5 text-xs text-primary flex items-center gap-1 font-medium">
                  {errors.identifier.message}
                </p>
              )}
            </div>

            {/* MẬT KHẨU */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-foreground">
                  Mật khẩu
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-semibold text-primary hover:text-primary-hover transition-colors"
                >
                  Quên mật khẩu?
                </Link>
              </div>
              <div className="relative rounded-lg">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-5 w-5 text-muted/70" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  {...formRegister('password')}
                  className="block w-full rounded-lg border border-border bg-card py-3 pl-10 pr-10 text-foreground placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-sm transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted/70 hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-xs text-primary flex items-center gap-1 font-medium">
                  {errors.password.message}
                </p>
              )}
            </div>
          </div>


          {/* NÚT SUBMIT */}
          <button
            type="submit"
            disabled={loading}
            className="group relative flex w-full justify-center rounded-lg bg-primary py-3 px-4 text-sm font-semibold text-white hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 transition-all duration-200 shadow-sm"
          >
            {loading ? 'Đang xử lý...' : 'Đăng nhập'}
            {!loading && <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />}
          </button>
        </form>

        {/* LINK CHUYỂN TRANG ĐĂNG KÝ VÀ TRỞ VỀ */}
        <div className="text-center text-sm text-muted pt-6 border-t border-border/60 flex flex-col items-center gap-4">
          <div>
            Chưa có tài khoản?{' '}
            <Link
              href="/register"
              className="font-bold text-primary hover:text-primary-hover transition-colors"
            >
              Đăng ký ngay
            </Link>
          </div>
          <Link href="/" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-primary font-medium transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Trở về trang chủ
          </Link>
        </div>

      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
