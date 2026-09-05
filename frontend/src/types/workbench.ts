import type { LucideIcon } from 'lucide-react';

export type ModuleId = 'personnel' | 'leave' | 'device' | 'payroll' | 'system-settings';

export interface ModuleDefinition {
  id: ModuleId;
  label: string;
  enabled: boolean; // only Personnel is enabled in this phase
}

export interface ProgramInternalTab {
  id: string;
  label: string;
}

/** Static definition of a program that can be opened from the sidebar. */
export interface ProgramDefinition {
  id: string;
  /** Fallback tab title if no override is supplied when opening. */
  title: string;
  breadcrumb: string[];
  internalTabs?: ProgramInternalTab[];
  defaultInternalTab?: string;
}

/** A single open Workbench tab (an instance of a program). */
export interface WorkbenchTab {
  key: string; // === programId, since a program can only be open once
  programId: string;
  title: string; // fixed at creation time
  breadcrumb: string[];
  activeInternalTab?: string;
}

export interface SidebarLeaf {
  type: 'leaf';
  id: string;
  label: string;
  icon?: LucideIcon;
  programId: string;
  /** For programs with internal tabs, which one this sidebar entry should activate. */
  internalTabId?: string;
  /** Special case: the Dashboard entry activates the Workbench tab instead of opening a program. */
  isDashboard?: boolean;
}

export interface SidebarGroup {
  type: 'group';
  id: string;
  label: string;
  icon?: LucideIcon;
  children: SidebarLeaf[];
}

export type SidebarNode = SidebarLeaf | SidebarGroup;
