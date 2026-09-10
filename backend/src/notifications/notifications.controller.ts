import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

// No @Roles() anywhere here -- every route is scoped to the calling user's
// own employeeId (from the JWT via @CurrentUser()), so any authenticated
// login (EMPLOYEE included) may read/ack their own notifications, the same
// "no explicit Roles = any authenticated user, but self-scoped" pattern as
// Roster's /roster/mine and Leave's /leave/my/*.
@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private service: NotificationsService) {}

  @Get('mine')
  listMine(@CurrentUser() user: any) {
    return this.service.listMine(user.employeeId);
  }

  @Get('mine/unread-count')
  unreadCount(@CurrentUser() user: any) {
    return this.service.unreadCount(user.employeeId);
  }

  @Patch('mine/:id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.markRead(id, user.employeeId);
  }

  @Patch('mine/read-all')
  markAllRead(@CurrentUser() user: any) {
    return this.service.markAllRead(user.employeeId);
  }
}
