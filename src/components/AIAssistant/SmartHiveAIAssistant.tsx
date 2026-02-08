// app/components/AIAssistant/SmartHiveAIAssistant.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Loader2, Sparkles, TrendingUp, AlertCircle } from 'lucide-react';
import { SensorData } from '../../lib/types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIAssistantProps {
  latestData: SensorData[];
  historicalData: SensorData[];
  selectedContainer: string;
  totalHives: number;
  activatedHives: number;
}

export default function SmartHiveAIAssistant({
  latestData,
  historicalData,
  selectedContainer,
  totalHives,
  activatedHives
}: AIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

useEffect(() => {
  // Check if dark mode is active
  const checkDarkMode = () => {
    setIsDarkMode(document.documentElement.classList.contains('dark'));
  };
  
  checkDarkMode();
  
  // Watch for dark mode changes
  const observer = new MutationObserver(checkDarkMode);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  });
  
  return () => observer.disconnect();
}, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Initialize with welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: '1',
          role: 'assistant',
          content: `👋 Hello! I'm your Smart Hive AI Assistant. I can help you analyze your ${totalHives} hive${totalHives !== 1 ? 's' : ''} and provide insights about temperature, humidity, weight changes, and more.\n\nYou can ask me things like:\n• "How are my hives performing?"\n• "Which hive has the lowest battery?"\n• "Compare temperature trends across hives"\n• "Alert me about any concerning readings"\n\nWhat would you like to know?`,
          timestamp: new Date()
        }
      ]);
    }
  }, [totalHives, messages.length]);

  // Prepare context data for AI
  const prepareContextData = () => {
    // Calculate statistics from latest data
    const hiveStats = new Map();
    
    latestData.forEach((item, index) => {
      const hiveNumber = index + 1;
      
      hiveStats.set(hiveNumber, {
        temperature_internal: item.temp_internal ||  null,
        temperature_external: item.temp_external ||  null,
        humidity_internal: item.hum_internal ||  null,
        humidity_external: item.hum_external ||  null,
        weight: item.weight || null,
        battery: item.battery || 100,
        timestamp: item.timestamp || item._metadata?.lastModified
      });
    });

    // Calculate trends from historical data
    const trends = {
      temperature: calculateTrend(historicalData, 'temp_internal'),
      weight: calculateTrend(historicalData, 'weight'),
      battery: calculateTrend(historicalData, 'battery')
    };

    return {
      apiary: selectedContainer,
      totalHives,
      activatedHives,
      hiveStats: Array.from(hiveStats.entries()).map(([num, stats]) => ({
        hiveNumber: num,
        ...stats
      })),
      trends,
      dataPoints: {
        latest: latestData.length,
        historical: historicalData.length
      }
    };
  };

  // Helper to calculate trends
  const calculateTrend = (data: SensorData[], field: string) => {
    if (data.length < 2) return 'insufficient_data';
    
    const values = data
      .map(item => item[field as keyof SensorData])
      .filter(v => v !== null && v !== undefined && !isNaN(Number(v)))
      .map(Number);
    
    if (values.length < 2) return 'no_data';
    
    const recentAvg = values.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, values.length);
    const olderAvg = values.slice(0, 5).reduce((a, b) => a + b, 0) / Math.min(5, values.length);
    
    const change = ((recentAvg - olderAvg) / olderAvg) * 100;
    
    if (Math.abs(change) < 2) return 'stable';
    return change > 0 ? 'increasing' : 'decreasing';
  };

  
  // Send message to AI
const sendMessage = async () => {
  if (!inputMessage.trim() || isLoading) return;

  const userMessage: Message = {
    id: Date.now().toString(),
    role: 'user',
    content: inputMessage.trim(),
    timestamp: new Date()
  };

  setMessages(prev => [...prev, userMessage]);
  setInputMessage('');
  setIsLoading(true);

  try {
    const contextData = prepareContextData();

    const systemPrompt = `You are a helpful beekeeping AI assistant analyzing smart hive sensor data. You have access to real-time data from ${totalHives} beehives in the "${selectedContainer}" apiary.

Current Data Summary:
${JSON.stringify(contextData, null, 2)}

Guidelines:
- Provide clear, actionable insights about hive health
- Alert users to concerning readings (e.g., temperature outside 32-36°C, low battery <30%, rapid weight loss)
- Compare hives when asked and identify patterns
- Suggest actions when problems are detected
- Be concise but informative
- Use emojis sparingly for readability (🐝, 📊, ⚠️, ✅)
- If data is missing or insufficient, acknowledge it clearly

Focus on practical beekeeping advice based on the sensor data.`;

    const response = await fetch('/api/ai-chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        system: systemPrompt,
        messages: [
          ...messages.slice(-10).map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          {
            role: 'user',
            content: userMessage.content
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: data.content[0].text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, assistantMessage]);
  } catch (error) {
    console.error('AI Assistant error:', error);
    
    const errorMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '❌ Sorry, I encountered an error processing your request. Please try again.',
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, errorMessage]);
  } finally {
    setIsLoading(false);
  }
};

  // Quick action buttons
  const quickActions = [
    { label: 'Overall Status', prompt: 'Give me an overview of all my hives' },
    { label: 'Alerts', prompt: 'Are there any concerning readings I should know about?' },
    { label: 'Compare Hives', prompt: 'Compare the performance of all my hives' },
    { label: 'Battery Status', prompt: 'Check battery levels across all hives' }
  ];

  const handleQuickAction = (prompt: string) => {
    setInputMessage(prompt);
    setTimeout(() => sendMessage(), 100);
  };

  return (
    <>
      {/* Floating Chat Button */}
      {!isOpen && (
  <button
    onClick={() => setIsOpen(true)}
    className="fixed bottom-6 right-6 z-50 bg-slate-600 hover:bg-slate-700 text-white p-4 rounded-full shadow-2xl hover:shadow-slate-500/50 transition-all duration-300 hover:scale-110 group"
    title="Open AI Assistant"
  >
          <MessageSquare className="w-6 h-6" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse"></span>
          
          {/* Tooltip */}
          <span className="absolute bottom-full right-0 mb-2 px-3 py-1 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Ask about your hives
          </span>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
  <div className={`fixed bottom-6 right-6 z-50 w-96 h-[600px] rounded-2xl shadow-2xl flex flex-col overflow-hidden ${
    isDarkMode
      ? 'bg-slate-900 border border-slate-700'
      : 'bg-white border border-slate-200'
  }`}>
          {/* Header */}
          <div className={`p-4 flex items-center justify-between ${
  isDarkMode
    ? 'bg-slate-600 text-white p-4 flex items-center justify-between'
    : 'bg-slate-600 text-white'
}`}>
            <div className="flex items-center gap-2">
              <div className="bg-white/20 p-2 rounded-lg">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg">AI Hive Assistant</h3>
                <p className="text-xs text-white/80">Powered by Groq</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Actions */}
          {messages.length <= 1 && (
  <div className={`p-3 border-b ${
    isDarkMode
      ? 'bg-slate-800 border-slate-700'
      : 'bg-slate-50 border-slate-200'
  }`}>
              <p className="text-xs text-slate-600 mb-2 font-medium">Quick Actions:</p>
              <div className="grid grid-cols-2 gap-2">
                {quickActions.map((action, index) => (
                  <button
  key={index}
  onClick={() => handleQuickAction(action.prompt)}
  className={`text-xs px-3 py-2 border rounded-lg transition-all ${
    isDarkMode
      ? 'bg-slate-700 border-slate-600 text-slate-200 hover:border-slate-500 hover:bg-slate-600'
      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-400 hover:bg-slate-50'
  }`}
>
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${
  isDarkMode ? 'bg-slate-800' : 'bg-slate-50'
}`}>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
    message.role === 'user'
      ? isDarkMode
        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
        : 'bg-slate-600 text-white'
      : isDarkMode
        ? 'bg-slate-700 border border-slate-600 text-slate-100'
        : 'bg-white border border-slate-200 text-slate-800'
  }`}
>
                  {message.role === 'assistant' && (
  <div className={`flex items-center gap-2 mb-2 pb-2 border-b ${
    isDarkMode ? 'border-slate-600' : 'border-slate-200'
  }`}>
    <Sparkles className={`w-4 h-4 ${isDarkMode ? 'text-blue-400' : 'text-slate-600'}`} />
    <span className={`text-xs font-semibold ${isDarkMode ? 'text-blue-400' : 'text-slate-600'}`}>AI Assistant</span>
  </div>
)}
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                  <p className={`text-xs mt-2 ${
  message.role === 'user' 
    ? 'text-white/70' 
    : isDarkMode ? 'text-slate-400' : 'text-slate-500'
}`}>
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
            
            {isLoading && (
  <div className="flex justify-start">
    <div className={`rounded-2xl px-4 py-3 ${
      isDarkMode
        ? 'bg-slate-700 border border-slate-600'
        : 'bg-white border border-slate-200'
    }`}>
      <div className="flex items-center gap-2">
        <Loader2 className={`w-4 h-4 animate-spin ${isDarkMode ? 'text-blue-400' : 'text-slate-600'}`} />
        <span className={`text-sm ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>Analyzing your hives...</span>
      </div>
    </div>
  </div>
)}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className={`p-4 border-t ${
  isDarkMode
    ? 'bg-slate-900 border-slate-700'
    : 'bg-white border-slate-200'
}`}>
            <div className="flex gap-2">
              <input
  ref={inputRef}
  type="text"
  value={inputMessage}
  onChange={(e) => setInputMessage(e.target.value)}
  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
  placeholder="Ask about your hives..."
  disabled={isLoading}
  className={`flex-1 px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:border-transparent disabled:opacity-50 ${
    isDarkMode
      ? 'bg-slate-800 border-slate-600 text-slate-100 placeholder-slate-500 focus:ring-slate-500'
      : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:ring-slate-500'
  }`}
/>
              <button
  onClick={sendMessage}
  disabled={!inputMessage.trim() || isLoading}
  className={`px-4 py-3 text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
    isDarkMode
      ? 'bg-gradient-to-r from-blue-600 to-purple-600'
      : 'bg-slate-600 hover:bg-slate-700'
  }`}
>
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
            
            <p className={`text-xs mt-2 text-center ${
  isDarkMode ? 'text-slate-400' : 'text-slate-500'
}`}>
  AI responses may take a few seconds
</p>
          </div>
        </div>
      )}
    </>
  );
}