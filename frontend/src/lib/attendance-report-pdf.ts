import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Company } from '@/hooks/useCompany';
import type { AttendanceRecord } from '@/types';
import { formatDate, formatTime } from '@/lib/utils';

export const ATTENDANCE_STATUS_LABEL: Record<string, string> = {
  PRESENT: 'Present',
  LATE: 'Late',
  ABSENT: 'Absent',
  HALF_DAY: 'Half Day',
  ON_LEAVE: 'Leave',
  HOLIDAY: 'Off',
};

const DAY_NAME = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dayName(dateStr: string) {
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? '—' : DAY_NAME[d.getDay()];
}

interface AttendanceReportPdfArgs {
  company?: Company | null;
  rows: AttendanceRecord[];
  /** e.g. "Sep 21, 2026" or "Sep 1 - Sep 21, 2026" */
  periodLabel: string;
  /** Always shown right under the "Attendance Report" title -- the department this run was filtered to. Defaults to "All Departments" so the printed sheet always states its scope, never leaves it implicit. */
  departmentLabel?: string;
  /** Extra scope appended after the period, e.g. "Employee: Jane Doe (EMP004)" or "Status: Present" -- omitted entirely when there's nothing extra to show. */
  scopeLabel?: string;
}

/**
 * Shared PDF builder -- the single source of truth for the standard
 * Attendance Report layout, used by both downloadAttendanceReportPdf
 * (saves the file) and printAttendanceReportPdf (opens it in a new tab and
 * triggers the browser's print dialog immediately). Keeping one builder
 * means the printed and downloaded versions can never drift apart.
 *
 * Layout: a letterhead (company logo + name, "Attendance Report" title,
 * then a Department line -- always present -- and the period/scope)
 * followed by one section per employee -- a Name/ID/Department header bar,
 * then a compact date-by-date table of that employee's records for the
 * selected period, and a per-employee totals line. This is the "standard"
 * register format: works the same whether `rows` covers a single employee
 * (the single-person filter), one department, or everyone in a date range
 * -- it just groups whatever rows it's given. A grand summary is added at
 * the end when more than one employee is included. autoTable repeats each
 * employee's table header on every page it spans, and section headers
 * never split across a page break, so long ranges paginate cleanly.
 */
function buildAttendanceReportPdf({
  company,
  rows,
  periodLabel,
  departmentLabel = 'All Departments',
  scopeLabel,
}: AttendanceReportPdfArgs): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 12;
  const bottomMargin = 16;

  // Letterhead -- company logo (if uploaded via Personnel > Organization >
  // Company) centered above the name, contact line, then the report title.
  // Drawn once, on page 1.
  let y = 14;
  if (company?.logo) {
    try {
      const props = doc.getImageProperties(company.logo);
      const h = 14;
      const w = (props.width / props.height) * h;
      doc.addImage(company.logo, props.fileType || 'PNG', pageWidth / 2 - w / 2, y, w, h, undefined, 'FAST');
      y += h + 3;
    } catch {
      // Unsupported image format for this PDF library (e.g. an SVG upload) -- fall back to text-only letterhead.
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(company?.name || 'Company Name', pageWidth / 2, y, { align: 'center' });
  y += 5;

  const contactLine = [company?.address, company?.phone, company?.email].filter(Boolean).join('   |   ');
  if (contactLine) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(contactLine, pageWidth / 2, y, { align: 'center' });
    y += 4;
  }

  y += 1;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Attendance Report', pageWidth / 2, y, { align: 'center' });
  y += 5;

  doc.setDrawColor(210);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 6;

  // Department line -- always shown right under the title (even when the
  // report covers everyone), so a printed sheet never leaves its scope
  // ambiguous.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`Department: ${departmentLabel}`, marginX, y);
  y += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(scopeLabel ? `${periodLabel}   —   ${scopeLabel}` : periodLabel, marginX, y);
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(`Generated ${formatDate(new Date())} ${formatTime(new Date())}`, pageWidth - marginX, y, { align: 'right' });
  doc.setTextColor(30, 30, 30);
  y += 6;

  if (rows.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(140);
    doc.text('No attendance records for this period.', pageWidth / 2, y + 10, { align: 'center' });
    doc.setTextColor(30, 30, 30);
    return doc;
  }

  // Group rows by employee -- name & ID become a section header, and every
  // date that employee has a record for lands underneath it, oldest first.
  const groups = new Map<string, { name: string; code: string; dept: string; rows: AttendanceRecord[] }>();
  for (const r of rows) {
    const key = r.employeeId;
    if (!groups.has(key)) {
      groups.set(key, {
        name: r.employee?.fullName ?? 'Unknown',
        code: r.employee?.employeeCode ?? '—',
        dept: r.employee?.department?.name ?? '—',
        rows: [],
      });
    }
    groups.get(key)!.rows.push(r);
  }
  const employeeGroups = [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
  employeeGroups.forEach((g) => g.rows.sort((a, b) => a.date.localeCompare(b.date)));
  const multiEmployee = employeeGroups.length > 1;

  employeeGroups.forEach((group, idx) => {
    // The header bar plus at least one table row needs roughly 18mm --
    // start a fresh page rather than stranding a lone header at the bottom.
    if (y + 18 > pageHeight - bottomMargin) {
      doc.addPage();
      y = 14;
    } else if (idx > 0) {
      y += 3;
    }

    doc.setFillColor(30, 41, 59);
    doc.rect(marginX, y, pageWidth - marginX * 2, 7.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255);
    doc.text(group.name, marginX + 2, y + 5.2);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`ID: ${group.code}   |   Dept: ${group.dept}`, pageWidth - marginX - 2, y + 5.2, { align: 'right' });
    doc.setTextColor(30, 30, 30);
    y += 9.5;

    autoTable(doc, {
      startY: y,
      head: [['Date', 'Day', 'Check In', 'Check Out', 'Work Hrs', 'Status']],
      body: group.rows.map((r) => [
        formatDate(r.date),
        dayName(r.date),
        formatTime(r.checkIn),
        formatTime(r.checkOut),
        r.workHours ? `${r.workHours}h` : '—',
        ATTENDANCE_STATUS_LABEL[r.status] ?? r.status,
      ]),
      styles: { fontSize: 8, cellPadding: 1.4, textColor: [30, 30, 30] },
      headStyles: { fillColor: [71, 85, 105], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 249, 250] },
      margin: { left: marginX, right: marginX, bottom: bottomMargin },
      theme: 'grid',
      showHead: 'everyPage',
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 3;

    const counts: Record<string, number> = {};
    group.rows.forEach((r) => {
      counts[r.status] = (counts[r.status] ?? 0) + 1;
    });
    const summary = [
      `Total: ${group.rows.length}`,
      ...Object.entries(ATTENDANCE_STATUS_LABEL)
        .filter(([key]) => counts[key])
        .map(([key, label]) => `${label}: ${counts[key]}`),
    ].join('     ');
    if (y + 5 > pageHeight - bottomMargin) {
      doc.addPage();
      y = 14;
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100);
    doc.text(summary, marginX + 1, y);
    doc.setTextColor(30, 30, 30);
    y += 6;
  });

  // A grand summary across everyone only means something once more than
  // one employee is on the report -- a single-person report already ends
  // with that person's own totals line above.
  if (multiEmployee) {
    if (y + 13 > pageHeight - bottomMargin) {
      doc.addPage();
      y = 14;
    }
    doc.setDrawColor(210);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 5;
    const counts: Record<string, number> = {};
    rows.forEach((r) => {
      counts[r.status] = (counts[r.status] ?? 0) + 1;
    });
    const summary = [
      `Employees: ${employeeGroups.length}`,
      `Total Records: ${rows.length}`,
      ...Object.entries(ATTENDANCE_STATUS_LABEL)
        .filter(([key]) => counts[key])
        .map(([key, label]) => `${label}: ${counts[key]}`),
    ].join('     ');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Overall Summary', marginX, y);
    y += 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(90);
    doc.text(summary, marginX, y);
    doc.setTextColor(30, 30, 30);
  }

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - marginX, pageHeight - 8, { align: 'right' });
  }

  return doc;
}

/** Builds the standard Attendance Report and downloads it as a PDF file. */
export function downloadAttendanceReportPdf(args: AttendanceReportPdfArgs) {
  const doc = buildAttendanceReportPdf(args);
  doc.save(`attendance-report-${new Date().toISOString().slice(0, 10)}.pdf`);
}

/**
 * Builds the standard Attendance Report and opens it straight into the
 * browser's print dialog -- no need to find the downloaded file first.
 * Uses jsPDF's autoPrint() (embeds a print instruction the browser's own
 * PDF viewer runs once the file loads) plus opening a blob URL in a new
 * tab, so this still never touches window.print()/HTML rasterizing on the
 * app's own page. Falls back to a normal download if the new tab was
 * blocked by a popup blocker, so the user still ends up with the file.
 */
export function printAttendanceReportPdf(args: AttendanceReportPdfArgs) {
  const doc = buildAttendanceReportPdf(args);
  doc.autoPrint();
  const win = window.open(doc.output('bloburl'), '_blank');
  if (!win) {
    doc.save(`attendance-report-${new Date().toISOString().slice(0, 10)}.pdf`);
  }
}
