'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createRoom } from '@/lib/game-logic';
import { Suspense } from 'react';

function HostSetupContent() {
  const router = useRouter();
  const [playerName, setPlayerName] = useState('');
  const [shouldPlay, setShouldPlay] = useState(true);
  const [minPlayers, setMinPlayers] = useState(8);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!playerName) return alert('Enter your name');
    setLoading(true);
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const { game, player } = await createRoom(code, playerName, shouldPlay, minPlayers);
      localStorage.setItem('playerName', playerName);
      if (player) localStorage.setItem('playerId', player.id);
      localStorage.setItem('roomId', game.id);
      localStorage.setItem('isHost', 'true');
      router.push(`/host/${code}`);
    } catch (error) {
      console.error(error);
      alert('Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-white">
      <div className="max-w-md w-full glass p-8 rounded-4xl space-y-10 animate-fade-enter-active border border-white/5 shadow-2xl">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-gold serif tracking-wide">The Sultan's Court</h1>
          <p className="text-gold/40 text-[10px] uppercase font-black tracking-[0.4em]">Host a New Mehfil</p>
        </div>

        <div className="space-y-8 animate-fade-enter-active">
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-black text-gold/40 tracking-widest ml-1">Your Takhallus (Name)</label>
            <input
                type="text"
                placeholder="Host Name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:border-gold transition-all text-white text-xl font-serif text-center"
            />
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-end px-1">
              <label className="text-[10px] uppercase font-black text-gold/40 tracking-widest">Required Gathering Size</label>
              <span className="text-2xl font-black text-gold serif">{minPlayers} <span className="text-[10px] uppercase font-bold opacity-40">Poets</span></span>
            </div>
            <div className="bg-white/5 p-6 rounded-3xl border border-white/10 space-y-4">
              <input 
                type="range" 
                min="4" 
                max="12" 
                step="1"
                value={minPlayers}
                onChange={(e) => setMinPlayers(parseInt(e.target.value))}
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-gold"
              />
              <div className="flex justify-between text-[8px] font-black text-white/20 uppercase tracking-tighter">
                <span>4 (Small)</span>
                <span>8 (Grand)</span>
                <span>12 (Royal)</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between bg-white/5 p-5 rounded-3xl border border-white/10 group cursor-pointer" onClick={() => setShouldPlay(!shouldPlay)}>
             <div className="space-y-1">
                <div className="text-xs font-black uppercase text-gold tracking-widest">Host as Player</div>
                <div className="text-[10px] text-gray-500 italic">I want to participate in the game</div>
             </div>
             <div className={`w-12 h-6 rounded-full transition-all duration-300 flex items-center px-1 ${shouldPlay ? 'bg-emerald-600' : 'bg-white/10'}`}>
                <div className={`w-4 h-4 bg-white rounded-full transition-all duration-300 ${shouldPlay ? 'translate-x-6' : 'translate-x-0'}`} />
             </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full bg-gold py-6 rounded-3xl text-background border-gold shadow-2xl text-2xl font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? 'Preparing...' : 'Create & Host'}
          </button>
          
          <div className="space-y-3 px-2">
             <div className="flex items-start gap-3 opacity-30">
                <span className="text-gold mt-1">📜</span>
                <p className="text-[10px] italic leading-relaxed">As the Sultan, you will orchestrate the phases and verify the poetic credentials of your guests.</p>
             </div>
          </div>

          <button 
            onClick={() => router.push('/')} 
            className="w-full text-[10px] uppercase font-black text-white/20 hover:text-white/40 tracking-widest transition-colors py-2"
          >
            Back to Home
          </button>
        </div>
      </div>
    </main>
  );
}

export default function HostSetup() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center text-gold">Loading...</div>}>
      <HostSetupContent />
    </Suspense>
  );
}
