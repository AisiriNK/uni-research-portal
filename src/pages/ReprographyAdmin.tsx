import { ThemeProvider } from '@/components/ThemeProvider';
import { Header } from '@/components/Header';
import { ReprographyDashboard } from '@/components/ReprographyDashboard';

const ReprographyAdmin = () => {
  return (
    <ThemeProvider defaultTheme="light" storageKey="university-portal-theme">
      <div className="min-h-screen bg-background">
        <Header />
        <main className="flex-1 overflow-auto">
          <div className="container mx-auto p-6 max-w-7xl">
            <ReprographyDashboard />
          </div>
        </main>
      </div>
    </ThemeProvider>
  );
};

export default ReprographyAdmin;
