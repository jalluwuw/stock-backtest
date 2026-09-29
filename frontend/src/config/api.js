// Otomatis pakai relative path di production (Vercel) atau localhost:8000 saat development di laptop
export const API_BASE = 
  process.env.NEXT_PUBLIC_API_URL || 
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' 
    ? '' 
    : 'http://localhost:8000');
