'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, MapPin, Pencil, Trash2 } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FieldWrap, Input, Select, Textarea } from '@/components/ui/Form';
import { Table, Thead, Tbody, Tr, Th, Td, EmptyState } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Card';
import { useLocations, useCreateLocation, useUpdateLocation, useDeleteLocation } from '@/hooks/useLocations';
import { useBranches } from '@/hooks/useBranches';
import { apiErrorMessage } from '@/lib/api';
import { Location } from '@/types';

const EMPTY_FORM = { name: '', code: '', type: 'OFFICE', address: '', branchId: '', status: 'ACTIVE' };

export default function LocationsPage() {
  const { data, isLoading } = useLocations();
  const { data: branches } = useBranches();
  const createLocation = useCreateLocation();
  const updateLocation = useUpdateLocation();
  const deleteLocation = useDeleteLocation();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(l: Location) {
    setEditing(l);
    setForm({
      name: l.name,
      code: l.code ?? '',
      type: l.type,
      address: l.address ?? '',
      branchId: l.branchId ?? '',
      status: l.status,
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: form.name,
      code: form.code || undefined,
      type: form.type,
      address: form.address || undefined,
      branchId: form.branchId || undefined,
      status: form.status,
    };
    try {
      if (editing) {
        await updateLocation.mutateAsync({ id: editing.id, ...payload });
        toast.success('Location updated');
      } else {
        await createLocation.mutateAsync(payload);
        toast.success('Location created');
      }
      setModalOpen(false);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function handleDelete(l: Location) {
    if (!confirm(`Delete location "${l.name}"?`)) return;
    try {
      await deleteLocation.mutateAsync(l.id);
      toast.success('Location deleted');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <AppShell title="Locations" subtitle="Factories, offices, sites and project locations">
      <Card>
        <div className="flex items-center justify-between p-5 border-b border-line">
          <p className="text-sm text-text-secondary">{data?.length || 0} locations</p>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Location
          </Button>
        </div>

        <Table>
          <Thead>
            <tr>
              <Th>Location</Th>
              <Th>Type</Th>
              <Th>Branch</Th>
              <Th>Status</Th>
              <Th>Employees</Th>
              <Th></Th>
            </tr>
          </Thead>
          <Tbody>
            {data?.map((l) => (
              <Tr key={l.id}>
                <Td className="font-medium">{l.name}</Td>
                <Td>
                  <Badge>{l.type}</Badge>
                </Td>
                <Td>{l.branch?.name ?? '—'}</Td>
                <Td>
                  <Badge className={l.status === 'ACTIVE' ? 'text-success bg-success-soft' : ''}>
                    {l.status}
                  </Badge>
                </Td>
                <Td>{l._count?.employees ?? 0}</Td>
                <Td className="text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => openEdit(l)}
                      className="rounded-md p-1.5 text-text-muted hover:bg-surface-sunken hover:text-text-primary"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(l)}
                      className="rounded-md p-1.5 text-text-muted hover:bg-danger-soft hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>

        {!isLoading && (data?.length ?? 0) === 0 && (
          <EmptyState icon={<MapPin className="h-8 w-8" />} title="No locations yet" />
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Location' : 'Add Location'}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="location-form"
              loading={createLocation.isPending || updateLocation.isPending}
            >
              Save
            </Button>
          </>
        }
      >
        <form id="location-form" onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FieldWrap label="Location Name" required>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} required autoFocus />
          </FieldWrap>
          <FieldWrap label="Code">
            <Input value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} />
          </FieldWrap>
          <FieldWrap label="Type" required>
            <Select value={form.type} onChange={(e) => set('type', e.target.value)}>
              <option value="FACTORY">Factory</option>
              <option value="OFFICE">Office</option>
              <option value="SITE">Site</option>
              <option value="PROJECT">Project</option>
              <option value="OTHER">Other</option>
            </Select>
          </FieldWrap>
          <FieldWrap label="Branch">
            <Select value={form.branchId} onChange={(e) => set('branchId', e.target.value)}>
              <option value="">Unassigned</option>
              {branches?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </FieldWrap>
          <FieldWrap label="Status">
            <Select value={form.status} onChange={(e) => set('status', e.target.value)}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </Select>
          </FieldWrap>
          <div className="sm:col-span-2">
            <FieldWrap label="Address">
              <Textarea value={form.address} onChange={(e) => set('address', e.target.value)} />
            </FieldWrap>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
