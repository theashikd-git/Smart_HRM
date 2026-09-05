'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollText } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Table, Thead, Tbody, Tr, Th, Td, EmptyState } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Card';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page],
    queryFn: async () => (await api.get('/audit-logs', { params: { page, pageSize: 20 } })).data,
  });

  return (
    <AppShell title="Audit Logs" subtitle="Every important action taken across Smart HRM">
      <Card>
        <Table>
          <Thead>
            <tr>
              <Th>Action</Th>
              <Th>Entity</Th>
              <Th>User</Th>
              <Th>Details</Th>
              <Th>Time</Th>
            </tr>
          </Thead>
          <Tbody>
            {data?.items?.map((log: any) => (
              <Tr key={log.id}>
                <Td>
                  <Badge>{log.action.replaceAll('_', ' ')}</Badge>
                </Td>
                <Td className="text-xs">{log.entity}</Td>
                <Td className="text-xs">{log.user?.fullName || 'System'}</Td>
                <Td className="text-xs text-text-secondary max-w-sm truncate">{log.details || '—'}</Td>
                <Td className="text-xs">{formatDateTime(log.createdAt)}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>

        {!isLoading && (data?.items?.length ?? 0) === 0 && (
          <EmptyState icon={<ScrollText className="h-8 w-8" />} title="No audit activity yet" />
        )}

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-line">
            <p className="text-xs text-text-secondary">
              Page {data.page} of {data.totalPages} &middot; {data.total} entries
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </AppShell>
  );
}
