'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Download, FileBarChart } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select, Input } from '@/components/ui/Form';
import { Table, Thead, Tbody, Tr, Th, Td, EmptyState } from '@/components/ui/Table';
import { api, apiErrorMessage } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';

const REPORTS = [
  { key: 'daily-attendance', label: 'Daily Attendance', params: ['date'] },
  { key: 'monthly-attendance', label: 'Monthly Attendance', params: ['month'] },
  { key: 'late', label: 'Late Report', params: ['startDate', 'endDate'] },
  { key: 'overtime', label: 'Overtime Report', params: ['startDate', 'endDate'] },
  { key: 'department-attendance', label: 'Department Attendance', params: ['startDate', 'endDate'] },
  { key: 'device-activity', label: 'Device Activity', params: [] },
  { key: 'sync-history', label: 'Synchronization History', params: [] },
  { key: 'audit-log', label: 'Audit Log', params: [] },
];

export default function ReportsPage() {
  const [reportKey, setReportKey] = useState(REPORTS[0].key);
  const [date, setDate] = useState('');
  const [month, setMonth] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const report = REPORTS.find((r) => r.key === reportKey)!;

  const params: Record<string, string> = {};
  if (report.params.includes('date') && date) params.date = date;
  if (report.params.includes('month') && month) params.month = month;
  if (report.params.includes('startDate') && startDate) params.startDate = startDate;
  if (report.params.includes('endDate') && endDate) params.endDate = endDate;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['report', reportKey, params],
    queryFn: async () => (await api.get(`/reports/${reportKey}`, { params })).data,
  });

  async function handleDownload() {
    try {
      const res = await api.get(`/reports/${reportKey}`, {
        params: { ...params, format: 'csv' },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${reportKey}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  const rows: any[] = Array.isArray(data) ? data : [];
  const columns = rows.length > 0 ? Object.keys(rows[0]).filter((k) => typeof rows[0][k] !== 'object') : [];

  return (
    <AppShell title="Reports" subtitle="Attendance, device, and audit reports with CSV export">
      <Card>
        <div className="flex flex-col sm:flex-row flex-wrap items-center gap-3 p-5 border-b border-line">
          <Select value={reportKey} onChange={(e) => setReportKey(e.target.value)} className="sm:w-64">
            {REPORTS.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </Select>

          {report.params.includes('date') && (
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="sm:w-40" />
          )}
          {report.params.includes('month') && (
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="sm:w-40" />
          )}
          {report.params.includes('startDate') && (
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="sm:w-40" placeholder="Start date" />
          )}
          {report.params.includes('endDate') && (
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="sm:w-40" placeholder="End date" />
          )}

          <div className="flex-1" />
          <Button variant="outline" onClick={() => refetch()}>
            Refresh
          </Button>
          <Button onClick={handleDownload}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>

        {isLoading && <p className="p-5 text-sm text-text-secondary">Loading report...</p>}

        {!isLoading && rows.length === 0 && (
          <EmptyState icon={<FileBarChart className="h-8 w-8" />} title="No data for this report yet" />
        )}

        {!isLoading && rows.length > 0 && (
          <Table>
            <Thead>
              <tr>
                {columns.map((c) => (
                  <Th key={c}>{c.replace(/([A-Z])/g, ' $1')}</Th>
                ))}
              </tr>
            </Thead>
            <Tbody>
              {rows.slice(0, 100).map((row, i) => (
                <Tr key={i}>
                  {columns.map((c) => (
                    <Td key={c} className="text-xs">
                      {String(row[c] ?? '—')}
                    </Td>
                  ))}
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Card>
    </AppShell>
  );
}
