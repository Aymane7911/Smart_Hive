'use client';

import { useRouter } from 'next/navigation';

export default function SmartHiveAccessDenied() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-800 via-blue-900 to-indigo-900 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        
        <h2 className="text-3xl font-bold text-gray-800 mb-4">Access Denied</h2>
        
        <p className="text-gray-600 mb-6">
          Thank you for your Smart Hive purchase! Your order is being processed.
        </p>
        
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-yellow-800 font-medium mb-2">⏳ Pending Activation</p>
          <p className="text-xs text-yellow-700">
            Your Smart Hive access is currently being set up. You will receive an email notification once your dashboard is ready to use.
          </p>
        </div>
        
        <div className="space-y-3">
          <button
            onClick={() => router.push('/welcome')}
            className="w-full py-3 px-6 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 shadow-lg"
          >
            Back to Welcome
          </button>
          
          <p className="text-xs text-gray-500">
            Need help? Contact support at support@honexis.com
          </p>
        </div>
      </div>
    </div>
  );
}