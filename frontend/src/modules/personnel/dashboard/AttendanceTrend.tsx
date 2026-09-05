'use client';

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useWeeklyAttendance } from '@/hooks/useDashboard';

export function AttendanceTrend() {
  const { data, isLoading } = useWeeklyAttendance();

  return (
    <div className="rounded border border-line bg-white">
      <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
        <h3 className="text-[13px] font-semibold text-text-primary">Attendance Trend</h3>
        <span className="text-[11px] text-text-muted">Last 7 Days</span>
      </div>
      <div className="h-56 px-2 py-3">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-xs text-text-muted">Loading...</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data || []} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E3E6EB" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, { weekday: 'short' })}
                tick={{ fontSize: 11, fill: '#8A93A1' }}
                axisLine={{ stroke: '#E3E6EB' }}
                tickLine={false}
              />
              <YAxis tick={{ fontSize: 11, fill: '#8A93A1' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #E3E6EB' }}
                labelFormatter={(v) => new Date(v).toDateString()}
              />
              <Line type="monotone" dataKey="present" name="Present" stroke="#16A34A" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="absent" name="Absent" stroke="#DC2626" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="late" name="Late" stroke="#D97706" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="flex items-center gap-4 border-t border-line px-3.5 py-2 text-[11px] text-text-secondary">
        <LegendDot color="#16A34A" label="Present" />
        <LegendDot color="#DC2626" label="Absent" />
        <LegendDot color="#D97706" label="Late" />
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
