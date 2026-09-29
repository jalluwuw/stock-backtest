// Default ke backend Vercel yang sudah aktif: https://stock-backtest-tg7d.vercel.app
export const API_BASE = 
  process.env.NEXT_PUBLIC_API_URL || 
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' 
    ? 'https://stock-backtest-tg7d.vercel.app' 
    : 'http://localhost:8000');
