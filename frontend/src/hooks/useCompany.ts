import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Company {
  id: string;
  name: string;
  code?: string | null;
  logo?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  timeZone: string;
  officeHours?: string | null;
  workingDays?: string | null;
}

/** Company Profile (name, logo, contact info) -- edited from
 *  Personnel > Organization > Company (see CompanyProgram), shown on the
 *  login screen and on any printable report's letterhead (see
 *  AttendanceReport). Same '/company' endpoint CompanyProgram itself uses --
 *  pulled out here so other consumers (a report, the login screen) don't
 *  have to repeat the query by hand. */
export function useCompany() {
  return useQuery({
    queryKey: ['company'],
    queryFn: async () => (await api.get<Company>('/company')).data,
  });
}
