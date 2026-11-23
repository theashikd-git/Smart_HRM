'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { ProgramWorkspace } from '@/components/shell/ProgramWorkspace';
import { Button } from '@/components/ui/Button';
import { DesignationList } from './DesignationList';
import type { WorkbenchTab } from '@/types/workbench';

/** Organization > Designation: the shared, company-wide list of job titles.
 *  Departments choose which of these apply to them (Organization > Department). */
export function DesignationProgram({ tab }: { tab: WorkbenchTab }) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <ProgramWorkspace
      title={tab.title}
      breadcrumb={tab.breadcrumb}
      actions={
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Designation
        </Button>
      }
    >
      <DesignationList addOpen={addOpen} onAddClose={() => setAddOpen(false)} />
    </ProgramWorkspace>
  );
}
