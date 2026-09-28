import './globals.css';
import Navbar from '../components/Navbar';

export const metadata = {
  title: 'IHSG Stock Screener & Backtest',
  description: 'Pro-level technical stock screener & backtest terminal for IHSG',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen antialiased flex flex-col">
        <Navbar />
        <main className="flex-1">
          {children}
        </main>
      </body>
    </html>
  );
}