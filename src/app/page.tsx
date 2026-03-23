'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createRoom, joinRoom } from '@/lib/game-logic';

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'join' | 'create'>('create');
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [shouldPlay, setShouldPlay] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      setRoomCode(code.toUpperCase());
      setMode('join');
    }
  }, [searchParams]);

  const handleCreate = async () => {
    if (!playerName) return alert('Enter your name');
    setLoading(true);
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const { game, player } = await createRoom(code, playerName, shouldPlay);
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

  const handleJoin = async () => {
    if (!roomCode || !playerName) return alert('Enter name and room code');
    setLoading(true);
    try {
      const { player, roomId } = await joinRoom(roomCode, playerName);
      localStorage.setItem('playerName', playerName);
      localStorage.setItem('playerId', player.id);
      localStorage.setItem('roomId', roomId);
      localStorage.setItem('isHost', 'false');
      router.push(`/play/${roomCode}`);
    } catch (error) {
      console.error(error);
      alert('Failed to join room. check code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-crimson-black text-white">
      <div className="max-w-md w-full glass p-8 rounded-4xl space-y-10 animate-fade-enter-active border border-white/5">
        <div className="text-center space-y-2">
          <h1 className="text-6xl font-black text-gold serif tracking-tighter italic">MK</h1>
          <h2 className="text-3xl font-bold text-white serif tracking-wide">Mehfil-e-Khaas</h2>
          <p className="text-gold/40 text-[10px] uppercase font-black tracking-[0.4em]">Social Deduction Poetry</p>
        </div>

        <div className="space-y-6">
          {/* STEP 1: Name Field */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-black text-gold/40 tracking-widest ml-1">Your Takhallus (Name)</label>
            <input
                type="text"
                placeholder={mode === 'create' ? "Host Name" : "Player Name"}
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:border-gold transition-all text-white text-xl font-serif text-center"
            />
          </div>

          {mode === 'join' ? (
            <div className="space-y-6 animate-fade-enter-active">
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-black text-emerald-500/40 tracking-widest ml-1">Room Code</label>
                <input
                    type="text"
                    placeholder="ABCDEF"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    className="w-full bg-emerald-950/20 border border-emerald-500/20 rounded-2xl px-6 py-5 focus:outline-none focus:border-emerald-500 transition-all text-white text-center text-4xl font-black tracking-[0.2em]"
                />
              </div>
              <button
                onClick={handleJoin}
                disabled={loading}
                className="btn-premium w-full bg-emerald-600 py-5 rounded-2xl text-white border-emerald-500 shadow-xl text-xl font-black uppercase tracking-widest"
              >
                {loading ? 'Entering...' : 'Join Now'}
              </button>
              <button 
                onClick={() => setMode('create')} 
                className="w-full text-[10px] uppercase font-black text-white/20 hover:text-white/40 tracking-widest transition-colors py-2"
              >
                Switch to Hosting
              </button>
            </div>
          ) : (
            <div className="space-y-8 animate-fade-enter-active">
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
                className="btn-premium w-full bg-gold py-6 rounded-3xl text-crimson-black border-gold shadow-2xl text-2xl font-black uppercase tracking-widest"
              >
                {loading ? 'Preparing...' : 'Create & Host'}
              </button>
              
              <div className="space-y-3 px-2">
                 <div className="flex items-start gap-3 opacity-30 group">
                    <span className="text-gold mt-1">📜</span>
                    <p className="text-[10px] italic leading-relaxed">As the Sultan, you will orchestrate the phases and verify the poetic credentials of your guests.</p>
                 </div>
              </div>
              
              <button 
                onClick={() => setMode('join')} 
                className="w-full text-[10px] uppercase font-black text-white/20 hover:text-white/40 tracking-widest transition-colors py-2"
              >
                I have a Room Code
              </button>
            </div>
          )}
        </div>

        <div className="text-center text-xs text-gray-500 uppercase tracking-widest pt-8">
          A Game of Sukhan-war & Naqal-baaz
        </div>
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-crimson-black flex items-center justify-center text-gold">Loading...</div>}>
      <HomeContent />
    </Suspense>
  );
}
