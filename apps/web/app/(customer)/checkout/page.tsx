'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../../lib/api';
import { getErrorMessage } from '../../../lib/errors';
import { resolveSellingPrice } from '../../../lib/pricing';
import { useAuth } from '../../../context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  CreditCard, 
  ShieldAlert, 
  Info,
  ChevronRight,
  Clock,
  CheckCircle,
  FileText
} from 'lucide-react';

interface Partner {
  companyName: string;
}

interface VoucherCampaign {
  campaignId?: string;
  title: string;
  originalPrice: number;
  salePrice: number | null;
  sellingPrice?: number;
  partner: Partner;
}

interface CartItem {
  cartItemId: string;
  quantity: number;
  campaign: VoucherCampaign;
}

interface CheckoutOrderItem {
  itemId?: string;
  orderItemId?: string;
  campaignId?: string;
  quantity: number;
  unitPrice: number;
  campaign?: {
    title?: string;
    salePrice?: number;
    partner?: Partner;
  };
}

interface CheckoutOrder {
  orderId: string;
  orderCode: string;
  totalAmount: number;
  reservationExpiresAt: string;
  selectedPaymentProvider: 'STRIPE' | 'PAYPAL' | 'VNPAY';
  recipientNote?: string;
  orderItems?: CheckoutOrderItem[];
}

interface PaymentRedirectResponse {
  paymentUrl: string;
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-background"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto" /></div>}>
      <CheckoutPageContent />
    </Suspense>
  );
}

function CheckoutPageContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderIdFromQuery = searchParams.get('orderId');
  const campaignIdFromQuery = searchParams.get('campaignId');
  const quantityFromQuery = Number(searchParams.get('quantity') || '1');
  const checkoutQuery = searchParams.toString();
  const isDirectCheckout = Boolean(campaignIdFromQuery && !orderIdFromQuery);

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Checkout form state
  const [recipientNote, setRecipientNote] = useState('');
  const [paymentProvider, setPaymentProvider] = useState<'STRIPE' | 'PAYPAL' | 'VNPAY'>('STRIPE');
  
  // Order created state
  const [createdOrder, setCreatedOrder] = useState<CheckoutOrder | null>(null);
  const [timeLeft, setTimeLeft] = useState(900); // 15 phút = 900 giây
  const [redirecting, setRedirecting] = useState(false);

  // Lấy giỏ hàng hiện tại để hiển thị tóm tắt
  const fetchCart = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<CartItem[]>('/cart');
      setCartItems(data);
      if (data.length === 0) {
        router.push('/cart');
      }
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, 'Không thể tải thông tin thanh toán.'));
    } finally {
      setLoading(false);
    }
  }, [router]);

  const fetchDirectItem = useCallback(async (campaignId: string, quantity: number) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
        setCartItems([]);
        setErrorMsg('Số lượng mua ngay phải từ 1 đến 10 voucher.');
        return;
      }

      const campaign = await apiRequest<VoucherCampaign>(`/vouchers/${campaignId}`);
      setCartItems([
        {
          cartItemId: `direct-${campaignId}`,
          quantity,
          campaign,
        },
      ]);
    } catch (error: unknown) {
      setCartItems([]);
      setErrorMsg(getErrorMessage(error, 'Không thể tải voucher cần thanh toán.'));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchExistingOrder = useCallback(async (orderId: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const orders = await apiRequest<CheckoutOrder[]>('/orders');
      const order = orders.find((item) => item.orderId === orderId);

      if (!order) {
        setCartItems([]);
        setCreatedOrder(null);
        setErrorMsg('Không tìm thấy đơn hàng chờ thanh toán này.');
        return;
      }

      const mappedItems = (order.orderItems || []).map((item, index) => ({
        cartItemId: item.itemId || item.orderItemId || item.campaignId || `${orderId}-${index}`,
        quantity: item.quantity,
        campaign: {
          title: item.campaign?.title || 'Voucher',
          originalPrice: Number(item.unitPrice ?? item.campaign?.salePrice ?? 0),
          salePrice: null,
          sellingPrice: Number(item.unitPrice ?? item.campaign?.salePrice ?? 0),
          partner: {
            companyName: item.campaign?.partner?.companyName || 'Partner',
          },
        },
      }));

      setCartItems(mappedItems);
      setCreatedOrder({
        ...order,
        selectedPaymentProvider: order.selectedPaymentProvider || 'STRIPE',
      });
      setPaymentProvider(order.selectedPaymentProvider || 'STRIPE');
      setRecipientNote(order.recipientNote || '');
    } catch (error: unknown) {
      setCartItems([]);
      setCreatedOrder(null);
      setErrorMsg(getErrorMessage(error, 'Không thể tải đơn hàng cần thanh toán.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        const redirectTarget = checkoutQuery ? `/checkout?${checkoutQuery}` : '/checkout';
        router.push(`/login?redirect=${encodeURIComponent(redirectTarget)}`);
      } else if (orderIdFromQuery) {
        queueMicrotask(() => {
          void fetchExistingOrder(orderIdFromQuery);
        });
      } else if (campaignIdFromQuery) {
        queueMicrotask(() => {
          void fetchDirectItem(campaignIdFromQuery, quantityFromQuery);
        });
      } else {
        queueMicrotask(() => {
          void fetchCart();
        });
      }
    }
  }, [
    user,
    authLoading,
    orderIdFromQuery,
    campaignIdFromQuery,
    quantityFromQuery,
    checkoutQuery,
    router,
    fetchCart,
    fetchDirectItem,
    fetchExistingOrder,
  ]);

  // Bộ đếm ngược giữ chỗ 15 phút
  useEffect(() => {
    if (!createdOrder) return;
    
    // Tính toán thời gian thực từ DB
    const expiry = new Date(createdOrder.reservationExpiresAt).getTime();
    const updateTimer = () => {
      const diff = Math.max(0, Math.floor((expiry - Date.now()) / 1000));
      setTimeLeft(diff);
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [createdOrder]);

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const order = await apiRequest<CheckoutOrder>('/orders', {
        method: 'POST',
        body: JSON.stringify({
          recipientNote,
          paymentProvider,
          ...(isDirectCheckout && campaignIdFromQuery
            ? {
                directItem: {
                  campaignId: campaignIdFromQuery,
                  quantity: quantityFromQuery,
                },
              }
            : {}),
        }),
      });
      setCreatedOrder(order);
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, 'Đặt hàng thất bại. Vui lòng thử lại.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaymentRedirect = async () => {
    if (!createdOrder) return;
    setRedirecting(true);
    setErrorMsg(null);
    try {
      const res = await apiRequest<PaymentRedirectResponse>(`/payments/${createdOrder.orderId}`, {
        method: 'POST',
        body: JSON.stringify({ provider: paymentProvider }),
      });
      
      // Chuyển hướng người dùng sang trang thanh toán chính thức hoặc mock URL
      if (res.paymentUrl.startsWith('http://') || res.paymentUrl.startsWith('https://')) {
        window.location.href = res.paymentUrl;
      } else {
        // Nếu là relative path (mock url)
        router.push(res.paymentUrl);
      }
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, 'Không thể chuyển hướng đến trang thanh toán.'));
      setRedirecting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto"></div>
      </div>
    );
  }

  const totalAmount = cartItems.reduce(
    (sum, item) => sum + resolveSellingPrice(item.campaign) * item.quantity,
    0
  );

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // MÀN HÌNH SAU KHI ĐẶT HÀNG THÀNH CÔNG (CHỜ THANH TOÁN MOCK)
  if (createdOrder) {
    return (
      <div className="min-h-screen bg-background font-sans py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto rounded-2xl border border-border bg-card p-8 shadow-xl text-center space-y-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600">
            <CheckCircle className="h-8 w-8" />
          </div>

          <div className="space-y-1">
            <h2 className="text-xl font-extrabold text-foreground">
              {orderIdFromQuery ? 'Tiếp tục thanh toán đơn hàng' : 'Đơn hàng đã được khởi tạo!'}
            </h2>
            <p className="text-xs text-muted">Mã đơn hàng: <span className="font-bold text-foreground">{createdOrder.orderCode}</span></p>
          </div>

          {/* Hộp đếm ngược giữ chỗ */}
          <div className="bg-secondary/40 border border-primary/20 rounded-xl p-4 flex flex-col items-center justify-center gap-1.5">
            <div className="flex items-center gap-1.5 text-xs text-primary font-bold">
              <Clock className="h-4 w-4" />
              <span>Thời gian giữ chỗ thanh toán</span>
            </div>
            <span className="text-2xl font-black text-primary font-mono tracking-wider">
              {formatTime(timeLeft)}
            </span>
            <p className="text-[10px] text-muted text-center max-w-xs mt-1 leading-relaxed">
              Tồn kho voucher đã được khoá dòng để giữ chỗ cho bạn. Đơn hàng sẽ tự động hủy nếu quá hạn thanh toán.
            </p>
          </div>

          {/* Chi tiết đơn */}
          <div className="text-xs text-left border-y border-border/60 py-4 space-y-2.5">
            <div className="flex justify-between">
              <span className="text-muted">Tổng số tiền:</span>
              <span className="font-extrabold text-primary text-sm">{Number(createdOrder.totalAmount).toLocaleString('vi-VN')} đ</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Cổng thanh toán:</span>
              <span className="font-bold text-foreground">{createdOrder.selectedPaymentProvider}</span>
            </div>
          </div>

          {errorMsg && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-3 text-left">
              {errorMsg}
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={handlePaymentRedirect}
              disabled={redirecting || timeLeft === 0}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary-hover text-white py-3 text-sm font-bold disabled:bg-slate-300 disabled:text-slate-500 transition-all shadow shadow-primary/10"
            >
              {redirecting ? 'Đang chuyển hướng...' : `Thanh toán ngay (${createdOrder.selectedPaymentProvider})`}
            </button>
            
            <Link
              href="/"
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border hover:bg-slate-50 text-foreground py-2.5 text-xs font-bold transition-colors"
            >
              Quay lại Trang chủ
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* THANH BREADCRUMB */}
        <div className="flex items-center gap-2 text-xs text-muted">
          <Link href="/" className="hover:text-primary font-semibold transition-colors">Trang chủ</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link
            href={isDirectCheckout && campaignIdFromQuery ? `/voucher/${campaignIdFromQuery}` : '/cart'}
            className="hover:text-primary font-semibold transition-colors"
          >
            {isDirectCheckout ? 'Chi tiết voucher' : 'Giỏ hàng'}
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-semibold text-foreground">Thanh toán</span>
        </div>

        <div className="flex items-center gap-2 pb-3 border-b border-border/60">
          <CreditCard className="h-6 w-6 text-primary" />
          <h1 className="text-xl sm:text-2xl font-extrabold text-foreground">
            {isDirectCheckout ? 'Thanh toán Mua ngay' : 'Thanh toán Đơn hàng'}
          </h1>
        </div>

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-800 text-sm p-4 rounded-xl flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleCheckoutSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* CỘT TRÁI: THÔNG TIN NGƯỜI NHẬN & CỔNG THANH TOÁN (2 CỘT) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* THÔNG TIN KHÁCH HÀNG */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-primary" />
                Thông tin người mua hàng
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-muted block">Họ và tên:</span>
                  <span className="font-bold text-foreground mt-0.5 block">{user?.fullName}</span>
                </div>
                <div>
                  <span className="text-muted block">Thông tin liên hệ (Email/SĐT):</span>
                  <span className="font-bold text-foreground mt-0.5 block">{user?.email || user?.phone}</span>
                </div>
              </div>

              {/* Note input */}
              <div className="space-y-1.5 pt-2">
                <label className="block text-xs font-semibold text-foreground">
                  Ghi chú đơn hàng (Tùy chọn)
                </label>
                <textarea
                  value={recipientNote}
                  onChange={(e) => setRecipientNote(e.target.value)}
                  placeholder="Ghi chú thêm cho đơn hàng..."
                  rows={3}
                  className="block w-full rounded-lg border border-border bg-card py-2 px-3 text-foreground placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-sm transition-all"
                />
              </div>
            </div>

            {/* PHƯƠNG THỨC THANH TOÁN */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard className="h-4 w-4 text-primary" />
                Chọn Cổng thanh toán
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                
                {/* STRIPE */}
                <label className={`flex flex-col items-center justify-center p-4 border rounded-xl cursor-pointer hover:border-primary/50 transition-all ${
                  paymentProvider === 'STRIPE'
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border bg-card text-foreground'
                }`}>
                  <input
                    type="radio"
                    name="paymentProvider"
                    value="STRIPE"
                    checked={paymentProvider === 'STRIPE'}
                    onChange={() => setPaymentProvider('STRIPE')}
                    className="sr-only"
                  />
                  <span className="text-xs font-extrabold tracking-wider">STRIPE</span>
                  <span className="text-[9px] text-muted mt-1">Visa/Mastercard</span>
                </label>

                {/* PAYPAL */}
                <label className={`flex flex-col items-center justify-center p-4 border rounded-xl cursor-pointer hover:border-primary/50 transition-all ${
                  paymentProvider === 'PAYPAL'
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border bg-card text-foreground'
                }`}>
                  <input
                    type="radio"
                    name="paymentProvider"
                    value="PAYPAL"
                    checked={paymentProvider === 'PAYPAL'}
                    onChange={() => setPaymentProvider('PAYPAL')}
                    className="sr-only"
                  />
                  <span className="text-xs font-extrabold tracking-wider">PAYPAL</span>
                  <span className="text-[9px] text-muted mt-1">Ví điện tử quốc tế</span>
                </label>

                {/* VNPAY */}
                <label className={`flex flex-col items-center justify-center p-4 border rounded-xl cursor-pointer hover:border-primary/50 transition-all ${
                  paymentProvider === 'VNPAY'
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border bg-card text-foreground'
                }`}>
                  <input
                    type="radio"
                    name="paymentProvider"
                    value="VNPAY"
                    checked={paymentProvider === 'VNPAY'}
                    onChange={() => setPaymentProvider('VNPAY')}
                    className="sr-only"
                  />
                  <span className="text-xs font-extrabold tracking-wider">VNPAY</span>
                  <span className="text-[9px] text-muted mt-1">Thẻ ATM / QR Việt Nam</span>
                </label>

              </div>
            </div>

          </div>

          {/* CỘT PHẢI: TÓM TẮT ĐƠN HÀNG & NÚT TIẾN HÀNH (1 CỘT) */}
          <div className="lg:col-span-1">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-6">
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Tóm tắt đơn hàng</h3>
              
              {/* Danh sách rút gọn */}
              <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                {cartItems.map((item) => (
                  <div key={item.cartItemId} className="flex justify-between gap-4 text-xs border-b border-border/40 pb-2">
                    <div className="flex-1">
                      <div className="font-semibold text-foreground line-clamp-1">{item.campaign.title}</div>
                      <span className="text-[10px] text-muted">Số lượng: {item.quantity}</span>
                    </div>
                    <span className="font-bold text-foreground shrink-0">
                      {(resolveSellingPrice(item.campaign) * item.quantity).toLocaleString('vi-VN')} đ
                    </span>
                  </div>
                ))}
              </div>

              {/* Tổng tiền */}
              <div className="space-y-3 text-xs text-muted border-t border-border/60 pt-4">
                <div className="flex items-center justify-between border-t border-dashed border-border/40 pt-3">
                  <span className="text-sm font-bold text-foreground">Tổng tiền:</span>
                  <span className="text-base font-extrabold text-primary">
                    {totalAmount.toLocaleString('vi-VN')} đ
                  </span>
                </div>
              </div>

              <div className="rounded-lg bg-yellow-50 border border-yellow-100 p-3 flex gap-2 text-[10px] text-yellow-800">
                <Info className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
                <span>Nhấn nút đặt mua sẽ khoá dòng dữ liệu để giữ chỗ voucher trong 15 phút.</span>
              </div>

              <button
                type="submit"
                disabled={submitting || cartItems.length === 0}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary-hover text-white py-3 text-sm font-bold disabled:bg-slate-300 disabled:text-slate-500 transition-colors shadow shadow-primary/10"
              >
                {submitting ? 'Đang tạo đơn...' : 'Đặt mua & Thanh toán'}
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
}
