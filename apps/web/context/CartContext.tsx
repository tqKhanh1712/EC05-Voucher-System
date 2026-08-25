'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { apiRequest } from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import { getSafeInternalRedirect } from '../lib/navigation';

interface CartItemSummary {
  quantity?: number;
}

interface PendingCartAction {
  campaignId: string;
  quantity: number;
  returnTo: string;
  createdAt: number;
}

interface CartContextType {
  cartItemCount: number;
  addingCampaignIds: ReadonlySet<string>;
  addToCart: (campaignId: string, quantity?: number) => Promise<boolean>;
  refreshCartCount: () => Promise<void>;
}

const PENDING_CART_ACTION_KEY = 'vouchernow.pending-cart-action';
const PENDING_CART_ACTION_TTL_MS = 30 * 60 * 1000;
const CartContext = createContext<CartContextType | undefined>(undefined);

function getCurrentInternalPath() {
  if (typeof window === 'undefined') return '/';
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function readPendingCartAction(): PendingCartAction | null {
  try {
    const rawValue = window.sessionStorage.getItem(PENDING_CART_ACTION_KEY);
    if (!rawValue) return null;

    const action = JSON.parse(rawValue) as Partial<PendingCartAction>;
    const isValid =
      typeof action.campaignId === 'string' &&
      Number.isInteger(action.quantity) &&
      Number(action.quantity) >= 1 &&
      Number(action.quantity) <= 10 &&
      typeof action.returnTo === 'string' &&
      typeof action.createdAt === 'number' &&
      Date.now() - action.createdAt <= PENDING_CART_ACTION_TTL_MS;

    if (!isValid) {
      window.sessionStorage.removeItem(PENDING_CART_ACTION_KEY);
      return null;
    }

    return action as PendingCartAction;
  } catch {
    window.sessionStorage.removeItem(PENDING_CART_ACTION_KEY);
    return null;
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const pendingActionInFlight = useRef(false);
  const [cartItemCount, setCartItemCount] = useState(0);
  const [addingCampaignIds, setAddingCampaignIds] = useState<Set<string>>(
    () => new Set(),
  );

  const refreshCartCount = useCallback(async () => {
    if (user?.role !== 'CUSTOMER') {
      setCartItemCount(0);
      return;
    }

    try {
      const items = await apiRequest<CartItemSummary[]>('/cart');
      const count = Array.isArray(items)
        ? items.reduce((total, item) => total + (item.quantity || 1), 0)
        : 0;
      setCartItemCount(count);
    } catch {
      setCartItemCount(0);
    }
  }, [user?.role]);

  const performAddToCart = useCallback(
    async (campaignId: string, quantity: number) => {
      setAddingCampaignIds((current) => new Set(current).add(campaignId));
      try {
        await apiRequest<void>('/cart/items', {
          method: 'POST',
          body: JSON.stringify({ campaignId, quantity }),
        });
        await refreshCartCount();
        showToast({
          title: 'Đã thêm vào giỏ hàng',
          description: `${quantity} voucher đã được thêm thành công.`,
        });
        return true;
      } catch (error: unknown) {
        showToast({
          title: 'Không thể thêm vào giỏ hàng',
          description: getErrorMessage(error, 'Vui lòng thử lại sau.'),
          variant: 'error',
        });
        return false;
      } finally {
        setAddingCampaignIds((current) => {
          const next = new Set(current);
          next.delete(campaignId);
          return next;
        });
      }
    },
    [refreshCartCount, showToast],
  );

  const addToCart = useCallback(
    async (campaignId: string, quantity = 1) => {
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
        showToast({
          title: 'Số lượng không hợp lệ',
          description: 'Bạn có thể thêm từ 1 đến 10 voucher mỗi lần.',
          variant: 'error',
        });
        return false;
      }

      if (authLoading) return false;

      if (!user) {
        const returnTo = getSafeInternalRedirect(getCurrentInternalPath(), '/') || '/';
        const pendingAction: PendingCartAction = {
          campaignId,
          quantity,
          returnTo,
          createdAt: Date.now(),
        };
        window.sessionStorage.setItem(
          PENDING_CART_ACTION_KEY,
          JSON.stringify(pendingAction),
        );
        router.push(`/login?redirect=${encodeURIComponent(returnTo)}`);
        return false;
      }

      if (user.role !== 'CUSTOMER') {
        showToast({
          title: 'Tài khoản không phù hợp',
          description: 'Vui lòng đăng nhập bằng tài khoản khách hàng để mua voucher.',
          variant: 'error',
        });
        return false;
      }

      if (addingCampaignIds.has(campaignId)) return false;
      return performAddToCart(campaignId, quantity);
    },
    [
      addingCampaignIds,
      authLoading,
      performAddToCart,
      router,
      showToast,
      user,
    ],
  );

  useEffect(() => {
    if (authLoading) return;

    if (user?.role !== 'CUSTOMER') {
      return;
    }

    if (pendingActionInFlight.current) return;

    const pendingAction = readPendingCartAction();
    if (pendingAction) {
      window.sessionStorage.removeItem(PENDING_CART_ACTION_KEY);
      pendingActionInFlight.current = true;
      queueMicrotask(() => {
        void performAddToCart(
          pendingAction.campaignId,
          pendingAction.quantity,
        ).finally(() => {
          pendingActionInFlight.current = false;
        });
      });
      return;
    }

    queueMicrotask(() => {
      void refreshCartCount();
    });
  }, [authLoading, performAddToCart, refreshCartCount, user?.role]);

  const value = useMemo(
    () => ({ cartItemCount, addingCampaignIds, addToCart, refreshCartCount }),
    [addingCampaignIds, addToCart, cartItemCount, refreshCartCount],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart phải được đặt trong CartProvider');
  }
  return context;
}
