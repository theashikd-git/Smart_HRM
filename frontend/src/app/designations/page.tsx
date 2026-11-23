'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { DesignationList } from '@/modules/personnel/designation/DesignationList';

export default function DesignationsPage() {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <AppShell title="Designations" subtitle="Job titles shared across the organization">
      <div className="mb-3 flex justify-end">
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Designation
        </Button>
      </div>
      <DesignationList addOpen={addOpen} onAddClose={() => setAddOpen(false)} />
    </AppShell>
  );
}
