"use client";
import React, { useState, useEffect } from 'react';
import {
  X,
  Send,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Bell,
  BellOff,
  Info,
  Layers,
  MessageSquare,
} from 'lucide-react';
import { API_BASE } from '../config/api';

export default function TelegramModal({ isOpen, onClose }) {
  const [botToken,  setBotToken]  = useState('');
  const [chatId,    setChatId]    = useState('');
  const [enabled,   setEnabled]   = useState(true);
  const [mode,      setMode]      = useState('grouped'); // 'grouped' | 'individual'

  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null); // { type: 'success' | 'error', text: '' }

  // Load config saat modal dibuka
  useEffect(() => {
    if (!isOpen) return;
    setStatusMsg(null);
    setIsLoading(true);

    fetch(`${API_BASE}/api/v1/telegram/config`)
      .then((r) => r.json())
      .then((data) => {
        setEnabled(data.enabled ?? true);
        setChatId(data.chat_id || '');
        setMode(data.mode || 'grouped');
        if (data.masked_token) {
          setBotToken(data.masked_token);
        }
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  // ── Handler: Simpan Konfigurasi ──────────────────────────────────────────
  const handleSave = async () => {
    setIsLoading(true);
    setStatusMsg(null);

    try {
      const res = await fetch(`${API_BASE}/api/v1/telegram/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bot_token: botToken.includes('...') ? '' : botToken.trim(),
          chat_id: chatId.trim(),
          enabled: enabled,
          mode: mode,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMsg({ type: 'success', text: 'Pengaturan Telegram berhasil disimpan!' });
      } else {
        setStatusMsg({ type: 'error', text: data.message || 'Gagal menyimpan pengaturan.' });
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: 'Gagal menghubungi server: ' + err.message });
    } finally {
      setIsLoading(false);
    }
  };

  // ── Handler: Test Notifikasi ─────────────────────────────────────────────
  const handleTest = async () => {
    setIsTesting(true);
    setStatusMsg(null);

    try {
      const res = await fetch(`${API_BASE}/api/v1/telegram/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bot_token: botToken.includes('...') ? null : (botToken.trim() || null),
          chat_id: chatId.trim() || null,
          mode: mode,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setStatusMsg({
          type: 'success',
          text: `Pesan tes (Mode: ${mode === 'grouped' ? 'Rangkap 1 Bubble' : 'Pesan Terpisah'}) berhasil dikirim! Silakan periksa aplikasi Telegram kamu.`,
        });
      } else {
        setStatusMsg({
          type: 'error',
          text: `Gagal kirim pesan: ${data.message}`,
        });
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: 'Koneksi error: ' + err.message });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 w-full max-w-xl text-white relative shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
            <Send className="w-5 h-5 -rotate-45" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              Notifikasi Telegram Otomatis
            </h2>
            <p className="text-xs text-slate-400">
              Kirim alert seketika ke Telegram saat sinyal BUY / Breakout terpicu.
            </p>
          </div>
        </div>

        {/* Status Message Banner */}
        {statusMsg && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
              statusMsg.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                : 'bg-red-500/10 border-red-500/40 text-red-300'
            }`}
          >
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            )}
            <span className="flex-1">{statusMsg.text}</span>
          </div>
        )}

        {/* Toggle Alert ON / OFF */}
        <div className="flex items-center justify-between bg-slate-950 p-3.5 rounded-xl border border-slate-800">
          <div className="flex items-center gap-3">
            {enabled ? (
              <Bell className="w-5 h-5 text-emerald-400" />
            ) : (
              <BellOff className="w-5 h-5 text-slate-500" />
            )}
            <div>
              <span className="text-sm font-semibold text-slate-200 block">Status Notifikasi</span>
              <span className="text-xs text-slate-500">
                {enabled ? 'Aktif — pesan akan otomatis dikirim tiap sinyal baru terdeteksi' : 'Nonaktif — bot tidak akan mengirim pesan'}
              </span>
            </div>
          </div>
          <button
            onClick={() => setEnabled((v) => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
              enabled ? 'bg-cyan-600' : 'bg-slate-800 border border-slate-700'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Pilihan Format Pesan: Rangkap 1 Bubble vs Dipisah-pisah */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            Format Pengiriman Sinyal
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Opsi 1: Rangkap 1 Bubble */}
            <div
              onClick={() => setMode('grouped')}
              className={`cursor-pointer p-3 rounded-xl border transition-all text-xs space-y-1.5 ${
                mode === 'grouped'
                  ? 'bg-cyan-500/10 border-cyan-500 text-cyan-300 ring-1 ring-cyan-500/50'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center gap-1.5 text-slate-200">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  Rangkap 1 Bubble
                </span>
                <input
                  type="radio"
                  name="telegram_mode"
                  checked={mode === 'grouped'}
                  onChange={() => setMode('grouped')}
                  className="accent-cyan-500"
                />
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Semua saham yang terdeteksi dalam 1 siklus sync dikompilasi jadi <b>satu pesan ringkas</b>. Tidak membuat chat penuh.
              </p>
            </div>

            {/* Opsi 2: Dipisah-pisah per emiten */}
            <div
              onClick={() => setMode('individual')}
              className={`cursor-pointer p-3 rounded-xl border transition-all text-xs space-y-1.5 ${
                mode === 'individual'
                  ? 'bg-cyan-500/10 border-cyan-500 text-cyan-300 ring-1 ring-cyan-500/50'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center gap-1.5 text-slate-200">
                  <MessageSquare className="w-4 h-4 text-blue-400" />
                  Pesan Terpisah
                </span>
                <input
                  type="radio"
                  name="telegram_mode"
                  checked={mode === 'individual'}
                  onChange={() => setMode('individual')}
                  className="accent-cyan-500"
                />
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Setiap emiten dikirim sebagai <b>bubble tersendiri</b> lengkap dengan rincian sektor dan indikator mendalam.
              </p>
            </div>
          </div>
        </div>

        {/* Form Inputs */}
        <div className="space-y-4">
          {/* Bot Token */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                Telegram Bot Token
              </label>
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noreferrer"
                className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-[11px]"
              >
                Buat Bot via @BotFather <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <input
              type="text"
              placeholder="Contoh: 7123456789:AAFxxx_your_bot_token"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-600 font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Chat ID */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-cyan-400" />
                Telegram Chat ID (User / Channel / Group)
              </label>
              <a
                href="https://t.me/userinfobot"
                target="_blank"
                rel="noreferrer"
                className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-[11px]"
              >
                Cek ID via @userinfobot <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <input
              type="text"
              placeholder="Contoh: 123456789 atau -100xxxx untuk Group/Channel"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-600 font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Petunjuk Cepat */}
        <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 space-y-1.5">
          <p className="font-semibold text-slate-300">Cara menghubungkan bot dalam 1 menit:</p>
          <ol className="list-decimal list-inside space-y-1 text-slate-400">
            <li>Buka Telegram, chat <b>@BotFather</b> lalu ketik <code className="text-cyan-400">/newbot</code>.</li>
            <li>Salin <b>HTTP API Token</b> yang diberikan ke kolom Bot Token di atas.</li>
            <li>Buka Telegram, chat <b>@userinfobot</b> untuk melihat ID angka kamu, lalu salin ke Chat ID.</li>
            <li><b>PENTING:</b> Buka bot yang baru kamu buat di Telegram dan klik <b>START</b> agar bot punya izin mengirim pesan kepadamu!</li>
          </ol>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-3 pt-2">
          {/* Tombol Test Alert */}
          <button
            onClick={handleTest}
            disabled={isTesting || (!chatId && !botToken)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-400 hover:bg-blue-600/30 text-xs font-semibold disabled:opacity-50 transition-all active:scale-95"
          >
            <Send className="w-3.5 h-3.5 -rotate-45" />
            {isTesting ? 'Mengirim tes…' : 'Kirim Pesan Tes'}
          </button>

          {/* Tombol Simpan */}
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-400 hover:to-blue-500 text-xs font-bold shadow-lg shadow-cyan-500/20 disabled:opacity-50 transition-all active:scale-95 ml-auto"
          >
            {isLoading ? 'Menyimpan…' : 'Simpan Pengaturan'}
          </button>
        </div>
      </div>
    </div>
  );
}
