/** Display text for a login role. The stored code MANAGING_DIRECTOR is shown as "Director". */
export function roleLabel(role?: string | null): string {
  if (!role) return '';
  return role === 'MANAGING_DIRECTOR' ? 'DIRECTOR' : role;
}
