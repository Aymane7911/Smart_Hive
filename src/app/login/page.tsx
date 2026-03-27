'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Mail, Lock, Check, AlertCircle, Hexagon } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [formData, setFormData] = useState({ email: '', password: '' });

  useEffect(() => {
    if (searchParams.get('registered') === 'true') {
      setSuccessMessage('Registration successful! Please log in to continue.');
    }
  }, [searchParams]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const validateForm = (): boolean => {
    if (!formData.email.trim()) { setError('Email is required'); return false; }
    if (!/\S+@\S+\.\S+/.test(formData.email)) { setError('Please enter a valid email address'); return false; }
    if (!formData.password) { setError('Password is required'); return false; }
    if (formData.password.length < 8) { setError('Password must be at least 8 characters'); return false; }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, password: formData.password })
      });
      const result = await response.json();
      if (result.success) {
        if (result.token) localStorage.setItem('authToken', result.token);
        if (result.user) localStorage.setItem('userInfo', JSON.stringify({ id: result.user.id, email: result.user.email, role: result.user.role, firstname: result.user.firstname, lastname: result.user.lastname }));
        router.push(result.user.role === 'admin' ? '/admin/access-management' : '/welcome');
      } else {
        setError(result.error || 'Login failed. Please check your credentials.');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  };

  const inputStyle = {
    background: 'rgba(255, 255, 255, 0.95)',
    border: '1px solid rgba(255,255,255,0.4)',
    color: '#111827',
  };

  return (
    <div>
      {successMessage && (
        <div className="bg-green-500/20 border border-green-400/40 rounded-lg p-4 mb-6 flex items-start gap-3">
          <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
          <p className="text-green-300 text-sm">{successMessage}</p>
        </div>
      )}
      {error && (
        <div className="bg-red-500/20 border border-red-400/40 rounded-lg p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      <div className="space-y-5">
        {/* Email */}
        <div>
          <label className="block text-sm font-semibold text-white/90 mb-2">Email Address</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Mail className="h-5 w-5 text-amber-500" />
            </div>
            <input
              type="email" name="email" value={formData.email}
              onChange={handleInputChange} onKeyPress={handleKeyPress}
              placeholder="you@example.com"
              className="w-full pl-10 pr-4 py-3 rounded-xl text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-amber-500"
              style={inputStyle}
              autoComplete="email"
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-semibold text-white/90 mb-2">Password</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-amber-500" />
            </div>
            <input
              type={showPassword ? 'text' : 'password'} name="password" value={formData.password}
              onChange={handleInputChange} onKeyPress={handleKeyPress}
              placeholder="Enter your password"
              className="w-full pl-10 pr-12 py-3 rounded-xl text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-amber-500"
              style={inputStyle}
              autoComplete="current-password"
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors">
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Remember + Forgot */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded border-white/30 bg-white/10 text-amber-500 focus:ring-amber-500" />
            <span className="text-sm text-white/70">Remember me</span>
          </label>
          <a href="/forgot-password" className="text-sm text-amber-400 hover:text-amber-300 font-medium transition-colors">
            Forgot password?
          </a>
        </div>

        {/* Submit */}
        <button onClick={handleSubmit} disabled={loading}
          className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white py-3.5 px-4 rounded-xl font-bold text-sm shadow-lg shadow-amber-500/30 hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0">
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Signing in...
            </span>
          ) : 'Sign In'}
        </button>
      </div>

      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/20" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-3 text-white/50">Don't have an account?</span>
        </div>
      </div>

      {/* Register */}
      <a href="/register"
        className="flex items-center justify-center w-full px-4 py-3 border border-white/30 hover:border-amber-400/70 text-white/80 hover:text-white rounded-xl hover:bg-white/10 transition-all font-semibold text-sm">
        Create an Account &amp; Purchase
      </a>
    </div>
  );
}

export default function LoginPage() {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setIsLoaded(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative w-full bg-black overflow-hidden" style={{ minHeight: '100dvh' }}>

      {/* VIDEO */}
      <video
        autoPlay muted loop playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={{ zIndex: 0, filter: 'blur(8px)', transform: 'scale(1.08)' }}
      >
        <source src="/littlebee.mp4" type="video/mp4" />
      </video>

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/60" style={{ zIndex: 1 }} />

      {/* Nav */}
      <header
        className={`fixed left-0 right-0 flex items-center justify-between px-5 sm:px-8 transition-all duration-700 ${
          isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
        }`}
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

      {/* Centered card */}
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
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-4xl font-black text-white mb-2">Welcome Back</h1>
            <p className="text-white/55 text-sm">Sign in to access your SmartHive dashboard</p>
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
            <Suspense fallback={
              <div className="space-y-5">
                {[1,2,3].map(i => <div key={i} className="h-12 rounded-xl animate-pulse bg-white/8" />)}
              </div>
            }>
              <LoginForm />
            </Suspense>
          </div>

          {/* Footer links */}
          <div className="mt-6 text-center space-y-2">
            <div className="flex items-center justify-center gap-3 text-xs">
              <a href="/terms"   className="text-white/40 hover:text-white/70 transition-colors">Terms of Service</a>
              <span className="text-white/20">•</span>
              <a href="/privacy" className="text-white/40 hover:text-white/70 transition-colors">Privacy Policy</a>
              <span className="text-white/20">•</span>
              <a href="/support" className="text-white/40 hover:text-white/70 transition-colors">Support</a>
            </div>
            <p className="text-white/25 text-xs">Your connection is secure and encrypted</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer
        className="fixed left-0 right-0 flex justify-center"
        style={{ bottom: 0, zIndex: 30, paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))' }}
      >
        <div className="bg-black/60 backdrop-blur-sm px-5 py-1.5 rounded-full border border-white/10">
          <p className="text-white/80 text-xs font-semibold tracking-wide">
            Powered by <span className="text-amber-400 font-bold">FRC</span>
          </p>
        </div>
      </footer>
    </div>
  );
}