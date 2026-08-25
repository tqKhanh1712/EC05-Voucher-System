'use client';

import React from 'react';
import { X, Filter, ChevronDown } from 'lucide-react';

interface CategoryFilterOption {
  code: string;
  name: string;
  campaignCount: number;
  children?: CategoryFilterOption[];
}

export interface FilterSidebarProps {
  category: string;
  categories: CategoryFilterOption[];
  totalCampaigns: number;
  onCategoryChange: (value: string) => void;
  maxPrice: string;
  onMaxPriceChange: (value: string) => void;
  onClear: () => void;
}

const QUICK_PRICES = [
  { label: '< 100K', value: '100.000' },
  { label: '< 200K', value: '200.000' },
  { label: '< 500K', value: '500.000' },
];

export default function FilterSidebar({
  category,
  categories,
  totalCampaigns,
  onCategoryChange,
  maxPrice,
  onMaxPriceChange,
  onClear,
}: FilterSidebarProps) {
  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    if (!rawValue) {
      onMaxPriceChange('');
      return;
    }
    onMaxPriceChange(Number(rawValue).toLocaleString('vi-VN'));
  };

  const [expandedCategories, setExpandedCategories] = React.useState<Record<string, boolean>>({});

  const toggleCategory = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedCategories(prev => ({ ...prev, [code]: !prev[code] }));
  };

  const renderCategoryButton = (option: CategoryFilterOption, nested = false, hasChildren = false) => {
    const isActive = category === option.code;
    const isExpanded = expandedCategories[option.code];

    return (
      <button
        key={option.code || 'all'}
        onClick={() => onCategoryChange(option.code)}
        className={`group flex w-full items-center justify-between border-l-4 px-3 py-2.5 text-left text-xs transition-colors ${
          nested ? 'pl-8' : ''
        } ${
          isActive
            ? 'rounded-r-xl border-red-600 bg-gray-100 font-semibold text-red-600'
            : 'rounded-r-xl border-transparent bg-white font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        }`}
        aria-pressed={isActive}
      >
        <span className="flex items-center gap-2">
          {!nested && option.code !== '' && (
            <span
              onClick={(e) => {
                if (hasChildren) toggleCategory(option.code, e);
              }}
              className={`p-1 rounded-md transition-colors ${
                hasChildren ? 'cursor-pointer hover:bg-slate-200' : 'opacity-30'
              }`}
            >
              <ChevronDown
                className={`h-3 w-3 transition-transform ${isExpanded && hasChildren ? '' : '-rotate-90'}`}
              />
            </span>
          )}
          <span className={!nested && option.code === '' ? 'pl-5' : ''}>{option.name}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className={isActive ? 'text-red-500' : 'text-gray-400'}>
            {option.campaignCount}
          </span>
        </span>
      </button>
    );
  };
  
  return (
    <aside className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-6">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <Filter className="h-5 w-5 text-primary" />
        <h2 className="text-base font-extrabold text-slate-800 uppercase tracking-tight">
          Bộ lọc tìm kiếm
        </h2>
      </div>

      {/* Khoảng giá */}
      <div className="space-y-3">
        <label className="block text-xs font-bold text-slate-700">Khoảng giá</label>
        
        <div className="flex flex-wrap gap-2">
          {QUICK_PRICES.map((qp) => (
            <button
              type="button"
              key={qp.value}
              onClick={() => {
                onMaxPriceChange(maxPrice === qp.value ? '' : qp.value);
              }}
              aria-pressed={maxPrice === qp.value}
              className={`inline-flex min-h-10 items-center justify-center rounded-full border px-3 py-2 text-[11px] font-bold transition-colors ${
                maxPrice === qp.value
                  ? 'border-red-200 bg-red-50 text-red-600'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-red-200 hover:bg-slate-50 hover:text-red-600'
              }`}
            >
              {qp.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            inputMode="numeric"
            value={maxPrice}
            onChange={handlePriceChange}
            placeholder="Tối đa (đ)"
            className="w-full bg-slate-50 border border-slate-200 focus:border-primary/50 focus:bg-white rounded-xl px-3 py-2 text-sm outline-none transition-all"
            aria-label="Giá tối đa"
          />
        </div>
      </div>

      {/* Danh mục */}
      <div className="space-y-3">
        <label className="block text-xs font-bold text-slate-700">Danh mục</label>
        <div className="flex flex-col gap-1.5">
          {renderCategoryButton({ code: '', name: 'Tất cả', campaignCount: totalCampaigns })}
          {categories.map((parent) => (
            <div key={parent.code} className="space-y-1">
              {renderCategoryButton(parent, false, (parent.children?.length ?? 0) > 0)}
              {expandedCategories[parent.code] &&
                parent.children?.map((child) => renderCategoryButton(child, true))}
            </div>
          ))}
        </div>
      </div>

      {/* Xóa lọc */}
      <div className="pt-2 border-t border-slate-100">
        <button
          onClick={onClear}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-white border-2 border-slate-100 hover:border-slate-300 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-xl transition-all"
        >
          <X className="h-4 w-4" />
          Xóa tất cả
        </button>
      </div>
    </aside>
  );
}
