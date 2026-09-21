'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Building2 } from 'lucide-react';
import { ProgramWorkspace } from '@/components/shell/ProgramWorkspace';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FieldWrap, Input } from '@/components/ui/Form';
import { api, apiErrorMessage } from '@/lib/api';
import { useCompany } from '@/hooks/useCompany';
import type { WorkbenchTab } from '@/types/workbench';

/**
 * Personnel > Organization > Company -- the real, editable company profile.
 * Replaces two things that used to stand in for it: the mock "info"
 * placeholder this program id used to render (fake name/registration/branch
 * counts -- see the old 'org-company' entry in placeholderConfig.tsx) and
 * the duplicate live copy that used to live under System Settings (Company
 * belongs with the rest of Organization, not buried in Settings, so it was
 * moved here instead of just linked from both places).
 *
 * Same fields and the same base64 data-URL logo upload pattern as the
 * Employee photo picker -- no separate upload endpoint needed. This is the
 * one place the logo/name/contact info get edited; everything else that
 * shows them (login screen, the Attendance Report letterhead) just reads
 * `useCompany()`.
 */
export function CompanyProgram({ tab }: { tab: WorkbenchTab }) {
  const qc = useQueryClient();
  const { data } = useCompany();
  const [form, setForm] = useState({
    name: '',
    logo: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    timeZone: '',
    officeHours: '',
    workingDays: '',
  });
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (data) {
      setForm({
        name: data.name || '',
        logo: data.logo || '',
        address: data.address || '',
        phone: data.phone || '',
        email: data.email || '',
        website: data.website || '',
        timeZone: data.timeZone || '',
        officeHours: data.officeHours || '',
        workingDays: data.workingDays || '',
      });
    }
  }, [data]);

  function handleLogoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo must be under 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => set('logo', reader.result as string);
    reader.readAsDataURL(file);
  }

  const update = useMutation({
    mutationFn: async () => (await api.patch('/company', form)).data,
    onSuccess: () => {
      toast.success('Company profile updated');
      qc.invalidateQueries({ queryKey: ['company'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <ProgramWorkspace title={tab.title} breadcrumb={tab.breadcrumb}>
      <Card>
        <CardHeader title="Company Profile" subtitle="Shown across reports and the login screen" />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate();
          }}
          className="px-5 pb-5"
        >
          <div className="mb-4 flex items-center gap-4">
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-line bg-surface-sunken text-text-muted hover:border-accent hover:text-accent transition-colors"
            >
              {form.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.logo} alt="" className="h-full w-full object-contain" />
              ) : (
                <Building2 className="h-6 w-6" />
              )}
            </button>
            <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoPick} className="hidden" />
            <div>
              <p className="text-xs font-medium text-text-primary">Company Logo</p>
              <p className="text-xs text-text-muted">
                Shown on the login screen and printed reports (e.g. the Attendance Report letterhead)
              </p>
              <button type="button" onClick={() => logoInputRef.current?.click()} className="mt-1 text-xs font-medium text-accent hover:underline">
                {form.logo ? 'Change logo' : 'Upload logo'}
              </button>
              {form.logo && (
                <button
                  type="button"
                  onClick={() => set('logo', '')}
                  className="ml-3 text-xs font-medium text-danger hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldWrap label="Company Name">
              <Input value={form.name} onChange={(e) => set('name', e.target.value)} />
            </FieldWrap>
            <FieldWrap label="Time Zone">
              <Input value={form.timeZone} onChange={(e) => set('timeZone', e.target.value)} />
            </FieldWrap>
            <FieldWrap label="Phone">
              <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </FieldWrap>
            <FieldWrap label="Email">
              <Input value={form.email} onChange={(e) => set('email', e.target.value)} />
            </FieldWrap>
            <FieldWrap label="Website">
              <Input value={form.website} onChange={(e) => set('website', e.target.value)} />
            </FieldWrap>
            <FieldWrap label="Office Hours">
              <Input value={form.officeHours} onChange={(e) => set('officeHours', e.target.value)} />
            </FieldWrap>
            <FieldWrap label="Working Days" hint="Comma separated, e.g. Sun,Mon,Tue,Wed,Thu">
              <Input value={form.workingDays} onChange={(e) => set('workingDays', e.target.value)} />
            </FieldWrap>
            <FieldWrap label="Address">
              <Input value={form.address} onChange={(e) => set('address', e.target.value)} />
            </FieldWrap>
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit" loading={update.isPending}>
                Save Company Profile
              </Button>
            </div>
          </div>
        </form>
      </Card>
    </ProgramWorkspace>
  );
}
