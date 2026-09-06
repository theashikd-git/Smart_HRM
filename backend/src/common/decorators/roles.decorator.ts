import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export type AppRole = 'ADMIN' | 'HR' | 'MANAGER' | 'SUPERVISOR' | 'EMPLOYEE';

/**
 * Restrict an endpoint to one or more roles.
 * Usage: @Roles('ADMIN', 'HR')
 */
export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);
