import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';
import { PartnerAccountStatus, PartnerApprovalStatus, Prisma, UserStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import * as bcrypt from 'bcrypt';

/**
 * Service quản lý logic nghiệp vụ cho Đối tác (Partner) và Chi nhánh (Branch).
 */
@Injectable()
export class PartnersService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  /**
   * Lấy thông tin hồ sơ doanh nghiệp của đối tác kèm thông tin tài khoản user.
   */
  async getProfile(partnerId: string) {
    const partner = await this.prisma.partner.findUnique({
      where: { partnerId },
      include: {
        user: {
          select: {
            email: true,
            phone: true,
            fullName: true,
            status: true,
          },
        },
      },
    });

    if (!partner) {
      throw new NotFoundException('Không tìm thấy thông tin đối tác.');
    }

    return partner;
  }

  /**
   * Cập nhật thông tin hồ sơ đối tác.
   */
  async updateProfile(partnerId: string, updatePartnerDto: UpdatePartnerDto) {
    const { companyName, taxCode, representative } = updatePartnerDto;

    // Kiểm tra trùng mã số thuế nếu có cập nhật
    if (taxCode) {
      const existing = await this.prisma.partner.findFirst({
        where: {
          taxCode,
          NOT: { partnerId },
        },
      });
      if (existing) {
        throw new ConflictException(
          'Mã số thuế này đã được đăng ký bởi doanh nghiệp khác.',
        );
      }
    }

    return this.prisma.partner.update({
      where: { partnerId },
      data: {
        companyName,
        taxCode,
        representative,
      },
    });
  }

  /**
   * Lấy thống kê dashboard theo tài khoản đối tác hiện tại.
   */
  async getDashboard(partnerId: string) {
    const partner = await this.prisma.partner.findUnique({
      where: { partnerId },
      select: { companyName: true },
    });

    if (!partner) {
      throw new NotFoundException('Không tìm thấy đối tác để tải dashboard.');
    }

    const campaigns = await this.prisma.voucherCampaign.findMany({
      where: { partnerId },
      select: {
        campaignId: true,
        status: true,
        soldQuantity: true,
      },
    });

    const orderItems = await this.prisma.orderItem.findMany({
      where: {
        campaign: {
          partnerId,
        },
      },
      select: {
        quantity: true,
        unitPrice: true,
        order: {
          select: {
            customerId: true,
          },
        },
      },
    });

    const totalCampaigns = campaigns.length;
    const activeCampaigns = campaigns.filter(
      (campaign) => campaign.status === 'APPROVED',
    ).length;
    const soldVouchers = campaigns.reduce(
      (sum, campaign) => sum + campaign.soldQuantity,
      0,
    );
    const customerIds = new Set(
      orderItems.map((item) => item.order.customerId),
    );
    const customerCount = customerIds.size;
    const revenue = orderItems.reduce(
      (sum, item) => sum + Number(item.unitPrice) * item.quantity,
      0,
    );

    const usedVouchers = await this.prisma.voucherCode.count({
      where: {
        status: 'USED',
        orderItem: {
          campaign: {
            partnerId,
          },
        },
      },
    });

    return {
      partnerName: partner.companyName,
      totalCampaigns,
      activeCampaigns,
      soldVouchers,
      customerCount,
      revenue,
      usedVouchers,
    };
  }

  /**
   * Lấy danh sách toàn bộ chi nhánh của đối tác.
   */
  async getBranches(partnerId: string) {
    return this.prisma.branch.findMany({
      where: { partnerId },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Tạo chi nhánh mới cho đối tác.
   */
  async createBranch(partnerId: string, createBranchDto: CreateBranchDto) {
    return this.prisma.branch.create({
      data: {
        partnerId,
        name: createBranchDto.name,
        address: createBranchDto.address,
      },
    });
  }

  /**
   * Cập nhật thông tin chi nhánh của đối tác.
   */
  async updateBranch(
    partnerId: string,
    branchId: string,
    updateBranchDto: UpdateBranchDto,
  ) {
    // Xác minh chi nhánh tồn tại và thuộc sở hữu của đối tác này
    const branch = await this.prisma.branch.findUnique({
      where: { branchId },
    });

    if (!branch || branch.partnerId !== partnerId) {
      throw new NotFoundException(
        'Chi nhánh không tồn tại hoặc bạn không có quyền sở hữu.',
      );
    }

    return this.prisma.branch.update({
      where: { branchId },
      data: {
        name: updateBranchDto.name,
        address: updateBranchDto.address,
      },
    });
  }

  /**
   * Xóa chi nhánh của đối tác.
   */
  async deleteBranch(partnerId: string, branchId: string) {
    // Xác minh chi nhánh tồn tại và thuộc sở hữu
    const branch = await this.prisma.branch.findUnique({
      where: { branchId },
      include: {
        campaignBranches: true,
        staff: true,
      },
    });

    if (!branch || branch.partnerId !== partnerId) {
      throw new NotFoundException(
        'Chi nhánh không tồn tại hoặc bạn không có quyền sở hữu.',
      );
    }

    // RB-09: Chặn xóa nếu chi nhánh đang được liên kết với chiến dịch voucher hoặc có nhân viên
    if (branch.campaignBranches.length > 0) {
      throw new BadRequestException(
        'Không thể xóa chi nhánh đang liên kết với các chương trình voucher.',
      );
    }

    if (branch.staff.length > 0) {
      throw new BadRequestException(
        'Không thể xóa chi nhánh đang có nhân viên quét mã trực thuộc.',
      );
    }

    return this.prisma.branch.delete({
      where: { branchId },
    });
  }

  /**
   * Tạo tài khoản nhân viên (PARTNER_STAFF) cho chi nhánh cửa hàng.
   */
  async createStaff(partnerId: string, dto: CreateStaffDto) {
    // 1. Kiểm tra chi nhánh thuộc sở hữu của đối tác
    const branch = await this.prisma.branch.findUnique({
      where: { branchId: dto.branchId },
    });
    if (!branch || branch.partnerId !== partnerId) {
      throw new NotFoundException(
        'Chi nhánh không tồn tại hoặc không thuộc sở hữu của đối tác.',
      );
    }

    // 2. Kiểm tra trùng lặp theo từng trường để frontend có thể gắn lỗi đúng ô nhập liệu
    const [existingEmail, existingPhone] = await Promise.all([
      this.prisma.user.findFirst({
        where: { email: dto.email },
        select: { userId: true },
      }),
      this.prisma.user.findFirst({
        where: { phone: dto.phone },
        select: { userId: true },
      }),
    ]);

    if (existingEmail) {
      throw new ConflictException('Email đã được đăng ký tài khoản khác.');
    }

    if (existingPhone) {
      throw new ConflictException(
        'Số điện thoại đã được đăng ký tài khoản khác.',
      );
    }

    // 3. Mã hóa mật khẩu
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // 4. Tạo user
    return this.prisma.user.create({
      data: {
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        fullName: dto.fullName,
        role: 'PARTNER_STAFF',
        partnerId,
        branchId: dto.branchId,
        status: UserStatus.ACTIVE, // Nhân viên của đối tác mặc định kích hoạt hoạt động
      },
      select: {
        userId: true,
        email: true,
        phone: true,
        fullName: true,
        role: true,
        branchId: true,
        createdAt: true,
      },
    });
  }

  /**
   * Lấy danh sách nhân viên của đối tác.
   */
  async listStaff(partnerId: string) {
    return this.prisma.user.findMany({
      where: { partnerId, role: 'PARTNER_STAFF' },
      select: {
        userId: true,
        email: true,
        phone: true,
        fullName: true,
        role: true,
        status: true,
        branchId: true,
        createdAt: true,
        branch: {
          select: { name: true, branchId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Cập nhật thông tin nhân viên (Đổi tên, đổi chi nhánh, đổi mật khẩu tùy chọn).
   */
  async updateStaff(
    partnerId: string,
    staffUserId: string,
    dto: UpdateStaffDto,
  ) {
    // 1. Kiểm tra tài khoản nhân viên thuộc đối tác quản lý
    const staff = await this.prisma.user.findFirst({
      where: { userId: staffUserId, partnerId, role: 'PARTNER_STAFF' },
    });
    if (!staff) {
      throw new NotFoundException(
        'Không tìm thấy tài khoản nhân viên cần chỉnh sửa.',
      );
    }

    const updateData: Prisma.UserUncheckedUpdateInput = {};

    if (dto.fullName) {
      updateData.fullName = dto.fullName;
    }

    if (dto.branchId) {
      // Xác thực chi nhánh mới thuộc đối tác sở hữu
      const branch = await this.prisma.branch.findUnique({
        where: { branchId: dto.branchId },
      });
      if (!branch || branch.partnerId !== partnerId) {
        throw new NotFoundException(
          'Chi nhánh không tồn tại hoặc không thuộc sở hữu của đối tác.',
        );
      }
      updateData.branchId = dto.branchId;
    }

    if (dto.password) {
      updateData.passwordHash = await bcrypt.hash(dto.password, 10);
      updateData.passwordChangedAt = new Date();
    }

    const changedAt = new Date();
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { userId: staffUserId },
        data: updateData,
        select: {
          userId: true,
          email: true,
          fullName: true,
          role: true,
          branchId: true,
        },
      });
      if (dto.password) {
        await tx.authSession.updateMany({
          where: { userId: staffUserId, revokedAt: null },
          data: { revokedAt: changedAt },
        });
      }
      return updated;
    });
  }

  /**
   * Xóa tài khoản nhân viên.
   */
  async deleteStaff(partnerId: string, staffUserId: string) {
    const staff = await this.prisma.user.findFirst({
      where: { userId: staffUserId, partnerId, role: 'PARTNER_STAFF' },
    });
    if (!staff) {
      throw new NotFoundException(
        'Không tìm thấy tài khoản nhân viên cần xóa.',
      );
    }

    return this.prisma.user.delete({
      where: { userId: staffUserId },
      select: { userId: true },
    });
  }

  // ================= ADMIN OPERATIONS =================

  /**
   * Admin: Lấy tổng quan dashboard hệ thống.
   */
  async getAdminDashboard() {
    const [
      partnerCount,
      campaignCount,
      successfulOrderCount,
      revenueSummary,
      customerCount,
      adminCount,
      staffCount,
      approvedCount,
      pendingCount,
      draftCount,
      rejectedCount,
      expiredCount,
    ] = await Promise.all([
      this.prisma.partner.count(),
      this.prisma.voucherCampaign.count(),
      this.prisma.order.count({
        where: {
          paymentStatus: 'PAID',
        },
      }),
      this.prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: {
          paymentStatus: 'PAID',
        },
      }),
      this.prisma.user.count({ where: { role: 'CUSTOMER' } }),
      this.prisma.user.count({ where: { role: 'ADMIN' } }),
      this.prisma.user.count({ where: { role: 'PARTNER_STAFF' } }),
      this.prisma.voucherCampaign.count({ where: { status: 'APPROVED' } }),
      this.prisma.voucherCampaign.count({ where: { status: 'PENDING_APPROVAL' } }),
      this.prisma.voucherCampaign.count({ where: { status: 'DRAFT' } }),
      this.prisma.voucherCampaign.count({ where: { status: 'REJECTED' } }),
      this.prisma.voucherCampaign.count({ where: { status: 'EXPIRED' } }),
    ]);

    // Truy vấn dữ liệu để tính hiệu suất đối tác
    const partnersData = await this.prisma.partner.findMany({
      include: {
        campaigns: {
          include: {
            orderItems: {
              where: {
                order: { paymentStatus: 'PAID' },
              },
              include: {
                voucherCodes: true,
              },
            },
          },
        },
      },
    });

    const partnerPerformance = partnersData.map((p) => {
      const totalCampaigns = p.campaigns.length;
      let vouchersSold = 0;
      let revenue = 0;
      let usedCount = 0;

      p.campaigns.forEach((camp) => {
        camp.orderItems.forEach((item) => {
          vouchersSold += item.quantity;
          revenue += item.quantity * Number(item.unitPrice);
          item.voucherCodes.forEach((code) => {
            if (code.status === 'USED') {
              usedCount++;
            }
          });
        });
      });

      const usageRate = vouchersSold > 0 ? (usedCount / vouchersSold) * 100 : 0;

      return {
        partnerId: p.partnerId,
        companyName: p.companyName,
        totalCampaigns,
        vouchersSold,
        revenue,
        usageRate: Math.round(usageRate * 10) / 10,
      };
    });

    // Sắp xếp giảm dần theo doanh thu của đối tác
    partnerPerformance.sort((a, b) => b.revenue - a.revenue);

    return {
      totalPartners: partnerCount,
      totalCampaigns: campaignCount,
      totalSuccessfulOrders: successfulOrderCount,
      totalRevenue: Number(revenueSummary._sum.totalAmount ?? 0),
      userStats: {
        totalCustomers: customerCount,
        totalPartners: partnerCount,
        totalAdmins: adminCount,
        totalStaffs: staffCount,
      },
      campaignStats: {
        approved: approvedCount,
        pending: pendingCount,
        draft: draftCount,
        rejected: rejectedCount,
        expired: expiredCount,
      },
      partnerPerformance: partnerPerformance, // Lấy toàn bộ danh sách đối tác
    };
  }

  /**
   * Admin: Lấy danh sách toàn bộ đối tác trên hệ thống kèm thông tin tài khoản để kiểm tra duyệt.
   */
  async adminListPartners() {
    return this.prisma.partner.findMany({
      include: {
        user: {
          select: {
            email: true,
            phone: true,
            fullName: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Admin: Phê duyệt đối tác (Duyệt hồ sơ & Kích hoạt tài khoản).
   */
  async adminApprovePartner(adminId: string, partnerId: string) {
    const partner = await this.prisma.partner.findUnique({
      where: { partnerId },
    });

    if (!partner) {
      throw new NotFoundException('Không tìm thấy đối tác cần duyệt.');
    }

    const res = await this.prisma.$transaction(async (tx) => {
      // 1. Cập nhật trạng thái phê duyệt của đối tác thành APPROVED
      const updatedPartner = await tx.partner.update({
        where: { partnerId },
        data: { approvalStatus: PartnerApprovalStatus.APPROVED },
      });

      // 2. Kích hoạt tài khoản User tương ứng thành ACTIVE (để đăng nhập được)
      await tx.user.update({
        where: { userId: partnerId },
        data: { status: UserStatus.ACTIVE },
      });

      return updatedPartner;
    });

    await this.auditService.logAction(
      adminId,
      'APPROVE_PARTNER',
      'Partner',
      partnerId,
    );
    return res;
  }

  /**
   * Admin: Từ chối phê duyệt đối tác.
   */
  async adminRejectPartner(adminId: string, partnerId: string) {
    const partner = await this.prisma.partner.findUnique({
      where: { partnerId },
    });

    if (!partner) {
      throw new NotFoundException('Không tìm thấy đối tác.');
    }

    const res = await this.prisma.$transaction(async (tx) => {
      // 1. Cập nhật trạng thái thành REJECTED
      const updatedPartner = await tx.partner.update({
        where: { partnerId },
        data: { approvalStatus: PartnerApprovalStatus.REJECTED },
      });

      // 2. Khóa tài khoản User tương ứng để chặn đăng nhập
      await tx.user.update({
        where: { userId: partnerId },
        data: { status: UserStatus.LOCKED },
      });
      await tx.authSession.updateMany({
        where: { userId: partnerId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      return updatedPartner;
    });

    await this.auditService.logAction(
      adminId,
      'REJECT_PARTNER',
      'Partner',
      partnerId,
    );
    return res;
  }

  /**
   * Admin: Khóa/Mở khóa tài khoản đối tác.
   */
  async adminTogglePartnerStatus(adminId: string, partnerId: string, status: PartnerAccountStatus) {
    const partner = await this.prisma.partner.findUnique({
      where: { partnerId },
    });

    if (!partner) {
      throw new NotFoundException('Không tìm thấy đối tác.');
    }

    const userStatus = status === PartnerAccountStatus.ACTIVE ? UserStatus.ACTIVE : UserStatus.LOCKED;

    const res = await this.prisma.$transaction(async (tx) => {
      // 1. Cập nhật trạng thái đối tác
      const updatedPartner = await tx.partner.update({
        where: { partnerId },
        data: { accountStatus: status },
      });

      // 2. Đồng bộ khóa/mở khóa User đăng nhập tương ứng
      await tx.user.update({
        where: { userId: partnerId },
        data: { status: userStatus },
      });

      return updatedPartner;
    });

    const action = status === PartnerAccountStatus.ACTIVE ? 'ACTIVATE_PARTNER' : 'LOCK_PARTNER';
    await this.auditService.logAction(adminId, action, 'Partner', partnerId);
    return res;
  }

  /**
   * Admin: Xem chi nhánh của một đối tác bất kỳ.
   */
  async adminGetPartnerBranches(partnerId: string) {
    const partner = await this.prisma.partner.findUnique({
      where: { partnerId },
    });
    if (!partner) {
      throw new NotFoundException('Không tìm thấy đối tác.');
    }

    return this.prisma.branch.findMany({
      where: { partnerId },
      orderBy: { name: 'asc' },
    });
  }
}
