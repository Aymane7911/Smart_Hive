// app/dashboard/loading.tsx
export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-xl text-gray-600">Loading dashboard...</p>
      </div>
    </div>
  );
}