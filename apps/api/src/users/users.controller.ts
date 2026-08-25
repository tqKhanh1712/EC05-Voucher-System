import { Controller, Get, Patch, Delete, Body, UseGuards, Req, Query, Param } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserRole, UserStatus } from '@prisma/client';

/**
 * Controller tiếp nhận các tác vụ tự chỉnh sửa thông tin cá nhân của người dùng hiện tại
 * và các tác vụ quản trị người dùng dành cho Admin.
 */
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  /**
   * Cập nhật thông tin cá nhân (đổi họ tên, sđt hoặc đổi mật khẩu).
   * PATCH /users/profile
   */
  @Patch('profile')
  async updateProfile(@Req() req: any, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(req.user.userId, dto);
  }

  /**
   * Khách hàng tự yêu cầu xóa vĩnh viễn tài khoản.
   * DELETE /users/profile
   */
  @Delete('profile')
  async deleteAccount(@Req() req: any) {
    return this.usersService.deleteAccount(req.user.userId);
  }

  // ================= ADMIN ENDPOINTS =================

  /**
   * Admin: Xem danh sách người dùng trong hệ thống.
   * GET /users/admin/list
   */
  @Get('admin/list')
  @Roles(UserRole.ADMIN)
  async adminListUsers(
    @Query('keyword') keyword?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
  ) {
    return this.usersService.adminListUsers({ keyword, role, status });
  }

  /**
   * Admin: Khóa/mở khóa tài khoản người dùng.
   * PATCH /users/admin/:id/status
   */
  @Patch('admin/:id/status')
  @Roles(UserRole.ADMIN)
  async adminUpdateStatus(
    @Param('id') userId: string,
    @Body('status') status: UserStatus,
  ) {
    return this.usersService.updateStatus(userId, status);
  }

  /**
   * Admin: Thay đổi vai trò người dùng.
   * PATCH /users/admin/:id/role
   */
  @Patch('admin/:id/role')
  @Roles(UserRole.ADMIN)
  async adminUpdateRole(
    @Param('id') userId: string,
    @Body('role') role: UserRole,
  ) {
    return this.usersService.adminUpdateRole(userId, role);
  }
}
