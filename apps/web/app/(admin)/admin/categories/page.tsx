'use client';

import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../../../lib/api';
import { getErrorMessage } from '../../../../lib/errors';
import { 
  FolderTree, 
  Plus, 
  Edit3, 
  Trash2, 
  AlertCircle, 
  CheckCircle,
  Eye,
  EyeOff,
  Tag,
  ChevronRight,
  ListOrdered,
  Layers,
  RefreshCw,
  X,
  Search
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../components/ui/alert-dialog';

interface Category {
  categoryId: string;
  code: string;
  nameVi: string;
  parentId: string | null;
  displayOrder: number;
  isActive: boolean;
  campaignCount?: number;
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Form states
  const [showFormModal, setShowFormModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  
  const [formCode, setFormCode] = useState('');
  const [formNameVi, setFormNameVi] = useState('');
  const [formParentId, setFormParentId] = useState('');
  const [formDisplayOrder, setFormDisplayOrder] = useState('0');
  const [formIsActive, setFormIsActive] = useState(true);

  // Delete action state
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

  const loadCategories = async () => {
    try {
      // Gọi endpoint lấy categories công khai nhưng do là Admin ta muốn lấy tất cả
      const data = await apiRequest<Category[]>('/vouchers/admin/categories');
      setCategories(data);
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, 'Không thể tải danh sách danh mục.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const openCreateModal = () => {
    setIsEditing(false);
    setSelectedCategoryId(null);
    setFormCode('');
    setFormNameVi('');
    setFormParentId('');
    setFormDisplayOrder('0');
    setFormIsActive(true);
    setShowFormModal(true);
  };

  const openEditModal = (cat: Category) => {
    setIsEditing(true);
    setSelectedCategoryId(cat.categoryId);
    setFormCode(cat.code);
    setFormNameVi(cat.nameVi);
    setFormParentId(cat.parentId || '');
    setFormDisplayOrder(String(cat.displayOrder));
    setFormIsActive(cat.isActive);
    setShowFormModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const bodyData = {
      code: formCode.trim(),
      nameVi: formNameVi.trim(),
      parentId: formParentId || null,
      displayOrder: parseInt(formDisplayOrder, 10) || 0,
      isActive: formIsActive
    };

    try {
      if (isEditing && selectedCategoryId) {
        await apiRequest<void>(`/vouchers/admin/categories/${selectedCategoryId}`, {
          method: 'PATCH',
          body: JSON.stringify(bodyData),
        });
        setSuccessMsg('Đã cập nhật danh mục thành công!');
      } else {
        await apiRequest<void>('/vouchers/admin/categories', {
          method: 'POST',
          body: JSON.stringify(bodyData),
        });
        setSuccessMsg('Đã tạo danh mục mới thành công!');
      }
      setShowFormModal(false);
      loadCategories();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, 'Không thể lưu danh mục. Vui lòng kiểm tra lại.'));
    }
  };

  const handleDelete = async (categoryId: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await apiRequest<void>(`/vouchers/admin/categories/${categoryId}`, {
        method: 'DELETE',
      });
      setSuccessMsg('Đã xóa danh mục thành công!');
      loadCategories();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, 'Không thể xóa danh mục này.'));
    }
  };

  // Lọc theo từ khóa tìm kiếm
  const filteredCategories = categories.filter(c => 
    c.nameVi.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Sắp xếp danh mục cha lên trước, sau đó là danh mục con thụt lề
  const rootCategories = searchTerm 
    ? filteredCategories 
    : filteredCategories.filter(c => !c.parentId);
  const getSubCategories = (parentId: string) => 
    searchTerm ? [] : filteredCategories.filter(c => c.parentId === parentId);

  return (
    <div className="space-y-6">
      
      {/* BREADCRUMB */}
      <div className="flex items-center gap-2 text-xs text-muted">
        <span>Admin Portal</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-semibold text-foreground">Quản lý Danh mục</span>
      </div>

      {/* TIÊU ĐỀ + TÌM KIẾM */}
      <div className="pb-4 border-b border-border/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-foreground flex items-center gap-2">
            <FolderTree className="h-6 w-6 text-primary" />
            Danh sách danh mục voucher
          </h1>
          <p className="text-xs text-muted mt-1">Phân loại voucher chuẩn hóa để khách hàng dễ dàng tìm kiếm theo lĩnh vực dịch vụ.</p>
        </div>
        <div className="flex items-center gap-2 max-w-md w-full sm:justify-end">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên danh mục, mã..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-xs text-foreground placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
            />
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 rounded-lg bg-primary hover:bg-primary/95 px-3 py-2 text-xs font-semibold text-primary-foreground transition shadow shadow-primary/10 shrink-0"
          >
            <Plus className="h-4 w-4" />
            Thêm danh mục
          </button>
        </div>
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

      {/* DANH SÁCH DANH MỤC */}
      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-3">
          <Tag className="h-10 w-10 text-muted mx-auto" />
          <h3 className="text-sm font-bold text-foreground">Không tìm thấy danh mục</h3>
          <p className="text-xs text-muted">Hệ thống chưa ghi nhận danh mục nào khớp với bộ lọc tìm kiếm.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-secondary/40 border-b border-border text-foreground/80 font-bold uppercase tracking-wider">
                  <th className="p-4">Tên danh mục (Tiếng Việt)</th>
                  <th className="p-4">Mã Code</th>
                  <th className="p-4">Cấp bậc</th>
                  <th className="p-4">Sắp xếp</th>
                  <th className="p-4">Voucher liên kết</th>
                  <th className="p-4">Trạng thái</th>
                  <th className="p-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rootCategories.map((root) => {
                  const children = getSubCategories(root.categoryId);
                  return (
                    <React.Fragment key={root.categoryId}>
                      {/* Danh mục cấp cha */}
                      <tr className="hover:bg-slate-50 font-semibold text-foreground transition-colors">
                        <td className="p-4 flex items-center gap-2">
                          <Tag className="h-4 w-4 text-primary shrink-0" />
                          <span>{root.nameVi}</span>
                        </td>
                        <td className="p-4 font-mono text-xs text-muted">{root.code}</td>
                        <td className="p-4">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-primary/10 text-primary font-bold uppercase">
                            Cấp Cha
                          </span>
                        </td>
                        <td className="p-4 text-muted">{root.displayOrder}</td>
                        <td className="p-4 text-muted">
                          {root.campaignCount ?? 0} chiến dịch
                        </td>
                        <td className="p-4">
                          {root.isActive ? (
                            <span className="inline-flex items-center text-xs text-emerald-600 font-bold gap-1">
                              <Eye className="h-3.5 w-3.5" /> Hiển thị
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-xs text-muted font-bold gap-1">
                              <EyeOff className="h-3.5 w-3.5" /> Ẩn
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openEditModal(root)}
                              className="p-1 rounded text-muted hover:bg-secondary/40 hover:text-foreground transition-colors border border-transparent"
                              title="Chỉnh sửa danh mục"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setCategoryToDelete(root)}
                              className="p-1 rounded text-rose-500 hover:bg-rose-50 transition-colors border border-transparent"
                              title="Xóa danh mục"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Danh mục con (nếu có) */}
                      {children.map((child) => (
                        <tr key={child.categoryId} className="hover:bg-slate-50 font-medium text-foreground bg-secondary/5 transition-colors">
                          <td className="p-4 pl-8 flex items-center gap-1.5">
                            <ChevronRight className="h-4 w-4 text-muted shrink-0" />
                            <span>{child.nameVi}</span>
                          </td>
                          <td className="p-4 font-mono text-xs text-muted pl-4">{child.code}</td>
                          <td className="p-4">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 font-bold uppercase">
                              Danh mục Con
                            </span>
                          </td>
                          <td className="p-4 text-muted">{child.displayOrder}</td>
                          <td className="p-4 text-muted">
                            {child.campaignCount ?? 0} chiến dịch
                          </td>
                          <td className="p-4">
                            {child.isActive ? (
                              <span className="inline-flex items-center text-xs text-emerald-600 font-bold gap-1">
                                <Eye className="h-3.5 w-3.5" /> Hiển thị
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-xs text-muted font-bold gap-1">
                                <EyeOff className="h-3.5 w-3.5" /> Ẩn
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => openEditModal(child)}
                                className="p-1 rounded text-muted hover:bg-secondary/40 hover:text-foreground transition-colors border border-transparent"
                                title="Chỉnh sửa danh mục"
                              >
                                <Edit3 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setCategoryToDelete(child)}
                                className="p-1 rounded text-rose-500 hover:bg-rose-50 transition-colors border border-transparent"
                                title="Xóa danh mục"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Form Dialog Modal */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-200">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Tag className="h-5 w-5 text-primary" />
                {isEditing ? 'Chỉnh sửa danh mục' : 'Thêm danh mục mới'}
              </h3>
              <button 
                onClick={() => setShowFormModal(false)}
                className="p-1.5 rounded-md hover:bg-secondary/20 transition-colors text-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                {/* Code */}
                <div>
                  <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
                    Mã danh mục (Code / Slug)*
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: food-beverage"
                    disabled={isEditing}
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <p className="text-[10px] text-muted mt-1">Dùng để định danh duy nhất (không trùng lặp, không sửa sau khi tạo).</p>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
                    Tên hiển thị (Tiếng Việt)*
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Ẩm thực & Nhà hàng"
                    value={formNameVi}
                    onChange={(e) => setFormNameVi(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {/* Parent Category */}
                <div>
                  <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
                    Danh mục cha
                  </label>
                  <select
                    value={formParentId}
                    onChange={(e) => setFormParentId(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Không có (Danh mục gốc)</option>
                    {categories
                      .filter(c => !c.parentId && c.categoryId !== selectedCategoryId)
                      .map(c => (
                        <option key={c.categoryId} value={c.categoryId}>
                          {c.nameVi}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Display Order */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
                      Thứ tự hiển thị
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formDisplayOrder}
                      onChange={(e) => setFormDisplayOrder(e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  {/* Active Toggle */}
                  <div className="flex flex-col justify-end pb-1.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formIsActive}
                        onChange={(e) => setFormIsActive(e.target.checked)}
                        className="rounded border-border text-primary focus:ring-primary/20 h-4 w-4"
                      />
                      <span className="text-sm font-semibold text-foreground">Cho phép hiển thị</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-border bg-secondary/10 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-secondary text-foreground hover:bg-secondary/80 transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-primary hover:bg-primary-hover text-primary-foreground transition shadow shadow-primary/10"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Xác nhận xóa */}
      <AlertDialog
        open={Boolean(categoryToDelete)}
        onOpenChange={(open) => {
          if (!open) setCategoryToDelete(null);
        }}
      >
        {categoryToDelete && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                Xác nhận xóa danh mục?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Bạn có chắc chắn muốn xóa danh mục <strong>&quot;{categoryToDelete.nameVi}&quot;</strong>? 
                Thao tác này sẽ xóa vĩnh viễn danh mục khỏi hệ thống và không thể phục hồi.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Hủy bỏ</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (categoryToDelete) {
                    void handleDelete(categoryToDelete.categoryId);
                    setCategoryToDelete(null);
                  }
                }}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Xác nhận xóa
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </div>
  );
}
