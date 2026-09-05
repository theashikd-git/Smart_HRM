'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FieldWrap, Input } from '@/components/ui/Form';
import { useCreateDevice, useUpdateDevice } from '@/hooks/useDevices';
import { apiErrorMessage } from '@/lib/api';
import { Device } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  device?: Device | null;
}

export function AddDeviceModal({ open, onClose, device }: Props) {
  const createDevice = useCreateDevice();
  const updateDevice = useUpdateDevice();
  const [name, setName] = useState('Main Entrance Terminal');
  const [ipAddress, setIpAddress] = useState('192.168.1.201');
  const [port, setPort] = useState(4370);

  const isEdit = !!device;
  const saving = createDevice.isPending || updateDevice.isPending;

  useEffect(() => {
    if (device) {
      setName(device.name);
      setIpAddress(device.ipAddress);
      setPort(device.port);
    } else {
      setName('Main Entrance Terminal');
      setIpAddress('192.168.1.201');
      setPort(4370);
    }
  }, [device, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (isEdit && device) {
        await updateDevice.mutateAsync({ id: device.id, name, ipAddress, port });
        toast.success('Device updated — reconnect to apply the new address');
      } else {
        await createDevice.mutateAsync({ name, ipAddress, port });
        toast.success('Device added');
      }
      onClose();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Device' : 'Add ZKTeco Device'}
      subtitle={isEdit ? `Editing ${device?.name}` : 'Connect a ZKTeco uFace 800 Plus terminal'}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="device-form" loading={saving}>
            {isEdit ? 'Save Changes' : 'Add Device'}
          </Button>
        </>
      }
    >
      <form id="device-form" onSubmit={handleSubmit} className="space-y-4">
        <FieldWrap label="Device Name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </FieldWrap>
        <FieldWrap label="IP Address" required hint="Local network IP of the terminal">
          <Input value={ipAddress} onChange={(e) => setIpAddress(e.target.value)} required />
        </FieldWrap>
        <FieldWrap label="Port">
          <Input type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} />
        </FieldWrap>
      </form>
    </Modal>
  );
}
