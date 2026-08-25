'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

type ToastVariant = 'success' | 'error';

interface ToastInput {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastItem extends Required<Pick<ToastInput, 'title' | 'variant'>> {
  id: number;
  description?: string;
}

interface ToastContextType {
  showToast: (toast: ToastInput) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    ({ title, description, variant = 'success', duration = 4000 }: ToastInput) => {
      const id = ++nextId.current;
      setToasts((current) => [
        ...current.slice(-2),
        { id, title, description, variant },
      ]);

      window.setTimeout(() => dismissToast(id), duration);
    },
    [dismissToast],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-relevant="additions"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex flex-col items-stretch gap-3 sm:left-auto sm:right-5 sm:w-full sm:max-w-sm"
      >
        {toasts.map((toast) => {
          const isSuccess = toast.variant === 'success';
          const Icon = isSuccess ? CheckCircle2 : AlertCircle;

          return (
            <div
              key={toast.id}
              role={isSuccess ? 'status' : 'alert'}
              className={`pointer-events-auto flex items-start gap-3 rounded-xl border bg-white p-4 shadow-xl animate-in slide-in-from-bottom-3 fade-in ${
                isSuccess
                  ? 'border-emerald-200 text-emerald-950'
                  : 'border-red-200 text-red-950'
              }`}
            >
              <Icon
                className={`mt-0.5 h-5 w-5 shrink-0 ${
                  isSuccess ? 'text-emerald-600' : 'text-red-600'
                }`}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold">{toast.title}</p>
                {toast.description ? (
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    {toast.description}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                aria-label="Đóng thông báo"
                className="-mr-1 -mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast phải được đặt trong ToastProvider');
  }
  return context;
}
