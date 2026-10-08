import React from 'react';
import VerifierDashboard from './VerifierDashboard';

function App() {
  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-100 flex flex-col justify-between">
      <main className="flex-grow">
        <VerifierDashboard />
      </main>
      
      {/* Dynamic footer */}
      <footer className="w-full py-6 border-t border-white/5 bg-black/30 backdrop-blur-sm text-center text-xs text-gray-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="font-semibold text-gray-400">ChainCert</span> &copy; {new Date().getFullYear()} — Enterprise Academic Verification System
          </div>
          <div className="flex gap-4">
            <a href="#" className="hover:text-blue-400 transition-colors">Privacy Policy</a>
            <span>&bull;</span>
            <a href="#" className="hover:text-blue-400 transition-colors">Terms of Service</a>
            <span>&bull;</span>
            <a href="https://ethereum.org" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition-colors">Ethereum Network</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
