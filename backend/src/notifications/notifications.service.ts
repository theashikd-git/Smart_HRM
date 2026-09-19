import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type NotificationCategoryValue = 'LEAVE' | 'SHIFT';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Drops one notification row for a login (User) -- staff and Employee
   * Portal accounts alike, no distinction. Called from other modules
   * (LeaveService on apply/approve/reject/tier-advance, RosterService on
   * assign/clear) -- never from a controller directly, so there is no
   * "notify someone else" surface to guard against.
   */
  async create(userId: string | null | undefined, category: NotificationCategoryValue, title: string, message: string) {
    if (!userId) return null;
    return this.prisma.notification.create({
      data: { userId, category, title, message },
    });
  }

  /** Convenience for callers that only have an Employee id on hand (most
   *  of the leave/roster flows, notifying the applicant about their own
   *  request) -- resolves that employee's own linked login, if any, and
   *  notifies it the same way create() would. No-op if the employee has
   *  no login of their own yet. */
  async createForEmployee(employeeId: string | null | undefined, category: NotificationCategoryValue, title: string, message: string) {
    if (!employeeId) return null;
    const account = await this.prisma.user.findUnique({ where: { employeeId } });
    if (!account) return null;
    return this.create(account.id, category, title, message);
  }

  async listMine(userId: string | null | undefined, limit = 50) {
    if (!userId) return { notifications: [], unreadCount: 0 };

    const [notifications, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return { notifications, unreadCount };
  }

  async unreadCount(userId: string | null | undefined) {
    if (!userId) return { count: 0 };
    const count = await this.prisma.notification.count({ where: { userId, isRead: false } });
    return { count };
  }

  async markRead(id: string, userId: string | null | undefined) {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification) throw new NotFoundException('Notification not found');
    if (notification.userId !== userId) {
      throw new ForbiddenException('This notification does not belong to you');
    }
    if (notification.isRead) return notification;
    return this.prisma.notification.update({ where: { id }, data: { isRead: true } });
  }

  async markAllRead(userId: string | null | undefined) {
    if (!userId) return { success: true, count: 0 };
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { success: true, count: result.count };
  }
}
