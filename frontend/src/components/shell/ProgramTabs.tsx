'use client';

import { cn } from '@/lib/utils';
import type { ProgramInternalTab } from '@/types/workbench';

interface ProgramTabsProps {
  tabs: ProgramInternalTab[];
  activeTab: string;
  onChange: (tabId: string) => void;
}

export function ProgramTabs({ tabs, activeTab, onChange }: ProgramTabsProps) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-line px-4">
      {tabs.map((tab) => {
        const active = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative shrink-0 whitespace-nowrap px-3 py-2 text-xs font-medium transition-colors focus:outline-none',
              active ? 'text-accent-dark' : 'text-text-secondary hover:text-text-primary',
            )}
          >
            {tab.label}
            {active && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-accent" />}
          </button>
        );
      })}
    </div>
  );
}
