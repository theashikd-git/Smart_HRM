'use client';

import { create } from 'zustand';
import type { ModuleId, ProgramDefinition, WorkbenchTab } from '@/types/workbench';

interface OpenProgramOptions {
  /** Overrides the program's default title for a NEW tab. Ignored if the tab is already open. */
  title?: string;
  /** Activates a specific internal tab (works whether the tab is new or already open). */
  internalTab?: string;
}

interface WorkbenchState {
  activeModule: ModuleId;
  openTabs: WorkbenchTab[];
  /** 'workbench' (dashboard) or a programId. */
  activeTabKey: string;
  sidebarExpanded: boolean;
  expandedGroups: Record<string, boolean>;

  setActiveModule: (moduleId: ModuleId) => void;
  openProgram: (program: ProgramDefinition, options?: OpenProgramOptions) => void;
  activateTab: (key: string) => void;
  closeTab: (key: string) => void;
  setInternalTab: (key: string, tabId: string) => void;
  toggleSidebar: () => void;
  toggleGroup: (groupId: string) => void;
}

export const useWorkbenchStore = create<WorkbenchState>((set, get) => ({
  activeModule: 'personnel',
  openTabs: [],
  activeTabKey: 'workbench',
  sidebarExpanded: true,
  expandedGroups: {},

  setActiveModule: (moduleId) => set({ activeModule: moduleId }),

  openProgram: (program, options) => {
    const { openTabs } = get();
    const existing = openTabs.find((t) => t.programId === program.id);

    if (existing) {
      // Duplicate prevention: activate the existing tab instead of creating a new one.
      set({
        activeTabKey: existing.key,
        openTabs: openTabs.map((t) =>
          t.key === existing.key
            ? { ...t, activeInternalTab: options?.internalTab ?? t.activeInternalTab }
            : t,
        ),
      });
      return;
    }

    const newTab: WorkbenchTab = {
      key: program.id,
      programId: program.id,
      title: options?.title ?? program.title,
      breadcrumb: program.breadcrumb,
      activeInternalTab: options?.internalTab ?? program.defaultInternalTab,
    };

    set({ openTabs: [...openTabs, newTab], activeTabKey: newTab.key });
  },

  activateTab: (key) => set({ activeTabKey: key }),

  closeTab: (key) => {
    const { openTabs, activeTabKey } = get();
    const idx = openTabs.findIndex((t) => t.key === key);
    if (idx === -1) return;

    const newTabs = openTabs.filter((t) => t.key !== key);
    let newActiveKey = activeTabKey;

    if (activeTabKey === key) {
      // Activate the previous open program (to the left); fall back to Workbench.
      newActiveKey = idx > 0 ? openTabs[idx - 1].key : 'workbench';
    }

    set({ openTabs: newTabs, activeTabKey: newActiveKey });
  },

  setInternalTab: (key, tabId) => {
    const { openTabs } = get();
    set({
      openTabs: openTabs.map((t) => (t.key === key ? { ...t, activeInternalTab: tabId } : t)),
    });
  },

  toggleSidebar: () => set((s) => ({ sidebarExpanded: !s.sidebarExpanded })),

  toggleGroup: (groupId) =>
    set((s) => ({ expandedGroups: { ...s.expandedGroups, [groupId]: !s.expandedGroups[groupId] } })),
}));
