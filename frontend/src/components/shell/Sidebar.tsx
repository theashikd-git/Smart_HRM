'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkbenchStore } from '@/hooks/useWorkbenchStore';
import { PERSONNEL_SIDEBAR, PROGRAM_REGISTRY } from '@/lib/personnel-nav';
import type { SidebarGroup, SidebarLeaf, SidebarNode } from '@/types/workbench';

export function Sidebar() {
  const sidebarExpanded = useWorkbenchStore((s) => s.sidebarExpanded);

  return (
    <aside
      className={cn(
        'shrink-0 overflow-y-auto border-r border-ink-line/40 bg-ink text-white transition-[width] duration-200 ease-in-out',
        sidebarExpanded ? 'w-56' : 'w-14',
      )}
    >
      <nav className="py-2">
        {PERSONNEL_SIDEBAR.map((node) => (
          <SidebarNodeItem key={node.id} node={node} depth={0} />
        ))}
      </nav>
    </aside>
  );
}

function SidebarNodeItem({ node, depth }: { node: SidebarNode; depth: number }) {
  if (node.type === 'group') return <SidebarGroupItem node={node} />;
  return <SidebarLeafItem node={node} depth={depth} />;
}

function SidebarGroupItem({ node }: { node: SidebarGroup }) {
  const sidebarExpanded = useWorkbenchStore((s) => s.sidebarExpanded);
  const isOpen = useWorkbenchStore((s) => s.expandedGroups[node.id] ?? false);
  const toggleGroup = useWorkbenchStore((s) => s.toggleGroup);
  const Icon = node.icon;

  return (
    <div>
      <button
        type="button"
        onClick={() => toggleGroup(node.id)}
        title={!sidebarExpanded ? node.label : undefined}
        className={cn(
          'flex w-full items-center gap-2.5 px-3.5 py-2 text-[13px] font-medium text-white/70 transition-colors hover:bg-ink-soft hover:text-white',
          !sidebarExpanded && 'justify-center px-0',
        )}
      >
        {Icon && <Icon className="h-4 w-4 shrink-0" />}
        {sidebarExpanded && (
          <>
            <span className="flex-1 text-left">{node.label}</span>
            {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </>
        )}
      </button>

      {sidebarExpanded && (
        <div
          className={cn(
            'overflow-hidden transition-[max-height] duration-200 ease-in-out',
            isOpen ? 'max-h-96' : 'max-h-0',
          )}
        >
          {node.children.map((child) => (
            <SidebarLeafItem key={child.id} node={child} depth={1} />
          ))}
        </div>
      )}
    </div>
  );
}

function SidebarLeafItem({ node, depth }: { node: SidebarLeaf; depth: number }) {
  const sidebarExpanded = useWorkbenchStore((s) => s.sidebarExpanded);
  const activeTabKey = useWorkbenchStore((s) => s.activeTabKey);
  const openTabs = useWorkbenchStore((s) => s.openTabs);
  const openProgram = useWorkbenchStore((s) => s.openProgram);
  const activateTab = useWorkbenchStore((s) => s.activateTab);
  const Icon = node.icon;

  const openTab = openTabs.find((t) => t.programId === node.programId);
  const isActive = node.isDashboard
    ? activeTabKey === 'workbench'
    : activeTabKey === node.programId && (!node.internalTabId || openTab?.activeInternalTab === node.internalTabId);

  function handleClick() {
    if (node.isDashboard) {
      activateTab('workbench');
      return;
    }
    const program = PROGRAM_REGISTRY[node.programId];
    if (!program) return;
    openProgram(program, { title: node.label, internalTab: node.internalTabId });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title={!sidebarExpanded ? node.label : undefined}
      className={cn(
        'flex w-full items-center gap-2.5 py-2 text-[13px] transition-colors',
        sidebarExpanded ? (depth > 0 ? 'pl-9 pr-3.5' : 'px-3.5') : 'justify-center px-0',
        isActive ? 'bg-accent text-white font-medium' : 'text-white/65 hover:bg-ink-soft hover:text-white',
      )}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" />}
      {!Icon && depth > 0 && <span className="h-1 w-1 shrink-0 rounded-full bg-current opacity-60" />}
      {sidebarExpanded && <span className="truncate text-left">{node.label}</span>}
    </button>
  );
}
