import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

// No @Roles() anywhere here -- every route is scoped to the calling
// login's own id (user.id from the JWT via @CurrentUser()), so any
// authenticated account may read/ack its own notifications, staff and
// Employee Portal alike -- there's nothing here that branches on role.
@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private service: NotificationsService) {}

  @Get('mine')
  listMine(@CurrentUser() user: any) {
    return this.service.listMine(user.id);
  }

  @Get('mine/unread-count')
  unreadCount(@CurrentUser() user: any) {
    return this.service.unreadCount(user.id);
  }

  @Patch('mine/:id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.markRead(id, user.id);
  }

  @Patch('mine/read-all')
  markAllRead(@CurrentUser() user: any) {
    return this.service.markAllRead(user.id);
  }
}
