'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Fingerprint, ShieldCheck, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/lib/auth-store';
import { apiErrorMessage } from '@/lib/api';
import { Input } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading, hydrate, hydrated, token } = useAuthStore();
  const [email, setEmail] = useState('admin@smarthrm.local');
  const [password, setPassword] = useState('Admin@123');

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (hydrated && token) router.replace('/workbench');
  }, [hydrated, token, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await login(email, password);
      router.replace('/workbench');
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
            Use your administrator or HR account credentials.
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-secondary">Email</label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
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

          <div className="mt-6 rounded-lg border border-line bg-surface-sunken/60 p-3.5 text-xs text-text-secondary">
            <p className="font-medium text-text-primary mb-1">Demo credentials</p>
            <p>Admin — admin@smarthrm.local / Admin@123</p>
            <p>HR — hr@smarthrm.local / Hr@12345</p>
          </div>
        </div>
      </div>
    </div>
  );
}
