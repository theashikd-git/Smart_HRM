'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, Pencil, CalendarOff } from 'lucide-react';
import { ProgramWorkspace } from '@/components/shell/ProgramWorkspace';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Card';
import { Table, Thead, Tbody, Tr, Th, Td, EmptyState } from '@/components/ui/Table';
import { useHolidays, useDeleteHoliday } from '@/hooks/useHolidays';
import { formatDate } from '@/lib/utils';
import { apiErrorMessage } from '@/lib/api';
import { AddHolidayModal } from './AddHolidayModal';
import { EditHolidayModal } from './EditHolidayModal';
import type { Holiday } from '@/types';
import type { WorkbenchTab } from '@/types/workbench';

/**
 * Personnel > Government Holiday -- real CRUD now, not the old mock
 * placeholder. Declaring a holiday here is what AttendanceService and
 * DashboardService check (see HolidaysService.isHoliday) so that date
 * shows as HOLIDAY in attendance and on the team dashboard instead of
 * PRESENT/LATE/ABSENT.
 */
export function HolidayProgram({ tab }: { tab: WorkbenchTab }) {
  const { data: holidays, isLoading } = useHolidays();
  const deleteHoliday = useDeleteHoliday();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Holiday | null>(null);

  async function handleDelete(holiday: Holiday) {
    if (!confirm(`Remove "${holiday.name}" from the holiday list?`)) return;
    try {
      await deleteHoliday.mutateAsync(holiday.id);
      toast.success('Holiday removed');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <ProgramWorkspace
      title={tab.title}
      breadcrumb={tab.breadcrumb}
      actions={
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Holiday
        </Button>
      }
    >
      <Card className="overflow-hidden">
        <Table>
          <Thead>
            <tr>
              <Th>Holiday</Th>
              <Th>Date</Th>
              <Th>Type</Th>
              <Th className="text-center w-24">Action</Th>
            </tr>
          </Thead>
          <Tbody>
            {holidays?.map((h) => (
              <Tr key={h.id}>
                <Td className="font-medium text-text-primary">{h.name}</Td>
                <Td>{formatDate(h.date)}</Td>
                <Td>
                  <Badge className={h.type === 'GOVERNMENT' ? 'text-info bg-info-soft' : ''}>
                    {h.type === 'GOVERNMENT' ? 'Government' : 'Company'}
                  </Badge>
                </Td>
                <Td className="text-center">
                  <div className="flex items-center justify-center gap-0.5">
                    <button
                      onClick={() => setEditing(h)}
                      title="Edit holiday"
                      className="rounded p-1 text-text-muted hover:bg-surface-sunken hover:text-text-primary"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(h)}
                      title="Delete holiday"
                      className="rounded p-1 text-text-muted hover:bg-danger-soft hover:text-danger"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>

        {!isLoading && (holidays?.length ?? 0) === 0 && (
          <EmptyState
            icon={<CalendarOff className="h-8 w-8" />}
            title="No holidays declared"
            subtitle="Add a government or company holiday to get started."
          />
        )}
      </Card>

      <AddHolidayModal open={modalOpen} onClose={() => setModalOpen(false)} />
      <EditHolidayModal open={!!editing} onClose={() => setEditing(null)} holiday={editing} />
    </ProgramWorkspace>
  );
}
