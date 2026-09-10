'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Fingerprint, ShieldCheck, IdCard } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/lib/auth-store';
import { apiErrorMessage } from '@/lib/api';
import { Input } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';

type Mode = 'staff' | 'employee';

export default function LoginPage() {
  const router = useRouter();
  const { login, employeeLogin, isLoading, hydrate, hydrated, token, user } = useAuthStore();
  const [mode, setMode] = useState<Mode>('staff');

  const [username, setUsername] = useState('admin@smarthrm.local');
  const [password, setPassword] = useState('Admin@123');

  const [employeeCode, setEmployeeCode] = useState('');
  const [employeePassword, setEmployeePassword] = useState('');

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated || !token) return;
    router.replace(user?.role === 'EMPLOYEE' ? '/employee-portal' : '/workbench');
  }, [hydrated, token, user, router]);

  function switchMode(next: Mode) {
    setMode(next);
  }

  async function handleStaffSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await login(username, password);
      router.replace('/workbench');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function handleEmployeeSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await employeeLogin(employeeCode.trim(), employeePassword);
      router.replace('/employee-portal');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      {/* Left: brand / biometric visual panel */}
      <div className="relative hidden lg:flex flex-col justify-between bg-ink text-white p-12 overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
        />
        <div className="relative flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-semibold">Smart HRM</span>
        </div>

        <div className="relative flex flex-col items-center justify-center flex-1">
          <div className="scan-frame m-3">
            <div className="flex h-28 w-28 items-center justify-center rounded-full bg-white/5 border border-white/10">
              <Fingerprint className="h-14 w-14 text-accent" strokeWidth={1.25} />
            </div>
          </div>
          <p className="mt-8 text-center text-sm text-white/60 max-w-xs">
            One employee record. One source of truth. Every fingerprint, face, and RFID
            check-in synchronized back to a single, centralized HR platform.
          </p>
        </div>

        <div className="relative text-xs text-white/40">
          Centralized HR &amp; Biometric Management &middot; ZKTeco uFace 800 Plus
        </div>
      </div>

      {/* Right: login form */}
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-semibold text-text-primary">Smart HRM</span>
          </div>

          <h1 className="text-xl font-semibold text-text-primary">Sign in to your workspace</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {mode === 'staff'
              ? 'Use your administrator or HR account credentials.'
              : 'Sign in with your Employee ID to view your leave and apply for time off.'}
          </p>

          <div className="mt-5 flex items-center rounded-lg border border-line bg-white p-0.5 w-full">
            <button
              type="button"
              onClick={() => switchMode('staff')}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === 'staff' ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Staff Login
            </button>
            <button
              type="button"
              onClick={() => switchMode('employee')}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === 'employee' ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <IdCard className="h-3.5 w-3.5" />
              Employee Login
            </button>
          </div>

          {mode === 'staff' ? (
            <form onSubmit={handleStaffSubmit} className="mt-6 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary">Username</label>
                <Input
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. admin"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary">Password</label>
                <Input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              <Button type="submit" className="w-full mt-2" size="lg" loading={isLoading}>
                {isLoading ? 'Signing in' : 'Sign in'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleEmployeeSubmit} className="mt-6 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary">Employee ID</label>
                <Input
                  required
                  value={employeeCode}
                  onChange={(e) => setEmployeeCode(e.target.value)}
                  placeholder="e.g. EMP-0042"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary">Password</label>
                <Input
                  type="password"
                  required
                  value={employeePassword}
                  onChange={(e) => setEmployeePassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              <Button type="submit" className="w-full mt-2" size="lg" loading={isLoading}>
                {isLoading ? 'Signing in' : 'Sign in'}
              </Button>

              <p className="text-xs text-text-muted">
                By default your password is the same as your Employee ID. Ask HR if you need it reset.
              </p>
            </form>
          )}

          {mode === 'staff' && (
            <div className="mt-6 rounded-lg border border-line bg-surface-sunken/60 p-3.5 text-xs text-text-secondary">
              <p className="font-medium text-text-primary mb-1">Demo credentials</p>
              <p>Admin — admin@smarthrm.local / Admin@123</p>
              <p>HR — hr@smarthrm.local / Hr@12345</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
