'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Trash2, Building2, Users as UsersIcon } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FieldWrap, Input, Select } from '@/components/ui/Form';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Card';
import { api, apiErrorMessage } from '@/lib/api';

function CompanySettings() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['company'],
    queryFn: async () => (await api.get('/company')).data,
  });
  const [form, setForm] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    timeZone: '',
    officeHours: '',
    workingDays: '',
  });

  useEffect(() => {
    if (data) {
      setForm({
        name: data.name || '',
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
    <Card>
      <CardHeader title="Company Profile" subtitle="Shown across reports and the login screen" />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          update.mutate();
        }}
        className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-5 pb-5"
      >
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
      </form>
    </Card>
  );
}

function UserManagement() {
  const qc = useQueryClient();
  const { data: users } = useQuery({
    queryKey: ['app-users'],
    queryFn: async () => (await api.get('/users')).data,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ username: '', fullName: '', password: '', role: 'HR' });

  const createUser = useMutation({
    mutationFn: async () => (await api.post('/users', form)).data,
    onSuccess: () => {
      toast.success('User created');
      qc.invalidateQueries({ queryKey: ['app-users'] });
      setModalOpen(false);
      setForm({ username: '', fullName: '', password: '', role: 'HR' });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const deleteUser = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/users/${id}`)).data,
    onSuccess: () => {
      toast.success('User removed');
      qc.invalidateQueries({ queryKey: ['app-users'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  return (
    <Card className="mt-4">
      <CardHeader
        title="System Users"
        subtitle="Administrator, HR Officer, and Manager accounts"
        action={
          <Button size="sm" onClick={() => setModalOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Add User
          </Button>
        }
      />
      <Table>
        <Thead>
          <tr>
            <Th>Name</Th>
            <Th>Login</Th>
            <Th>Role</Th>
            <Th>Status</Th>
            <Th></Th>
          </tr>
        </Thead>
        <Tbody>
          {users?.map((u: any) => (
            <Tr key={u.id}>
              <Td className="font-medium">{u.fullName}</Td>
              <Td className="text-xs font-mono">{u.username}</Td>
              <Td>
                <Badge>{u.role}</Badge>
              </Td>
              <Td className="text-xs">{u.isActive ? 'Active' : 'Inactive'}</Td>
              <Td className="text-right">
                <button
                  onClick={() => {
                    if (confirm(`Remove ${u.fullName}?`)) deleteUser.mutate(u.id);
                  }}
                  className="rounded-md p-1.5 text-text-muted hover:bg-danger-soft hover:text-danger"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add System User"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={createUser.isPending}
              onClick={() => createUser.mutate()}
              disabled={!form.username || !form.fullName || form.password.length < 6}
            >
              Create User
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FieldWrap label="Full Name" required>
            <Input value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
          </FieldWrap>
          <FieldWrap label="Username" required>
            <Input
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            />
          </FieldWrap>
          <FieldWrap label="Password" required hint="Minimum 6 characters">
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
          </FieldWrap>
          <FieldWrap label="Role" required>
            <Select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
              <option value="ADMIN">Administrator</option>
              <option value="HR">HR Officer</option>
              <option value="MANAGER">Manager</option>
            </Select>
          </FieldWrap>
        </div>
      </Modal>
    </Card>
  );
}

export default function SettingsPage() {
  return (
    <AppShell title="Settings" subtitle="Company profile and system user accounts">
      <CompanySettings />
      <UserManagement />
    </AppShell>
  );
}
