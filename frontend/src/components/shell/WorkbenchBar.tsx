'use client';

import { LayoutGrid, Menu, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkbenchStore } from '@/hooks/useWorkbenchStore';

export function WorkbenchBar() {
  const openTabs = useWorkbenchStore((s) => s.openTabs);
  const activeTabKey = useWorkbenchStore((s) => s.activeTabKey);
  const activateTab = useWorkbenchStore((s) => s.activateTab);
  const closeTab = useWorkbenchStore((s) => s.closeTab);
  const toggleSidebar = useWorkbenchStore((s) => s.toggleSidebar);

  return (
    <div className="flex h-9 items-center border-b border-line bg-surface-sunken/70 pl-2 pr-1">
      <div className="flex items-center gap-0.5 pr-2 mr-1 border-r border-line">
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
          className="flex h-6 w-6 items-center justify-center rounded text-text-muted hover:bg-surface-sunken hover:text-text-primary"
        >
          <Menu className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label="Program launcher"
          className="flex h-6 w-6 items-center justify-center rounded text-text-muted hover:bg-surface-sunken hover:text-text-primary"
        >
          <LayoutGrid className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label="Search programs"
          className="flex h-6 w-6 items-center justify-center rounded text-text-muted hover:bg-surface-sunken hover:text-text-primary"
        >
          <Search className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex h-full flex-1 items-center gap-0.5 overflow-x-auto">
        <WorkbenchTabButton
          label="Workbench"
          active={activeTabKey === 'workbench'}
          onClick={() => activateTab('workbench')}
        />
        {openTabs.map((tab) => (
          <WorkbenchTabButton
            key={tab.key}
            label={tab.title}
            active={activeTabKey === tab.key}
            onClick={() => activateTab(tab.key)}
            onClose={() => closeTab(tab.key)}
          />
        ))}
      </div>
    </div>
  );
}

function WorkbenchTabButton({
  label,
  active,
  onClick,
  onClose,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  onClose?: () => void;
}) {
  return (
    <div
      className={cn(
        'group flex h-7 shrink-0 items-center gap-1.5 rounded-t border border-b-0 px-2.5 text-xs font-medium transition-colors',
        active
          ? 'border-line bg-white text-text-primary'
          : 'border-transparent text-text-secondary hover:bg-white/60 hover:text-text-primary',
      )}
    >
      <button type="button" onClick={onClick} className="whitespace-nowrap focus:outline-none">
        {label}
      </button>
      {onClose && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label={`Close ${label}`}
          className="rounded p-0.5 text-text-muted opacity-0 hover:bg-danger-soft hover:text-danger group-hover:opacity-100"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
