'use client';

import { useEffect } from 'react';
import { AppShellRoot } from './AppShellRoot';
import { useWorkbenchStore } from '@/hooks/useWorkbenchStore';
import { PROGRAM_REGISTRY } from '@/lib/personnel-nav';

/**
 * Mounts the Workbench shell and opens a specific program on load, so a legacy
 * URL (e.g. /employees) keeps working as a deep link/bookmark/refresh target
 * while the actual UI is rendered inside the new Workbench architecture.
 *
 * This does not duplicate business logic — it only opens the Workbench tab for
 * the given program; the program's real component/API usage lives in the
 * program registry (see modules/personnel/ProgramRouter.tsx).
 */
export function ProgramDeepLink({ programId, internalTab }: { programId: string; internalTab?: string }) {
  const openProgram = useWorkbenchStore((s) => s.openProgram);

  useEffect(() => {
    const program = PROGRAM_REGISTRY[programId];
    if (program) openProgram(program, { internalTab });
    // Only run once on mount — this is a deep-link entry point, not a sync loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <AppShellRoot />;
}
