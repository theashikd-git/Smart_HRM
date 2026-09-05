'use client';

import { Plus } from 'lucide-react';
import { useWorkbenchStore } from '@/hooks/useWorkbenchStore';
import { PROGRAM_REGISTRY } from '@/lib/personnel-nav';

const ACTIONS = [
  { label: 'Add Employee', programId: 'employee' },
  { label: 'Create Roster', programId: 'roster' },
  { label: 'Assign Shift', programId: 'shift' },
  { label: 'Add Holiday', programId: 'holiday' },
];

export function QuickActions() {
  const openProgram = useWorkbenchStore((s) => s.openProgram);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {ACTIONS.map((action) => (
        <button
          key={action.programId}
          type="button"
          onClick={() => {
            const program = PROGRAM_REGISTRY[action.programId];
            if (program) openProgram(program);
          }}
          className="flex items-center gap-1.5 rounded border border-line bg-white px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:border-accent hover:text-accent-dark"
        >
          <Plus className="h-3.5 w-3.5" />
          {action.label}
        </button>
      ))}
    </div>
  );
}
