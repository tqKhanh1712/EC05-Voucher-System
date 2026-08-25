'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { apiRequest } from '../lib/api';
import { hasDiscount, resolveSellingPrice } from '../lib/pricing';
import { 
  Ticket, 
  Search, 
  LogOut, 
  ShieldAlert, 
  Briefcase,
  ShoppingCart,
  FileText,
  User as UserIcon,
  Menu,
  X,
  Home,
  Sparkles,
  Building2,
  LayoutDashboard,
  WalletCards,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './ui/sheet';

interface HeaderProps {
  onSearch?: (keyword: string) => void;
  initialKeyword?: string;
}

interface VoucherSuggestion {
  title: string;
  originalPrice: number;
  salePrice: number | null;
  sellingPrice?: number;
  thumbnail_url?: string | null;
}

export default function Header({ onSearch, initialKeyword = '' }: HeaderProps) {
  const { user, logout } = useAuth();
  const { cartItemCount, refreshCartCount } = useCart();
  const router = useRouter();
  const [keyword, setKeyword] = useState(initialKeyword);
  const [suggestions, setSuggestions] = useState<VoucherSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  useEffect(() => {
    if (user?.role === 'CUSTOMER') {
      void refreshCartCount();
    }
  }, [refreshCartCount, user?.role]);

  // Fetch suggestions with debounce
  useEffect(() => {
    if (!keyword.trim()) {
      return;
    }
    const timer = setTimeout(() => {
      apiRequest<VoucherSuggestion[]>(`/vouchers?keyword=${encodeURIComponent(keyword)}`)
        .then((data) => {
          if (Array.isArray(data)) {
            const uniqueMap = new Map<string, VoucherSuggestion>();
            data.forEach((item) => {
              if (item.title && !uniqueMap.has(item.title)) {
                uniqueMap.set(item.title, item);
              }
            });
            setSuggestions(Array.from(uniqueMap.values()).slice(0, 5));
          }
        })
        .catch(() => setSuggestions([]));
    }, 300); // 300ms debounce
    return () => clearTimeout(timer);
  }, [keyword]);

  const handleKeywordChange = (value: string) => {
    setKeyword(value);
    if (!value.trim()) {
      setSuggestions([]);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    setShowMobileSearch(false);
    if (onSearch) {
      onSearch(keyword);
    } else {
      router.push(`/?keyword=${encodeURIComponent(keyword)}`);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setKeyword(suggestion);
    setShowSuggestions(false);
    setShowMobileSearch(false);
    if (onSearch) {
      onSearch(suggestion);
    } else {
      router.push(`/?keyword=${encodeURIComponent(suggestion)}`);
    }
  };

  const closeMobileNavigation = () => {
    setShowMobileMenu(false);
    setShowMobileSearch(false);
  };

  return (
    <Sheet
      open={showMobileMenu}
      onOpenChange={(isOpen) => {
        setShowMobileMenu(isOpen);
        if (isOpen) setShowMobileSearch(false);
      }}
    >
      <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all">
      {/* Main Header Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex items-center justify-between gap-4 lg:gap-8">
        
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-orange-500 text-white shadow-md transform transition hover:scale-105">
            <Ticket className="h-6 w-6" />
          </div>
          <span className="hidden sm:block text-2xl font-black tracking-tight text-primary drop-shadow-sm">
            VoucherNow
          </span>
        </Link>

        {/* Search Bar - Center */}
        <div className="flex-1 max-w-2xl hidden md:block relative" onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}>
          <form onSubmit={handleSearch} className="relative flex items-center w-full">
            <input
              type="text"
              value={keyword}
              onChange={(e) => handleKeywordChange(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Tìm voucher ẩm thực, làm đẹp, giải trí..."
              className="w-full pl-4 pr-20 py-2.5 bg-slate-100 border-2 border-transparent focus:bg-white focus:border-primary/30 rounded-xl text-sm transition-all outline-none text-foreground placeholder:text-slate-400"
            />
            {keyword && (
              <button
                type="button"
                onClick={() => {
                  setKeyword('');
                  setSuggestions([]);
                }}
                className="absolute right-10 p-1.5 text-slate-400 hover:text-slate-600 transition-colors rounded-full"
                title="Xóa từ khóa"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <button
              type="submit"
              className="absolute right-1.5 p-1.5 bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors"
            >
              <Search className="h-4 w-4" />
            </button>
          </form>

          {/* Suggestions Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full mt-2 w-full bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              <ul>
                {suggestions.map((s, i) => (
                  <li key={i}>
                    <button 
                      type="button"
                      className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-center gap-3 border-b border-slate-50 last:border-0"
                      onClick={() => handleSuggestionClick(s.title)}
                    >
                      {s.thumbnail_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={s.thumbnail_url} alt={s.title} className="w-12 h-12 object-cover rounded-lg border border-slate-100 shrink-0 shadow-sm" />
                      ) : (
                        <div className="w-12 h-12 bg-slate-100 rounded-lg shrink-0 flex items-center justify-center border border-slate-200 shadow-sm">
                          <Search className="h-5 w-5 text-slate-400" />
                        </div>
                      )}
                      <div className="flex flex-col flex-1 overflow-hidden">
                        <span className="line-clamp-1 text-sm font-semibold text-slate-800">{s.title}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-primary font-bold text-xs">{resolveSellingPrice(s).toLocaleString('vi-VN')}đ</span>
                          {hasDiscount(s) && (
                            <span className="text-slate-400 text-[10px] line-through">{Number(s.originalPrice).toLocaleString('vi-VN')}đ</span>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Mobile Search & Menu (Visible only on small screens) */}
        <div className="flex md:hidden flex-1 justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowMobileSearch((isOpen) => !isOpen);
                setShowMobileMenu(false);
              }}
              aria-label={showMobileSearch ? 'Đóng ô tìm kiếm' : 'Mở ô tìm kiếm'}
              aria-expanded={showMobileSearch}
              aria-controls="mobile-search-panel"
              className="p-2 text-slate-600 hover:text-primary bg-slate-100 rounded-full"
            >
              {showMobileSearch ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
            </button>
            <SheetTrigger
              render={
                <button
                  type="button"
                  aria-label="Mở menu điều hướng"
                  className="rounded-full bg-slate-100 p-2 text-slate-600 transition hover:text-primary"
                />
              }
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </SheetTrigger>
        </div>

        {/* Actions & Profile - Right */}
        <div className="hidden md:flex items-center gap-4 shrink-0">
          {user ? (
            <>
              {/* Portals based on role */}
              {user.role === 'ADMIN' && (
                <Link href="/admin" className="flex items-center gap-1.5 px-3 py-2 text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                  <ShieldAlert className="h-4 w-4 text-red-500" />
                  Admin
                </Link>
              )}
              {user.role === 'PARTNER' && (
                <Link href="/partner" className="flex items-center gap-1.5 px-3 py-2 text-sm font-bold text-slate-700 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors">
                  <Briefcase className="h-4 w-4 text-orange-500" />
                  Partner
                </Link>
              )}
              {user.role === 'CUSTOMER' && (
                <>
                  <Link href="/cart" className="relative p-2 text-slate-600 hover:text-primary transition-colors group">
                    <ShoppingCart className="h-6 w-6" />
                    {cartItemCount > 0 && (
                      <span className="absolute -top-1 -right-1 h-[18px] min-w-[18px] px-1 bg-primary text-white text-[10px] font-bold flex items-center justify-center rounded-full border border-white group-hover:scale-110 transition-transform">
                        {cartItemCount > 99 ? '99+' : cartItemCount}
                      </span>
                    )}
                  </Link>
                  <Link href="/customer/orders" className="p-2 text-slate-600 hover:text-primary transition-colors" title="Đơn hàng">
                    <FileText className="h-6 w-6" />
                  </Link>
                  <Link href="/customer/vouchers" className="p-2 text-slate-600 hover:text-primary transition-colors" title="Ví Voucher">
                    <Ticket className="h-6 w-6" />
                  </Link>
                </>
              )}
              
              {/* Profile Dropdown (Simplified as hover group for MVP) */}
              <div className="relative group ml-2 border-l border-slate-200 pl-4 flex items-center gap-2 cursor-pointer">
                <div className="h-9 w-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold overflow-hidden">
                  {user.fullName ? user.fullName.charAt(0).toUpperCase() : <UserIcon className="h-5 w-5" />}
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 font-medium">Tài khoản</span>
                  <span className="text-sm font-bold text-slate-800 line-clamp-1 max-w-[100px]">{user.fullName || 'User'}</span>
                </div>
                
                {/* Dropdown Menu */}
                <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all transform origin-top-right scale-95 group-hover:scale-100 z-50">
                  <div className="p-2 space-y-1">
                    <Link href="/profile" className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-primary rounded-lg transition-colors">
                      <UserIcon className="h-4 w-4" /> Thông tin hồ sơ
                    </Link>
                    {user.role === 'CUSTOMER' && (
                      <>
                        <Link href="/customer/vouchers" className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-primary rounded-lg transition-colors">
                          <WalletCards className="h-4 w-4" /> Voucher sở hữu
                        </Link>
                        <Link href="/customer/orders" className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-primary rounded-lg transition-colors">
                          <FileText className="h-4 w-4" /> Đơn hàng
                        </Link>
                      </>
                    )}
                    <div className="h-px bg-slate-100 my-1"></div>
                    <button 
                      onClick={logout}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <LogOut className="h-4 w-4" /> Đăng xuất
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <Link href="/login" className="px-4 py-2 text-sm font-bold text-primary bg-primary/10 hover:bg-primary/20 rounded-xl transition-colors">
                Đăng nhập
              </Link>
              <Link href="/register" className="px-4 py-2 text-sm font-bold text-white bg-primary hover:bg-primary-hover rounded-xl shadow-md shadow-primary/20 transition-all hover:-translate-y-0.5">
                Đăng ký
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="hidden border-t border-slate-100 md:block">
        <nav
          aria-label="Điều hướng giới thiệu"
          className="mx-auto flex min-h-10 w-full max-w-7xl items-center gap-6 px-4 text-xs font-bold text-slate-600 sm:px-6 lg:px-8"
        >
          <Link href="/" className="inline-flex items-center gap-1.5 transition hover:text-primary">
            <Home className="h-3.5 w-3.5" aria-hidden="true" />
            Kho voucher
          </Link>
          <Link href="/for-customers" className="inline-flex items-center gap-1.5 transition hover:text-primary">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Dành cho khách hàng
          </Link>
          <Link href="/for-partners" className="inline-flex items-center gap-1.5 transition hover:text-emerald-700">
            <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
            Dành cho đối tác
          </Link>
        </nav>
      </div>

      {showMobileSearch && (
        <div id="mobile-search-panel" className="border-t border-slate-100 bg-white px-4 py-4 md:hidden">
          <div
            className="relative mx-auto w-full max-w-7xl"
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          >
            <form onSubmit={handleSearch} className="relative flex items-center">
              <label htmlFor="mobile-catalog-search" className="sr-only">Tìm voucher</label>
              <input
                id="mobile-catalog-search"
                type="search"
                value={keyword}
                onChange={(event) => handleKeywordChange(event.target.value)}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Tìm voucher ẩm thực, làm đẹp..."
                className="w-full rounded-xl border-2 border-transparent bg-slate-100 py-3 pl-4 pr-12 text-sm text-foreground outline-none transition focus:border-primary/30 focus:bg-white"
              />
              <button
                type="submit"
                aria-label="Tìm kiếm"
                className="absolute right-1.5 rounded-lg bg-primary p-2 text-white transition-colors hover:bg-primary-hover"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>

            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute top-full z-50 mt-2 w-full overflow-hidden rounded-xl border border-slate-100 bg-white shadow-xl">
                {suggestions.map((suggestion) => (
                  <li key={suggestion.title}>
                    <button
                      type="button"
                      onClick={() => handleSuggestionClick(suggestion.title)}
                      className="flex w-full items-center gap-3 border-b border-slate-50 px-4 py-3 text-left text-sm text-slate-700 transition-colors last:border-0 hover:bg-slate-50"
                    >
                      <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                      <span className="line-clamp-1">{suggestion.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      </header>

      <SheetContent side="right" className="w-[min(22rem,88vw)] gap-0 p-0 md:hidden">
        <SheetHeader className="border-b border-border p-5 pr-12">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-ui-md bg-brand text-white">
              <Ticket className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <SheetTitle>VoucherNow</SheetTitle>
              <SheetDescription>Điều hướng và tài khoản</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <nav aria-label="Điều hướng trên điện thoại" className="flex-1 space-y-1 overflow-y-auto px-4 py-4">
            {[
              { href: '/', label: 'Kho voucher', icon: Home },
              { href: '/for-customers', label: 'Dành cho khách hàng', icon: Sparkles },
              { href: '/for-partners', label: 'Dành cho đối tác', icon: Building2 },
            ].map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={closeMobileNavigation}
                className="flex min-h-11 items-center gap-3 rounded-ui-md px-3 py-2.5 text-sm font-bold text-foreground transition hover:bg-surface-subtle hover:text-brand"
              >
                <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                {label}
              </Link>
            ))}

            {user && (
              <div className="mt-3 space-y-1 border-t border-border pt-3">
                {user.role === 'ADMIN' && (
                  <Link href="/admin" onClick={closeMobileNavigation} className="flex min-h-11 items-center gap-3 rounded-ui-md px-3 py-2.5 text-sm font-bold text-foreground hover:bg-surface-subtle">
                    <ShieldAlert className="h-5 w-5 text-danger" aria-hidden="true" />
                    Trang quản trị Admin
                  </Link>
                )}
                {(user.role === 'PARTNER' || user.role === 'PARTNER_STAFF') && (
                  <Link href={user.role === 'PARTNER_STAFF' ? '/partner/redeem' : '/partner'} onClick={closeMobileNavigation} className="flex min-h-11 items-center gap-3 rounded-ui-md px-3 py-2.5 text-sm font-bold text-foreground hover:bg-surface-subtle">
                    <LayoutDashboard className="h-5 w-5 text-brand" aria-hidden="true" />
                    Khu vực đối tác
                  </Link>
                )}
                {user.role === 'CUSTOMER' && (
                  <>
                    <Link href="/cart" onClick={closeMobileNavigation} className="flex min-h-11 items-center gap-3 rounded-ui-md px-3 py-2.5 text-sm font-bold text-foreground hover:bg-surface-subtle">
                      <ShoppingCart className="h-5 w-5 text-brand" aria-hidden="true" />
                      Giỏ hàng {cartItemCount > 0 ? `(${cartItemCount})` : ''}
                    </Link>
                    <Link href="/customer/orders" onClick={closeMobileNavigation} className="flex min-h-11 items-center gap-3 rounded-ui-md px-3 py-2.5 text-sm font-bold text-foreground hover:bg-surface-subtle">
                      <FileText className="h-5 w-5 text-brand" aria-hidden="true" />
                      Đơn hàng
                    </Link>
                    <Link href="/customer/vouchers" onClick={closeMobileNavigation} className="flex min-h-11 items-center gap-3 rounded-ui-md px-3 py-2.5 text-sm font-bold text-foreground hover:bg-surface-subtle">
                      <WalletCards className="h-5 w-5 text-brand" aria-hidden="true" />
                      Voucher sở hữu
                    </Link>
                  </>
                )}
                <Link href="/profile" onClick={closeMobileNavigation} className="flex min-h-11 items-center gap-3 rounded-ui-md px-3 py-2.5 text-sm font-bold text-foreground hover:bg-surface-subtle">
                  <UserIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                  Hồ sơ tài khoản
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    closeMobileNavigation();
                    logout();
                  }}
                  className="flex min-h-11 w-full items-center gap-3 rounded-ui-md px-3 py-2.5 text-sm font-bold text-danger transition hover:bg-danger-subtle"
                >
                  <LogOut className="h-5 w-5" aria-hidden="true" />
                  Đăng xuất
                </button>
              </div>
            )}

            {!user && (
              <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-4">
                <Link href="/login" onClick={closeMobileNavigation} className="inline-flex min-h-11 items-center justify-center rounded-ui-md bg-brand-subtle px-4 py-2.5 text-sm font-bold text-brand">
                  Đăng nhập
                </Link>
                <Link href="/register" onClick={closeMobileNavigation} className="inline-flex min-h-11 items-center justify-center rounded-ui-md bg-brand px-4 py-2.5 text-sm font-bold text-white">
                  Đăng ký
                </Link>
              </div>
            )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
