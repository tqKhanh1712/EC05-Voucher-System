'use client';

import React, { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import RoleGuard from '../../../components/RoleGuard';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Users, 
  Ticket, 
  ShieldAlert, 
  LogOut, 
  Menu, 
  LayoutDashboard,
  ShoppingBag,
  UserCog,
  FolderTree
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../../../components/ui/sheet';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigation = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'Duyệt Đối tác', href: '/admin/partners', icon: Users },
    { name: 'Duyệt Voucher', href: '/admin/vouchers', icon: Ticket },
    { name: 'Quản lý Đơn hàng', href: '/admin/orders', icon: ShoppingBag },
    { name: 'Quản lý Người dùng', href: '/admin/users', icon: UserCog },
    { name: 'Quản lý Danh mục', href: '/admin/categories', icon: FolderTree },
    { name: 'Nhật ký hệ thống', href: '/admin/audit-logs', icon: ShieldAlert },
  ];

  return (
    <RoleGuard allowedRoles={['ADMIN']}>
      <div className="min-h-screen flex flex-col md:flex-row bg-background">
        
        {/* Sidebar cho Desktop */}
        <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r border-border bg-card">
          <div className="flex flex-col flex-grow pt-5 pb-4 overflow-y-auto">
            {/* Logo */}
            <div className="flex items-center flex-shrink-0 px-4 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white shadow shadow-primary/20">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <span className="ml-3 text-lg font-bold tracking-tight text-foreground">
                AdminPortal
              </span>
            </div>

            {/* Menu */}
            <nav className="flex-1 px-2 space-y-1">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`group flex items-center px-3 py-2.5 text-sm font-semibold rounded-lg transition-all duration-150 ${
                      isActive
                        ? 'bg-secondary text-primary'
                        : 'text-foreground/75 hover:bg-secondary/40 hover:text-primary'
                    }`}
                  >
                    <item.icon
                      className={`mr-3 h-5 w-5 shrink-0 ${
                        isActive ? 'text-primary' : 'text-muted group-hover:text-primary'
                      }`}
                    />
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            {/* Thông tin tài khoản phía dưới Sidebar */}
            <div className="flex-shrink-0 flex border-t border-border p-4 bg-background/50">
              <div className="flex items-center w-full">
                <Link href="/profile" className="flex items-center group overflow-hidden" title="Xem hồ sơ cá nhân">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold group-hover:bg-primary/20 transition-colors">
                    {user?.fullName?.charAt(0).toUpperCase() || 'A'}
                  </div>
                  <div className="ml-3 overflow-hidden">
                    <p className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">{user?.fullName}</p>
                    <p className="text-[10px] text-muted truncate">Quản trị viên</p>
                  </div>
                </Link>
                <button
                  onClick={logout}
                  className="ml-auto p-1.5 rounded-lg hover:bg-red-500/10 text-muted hover:text-red-500 transition-colors"
                  title="Đăng xuất"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </aside>

        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          {/* Mobile Header */}
          <header className="z-20 flex items-center justify-between border-b border-border bg-surface px-4 py-3 md:hidden">
            <div className="flex items-center">
              <div className="flex h-8 w-8 items-center justify-center rounded-ui-md bg-brand text-white">
                <ShieldAlert className="h-4 w-4" aria-hidden="true" />
              </div>
              <span className="ml-2 text-md font-bold tracking-tight text-foreground">
                AdminPortal
              </span>
            </div>
            <SheetTrigger
              render={
                <button
                  type="button"
                  aria-label="Mở menu quản trị"
                  className="rounded-ui-sm p-2 text-foreground transition hover:bg-surface-subtle"
                />
              }
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </SheetTrigger>
          </header>

          {/* Mobile Menu Sidebar */}
          <SheetContent side="left" className="w-[min(18rem,86vw)] gap-0 p-0 md:hidden">
            <SheetHeader className="border-b border-border p-5 pr-12">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-ui-md bg-brand text-white">
                  <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <SheetTitle>AdminPortal</SheetTitle>
                  <SheetDescription>Khu vực quản trị hệ thống</SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <nav aria-label="Điều hướng quản trị" className="flex-1 space-y-1 overflow-y-auto p-4">
                  {navigation.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex min-h-11 items-center rounded-ui-md px-3 py-2.5 text-sm font-semibold transition ${
                          isActive
                            ? 'bg-brand-subtle text-brand'
                            : 'text-foreground/75 hover:bg-surface-subtle hover:text-foreground'
                        }`}
                      >
                        <item.icon className={`mr-3 h-5 w-5 shrink-0 ${isActive ? 'text-brand' : 'text-muted-foreground'}`} aria-hidden="true" />
                        {item.name}
                      </Link>
                    );
                  })}
            </nav>

            <SheetFooter className="border-t border-border p-4">
              <div className="flex items-center">
                <Link href="/profile" onClick={() => setMobileMenuOpen(false)} className="group flex min-w-0 items-center" title="Xem hồ sơ cá nhân">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-subtle font-bold text-brand transition-colors group-hover:bg-orange-100">
                    {user?.fullName?.charAt(0).toUpperCase() || 'A'}
                  </div>
                  <div className="ml-3 min-w-0">
                    <p className="truncate text-xs font-semibold text-foreground transition-colors group-hover:text-brand">{user?.fullName}</p>
                    <p className="text-[10px] text-muted-foreground">Quản trị</p>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    logout();
                  }}
                  aria-label="Đăng xuất"
                  className="ml-auto rounded-ui-sm p-2 text-muted-foreground transition hover:bg-danger-subtle hover:text-danger"
                >
                  <LogOut className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        {/* Khung chứa Nội dung chính */}
        <main className="flex-1 md:pl-64 flex flex-col min-h-screen">
          <div className="py-6 px-4 sm:px-6 lg:px-8 max-w-7xl w-full mx-auto flex-grow">
            {children}
          </div>
        </main>

      </div>
    </RoleGuard>
  );
}
