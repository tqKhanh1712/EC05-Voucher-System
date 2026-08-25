'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiRequest } from '../../../../lib/api';
import { getErrorMessage } from '../../../../lib/errors';
import {
  discountPercentage,
  hasDiscount,
  resolveSellingPrice,
} from '../../../../lib/pricing';
import { useAuth } from '../../../../context/AuthContext';
import { useCart } from '../../../../context/CartContext';
import { useToast } from '../../../../context/ToastContext';
import ProductDescription from '../../../../components/ProductDescription';
import Link from 'next/link';
import Image from 'next/image';
import { 
  ArrowLeft, 
  MapPin, 
  Calendar, 
  Clock, 
  Store, 
  ShoppingCart, 
  CreditCard,
  LoaderCircle,
  AlertCircle, 
  CheckCircle,
  Ticket,
  ChevronRight,
  Info,
  Star,
  MessageSquare
} from 'lucide-react';

interface Branch {
  branchId: string;
  name: string;
  address: string | null;
}

interface CampaignBranch {
  branch: Branch;
}

interface Partner {
  companyName: string;
  representative: string | null;
}

interface VoucherCampaign {
  campaignId: string;
  title: string;
  description: string | null;
  termsAndConditions: string | null;
  category: string | null;
  thumbnailUrl: string | null;
  sourceUrl: string | null;
  usageValidityDays: number | null;
  originalPrice: number;
  salePrice: number | null;
  sellingPrice?: number;
  capacity: number;
  soldQuantity: number;
  reservedStock: number;
  saleStartTime: string;
  saleEndTime: string;
  usageStartTime: string;
  usageEndTime: string;
  isMultiUse: boolean;
  maxUsesPerCode: number | null;
  partner: Partner;
  primaryBrand: {
    displayName: string;
    logoUrl: string | null;
  } | null;
  primaryCategory: {
    nameVi: string;
    parent: { nameVi: string } | null;
  } | null;
  campaignBranches: CampaignBranch[];
}

interface ReviewCustomer {
  fullName: string | null;
}

interface Review {
  reviewId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  customer: ReviewCustomer;
}

interface ReviewStats {
  totalCount: number;
  averageRating: number;
}

interface ReviewsResponse {
  reviews: Review[];
  statistics: ReviewStats;
}

export default function VoucherDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { addToCart, addingCampaignIds } = useCart();
  const { showToast } = useToast();
  const campaignId = params.id as string;

  const [campaign, setCampaign] = useState<VoucherCampaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [purchaseQty, setPurchaseQty] = useState(1);
  const [isBuyingNow, startBuyNowTransition] = useTransition();

  // States cho module Đánh giá & Phản hồi (Commit 24)
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewStats, setReviewStats] = useState<ReviewStats>({ totalCount: 0, averageRating: 0 });
  const [userRating, setUserRating] = useState(5);
  const [userComment, setUserComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSuccess, setReviewSuccess] = useState(false);

  useEffect(() => {
    async function loadCampaignAndReviews() {
      try {
        const campaignData = await apiRequest<VoucherCampaign>(`/vouchers/${campaignId}`);
        setCampaign(campaignData);
        
        // Tải danh sách đánh giá của campaign
        const reviewsData = await apiRequest<ReviewsResponse>(`/reviews/campaign/${campaignId}`);
        setReviews(reviewsData.reviews);
        setReviewStats(reviewsData.statistics);
      } catch (error: unknown) {
        setErrorMsg(getErrorMessage(error, 'Không thể tải thông tin chi tiết voucher.'));
      } finally {
        setLoading(false);
      }
    }
    if (campaignId) {
      loadCampaignAndReviews();
    }
  }, [campaignId]);

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingReview(true);
    setReviewError(null);
    setReviewSuccess(false);

    try {
      await apiRequest<void>('/reviews', {
        method: 'POST',
        body: JSON.stringify({
          campaignId,
          rating: userRating,
          comment: userComment,
        }),
      });
      setReviewSuccess(true);
      setUserComment('');
      setUserRating(5);
      
      // Tải lại danh sách đánh giá mới nhất
      const reviewsData = await apiRequest<ReviewsResponse>(`/reviews/campaign/${campaignId}`);
      setReviews(reviewsData.reviews);
      setReviewStats(reviewsData.statistics);
    } catch (error: unknown) {
      setReviewError(getErrorMessage(error, 'Gửi đánh giá thất bại. Bạn chỉ có thể đánh giá sau khi đã mua và quét đổi mã voucher thành công.'));
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleAddToCart = async () => {
    await addToCart(campaignId, purchaseQty);
  };

  const handleBuyNow = () => {
    if (authLoading) return;

    const checkoutTarget = `/checkout?campaignId=${encodeURIComponent(campaignId)}&quantity=${purchaseQty}`;
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(checkoutTarget)}`);
      return;
    }

    if (user.role !== 'CUSTOMER') {
      showToast({
        title: 'Tài khoản không phù hợp',
        description: 'Vui lòng đăng nhập bằng tài khoản khách hàng để mua voucher.',
        variant: 'error',
      });
      return;
    }

    startBuyNowTransition(() => {
      router.push(checkoutTarget);
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto"></div>
      </div>
    );
  }

  if (errorMsg || !campaign) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-primary mx-auto" />
        <h3 className="text-lg font-bold text-foreground">Không tìm thấy voucher</h3>
        <p className="text-sm text-muted">{errorMsg || 'Chiến dịch voucher này không tồn tại hoặc đã bị gỡ bỏ.'}</p>
        <Link href="/" className="inline-flex items-center text-xs font-bold text-primary hover:underline">
          <ArrowLeft className="mr-1 h-4 w-4" /> Quay lại trang chủ
        </Link>
      </div>
    );
  }

  const remaining = campaign.capacity - campaign.soldQuantity;
  const isSoldOut = remaining <= 0;
  const discounted = hasDiscount(campaign);
  const discountPct = discountPercentage(campaign);
  const sellingPrice = resolveSellingPrice(campaign);
  const isAddingToCart = addingCampaignIds.has(campaignId);

  return (
    <div className="min-h-screen bg-background font-sans py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* THANH BREADCRUMB / QUAY LẠI */}
        <div className="flex items-center gap-2 text-xs text-muted">
          <Link href="/" className="hover:text-primary font-semibold transition-colors">Trang chủ</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-semibold text-foreground max-w-xs truncate">{campaign.title}</span>
        </div>

        {/* CONTAINER CHÍNH */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* CỘT TRÁI: CHI TIẾT VOUCHER */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
              {campaign.thumbnailUrl && (
                <div className="relative h-64 overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
                  <Image
                    src={campaign.thumbnailUrl}
                    alt=""
                    fill
                    sizes="(max-width: 1024px) 100vw, 66vw"
                    unoptimized
                    className="scale-110 object-cover opacity-20 blur-lg"
                  />
                  <Image
                    src={campaign.thumbnailUrl}
                    alt={campaign.title}
                    fill
                    sizes="(max-width: 1024px) 100vw, 66vw"
                    unoptimized
                    className="object-contain p-2"
                  />
                </div>
              )}
              
              {/* Badge & Title */}
              <div>
                <span className="inline-block text-[10px] font-bold text-primary bg-primary/5 rounded px-2 py-0.5 uppercase tracking-wide">
                  {campaign.primaryCategory?.nameVi || campaign.category || 'Khác'}
                </span>
                <h1 className="text-xl sm:text-2xl font-extrabold text-foreground mt-2 leading-tight">
                  {campaign.title}
                </h1>
                
                <div className="flex items-center gap-1.5 text-xs text-muted mt-2">
                  <Store className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-semibold text-foreground">
                    {campaign.primaryBrand?.displayName || campaign.partner.companyName}
                  </span>
                </div>
              </div>

              <ProductDescription description={campaign.description} />

              <div className="border-t border-border pt-4 space-y-3">
                <h3 className="text-sm font-bold text-foreground">Chú ý & Điều kiện áp dụng</h3>
                <div className="text-xs text-muted leading-relaxed whitespace-pre-line bg-amber-50/50 border border-amber-100 p-4 rounded-xl">
                  {campaign.termsAndConditions || 'Chưa có điều kiện áp dụng cho sản phẩm này.'}
                </div>
                {campaign.sourceUrl && (
                  <a
                    href={campaign.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex text-[11px] font-semibold text-primary hover:underline"
                  >
                    Xem thông tin cập nhật tại nguồn Giftpop
                  </a>
                )}
              </div>

              {/* Quy chế quét */}
              <div className="border-t border-border pt-4 text-xs space-y-2">
                <h3 className="text-sm font-bold text-foreground">Hình thức quy đổi</h3>
                <div className="flex items-center gap-2 text-muted">
                  <Ticket className="h-4 w-4 text-primary" />
                  <span>
                    Chế độ quét mã: {campaign.isMultiUse 
                      ? `Sử dụng nhiều lần (Tối đa ${campaign.maxUsesPerCode || 'không giới hạn'} lần quét)` 
                      : 'Quét 1 lần duy nhất để đổi voucher'
                    }
                  </span>
                </div>
              </div>

              {/* Chi nhánh áp dụng */}
              <div className="border-t border-border pt-4 space-y-3 text-xs">
                <h3 className="text-sm font-bold text-foreground">Chi nhánh áp dụng ({campaign.campaignBranches.length})</h3>
                <div className="grid grid-cols-1 gap-3">
                  {campaign.campaignBranches.map((cb) => (
                    <div key={cb.branch.branchId} className="flex gap-2 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-foreground">{cb.branch.name}</div>
                        <p className="text-[11px] text-muted mt-0.5">{cb.branch.address || 'Chưa cập nhật địa chỉ'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* PHÂN HỆ ĐÁNH GIÁ & Ý KIẾN PHẢN HỒI (Commit 24) */}
              <div className="border-t border-border pt-6 space-y-6">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    Đánh giá từ khách hàng ({reviewStats.totalCount})
                  </h3>
                  {reviewStats.totalCount > 0 && (
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center text-amber-500">
                        <Star className="h-4 w-4 fill-current" />
                      </div>
                      <span className="text-sm font-extrabold text-foreground">{reviewStats.averageRating}</span>
                      <span className="text-xs text-muted">/ 5.0</span>
                    </div>
                  )}
                </div>

                {/* FORM GỬI ĐÁNH GIÁ (Nếu là Customer đăng nhập) */}
                {user && user.role === 'CUSTOMER' && (
                  <div className="bg-secondary/40 border border-border rounded-2xl p-5 space-y-4">
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">Viết đánh giá của bạn</h4>
                    
                    <form onSubmit={handleReviewSubmit} className="space-y-3">
                      {/* Chọn Số Sao */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted">Đánh giá sao:</span>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setUserRating(star)}
                              className="text-amber-500 hover:scale-110 transition-transform"
                            >
                              <Star className={`h-5 w-5 ${star <= userRating ? 'fill-current' : 'text-slate-300'}`} />
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Bình luận text */}
                      <div className="space-y-1.5">
                        <textarea
                          value={userComment}
                          onChange={(e) => setUserComment(e.target.value)}
                          placeholder="Nhập cảm nghĩ, bình luận của bạn về chất lượng dịch vụ và voucher..."
                          rows={3}
                          className="block w-full rounded-lg border border-border bg-card py-2 px-3 text-xs text-foreground placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all resize-none"
                        />
                      </div>

                      {reviewError && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-800 text-[10px] p-2.5 rounded-lg flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                          <span>{reviewError}</span>
                        </div>
                      )}

                      {reviewSuccess && (
                        <div className="bg-green-500/10 border border-green-500/20 text-green-800 text-[10px] p-2.5 rounded-lg flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                          <span>Đã gửi đánh giá thành công! Cảm ơn ý kiến đóng góp của bạn.</span>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={submittingReview}
                        className="inline-flex items-center justify-center rounded-xl bg-primary hover:bg-primary-hover text-white px-4 py-2 text-xs font-bold transition-colors disabled:bg-slate-300"
                      >
                        {submittingReview ? 'Đang gửi...' : 'Gửi đánh giá'}
                      </button>
                    </form>
                  </div>
                )}

                {/* DANH SÁCH BÌNH LUẬN */}
                {reviews.length === 0 ? (
                  <p className="text-xs text-muted text-center py-4">Chưa có đánh giá nào cho chương trình voucher này.</p>
                ) : (
                  <div className="space-y-4">
                    {reviews.map((rev) => {
                      const reviewDate = new Date(rev.createdAt).toLocaleDateString('vi-VN');
                      return (
                        <div key={rev.reviewId} className="border-b border-border/40 pb-4 last:border-b-0 last:pb-0 space-y-2">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary">
                                {rev.customer.fullName?.charAt(0).toUpperCase() || 'C'}
                              </div>
                              <div>
                                <span className="text-xs font-bold text-foreground block">{rev.customer.fullName || 'Khách hàng ẩn danh'}</span>
                                <span className="text-[9px] text-muted">{reviewDate}</span>
                              </div>
                            </div>

                            {/* Số sao hiển thị */}
                            <div className="flex items-center gap-0.5">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star 
                                  key={star} 
                                  className={`h-3 w-3 ${star <= rev.rating ? 'text-amber-500 fill-current' : 'text-slate-200'}`} 
                                />
                              ))}
                            </div>
                          </div>

                          {rev.comment && (
                            <p className="text-xs text-muted pl-9 leading-relaxed">{rev.comment}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* CỘT PHẢI: KHUNG ĐẶT MUA */}
          <div className="lg:col-span-1">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sticky top-24 space-y-6">
              
              {/* Giá cả */}
              <div className="space-y-1">
                <span className="text-[10px] text-muted uppercase font-bold tracking-wider">
                  {discounted ? 'Giá khuyến mãi' : 'Giá bán'}
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-primary">
                    {sellingPrice.toLocaleString('vi-VN')} đ
                  </span>
                  {discounted ? (
                    <span className="text-xs text-muted line-through">
                      {Number(campaign.originalPrice).toLocaleString('vi-VN')} đ
                    </span>
                  ) : null}
                </div>
                {discountPct > 0 && (
                  <span className="inline-block text-[10px] font-bold text-red-700 bg-red-50 rounded px-1.5 py-0.5 ring-1 ring-red-600/10 mt-1">
                    Tiết kiệm {discountPct}% ({Math.round(Number(campaign.originalPrice) - sellingPrice).toLocaleString('vi-VN')} đ)
                  </span>
                )}
              </div>

              {/* Tình trạng kho hàng */}
              <div className="border-t border-border/60 pt-4 text-xs space-y-2 text-slate-700">
                <div className="flex items-center justify-between">
                  <span>Tình trạng:</span>
                  <span className={`font-bold ${isSoldOut ? 'text-red-600' : 'text-green-600'}`}>
                    {isSoldOut ? 'Hết hàng' : 'Đang mở bán'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Còn lại trong kho:</span>
                  <span className="font-bold text-foreground">{remaining} / {campaign.capacity} voucher</span>
                </div>
              </div>

              {/* Hạn sử dụng */}
              <div className="border-t border-border/60 pt-4 text-xs space-y-2 text-muted">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary shrink-0" />
                  <span>Bán đến: {new Date(campaign.saleEndTime).toLocaleDateString('vi-VN')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary shrink-0" />
                  <span>
                    {campaign.usageValidityDays
                      ? `Hạn dùng: ${campaign.usageValidityDays} ngày kể từ ngày mua`
                      : `Sử dụng đến: ${new Date(campaign.usageEndTime).toLocaleDateString('vi-VN')}`}
                  </span>
                </div>
              </div>

              {/* Bộ chọn số lượng (nếu chưa hết hàng) */}
              {!isSoldOut && (
                <div className="border-t border-border/60 pt-4 space-y-2">
                  <label className="block text-xs font-semibold text-foreground">Chọn số lượng mua</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={purchaseQty <= 1}
                      onClick={() => setPurchaseQty(purchaseQty - 1)}
                      className="h-8 w-8 rounded-lg border border-border flex items-center justify-center font-bold text-foreground hover:bg-slate-50 disabled:opacity-50"
                    >
                      -
                    </button>
                    <span className="h-8 w-12 border border-border rounded-lg flex items-center justify-center text-xs font-bold text-foreground bg-slate-50/50">
                      {purchaseQty}
                    </span>
                    <button
                      type="button"
                      disabled={purchaseQty >= Math.min(remaining, 10)}
                      onClick={() => setPurchaseQty(purchaseQty + 1)}
                      className="h-8 w-8 rounded-lg border border-border flex items-center justify-center font-bold text-foreground hover:bg-slate-50 disabled:opacity-50"
                    >
                      +
                    </button>
                    <span className="text-[10px] text-muted ml-1">(Tối đa 10)</span>
                  </div>
                </div>
              )}

              {/* Đăng nhập nhắc nhở */}
              {!user && (
                <div className="rounded-lg bg-yellow-50 p-3 border border-yellow-100 flex items-start gap-2 text-[10px] text-yellow-800">
                  <Info className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
                  <span>Bạn cần đăng nhập tài khoản Khách hàng để thực hiện giao dịch mua voucher.</span>
                </div>
              )}

              {/* Thêm vào giỏ hoặc mua ngay */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => void handleAddToCart()}
                  disabled={isSoldOut || isAddingToCart || authLoading}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-primary bg-white px-3 py-3 text-sm font-bold text-primary transition hover:bg-primary/5 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
                >
                  {isAddingToCart ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                  )}
                  {isSoldOut ? 'Hết hàng' : 'Thêm vào giỏ'}
                </button>
                <button
                  type="button"
                  onClick={handleBuyNow}
                  disabled={isSoldOut || isBuyingNow || authLoading}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-3 py-3 text-sm font-bold text-white shadow shadow-primary/10 transition hover:bg-primary-hover active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                >
                  {isBuyingNow ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <CreditCard className="h-4 w-4" aria-hidden="true" />
                  )}
                  {isSoldOut ? 'Hết hàng' : 'Mua ngay'}
                </button>
              </div>

            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
