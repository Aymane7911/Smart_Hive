'use client';

// app/(auth)/register/page.tsx

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Eye, EyeOff, Mail, Lock, User, Hash,
  Check, AlertCircle, Hexagon, CheckCircle2, XCircle, Loader2,
} from 'lucide-react';

type SerialStatus = 'idle' | 'checking' | 'valid' | 'invalid';

const inputStyle = {
  background: 'rgba(255, 255, 255, 0.95)',
  border: '1px solid rgba(255,255,255,0.4)',
  color: '#111827',
};

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-white/90 mb-2">{label}</label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">{icon}</div>
        {children}
      </div>
    </div>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [isLoaded,     setIsLoaded]     = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const [success,      setSuccess]      = useState(false);

  const [serialStatus,  setSerialStatus]  = useState<SerialStatus>('idle');
  const [serialMessage, setSerialMessage] = useState('');

  const [form, setForm] = useState({
    firstname: '', lastname: '', email: '',
    password: '', confirmPassword: '', serialNumber: '',
  });

  useEffect(() => {
    const t = setTimeout(() => setIsLoaded(true), 50);
    return () => clearTimeout(t);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (error) setError('');
    if (name === 'serialNumber') { setSerialStatus('idle'); setSerialMessage(''); }
  };

  const validateSerial = async () => {
    const s = form.serialNumber.trim();
    if (!s) return;
    setSerialStatus('checking');
    try {
      const res  = await fetch(`/api/auth/validate-serial?serial=${encodeURIComponent(s)}`);
      const data = await res.json();
      if (data.valid) {
        setSerialStatus('valid');
        setSerialMessage(data.message || 'Device verified ✓');
      } else {
        setSerialStatus('invalid');
        setSerialMessage(data.error || 'Invalid serial number');
      }
    } catch {
      setSerialStatus('invalid');
      setSerialMessage('Unable to validate. Check your connection.');
    }
  };

  const validate = () => {
    if (!form.firstname.trim())    { setError('First name is required');                  return false; }
    if (!form.lastname.trim())     { setError('Last name is required');                   return false; }
    if (!form.email.trim())        { setError('Email is required');                       return false; }
    if (!/\S+@\S+\.\S+/.test(form.email)) { setError('Enter a valid email');             return false; }
    if (!form.password)            { setError('Password is required');                    return false; }
    if (form.password.length < 8)  { setError('Password must be at least 8 characters'); return false; }
    if (form.password !== form.confirmPassword) { setError('Passwords do not match');    return false; }
    if (!form.serialNumber.trim()) { setError('Serial number is required');               return false; }
    if (serialStatus === 'invalid') { setError('Please enter a valid serial number');     return false; }
    if (serialStatus !== 'valid')   { setError('Please validate your serial number');     return false; }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true); setError('');
    try {
      const res  = await fetch('/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstname:    form.firstname.trim(),
          lastname:     form.lastname.trim(),
          email:        form.email.trim().toLowerCase(),
          password:     form.password,
          serialNumber: form.serialNumber.trim().toUpperCase(),
        }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error || 'Registration failed'); return; }

      setSuccess(true);
      setTimeout(() => router.push('/login?registered=true'), 2500);
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full pl-10 pr-4 py-3 rounded-xl text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-amber-500";

  // ── Success screen ────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="relative w-full bg-black flex items-center justify-center overflow-hidden" style={{ minHeight: '100dvh' }}>
        <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover"
          style={{ zIndex: 0, filter: 'blur(8px)', transform: 'scale(1.08)' }}>
          <source src="/littlebee.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-black/60" style={{ zIndex: 1 }} />
        <div className="relative text-center px-6" style={{ zIndex: 10 }}>
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center shadow-xl"
            style={{ background: 'linear-gradient(135deg, #10b981, #34d399)' }}>
            <Check className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-black text-white mb-3">Account Created!</h1>
          <p className="text-white/60 text-sm mb-2">Your device has been linked successfully.</p>
          <p className="text-white/40 text-xs">Waiting for admin to grant dashboard access.</p>
          <p className="text-white/30 text-xs mt-4">Redirecting to login…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full bg-black overflow-hidden" style={{ minHeight: '100dvh' }}>
      <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover"
        style={{ zIndex: 0, filter: 'blur(8px)', transform: 'scale(1.08)' }}>
        <source src="/littlebee.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-black/60" style={{ zIndex: 1 }} />

      {/* Nav */}
      <header
        className={`fixed left-0 right-0 flex items-center justify-between px-5 sm:px-8 transition-all duration-700 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}
        style={{ top: 0, zIndex: 30, paddingTop: 'max(44px, env(safe-area-inset-top, 44px))', paddingBottom: '14px', background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 100%)' }}
      >
        <a href="/" className="flex items-center gap-2">
          <div className="p-1.5 bg-gradient-to-br from-amber-400 to-yellow-400 rounded-lg">
            <Hexagon className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-black bg-gradient-to-r from-amber-400 to-yellow-400 bg-clip-text text-transparent">NahalAI</span>
        </a>
        <a href="/" className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/30 text-white text-sm font-bold py-2 px-4 rounded-lg transition-all">
          Back to Home
        </a>
      </header>

      {/* Content */}
      <div className="relative flex items-center justify-center px-4 w-full"
        style={{ zIndex: 10, minHeight: '100dvh', paddingTop: 'max(110px, calc(env(safe-area-inset-top, 44px) + 80px))', paddingBottom: 'max(60px, calc(env(safe-area-inset-bottom, 20px) + 40px))' }}>
        <div className={`w-full max-w-md transition-all duration-700 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>

          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-xl shadow-amber-500/30"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #eab308)' }}>
              <User className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-black text-white mb-2">Activate Device</h1>
            <p className="text-white/55 text-sm">Create your account using the serial number from your box</p>
          </div>

          <div className="rounded-2xl p-8"
            style={{ background: 'rgba(15,15,15,0.65)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>

            {error && (
              <div className="bg-red-500/20 border border-red-400/40 rounded-lg p-4 mb-6 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            <div className="space-y-5">

              {/* Name */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="First Name" icon={<User className="h-5 w-5 text-amber-500" />}>
                  <input type="text" name="firstname" value={form.firstname} onChange={handleChange}
                    placeholder="John" className={inputCls} style={inputStyle} autoComplete="given-name" />
                </Field>
                <Field label="Last Name" icon={<User className="h-5 w-5 text-amber-500" />}>
                  <input type="text" name="lastname" value={form.lastname} onChange={handleChange}
                    placeholder="Doe" className={inputCls} style={inputStyle} autoComplete="family-name" />
                </Field>
              </div>

              {/* Email */}
              <Field label="Email Address" icon={<Mail className="h-5 w-5 text-amber-500" />}>
                <input type="email" name="email" value={form.email} onChange={handleChange}
                  placeholder="you@example.com" className={inputCls} style={inputStyle} autoComplete="email" />
              </Field>

              {/* Password */}
              <Field label="Password" icon={<Lock className="h-5 w-5 text-amber-500" />}>
                <input type={showPassword ? 'text' : 'password'} name="password" value={form.password}
                  onChange={handleChange} placeholder="Min. 8 characters"
                  className={`${inputCls} pr-12`} style={inputStyle} autoComplete="new-password" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </Field>

              {/* Confirm Password */}
              <Field label="Confirm Password" icon={<Lock className="h-5 w-5 text-amber-500" />}>
                <input type={showConfirm ? 'text' : 'password'} name="confirmPassword" value={form.confirmPassword}
                  onChange={handleChange} placeholder="Repeat your password"
                  className={`${inputCls} pr-12`} style={inputStyle} autoComplete="new-password" />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600">
                  {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </Field>

              {/* Divider */}
              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/15" /></div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-3 text-white/40">Device Activation</span>
                </div>
              </div>

              {/* Serial Number */}
              <div>
                <label className="block text-sm font-semibold text-white/90 mb-2">Serial Number</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Hash className="h-5 w-5 text-amber-500" />
                  </div>
                  <input type="text" name="serialNumber" value={form.serialNumber}
                    onChange={handleChange} onBlur={validateSerial}
                    placeholder="e.g. SH-2024-001234"
                    className={`${inputCls} pr-10 uppercase`}
                    style={{
                      ...inputStyle,
                      ...(serialStatus === 'valid'   ? { borderColor: '#34d399', boxShadow: '0 0 0 1px #34d399' } : {}),
                      ...(serialStatus === 'invalid' ? { borderColor: '#f87171', boxShadow: '0 0 0 1px #f87171' } : {}),
                    }}
                    autoComplete="off" spellCheck={false}
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    {serialStatus === 'checking' && <Loader2 className="w-4 h-4 animate-spin text-amber-500" />}
                    {serialStatus === 'valid'    && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                    {serialStatus === 'invalid'  && <XCircle className="w-4 h-4 text-red-400" />}
                  </div>
                </div>
                {serialStatus !== 'idle' && (
                  <p className={`mt-2 text-xs font-semibold flex items-center gap-1.5 ${serialStatus === 'valid' ? 'text-emerald-400' : serialStatus === 'invalid' ? 'text-red-400' : 'text-white/50'}`}>
                    {serialStatus === 'checking' && <><Loader2 className="w-3 h-3 animate-spin" /> Validating…</>}
                    {serialStatus === 'valid'    && <><CheckCircle2 className="w-3 h-3" /> {serialMessage}</>}
                    {serialStatus === 'invalid'  && <><XCircle className="w-3 h-3" /> {serialMessage}</>}
                  </p>
                )}
                <p className="mt-1.5 text-white/35 text-xs">Printed on the sticker inside your SmartHive box.</p>
              </div>

              {/* Submit */}
              <button onClick={handleSubmit} disabled={loading || serialStatus === 'checking'}
                className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-amber-500/30 hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 mt-2">
                {loading
                  ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Creating account…</span>
                  : 'Create Account & Activate Device'}
              </button>
            </div>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/20" /></div>
              <div className="relative flex justify-center text-sm"><span className="px-3 text-white/50">Already have an account?</span></div>
            </div>
            <a href="/login" className="flex items-center justify-center w-full px-4 py-3 border border-white/30 hover:border-amber-400/70 text-white/80 hover:text-white rounded-xl hover:bg-white/10 transition-all font-semibold text-sm mb-3">
              Sign In
            </a>
            <a href="/order" className="flex items-center justify-center w-full px-4 py-3 text-white/40 hover:text-white/70 text-sm transition-colors">
              Don't have a device yet? → Order one
            </a>
          </div>

          <div className="mt-6 text-center">
            <div className="flex items-center justify-center gap-3 text-xs">
              <a href="/terms"   className="text-white/40 hover:text-white/70 transition-colors">Terms</a>
              <span className="text-white/20">•</span>
              <a href="/privacy" className="text-white/40 hover:text-white/70 transition-colors">Privacy</a>
              <span className="text-white/20">•</span>
              <a href="/support" className="text-white/40 hover:text-white/70 transition-colors">Support</a>
            </div>
          </div>
        </div>
      </div>

      <footer className="fixed left-0 right-0 flex justify-center"
        style={{ bottom: 0, zIndex: 30, paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))' }}>
        <div className="bg-black/60 backdrop-blur-sm px-5 py-1.5 rounded-full border border-white/10">
          <p className="text-white/80 text-xs font-semibold tracking-wide">Powered by <span className="text-amber-400 font-bold">FRC</span></p>
        </div>
      </footer>
    </div>
  );
}