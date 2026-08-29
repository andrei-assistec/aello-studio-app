import React, { useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import { Menu } from 'lucide-react';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col lg:flex-row">
      {/* Mobile Top Header */}
      <header className="lg:hidden h-16 bg-white border-b border-surface-200 flex items-center justify-between px-6 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <img 
            src="/icons/icon-192.png" 
            className="w-8 h-8 object-contain rounded-full shadow-sm" 
            alt="Aello Logo" 
          />
          <span className="font-display font-bold text-brand-dark text-lg">Aello Studio</span>
        </div>
        <button 
          onClick={() => setIsMobileOpen(true)}
          className="p-2 text-surface-500 hover:text-brand-dark rounded-lg hover:bg-surface-50 transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
      </header>

      {/* Backdrop overlay for mobile drawer */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-40 lg:hidden transition-opacity duration-300"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar Component */}
      <Sidebar isMobileOpen={isMobileOpen} onMobileClose={() => setIsMobileOpen(false)} />

      {/* Main Content Area */}
      <main className="flex-1 lg:ml-64 p-4 md:p-6">
        <div className="max-w-7xl mx-auto animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
};
