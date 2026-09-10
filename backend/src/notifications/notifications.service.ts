import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type NotificationCategoryValue = 'LEAVE' | 'SHIFT';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Drops one notification row for an employee. Called from other modules
   * (LeaveService on approve/reject/tier-advance, RosterService on
   * assign/clear) -- never from a controller directly, so there is no
   * "notify someone else" surface to guard against.
   */
  async create(employeeId: string, category: NotificationCategoryValue, title: string, message: string) {
    if (!employeeId) return null; // e.g. a request tied to an employee with no linked login yet
    return this.prisma.notification.create({
      data: { employeeId, category, title, message },
    });
  }

  async listMine(employeeId: string | null | undefined, limit = 50) {
    if (!employeeId) return { notifications: [], unreadCount: 0 };

    const [notifications, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { employeeId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.notification.count({ where: { employeeId, isRead: false } }),
    ]);

    return { notifications, unreadCount };
  }

  async unreadCount(employeeId: string | null | undefined) {
    if (!employeeId) return { count: 0 };
    const count = await this.prisma.notification.count({ where: { employeeId, isRead: false } });
    return { count };
  }

  async markRead(id: string, employeeId: string | null | undefined) {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification) throw new NotFoundException('Notification not found');
    if (notification.employeeId !== employeeId) {
      throw new ForbiddenException('This notification does not belong to you');
    }
    if (notification.isRead) return notification;
    return this.prisma.notification.update({ where: { id }, data: { isRead: true } });
  }

  async markAllRead(employeeId: string | null | undefined) {
    if (!employeeId) return { success: true, count: 0 };
    const result = await this.prisma.notification.updateMany({
      where: { employeeId, isRead: false },
      data: { isRead: true },
    });
    return { success: true, count: result.count };
  }
}
