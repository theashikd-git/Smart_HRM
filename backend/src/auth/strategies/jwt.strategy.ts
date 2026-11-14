import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  username: string;
  role: string;
}

// Every authenticated request used to hit the database just to re-check the
// user -- that's one extra query on EVERY click/poll. The result is now kept
// in memory for a short time instead. The only effect: a role change or
// deactivation can take up to this long to apply to an already-signed-in
// session.
const USER_CACHE_MS = 30_000;
const USER_CACHE_MAX = 500;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private userCache = new Map<
    string,
    { until: number; user: { id: string; username: string; role: string; fullName: string; employeeId: string | null } }
  >();

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') || 'dev-secret-change-me',
    });
  }

  async validate(payload: JwtPayload) {
    const hit = this.userCache.get(payload.sub);
    if (hit && hit.until > Date.now()) return hit.user;

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      this.userCache.delete(payload.sub);
      throw new UnauthorizedException('User no longer active');
    }
    const result = {
      id: user.id,
      username: user.email,
      role: user.role,
      fullName: user.fullName,
      employeeId: user.employeeId,
    };
    if (this.userCache.size >= USER_CACHE_MAX) this.userCache.clear();
    this.userCache.set(payload.sub, { until: Date.now() + USER_CACHE_MS, user: result });
    return result;
  }
}
