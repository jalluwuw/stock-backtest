// Default langsung ke backend Vercel jika di production, atau localhost:8000 di laptop
export const API_BASE = 
  process.env.NEXT_PUBLIC_API_URL || 
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' 
    ? 'https://stock-backtest-blush.vercel.app' 
    : 'http://localhost:8000');
