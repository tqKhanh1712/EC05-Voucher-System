import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, User, UserStatus, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { UpdateProfileDto } from './dto/update-profile.dto';

/**
 * Service quản lý người dùng (Users), bao gồm các thao tác tìm kiếm,
 * khởi tạo và cập nhật trạng thái hoạt động của tài khoản.
 */
@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Tìm kiếm người dùng bằng email duy nhất.
   * @param email Địa chỉ email cần tra cứu
   * @returns Bản ghi User hoặc null nếu không tìm thấy
   */
  async findByEmail(email: string): Promise<User | null> {
    const normalizedEmail = email?.trim().toLowerCase();
    return this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
  }

  /**
   * Tìm kiếm người dùng bằng số điện thoại duy nhất.
   * @param phone Số điện thoại cần tra cứu
   * @returns Bản ghi User hoặc null nếu không tìm thấy
   */
  async findByPhone(phone: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { phone },
    });
  }

  /**
   * Tìm kiếm người dùng bằng mã định danh (user_id).
   * @param userId ID duy nhất của người dùng
   * @returns Bản ghi User hoặc null nếu không tìm thấy
   */
  async findById(userId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { userId },
    });
  }

  /**
   * Tạo tài khoản người dùng mới (đáp ứng điều kiện kiểm tra dữ liệu đầu vào DTO).
   * @param data Đối tượng chứa thông tin khởi tạo tài khoản
   * @returns Bản ghi User vừa được khởi tạo thành công
   */
  async create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({
      data,
    });
  }

  /**
   * Cập nhật trạng thái hoạt động (ACTIVE/LOCKED) của người dùng.
   * Thường được gọi bởi các API quản trị hệ thống (Admin).
   * @param userId ID người dùng cần cập nhật
   * @param status Trạng thái mới cần áp dụng
   * @returns Bản ghi User sau khi cập nhật
   */
  async updateStatus(userId: string, status: UserStatus): Promise<User> {
    const changedAt = new Date();
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { userId },
        data: { status },
      });
      if (status !== UserStatus.ACTIVE) {
        await tx.authSession.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: changedAt },
        });
      }
      return user;
    });
  }

  /**
   * Cập nhật thông tin cá nhân của người dùng.
   */
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({ where: { userId } });
    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại.');
    }

    const updateData: Prisma.UserUpdateInput = {};

    // 1. Chỉ đổi tên nếu là CUSTOMER
    if (dto.fullName) {
      if (user.role !== 'CUSTOMER') {
        throw new BadRequestException(
          'Chỉ tài khoản khách hàng mới được đổi họ tên.',
        );
      }
      updateData.fullName = dto.fullName;
    }

    // 2. Đổi sđt (cho phép đổi cho tất cả)
    if (dto.phone !== undefined) {
      if (dto.phone) {
        const existingPhone = await this.prisma.user.findFirst({
          where: { phone: dto.phone, NOT: { userId } },
        });
        if (existingPhone) {
          throw new BadRequestException(
            'Số điện thoại này đã được đăng ký cho tài khoản khác.',
          );
        }
      }
      updateData.phone = dto.phone || null;
    }

    // 3. Đổi mật khẩu
    if (dto.newPassword) {
      if (!dto.currentPassword) {
        throw new BadRequestException(
          'Vui lòng nhập mật khẩu hiện tại để đổi mật khẩu.',
        );
      }
      const isMatch = await bcrypt.compare(
        dto.currentPassword,
        user.passwordHash,
      );
      if (!isMatch) {
        throw new BadRequestException('Mật khẩu hiện tại không chính xác.');
      }
      updateData.passwordHash = await bcrypt.hash(dto.newPassword, 10);
      updateData.passwordChangedAt = new Date();
    }

    const changedAt = new Date();
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { userId },
        data: updateData,
        select: {
          userId: true,
          email: true,
          phone: true,
          fullName: true,
          role: true,
          status: true,
          createdAt: true,
        },
      });
      if (dto.newPassword) {
        await tx.authSession.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: changedAt },
        });
      }
      return updated;
    });
  }

  /**
   * Xóa vĩnh viễn tài khoản người dùng (chỉ áp dụng cho CUSTOMER).
   */
  async deleteAccount(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { userId } });
    if (!user || user.role !== 'CUSTOMER') {
      throw new BadRequestException(
        'Chỉ tài khoản Khách hàng mới được tự xóa tài khoản.',
      );
    }

    return this.prisma.user.delete({
      where: { userId },
      select: { userId: true },
    });
  }

  /**
   * Lấy danh sách tất cả các tài khoản người dùng trong hệ thống (chỉ ADMIN).
   * @param query Bộ lọc tìm kiếm và trạng thái
   */
  async adminListUsers(query: { keyword?: string; role?: string; status?: string }) {
    const where: Prisma.UserWhereInput = {};
    
    if (query.role) {
      where.role = query.role as UserRole;
    }
    
    if (query.status) {
      where.status = query.status as UserStatus;
    }
    
    if (query.keyword) {
      where.OR = [
        { fullName: { contains: query.keyword, mode: 'insensitive' } },
        { email: { contains: query.keyword, mode: 'insensitive' } },
        { phone: { contains: query.keyword, mode: 'insensitive' } },
      ];
    }

    return this.prisma.user.findMany({
      where,
      select: {
        userId: true,
        email: true,
        phone: true,
        fullName: true,
        role: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Thay đổi vai trò người dùng (chỉ ADMIN).
   * @param userId ID người dùng
   * @param role Vai trò mới cần gán
   */
  async adminUpdateRole(userId: string, role: UserRole) {
    const user = await this.prisma.user.findUnique({ where: { userId } });
    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại.');
    }
    
    return this.prisma.user.update({
      where: { userId },
      data: { role },
      select: {
        userId: true,
        email: true,
        role: true,
        status: true,
      },
    });
  }
}
