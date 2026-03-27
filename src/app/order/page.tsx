'use client';

// app/(public)/order/page.tsx
// Public inquiry form — no account needed.
// Submits order interest → saved to DB + email sent to team.
// After admin approves and ships, customer registers at /register.

import { useState, useEffect } from 'react';
import {
  Mail, Phone, User, Globe, MapPin, MessageSquare,
  Package, Check, AlertCircle, Hexagon, Loader2, Hash,
} from 'lucide-react';

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

const MASTER_PRICE = 299;
const NORMAL_PRICE = 199;

export default function OrderPage() {
  const [isLoaded, setIsLoaded]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [success, setSuccess]     = useState(false);
  const [error, setError]         = useState('');

  const [form, setForm] = useState({
    fullName:    '',
    email:       '',
    phone:       '',
    country:     '',
    city:        '',
    masterHives: 1,
    normalHives: 0,
    message:     '',
  });

  useEffect(() => {
    const t = setTimeout(() => setIsLoaded(true), 50);
    return () => clearTimeout(t);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: (name === 'masterHives' || name === 'normalHives') ? Math.max(0, parseInt(value) || 0) : value,
    }));
    if (error) setError('');
  };

  const validate = () => {
    if (!form.fullName.trim()) { setError('Full name is required'); return false; }
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) { setError('Valid email is required'); return false; }
    if (!form.phone.trim()) { setError('Phone number is required'); return false; }
    if (!form.country.trim()) { setError('Country is required'); return false; }
    if (form.masterHives + form.normalHives === 0) { setError('Please select at least one hive'); return false; }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
      } else {
        setError(data.error || 'Something went wrong. Please try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const estimatedTotal = form.masterHives * MASTER_PRICE + form.normalHives * NORMAL_PRICE;

  const inputCls = "w-full pl-10 pr-4 py-3 rounded-xl text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-amber-500";

  // ── Success screen ──────────────────────────────────────────────
  if (success) {
    return (
      <div className="relative w-full bg-black flex items-center justify-center overflow-hidden" style={{ minHeight: '100dvh' }}>
        <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover"
          style={{ zIndex: 0, filter: 'blur(8px)', transform: 'scale(1.08)' }}>
          <source src="/littlebee.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-black/50" style={{ zIndex: 1 }} />
        <div className="relative text-center px-6 max-w-md" style={{ zIndex: 10 }}>
          <div
            className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center shadow-xl shadow-amber-500/30"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #eab308)' }}
          >
            <Check className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-black text-white mb-3">Order Submitted!</h1>
          <p className="text-white/65 text-sm mb-6 leading-relaxed">
            Thanks <span className="text-amber-400 font-bold">{form.fullName.split(' ')[0]}</span>! We've received your order inquiry.
            Our team will review it and contact you at <span className="text-amber-400 font-semibold">{form.email}</span> within 1–2 business days.
          </p>
          <div
            className="rounded-2xl p-5 text-left mb-6"
            style={{ background: 'rgba(15,15,15,0.65)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <p className="text-white/50 text-xs font-bold uppercase tracking-widest mb-3">What happens next</p>
            {[
              'We review your order and contact you to confirm',
              'Once confirmed, we ship your SmartHive boxes',
              'Each box includes a unique serial number',
              'Use that serial number to create your account at /register',
              'We grant you access to your hive dashboard',
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3 mb-2 last:mb-0">
                <div className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-amber-400 text-[10px] font-black">{i + 1}</span>
                </div>
                <p className="text-white/60 text-xs leading-relaxed">{step}</p>
              </div>
            ))}
          </div>
          <a href="/"
            className="inline-flex items-center gap-2 text-white/50 hover:text-white/80 text-sm transition-colors">
            ← Back to Home
          </a>
        </div>
      </div>
    );
  }

  // ── Main form ───────────────────────────────────────────────────
  return (
    <div className="relative w-full bg-black overflow-hidden" style={{ minHeight: '100dvh' }}>

      {/* Video background */}
      <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover"
        style={{ zIndex: 0, filter: 'blur(8px)', transform: 'scale(1.08)' }}>
        <source src="/littlebee.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-black/45" style={{ zIndex: 1 }} />

      {/* Nav */}
      <header
        className={`fixed left-0 right-0 flex items-center justify-between px-5 sm:px-8 transition-all duration-700 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}
        style={{
          top: 0, zIndex: 30,
          paddingTop: 'max(44px, env(safe-area-inset-top, 44px))',
          paddingBottom: '14px',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 100%)',
        }}
      >
        <a href="/" className="flex items-center gap-2">
          <div className="p-1.5 bg-gradient-to-br from-amber-400 to-yellow-400 rounded-lg">
            <Hexagon className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-black bg-gradient-to-r from-amber-400 to-yellow-400 bg-clip-text text-transparent">
            NahalAI
          </span>
        </a>
        <a href="/"
          className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/30 text-white text-sm font-bold py-2 px-4 rounded-lg transition-all">
          Back to Home
        </a>
      </header>

      {/* Content */}
      <div
        className="relative flex items-center justify-center px-4 w-full"
        style={{
          zIndex: 10,
          minHeight: '100dvh',
          paddingTop: 'max(110px, calc(env(safe-area-inset-top, 44px) + 80px))',
          paddingBottom: 'max(60px, calc(env(safe-area-inset-bottom, 20px) + 40px))',
        }}
      >
        <div className={`w-full max-w-md transition-all duration-700 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>

          {/* Heading */}
          <div className="text-center mb-8">
            <div
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-xl shadow-amber-500/30"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #eab308)' }}
            >
              <Package className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-black text-white mb-2">Order SmartHive</h1>
            <p className="text-white/55 text-sm">Fill in your details and we'll reach out to confirm your order</p>
          </div>

          {/* Card */}
          <div
            className="rounded-2xl p-8"
            style={{
              background: 'rgba(15, 15, 15, 0.65)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}
          >
            {error && (
              <div className="bg-red-500/20 border border-red-400/40 rounded-lg p-4 mb-6 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            <div className="space-y-5">

              {/* Name */}
              <Field label="Full Name *" icon={<User className="h-5 w-5 text-amber-500" />}>
                <input type="text" name="fullName" value={form.fullName} onChange={handleChange}
                  placeholder="John Doe" className={inputCls} style={inputStyle} autoComplete="name" />
              </Field>

              {/* Email */}
              <Field label="Email Address *" icon={<Mail className="h-5 w-5 text-amber-500" />}>
                <input type="email" name="email" value={form.email} onChange={handleChange}
                  placeholder="you@example.com" className={inputCls} style={inputStyle} autoComplete="email" />
              </Field>

              {/* Phone */}
              <Field label="Phone Number *" icon={<Phone className="h-5 w-5 text-amber-500" />}>
                <input type="tel" name="phone" value={form.phone} onChange={handleChange}
                  placeholder="+1 234 567 8900" className={inputCls} style={inputStyle} autoComplete="tel" />
              </Field>

              {/* Country + City */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Country *" icon={<Globe className="h-5 w-5 text-amber-500" />}>
                  <input type="text" name="country" value={form.country} onChange={handleChange}
                    placeholder="UAE" className={inputCls} style={inputStyle} />
                </Field>
                <Field label="City" icon={<MapPin className="h-5 w-5 text-amber-500" />}>
                  <input type="text" name="city" value={form.city} onChange={handleChange}
                    placeholder="Dubai" className={inputCls} style={inputStyle} />
                </Field>
              </div>

              {/* Divider */}
              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/15" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-3 text-white/40">How many hives?</span>
                </div>
              </div>

              {/* Hive counters */}
              {[
                { name: 'masterHives', label: 'Master Hives', desc: 'Central hub unit', price: MASTER_PRICE, min: 1 },
                { name: 'normalHives', label: 'Normal Hives', desc: 'Standard monitoring unit', price: NORMAL_PRICE, min: 0 },
              ].map(({ name, label, desc, price, min }) => (
                <div key={name}
                  className="flex items-center justify-between rounded-xl px-4 py-3"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <div>
                    <p className="text-white text-sm font-bold">{label}</p>
                    <p className="text-white/40 text-xs">{desc} · <span className="text-amber-400">${price}/unit</span></p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button type="button"
                      onClick={() => setForm(p => ({ ...p, [name]: Math.max(min, (p as any)[name] - 1) }))}
                      className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center transition-all text-lg">
                      −
                    </button>
                    <span className="text-white font-black w-5 text-center">{(form as any)[name]}</span>
                    <button type="button"
                      onClick={() => setForm(p => ({ ...p, [name]: (p as any)[name] + 1 }))}
                      className="w-8 h-8 rounded-lg bg-amber-500/80 hover:bg-amber-500 text-white font-bold flex items-center justify-center transition-all text-lg">
                      +
                    </button>
                  </div>
                </div>
              ))}

              {/* Estimated total */}
              {estimatedTotal > 0 && (
                <div className="flex items-center justify-between rounded-xl px-4 py-3"
                  style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}>
                  <span className="text-white/60 text-sm">Estimated total</span>
                  <span className="text-amber-400 font-black text-lg">${estimatedTotal.toLocaleString()}</span>
                </div>
              )}

              {/* Message */}
              <div>
                <label className="block text-sm font-semibold text-white/90 mb-2">Message / Notes</label>
                <div className="relative">
                  <div className="absolute top-3 left-3 pointer-events-none">
                    <MessageSquare className="h-5 w-5 text-amber-500" />
                  </div>
                  <textarea name="message" value={form.message} onChange={handleChange}
                    placeholder="Any special requirements, questions, or notes for our team…"
                    rows={3}
                    className="w-full pl-10 pr-4 py-3 rounded-xl text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Submit */}
              <button onClick={handleSubmit} disabled={loading}
                className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-amber-500/30 hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 mt-2">
                {loading
                  ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Submitting…</span>
                  : 'Submit Order Inquiry →'}
              </button>

              {/* Already have serial */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/15" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-3 text-white/40">Already received your box?</span>
                </div>
              </div>
              <a href="/register"
                className="flex items-center justify-center w-full px-4 py-3 border border-white/30 hover:border-amber-400/70 text-white/80 hover:text-white rounded-xl hover:bg-white/10 transition-all font-semibold text-sm gap-2">
                <Hash className="w-4 h-4" /> Register with Serial Number
              </a>
            </div>
          </div>

          {/* Footer links */}
          <div className="mt-6 text-center space-y-2">
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

      {/* Footer pill */}
      <footer className="fixed left-0 right-0 flex justify-center"
        style={{ bottom: 0, zIndex: 30, paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))' }}>
        <div className="bg-black/60 backdrop-blur-sm px-5 py-1.5 rounded-full border border-white/10">
          <p className="text-white/80 text-xs font-semibold tracking-wide">
            Powered by <span className="text-amber-400 font-bold">FRC</span>
          </p>
        </div>
      </footer>
    </div>
  );
}