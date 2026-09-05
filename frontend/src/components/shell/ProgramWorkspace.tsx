import { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { ProgramTabs } from './ProgramTabs';
import type { ProgramInternalTab } from '@/types/workbench';

interface ProgramWorkspaceProps {
  title: string;
  breadcrumb: string[];
  actions?: ReactNode;
  internalTabs?: ProgramInternalTab[];
  activeInternalTab?: string;
  onInternalTabChange?: (tabId: string) => void;
  children: ReactNode;
}

export function ProgramWorkspace({
  title,
  breadcrumb,
  actions,
  internalTabs,
  activeInternalTab,
  onInternalTabChange,
  children,
}: ProgramWorkspaceProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-line bg-white px-4 py-2.5">
        <div>
          <h1 className="text-[15px] font-semibold text-text-primary leading-tight">{title}</h1>
          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-text-muted">
            {breadcrumb.map((crumb, i) => (
              <span key={crumb} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-2.5 w-2.5" />}
                {crumb}
              </span>
            ))}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      {internalTabs && internalTabs.length > 0 && activeInternalTab && onInternalTabChange && (
        <ProgramTabs tabs={internalTabs} activeTab={activeInternalTab} onChange={onInternalTabChange} />
      )}

      <div className="flex-1 overflow-auto bg-surface p-4">{children}</div>
    </div>
  );
}
