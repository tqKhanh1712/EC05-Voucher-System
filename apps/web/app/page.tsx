'use client';

import React, { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { apiRequest } from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import Header from '../components/Header';
import FilterSidebar from '../components/FilterSidebar';
import VoucherCard, { type VoucherCampaignCard } from '../components/VoucherCard';
import ProductCardSkeleton from '../components/ProductCardSkeleton';
import { ArrowRight, ShieldAlert, Ticket, Grid, ArrowUpNarrowWide, ArrowDownWideNarrow } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';

interface CatalogCategory {
  code: string;
  name: string;
  campaignCount: number;
  children: Array<{
    code: string;
    name: string;
    campaignCount: number;
  }>;
}

interface CatalogFilters {
  keyword: string;
  categoryCode: string;
  maxPrice: string;
  sortPrice?: 'asc' | 'desc' | '';
}

interface CatalogCategoryResponse {
  categories: CatalogCategory[];
  totalCampaignCount: number;
}

const PRODUCT_SKELETON_COUNT = 6;

function buildCatalogUrl(filters: CatalogFilters) {
  const params = new URLSearchParams();
  if (filters.keyword) params.set('keyword', filters.keyword);
  if (filters.categoryCode) params.set('categoryCode', filters.categoryCode);
  
  if (filters.maxPrice) {
    const rawMaxPrice = filters.maxPrice.replace(/\D/g, '');
    if (rawMaxPrice) params.set('maxPrice', rawMaxPrice);
  }
  
  if (filters.sortPrice) params.set('sortPrice', filters.sortPrice);
  const queryString = params.toString();
  return `/vouchers${queryString ? `?${queryString}` : ''}`;
}

function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [initialFilters] = useState<CatalogFilters>(() => {
    const rawMaxPrice = searchParams.get('maxPrice');
    return {
      keyword: searchParams.get('keyword') || '',
      categoryCode: searchParams.get('category') || '',
      maxPrice: rawMaxPrice ? Number(rawMaxPrice).toLocaleString('vi-VN') : '',
      sortPrice: (searchParams.get('sortPrice') as 'asc'|'desc'|'') || '',
    };
  });
  
  const [campaigns, setCampaigns] = useState<VoucherCampaignCard[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [totalCampaigns, setTotalCampaigns] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // States for filtering
  const [keyword, setKeyword] = useState(initialFilters.keyword);
  const [category, setCategory] = useState(initialFilters.categoryCode);
  const [maxPrice, setMaxPrice] = useState(initialFilters.maxPrice);
  const [sortPrice, setSortPrice] = useState<'asc'|'desc'|''>(initialFilters.sortPrice || '');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const priceDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchCatalog = useCallback(async (filters: CatalogFilters) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await apiRequest<VoucherCampaignCard[]>(buildCatalogUrl(filters));
      setCampaigns(data);
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, 'Không thể tải danh sách voucher.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function loadInitialCatalog() {
      setLoading(true);
      setErrorMsg(null);
      try {
        const [catalogData, categoryData] = await Promise.all([
          apiRequest<VoucherCampaignCard[]>(buildCatalogUrl(initialFilters)),
          apiRequest<CatalogCategoryResponse>('/vouchers/categories'),
        ]);
        setCampaigns(catalogData);
        setCategories(categoryData.categories);
        setTotalCampaigns(categoryData.totalCampaignCount);
      } catch (error: unknown) {
        setErrorMsg(getErrorMessage(error, 'Không thể tải catalog voucher.'));
      } finally {
        setLoading(false);
      }
    }

    void loadInitialCatalog();
  }, [initialFilters]);

  const updateBrowserFilters = useCallback((filters: CatalogFilters) => {
    const params = new URLSearchParams();
    if (filters.keyword) params.set('keyword', filters.keyword);
    if (filters.categoryCode) params.set('category', filters.categoryCode);
    
    if (filters.maxPrice) {
      const rawMaxPrice = filters.maxPrice.replace(/\D/g, '');
      if (rawMaxPrice) params.set('maxPrice', rawMaxPrice);
    }
    
    if (filters.sortPrice) params.set('sortPrice', filters.sortPrice);
    const queryString = params.toString();
    router.push(queryString ? `/?${queryString}` : '/', { scroll: false });
  }, [router]);

  const scrollToProducts = useCallback(() => {
    document.getElementById('product-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const cancelPendingPriceFilter = useCallback(() => {
    if (priceDebounceTimer.current) {
      clearTimeout(priceDebounceTimer.current);
      priceDebounceTimer.current = null;
    }
  }, []);

  useEffect(() => {
    return () => cancelPendingPriceFilter();
  }, [cancelPendingPriceFilter]);

  const handleMaxPriceChange = useCallback((newMaxPrice: string) => {
    setMaxPrice(newMaxPrice);
    cancelPendingPriceFilter();

    priceDebounceTimer.current = setTimeout(() => {
      priceDebounceTimer.current = null;
      const filters = {
        keyword,
        categoryCode: category,
        maxPrice: newMaxPrice,
        sortPrice,
      };
      updateBrowserFilters(filters);
      void fetchCatalog(filters);
    }, 300);
  }, [
    cancelPendingPriceFilter,
    category,
    fetchCatalog,
    keyword,
    sortPrice,
    updateBrowserFilters,
  ]);

  const handleHeaderSearch = (newKeyword: string) => {
    cancelPendingPriceFilter();
    setKeyword(newKeyword);
    const filters = { keyword: newKeyword, categoryCode: category, maxPrice, sortPrice };
    updateBrowserFilters(filters);
    void fetchCatalog(filters);
    setTimeout(scrollToProducts, 50);
  };

  const handleCategoryChange = (categoryCode: string) => {
    cancelPendingPriceFilter();
    setCategory(categoryCode);
    const filters = { keyword, categoryCode, maxPrice, sortPrice };
    updateBrowserFilters(filters);
    void fetchCatalog(filters);
    setTimeout(scrollToProducts, 50);
  };

  const handleClearFilters = () => {
    cancelPendingPriceFilter();
    setKeyword('');
    setCategory('');
    setMaxPrice('');
    setSortPrice('');
    router.push('/', { scroll: false });
    
    void fetchCatalog({ keyword: '', categoryCode: '', maxPrice: '', sortPrice: '' });
    setTimeout(scrollToProducts, 50);
  };

  return (
    <div className="min-h-screen bg-background font-sans flex flex-col">
      
      <Header onSearch={handleHeaderSearch} initialKeyword={keyword} />

      <section className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-8" aria-labelledby="catalog-title">
        <div className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white px-6 py-6 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary">Kho voucher</p>
            <h1 id="catalog-title" className="mt-2 font-black tracking-tight text-slate-900">
              Tìm ưu đãi phù hợp với bạn
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
              Tìm kiếm, lọc theo danh mục và so sánh các voucher đang mở bán trên hệ thống.
            </p>
          </div>
          <Link
            href="/for-customers"
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-5 py-2.5 text-sm font-extrabold text-primary transition hover:border-orange-300 hover:bg-orange-100"
          >
            VoucherNow hoạt động thế nào?
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <main id="product-section" className="flex-grow max-w-7xl w-full mx-auto py-8 px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <FilterSidebar
            category={category}
            categories={categories}
            totalCampaigns={totalCampaigns}
            onCategoryChange={handleCategoryChange}
            maxPrice={maxPrice}
            onMaxPriceChange={handleMaxPriceChange}
            onClear={handleClearFilters}
          />
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-4 gap-4">
            <div className="flex items-center gap-3">
              <Grid className="h-6 w-6 text-primary" />
              <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">
                Danh sách voucher
              </h2>
              <span className="text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full ml-2">
                {campaigns.length} kết quả
              </span>
            </div>

            {/* Sort Price Buttons */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl shrink-0 self-start sm:self-auto">
              <button
                onClick={() => {
                  cancelPendingPriceFilter();
                  const val: CatalogFilters['sortPrice'] = sortPrice === 'asc' ? '' : 'asc';
                  setSortPrice(val);
                  const filters = { keyword, categoryCode: category, maxPrice, sortPrice: val };
                  updateBrowserFilters(filters);
                  void fetchCatalog(filters);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  sortPrice === 'asc'
                    ? 'bg-white text-primary shadow-sm ring-1 ring-slate-200/50'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
                }`}
              >
                <ArrowUpNarrowWide className="h-4 w-4" />
                <span className="hidden sm:inline">Giá tăng dần</span>
              </button>
              <button
                onClick={() => {
                  cancelPendingPriceFilter();
                  const val: CatalogFilters['sortPrice'] = sortPrice === 'desc' ? '' : 'desc';
                  setSortPrice(val);
                  const filters = { keyword, categoryCode: category, maxPrice, sortPrice: val };
                  updateBrowserFilters(filters);
                  void fetchCatalog(filters);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  sortPrice === 'desc'
                    ? 'bg-white text-primary shadow-sm ring-1 ring-slate-200/50'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
                }`}
              >
                <ArrowDownWideNarrow className="h-4 w-4" />
                <span className="hidden sm:inline">Giá giảm dần</span>
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-800 text-sm p-4 rounded-r-xl flex items-center gap-3 shadow-sm">
              <ShieldAlert className="h-5 w-5 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {loading ? (
            <div
              className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
              role="status"
              aria-busy="true"
              aria-label="Đang tải danh sách voucher"
            >
              <span className="sr-only">Đang tải danh sách voucher...</span>
              {Array.from({ length: PRODUCT_SKELETON_COUNT }, (_, index) => (
                <ProductCardSkeleton key={index} />
              ))}
            </div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-24 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Ticket className="h-10 w-10 text-slate-300" />
              </div>
              <h3 className="text-base font-bold text-slate-800">Không tìm thấy voucher phù hợp</h3>
              <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">
                Thử thay đổi từ khóa tìm kiếm hoặc lọc khoảng giá rộng hơn để săn nhiều khuyến mãi cực hot khác.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {campaigns.map((c, i) => (
                <VoucherCard key={c.campaignId} campaign={c} index={i} />
              ))}
            </div>
          )}
        </div>
      </main>

      <footer className="bg-white border-t border-slate-200 py-8 px-4 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 opacity-50 grayscale">
            <Ticket className="h-6 w-6 text-slate-800" />
            <span className="text-xl font-black text-slate-800 tracking-tight">VoucherNow</span>
          </div>
          <div className="text-center md:text-right">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Hệ thống phân phối Voucher Điện Tử</p>
            <p className="text-[10px] text-slate-400 mt-1">Đồ án môn học Thương mại điện tử EC05 - HCMUS © 2026</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <HomePageContent />
    </Suspense>
  );
}
