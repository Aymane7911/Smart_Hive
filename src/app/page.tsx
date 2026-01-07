'use client'

import React, { useState, useEffect } from 'react';
import { ArrowRight, LogIn, UserPlus, Mail, Send, Activity, Brain, TrendingUp, Shield, Hexagon } from 'lucide-react';

export default function SmartHivePage() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const handleGetStarted = () => {
    setFadeOut(true);
    setTimeout(() => {
      setShowInfo(true);
      setShowContact(false);
      setFadeOut(false);
    }, 300);
  };

  const handleContactClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setFadeOut(true);
    setTimeout(() => {
      setShowContact(true);
      setShowInfo(false);
      setFadeOut(false);
    }, 300);
  };

  const handleBack = () => {
    setFadeOut(true);
    setTimeout(() => {
      setShowInfo(false);
      setShowContact(false);
      setFadeOut(false);
      setMessage('');
    }, 300);
  };

  const handleSendMessage = () => {
    const email = 'info@smarthive.com';
    const subject = 'Inquiry from Smart Hive Website';
    const body = message;
    
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, '_blank');
  };

  return (
    <div className="min-h-screen w-full overflow-hidden bg-black">
      {/* Background Video */}
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        onError={(e) => console.error('Video error:', e)}
      >
        <source src="/littlebee.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>

      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-black/50 to-black/70"></div>

      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      {/* Top Navigation Bar */}
      <div className={`fixed top-0 left-0 right-0 z-20 flex items-center justify-between px-6 sm:px-8 py-4 transition-all duration-700 ${
        isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
      }`}>
        {/* Logo */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="p-2 bg-gradient-to-br from-amber-400 to-yellow-400 rounded-lg">
            <Hexagon className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl font-black bg-gradient-to-r from-amber-400 to-yellow-400 bg-clip-text text-transparent">Smart Hive</h1>
        </div>

        {/* Navigation Links and Auth Buttons */}
        <div className="flex items-center gap-3 sm:gap-6 flex-shrink-0">
          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-6">
            <a
              href="/contact"
              onClick={handleContactClick}
              className="text-white/80 hover:text-white font-semibold transition-colors duration-300"
            >
              Contact Us
            </a>
          </div>

          {/* hAuth Buttons */}
          <div className="flex items-center gap-3">
            <a
              href="/auth/login"
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/30 text-white font-bold py-2 px-4 sm:px-6 rounded-lg transition-all duration-300 hover:shadow-lg"
            >
              <LogIn className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Login</span>
            </a>

            <a
              href="/auth/register"
              className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white font-bold py-2 px-4 sm:px-6 rounded-lg shadow-lg hover:shadow-yellow-500/50 transition-all duration-300"
            >
              <UserPlus className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Register</span>
            </a>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 pt-20">
        {/* Main Content */}
        {!showInfo && !showContact ? (
          <div className={`text-center max-w-2xl mx-auto transform transition-all duration-500 ${
            isLoaded && !fadeOut ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}>
            <h2 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white mb-6 leading-tight">
              <span className="bg-gradient-to-r from-amber-400 to-yellow-400 bg-clip-text text-transparent">Smart Hive</span>
            </h2>

            <p className={`text-2xl sm:text-3xl text-white font-bold mb-4 transform transition-all duration-500 delay-100 ${
              isLoaded && !fadeOut ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}>
              AI-Powered Beekeeping Intelligence
            </p>

            <p className={`text-lg sm:text-xl text-gray-300 mb-8 leading-relaxed transform transition-all duration-500 delay-100 ${
              isLoaded && !fadeOut ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}>
              Data-driven insights for modern beekeepers
            </p>

            {/* Get Started Button */}
            <button
              onClick={handleGetStarted}
              className={`inline-flex items-center gap-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white font-bold py-4 px-8 rounded-2xl shadow-2xl hover:shadow-yellow-500/50 transition-all duration-300 transform hover:-translate-y-1 mb-12 ${
                isLoaded && !fadeOut ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
              } delay-200`}
            >
              Get Started
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        ) : showInfo ? (
          /* Info Section */
          <div className={`max-w-5xl mx-auto w-full transform transition-all duration-500 overflow-y-auto max-h-[85vh] px-4 ${
            showInfo && !fadeOut ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}>
            <div className="text-center mb-10">
              <h2 className="text-4xl sm:text-5xl font-black text-white mb-4 leading-tight">
                <span className="bg-gradient-to-r from-amber-400 to-yellow-400 bg-clip-text text-transparent">Smart Hive</span>
              </h2>
              <p className="text-xl text-gray-300">
                Advanced technology platform leveraging AI and biometric data analysis for modern beekeeping
              </p>
            </div>

            {/* Why Smart Hive */}
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 sm:p-8 mb-6">
              <h3 className="text-2xl font-bold text-amber-400 mb-4">Why Smart Hive?</h3>
              <p className="text-gray-300 leading-relaxed mb-3">
                Beekeeping is an ancient practice, but management still relies heavily on personal experience and guesswork.
              </p>
              <p className="text-white font-semibold">
                Smart Hive brings this world into the era of data and scientific measurement — we don't replace beekeepers, we empower them.
              </p>
            </div>

            {/* What We Offer */}
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-amber-400 mb-6">What We Offer</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <Brain className="w-6 h-6 text-amber-400" />
                    <h4 className="text-lg font-bold text-white">Hive Health Analysis</h4>
                  </div>
                  <ul className="text-gray-300 text-sm space-y-2">
                    <li>• Real-time temperature monitoring</li>
                    <li>• Humidity level tracking</li>
                    <li>• Early disease detection</li>
                  </ul>
                </div>

                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <TrendingUp className="w-6 h-6 text-yellow-400" />
                    <h4 className="text-lg font-bold text-white">Performance Metrics</h4>
                  </div>
                  <ul className="text-gray-300 text-sm space-y-2">
                    <li>• Honey production tracking</li>
                    <li>• Colony strength assessment</li>
                    <li>• Comparative hive analysis</li>
                  </ul>
                </div>

                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <Activity className="w-6 h-6 text-amber-400" />
                    <h4 className="text-lg font-bold text-white">Activity Monitoring</h4>
                  </div>
                  <ul className="text-gray-300 text-sm space-y-2">
                    <li>• Bee population counting</li>
                    <li>• Flight pattern analysis</li>
                    <li>• Foraging behavior insights</li>
                  </ul>
                </div>

                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <Shield className="w-6 h-6 text-yellow-400" />
                    <h4 className="text-lg font-bold text-white">Colony Protection</h4>
                  </div>
                  <ul className="text-gray-300 text-sm space-y-2">
                    <li>• Pest and disease alerts</li>
                    <li>• Environmental hazard detection</li>
                    <li>• Proactive intervention recommendations</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* How It Works */}
            <div className="bg-gradient-to-br from-amber-500/20 to-yellow-500/20 backdrop-blur-md border border-amber-500/30 rounded-2xl p-6 sm:p-8 mb-6">
              <h3 className="text-2xl font-bold text-amber-400 mb-4">How It Works</h3>
              <div className="space-y-3">
                <p className="text-white">✓ Smart sensors installed in each hive</p>
                <p className="text-white">✓ Continuous data collection 24/7</p>
                <p className="text-white">✓ Data uploaded to cloud platform</p>
                <p className="text-white">✓ AI-powered automated analysis</p>
                <p className="text-white">✓ Clear dashboard for beekeepers</p>
              </div>
              <p className="text-center text-2xl font-bold text-amber-300 mt-6">
                Monitor → Analyze → Act with Confidence
              </p>
            </div>

            {/* Target Audience */}
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 sm:p-8 mb-6">
              <h3 className="text-2xl font-bold text-amber-400 mb-4">Who Is Smart Hive For?</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="text-gray-300">• Hobby Beekeepers</div>
                <div className="text-gray-300">• Commercial Operations</div>
                <div className="text-gray-300">• Agricultural Researchers</div>
                <div className="text-gray-300">• Pollination Services</div>
                <div className="text-gray-300">• Bee Breeders</div>
                <div className="text-gray-300">• Environmental Organizations</div>
              </div>
            </div>

            {/* What Makes Us Different */}
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 sm:p-8 mb-6">
              <h3 className="text-2xl font-bold text-amber-400 mb-4">What Makes Us Different</h3>
              <div className="space-y-2 text-gray-300">
                <p>• First platform specialized in bee colony biometrics</p>
                <p>• Built on real data, not assumptions</p>
                <p>• Scalable from single hive to large apiaries</p>
                <p>• Non-invasive monitoring technology</p>
                <p>• Weather-resistant hardware design</p>
              </div>
            </div>

            {/* Vision */}
            <div className="bg-gradient-to-br from-amber-500/20 to-yellow-500/20 backdrop-blur-md border border-amber-500/30 rounded-2xl p-6 sm:p-8 mb-8 text-center">
              <h3 className="text-2xl font-bold text-amber-400 mb-4">Our Vision</h3>
              <p className="text-white text-lg mb-4">
                We believe the future of beekeeping will be safer, more productive, and more sustainable
              </p>
              <p className="text-amber-300 text-xl font-bold">
                Smart Hive isn't just a tech tool, it's a cultural shift in understanding bee colony health
              </p>
            </div>

            {/* Back Button */}
            <div className="text-center">
              <button
                onClick={handleBack}
                className="text-white/60 hover:text-white transition-colors underline mb-8"
              >
                ← Back
              </button>
            </div>
          </div>
        ) : (
          /* Contact Section */
          <div className={`text-center max-w-2xl mx-auto w-full transform transition-all duration-500 overflow-y-auto max-h-[85vh] ${
            showContact && !fadeOut ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}>
            <div className="flex justify-center mb-6">
              <div className="bg-gradient-to-r from-amber-500 to-yellow-500 p-4 rounded-full">
                <Mail className="w-12 h-12 text-white" />
              </div>
            </div>

            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-4 leading-tight">
              <span className="bg-gradient-to-r from-amber-400 to-yellow-400 bg-clip-text text-transparent">Contact Us</span>
            </h2>

            <p className="text-lg text-gray-300 mb-4">
              We're here to answer your questions and help you get started
            </p>

            <p className="text-gray-400 mb-8">
              📍 [Your Location]
            </p>

            {/* Contact Form */}
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 mb-6">
              <div className="mb-6">
                <label className="block text-left text-white font-semibold mb-2">
                  Support Email
                </label>
                <div className="bg-white/5 border border-white/20 rounded-lg p-4 text-gray-300 text-left">
                  info@smarthive.com
                </div>
              </div>

              <div className="mb-6">
                <label htmlFor="message" className="block text-left text-white font-semibold mb-2">
                  Your Message
                </label>
                <textarea
                  id="message"
                  rows={6}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Write your message here... (demo request, technical partnership, research project, apiary deployment)"
                  className="w-full bg-white/5 border border-white/20 rounded-lg p-4 text-white placeholder-gray-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/50 transition-all"
                />
              </div>

              <button
                onClick={handleSendMessage}
                disabled={!message.trim()}
                className={`w-full flex items-center justify-center gap-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-yellow-500/50 transition-all duration-300 transform hover:-translate-y-1 ${
                  !message.trim() ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <Send className="w-5 h-5" />
                Send via Gmail
              </button>
            </div>

            {/* Back Button */}
            <button
              onClick={handleBack}
              className="text-white/60 hover:text-white transition-colors underline"
            >
              ← Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}