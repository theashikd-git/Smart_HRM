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

/**
 * Builds and downloads the Attendance Report as a PDF, generated entirely
 * in JavaScript with jsPDF/jspdf-autotable -- text and table cells drawn
 * directly onto the page rather than rasterizing an on-screen HTML layout
 * (the old window.print()-based flow this replaces). Same content as
 * before -- letterhead (company logo + name), period/scope, a compact
 * table, and a totals summary -- tuned to stay small and print cleanly on
 * A4 (autoTable repeats the header on every page automatically, so long
 * ranges paginate instead of overflowing).
 */
export function downloadAttendanceReportPdf({
  company,
  rows,
  periodLabel,
  scopeLabel,
}: {
  company?: Company | null;
  rows: AttendanceRecord[];
  /** e.g. "Sep 21, 2026" or "Sep 1 - Sep 21, 2026" */
  periodLabel: string;
  /** e.g. a department name, or a status filter -- appended after the period, omitted if not filtered */
  scopeLabel?: string;
}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 12;
  let y = 14;

  // Letterhead -- company logo (if uploaded via Personnel > Organization >
  // Company) centered above the name, then contact info. jsPDF only
  // decodes raster formats (PNG/JPEG/WEBP), so an unsupported data URL
  // (e.g. an SVG upload) is skipped rather than throwing.
  if (company?.logo) {
    try {
      const props = doc.getImageProperties(company.logo);
      const h = 14;
      const w = (props.width / props.height) * h;
      doc.addImage(company.logo, props.fileType || 'PNG', pageWidth / 2 - w / 2, y, w, h, undefined, 'FAST');
      y += h + 3;
    } catch {
      // Unsupported image format for this PDF library -- fall back to text-only letterhead.
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

  y += 2;
  doc.setDrawColor(210);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Attendance Report', marginX, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Generated ${formatDate(new Date())} ${formatTime(new Date())}`, pageWidth - marginX, y, { align: 'right' });
  y += 5;

  doc.setFontSize(9);
  doc.text(scopeLabel ? `${periodLabel}  --  ${scopeLabel}` : periodLabel, marginX, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [['Employee', 'ID', 'Department', 'Date', 'Check In', 'Check Out', 'Status']],
    body: rows.map((r) => [
      r.employee?.fullName ?? '—',
      r.employee?.employeeCode ?? '—',
      r.employee?.department?.name ?? '—',
      formatDate(r.date),
      formatTime(r.checkIn),
      formatTime(r.checkOut),
      ATTENDANCE_STATUS_LABEL[r.status] ?? r.status,
    ]),
    styles: { fontSize: 8, cellPadding: 1.6, textColor: [30, 30, 30] },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [246, 247, 249] },
    margin: { left: marginX, right: marginX },
    theme: 'grid',
    showHead: 'everyPage',
  });

  if (rows.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(140);
    doc.text('No attendance records for this period.', pageWidth / 2, y + 10, { align: 'center' });
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finalY = (doc as any).lastAutoTable.finalY + 6;
    const counts: Record<string, number> = {};
    rows.forEach((r) => {
      counts[r.status] = (counts[r.status] ?? 0) + 1;
    });
    const summary = [
      `Total: ${rows.length}`,
      ...Object.entries(ATTENDANCE_STATUS_LABEL)
        .filter(([key]) => counts[key])
        .map(([key, label]) => `${label}: ${counts[key]}`),
    ].join('     ');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(90);
    doc.text(summary, marginX, finalY);
  }

  doc.save(`attendance-report-${new Date().toISOString().slice(0, 10)}.pdf`);
}
