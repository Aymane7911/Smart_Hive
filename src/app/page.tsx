'use client'

import React, { useState, useEffect } from 'react'
import {
  ArrowRight, LogIn, UserPlus, Mail, Send,
  Activity, Brain, TrendingUp, Shield, Hexagon, Package,
} from 'lucide-react'

type View = 'home' | 'info' | 'contact'

export default function SmartHivePage() {
  const [isLoaded, setIsLoaded] = useState(false)
  const [view, setView] = useState<View>('home')
  const [fadeOut, setFadeOut] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setIsLoaded(true), 50)
    return () => clearTimeout(t)
  }, [])

  const navigate = (next: View) => {
    setFadeOut(true)
    setTimeout(() => {
      setView(next)
      setFadeOut(false)
      setMessage('')
    }, 300)
  }

  const handleSend = () => {
    if (!message.trim()) return
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=info@smarthive.com&su=${encodeURIComponent('Inquiry from Smart Hive Website')}&body=${encodeURIComponent(message)}`
    window.open(url, '_blank')
  }

  const features = [
    {
      icon: <Brain className="w-5 h-5 text-amber-400" />,
      title: 'Hive Health Analysis',
      items: ['Real-time temperature monitoring', 'Humidity level tracking', 'Early disease detection'],
    },
    {
      icon: <TrendingUp className="w-5 h-5 text-yellow-400" />,
      title: 'Performance Metrics',
      items: ['Honey production tracking', 'Colony strength assessment', 'Comparative hive analysis'],
    },
    {
      icon: <Activity className="w-5 h-5 text-amber-400" />,
      title: 'Activity Monitoring',
      items: ['Bee population counting', 'Flight pattern analysis', 'Foraging behavior insights'],
    },
    {
      icon: <Shield className="w-5 h-5 text-yellow-400" />,
      title: 'Colony Protection',
      items: ['Pest and disease alerts', 'Environmental hazard detection', 'Proactive intervention recommendations'],
    },
  ]

  return (
    <div
      className="relative w-full bg-black"
      style={{
        minHeight: '100dvh',
        height: view === 'home' ? '100dvh' : 'auto',
        overflow: view === 'home' ? 'hidden' : 'auto',
      }}
    >
      {/* Background video */}
      <video
        autoPlay muted loop playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={{ zIndex: 0 }}
      >
        <source src="/littlebee.mp4" type="video/mp4" />
      </video>

      {/* Dark overlay */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-black/65 via-black/50 to-black/70"
        style={{ zIndex: 1 }}
      />

      {/* Animated blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 2 }}>
        <div className="absolute top-20 left-10 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }} />
      </div>

      {/* ── TOP NAV ── */}
      <header
        className={`fixed left-0 right-0 flex items-center justify-between px-5 sm:px-8 transition-all duration-700 ${
          isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
        }`}
        style={{
          top: 0,
          zIndex: 30,
          paddingTop: 'max(44px, env(safe-area-inset-top, 44px))',
          paddingBottom: '14px',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 100%)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-gradient-to-br from-amber-400 to-yellow-400 rounded-lg">
            <Hexagon className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-black bg-gradient-to-r from-amber-400 to-yellow-400 bg-clip-text text-transparent">
            NahalAI
          </span>
        </div>

        {/* Nav buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('contact')}
            className="hidden md:block text-white/80 hover:text-white text-sm font-semibold transition-colors mr-2"
          >
            Contact Us
          </button>
          <a
            href="/order"
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/30 text-white text-sm font-bold py-2 px-4 rounded-lg transition-all"
          >
            <Package className="w-4 h-4" />
            <span className="hidden sm:inline">Order</span>
          </a>
          <a
            href="/login"
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/30 text-white text-sm font-bold py-2 px-4 rounded-lg transition-all"
          >
            <LogIn className="w-4 h-4" />
            <span className="hidden sm:inline">Login</span>
          </a>
          <a
            href="/register"
            className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white text-sm font-bold py-2 px-4 rounded-lg shadow-lg transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span className="hidden sm:inline">Register</span>
          </a>
        </div>
      </header>

      {/* ── FOOTER ── */}
      <footer
        className={`fixed left-0 right-0 flex justify-center transition-all duration-700 ${
          isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
        style={{
          bottom: 0,
          zIndex: 30,
          paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))',
        }}
      >
        <div className="bg-black/60 backdrop-blur-sm px-5 py-1.5 rounded-full border border-white/10">
          <p className="text-white/80 text-xs font-semibold tracking-wide">
            Powered by <span className="text-amber-400 font-bold">FRC</span>
          </p>
        </div>
      </footer>

      {/* ── PAGE CONTENT ── */}
      <div
        className="relative flex flex-col items-center justify-center px-4 sm:px-6 w-full"
        style={{
          zIndex: 10,
          minHeight: '100dvh',
          paddingTop: 'max(110px, calc(env(safe-area-inset-top, 44px) + 80px))',
          paddingBottom: 'max(80px, calc(env(safe-area-inset-bottom, 20px) + 56px))',
        }}
      >

        {/* ── HOME ── */}
        {view === 'home' && (
          <div
            className={`text-center max-w-xl mx-auto w-full transition-all duration-500 ${
              isLoaded && !fadeOut ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}
          >
            <h2 className="text-5xl sm:text-6xl font-black mb-4 leading-tight">
              <span className="bg-gradient-to-r from-amber-400 to-yellow-400 bg-clip-text text-transparent">
                NahalAI
              </span>
            </h2>
            <p className="text-xl sm:text-2xl text-white font-bold mb-3">
              Beekeeping Monitoring Platform
            </p>
            <p className="text-base text-gray-300 mb-10 leading-relaxed">
              Data-driven insights for modern beekeepers
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <button
                onClick={() => navigate('info')}
                className="inline-flex items-center gap-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white font-bold py-4 px-10 rounded-2xl shadow-2xl hover:shadow-yellow-500/40 transition-all duration-300 hover:-translate-y-1 text-lg"
              >
                About Us
                <ArrowRight className="w-5 h-5" />
              </button>
              
            </div>
          </div>
        )}

        {/* ── INFO ── */}
        {view === 'info' && (
          <div
            className={`w-full max-w-4xl mx-auto transition-all duration-500 ${
              !fadeOut ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}
          >
            <div className="text-center mb-8">
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">
                About{' '}
                <span className="bg-gradient-to-r from-amber-400 to-yellow-400 bg-clip-text text-transparent">
                  NahalAI
                </span>
              </h2>
              <p className="text-gray-300 text-sm sm:text-base">
                Advanced AI platform for modern beekeeping
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5 sm:p-7 mb-4">
              <h3 className="text-lg font-bold text-amber-400 mb-3">Why NahalAI?</h3>
              <p className="text-gray-300 text-sm leading-relaxed mb-2">
                Beekeeping is an ancient practice, but management still relies heavily on personal experience and guesswork.
              </p>
              <p className="text-white text-sm font-semibold">
                Smart Hive brings this world into the era of data — we don't replace beekeepers, we empower them.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              {features.map(({ icon, title, items }) => (
                <div key={title} className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    {icon}
                    <h4 className="text-sm font-bold text-white">{title}</h4>
                  </div>
                  <ul className="text-gray-300 text-xs space-y-1.5">
                    {items.map(item => <li key={item}>• {item}</li>)}
                  </ul>
                </div>
              ))}
            </div>

            <div className="bg-gradient-to-br from-amber-500/20 to-yellow-500/20 backdrop-blur-md border border-amber-500/30 rounded-2xl p-5 sm:p-7 mb-4">
              <h3 className="text-lg font-bold text-amber-400 mb-4">How It Works</h3>
              <div className="space-y-2 text-sm text-white">
                {[
                  'Smart sensors installed in each hive',
                  'Continuous data collection 24/7',
                  'Data uploaded to cloud platform',
                  'AI-powered automated analysis',
                  'Clear dashboard for beekeepers',
                ].map(s => <p key={s}>✓ {s}</p>)}
              </div>
              <p className="text-center text-base font-bold text-amber-300 mt-5">
                Monitor → Analyze → Act with Confidence
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5 sm:p-7 mb-4">
              <h3 className="text-lg font-bold text-amber-400 mb-3">Who Is Smart Hive For?</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-gray-300 text-sm">
                {['Hobby Beekeepers', 'Commercial Operations', 'Agricultural Researchers', 'Pollination Services', 'Bee Breeders', 'Environmental Organizations'].map(t => (
                  <span key={t}>• {t}</span>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-br from-amber-500/20 to-yellow-500/20 backdrop-blur-md border border-amber-500/30 rounded-2xl p-5 sm:p-7 mb-6 text-center">
              <h3 className="text-lg font-bold text-amber-400 mb-3">Our Vision</h3>
              <p className="text-white text-sm mb-3">
                We believe the future of beekeeping will be safer, more productive, and more sustainable.
              </p>
              <p className="text-amber-300 text-base font-bold">
                NahalAI isn't just a tech tool — it's a cultural shift in understanding bee colony health.
              </p>
            </div>

            <div className="text-center pb-4">
              <button onClick={() => navigate('home')} className="text-white/50 hover:text-white text-sm underline transition-colors">
                ← Back
              </button>
            </div>
          </div>
        )}

        {/* ── CONTACT ── */}
        {view === 'contact' && (
          <div
            className={`w-full max-w-lg mx-auto transition-all duration-500 ${
              !fadeOut ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}
          >
            <div className="flex justify-center mb-5">
              <div className="bg-gradient-to-r from-amber-500 to-yellow-500 p-4 rounded-full shadow-xl">
                <Mail className="w-10 h-10 text-white" />
              </div>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-center text-white mb-3">
              <span className="bg-gradient-to-r from-amber-400 to-yellow-400 bg-clip-text text-transparent">
                Contact Us
              </span>
            </h2>
            <p className="text-center text-gray-300 text-sm mb-8">
              We're here to answer your questions and help you get started.
            </p>

            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 sm:p-8 mb-4">
              <div className="mb-5">
                <label className="block text-white text-sm font-semibold mb-2">Support Email</label>
                <div className="bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-gray-300 text-sm">
                  info@smarthive.com
                </div>
              </div>
              <div className="mb-6">
                <label htmlFor="msg" className="block text-white text-sm font-semibold mb-2">
                  Your Message
                </label>
                <textarea
                  id="msg"
                  rows={5}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Demo request, technical partnership, research project..."
                  className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-all resize-none"
                />
              </div>
              <button
                onClick={handleSend}
                disabled={!message.trim()}
                className={`w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg transition-all duration-300 ${
                  message.trim()
                    ? 'hover:from-amber-600 hover:to-yellow-600 hover:-translate-y-0.5 hover:shadow-yellow-500/40'
                    : 'opacity-40 cursor-not-allowed'
                }`}
              >
                <Send className="w-4 h-4" />
                Send via Gmail
              </button>
            </div>

            <div className="text-center pb-4">
              <button onClick={() => navigate('home')} className="text-white/50 hover:text-white text-sm underline transition-colors">
                ← Back
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}