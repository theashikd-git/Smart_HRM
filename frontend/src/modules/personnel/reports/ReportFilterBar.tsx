'use client';

import { useState } from 'react';
import { Printer, RotateCcw, Search, Upload } from 'lucide-react';
import { reportDepartments, reportShifts } from '@/data/mock/personnel';

export function ReportFilterBar() {
  const [from, setFrom] = useState('2026-08-17');
  const [to, setTo] = useState('2026-08-17');
  const [department, setDepartment] = useState(reportDepartments[0]);
  const [employee, setEmployee] = useState('All Employees');
  const [shift, setShift] = useState(reportShifts[0]);

  return (
    <div className="mb-4 rounded border border-line bg-white p-3.5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Date Range">
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded border border-line bg-white px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/40"
            />
            <span className="text-xs text-text-muted">-</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded border border-line bg-white px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/40"
            />
          </div>
        </Field>

        <Field label="Department">
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="w-full rounded border border-line bg-white px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/40"
          >
            {reportDepartments.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </Field>

        <Field label="Employee">
          <select
            value={employee}
            onChange={(e) => setEmployee(e.target.value)}
            className="w-full rounded border border-line bg-white px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/40"
          >
            <option>All Employees</option>
          </select>
        </Field>

        <Field label="Shift">
          <select
            value={shift}
            onChange={(e) => setShift(e.target.value)}
            className="w-full rounded border border-line bg-white px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/40"
          >
            {reportShifts.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <button className="flex items-center gap-1.5 rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-dark">
          <Search className="h-3.5 w-3.5" /> Search
        </button>
        <button className="flex items-center gap-1.5 rounded border border-line bg-white px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-sunken">
          <RotateCcw className="h-3.5 w-3.5" /> Reset
        </button>
        <button className="flex items-center gap-1.5 rounded border border-line bg-white px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-sunken">
          <Upload className="h-3.5 w-3.5" /> Export
        </button>
        <button className="flex items-center gap-1.5 rounded border border-line bg-white px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-sunken">
          <Printer className="h-3.5 w-3.5" /> Print
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium text-text-secondary">{label}</label>
      {children}
    </div>
  );
}
