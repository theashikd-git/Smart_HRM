'use client';

import { create } from 'zustand';
import type { ModuleId, ProgramDefinition, WorkbenchTab } from '@/types/workbench';

interface OpenProgramOptions {
  /** Overrides the program's default title for a NEW tab. Ignored if the tab is already open. */
  title?: string;
  /** Activates a specific internal tab (works whether the tab is new or already open). */
  internalTab?: string;
}

// localStorage key -- bump the version suffix if the persisted shape below
// ever changes incompatibly, so old browsers don't load a stale/broken shape.
const STORAGE_KEY = 'smart_hrm_workbench_v1';

/** The subset of state that survives a page reload -- everything about
 *  which programs are open and how, not the data inside them (React Query
 *  refetches that fresh on mount regardless). */
interface PersistedWorkbenchState {
  activeModule: ModuleId;
  openTabs: WorkbenchTab[];
  activeTabKey: string;
  sidebarExpanded: boolean;
  expandedGroups: Record<string, boolean>;
}

function loadPersisted(): Partial<PersistedWorkbenchState> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    // Corrupt/old-shape value -- ignore it and start fresh rather than crash.
    return null;
  }
}

function savePersisted(state: PersistedWorkbenchState) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full/unavailable (e.g. private browsing) -- reloading just
    // won't restore tabs this time; not worth surfacing to the user.
  }
}

interface WorkbenchState extends PersistedWorkbenchState {
  /** True once a reload's saved tabs (if any) have been applied. Gates the
   *  shell's first real render so tabs don't flash empty before restoring. */
  hydrated: boolean;

  hydrate: () => void;
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
  hydrated: false,

  // Reads whatever was open last time (if anything) from localStorage.
  // Safe to call more than once -- a no-op after the first successful run.
  hydrate: () => {
    if (get().hydrated) return;
    const saved = loadPersisted();
    if (saved) {
      set({
        activeModule: saved.activeModule ?? 'personnel',
        openTabs: saved.openTabs ?? [],
        activeTabKey: saved.activeTabKey ?? 'workbench',
        sidebarExpanded: saved.sidebarExpanded ?? true,
        expandedGroups: saved.expandedGroups ?? {},
        hydrated: true,
      });
    } else {
      set({ hydrated: true });
    }
  },

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

// Mirror every change back to localStorage once hydration has run, so the
// next reload picks up exactly what was open (which programs, which one was
// active, sidebar state) -- only the underlying data refreshes, not the
// layout. Guarded on `hydrated` so this never fires with the store's
// pre-hydration defaults and overwrites a real saved session with them.
if (typeof window !== 'undefined') {
  useWorkbenchStore.subscribe((state) => {
    if (!state.hydrated) return;
    savePersisted({
      activeModule: state.activeModule,
      openTabs: state.openTabs,
      activeTabKey: state.activeTabKey,
      sidebarExpanded: state.sidebarExpanded,
      expandedGroups: state.expandedGroups,
    });
  });
}

/** Clears any saved tab layout -- call this on logout so the next person to
 *  sign in on this browser doesn't inherit the previous user's open tabs. */
export function clearPersistedWorkbench() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
