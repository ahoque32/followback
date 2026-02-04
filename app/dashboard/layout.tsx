import Sidebar from '@/components/Sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-100">
      <Sidebar />
      
      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top padding for mobile header */}
        <div className="pt-16 lg:pt-0 pb-16 lg:pb-0">
          {children}
        </div>
      </div>
    </div>
  );
}
