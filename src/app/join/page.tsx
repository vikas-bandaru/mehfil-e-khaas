'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { joinRoom } from '@/lib/game-logic';

function JoinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAutoFilled, setIsAutoFilled] = useState(false);

  // Restore player name and handle auto-fill from URL
  useEffect(() => {
    // Restore name
    const storedName = localStorage.getItem('playerName');
    if (storedName) setPlayerName(storedName);

    // Auto-fill room code
    const code = searchParams.get('code');
    if (code) {
      const upperCode = code.toUpperCase();
      setRoomCode(upperCode);
      setIsAutoFilled(true);
      if (process.env.NODE_ENV === 'development') {
        console.log('Auto-filling room code:', upperCode);
      }
    }
  }, [searchParams]);

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
      alert('Failed to join room. Check code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-white">
      <div className="max-w-md w-full glass p-8 rounded-4xl space-y-10 animate-fade-enter-active border border-white/5 shadow-2xl">
        <div className="text-center space-y-2">
          <h1 className="text-5xl font-bold serif text-gold tracking-tight drop-shadow-sm">Join the Mehfil</h1>
          <p className="text-gold/60 font-medium tracking-widest uppercase text-[10px]">Enter the secret code to proceed</p>
        </div>

        {/* ONBOARDING TOOLTIP */}
        <div className="flex justify-center mb-4">
          <details className="group relative">
            <summary className="list-none cursor-pointer flex items-center gap-2 px-4 py-2 rounded-full border border-gold/20 bg-gold/5 hover:bg-gold/10 transition-all text-[10px] uppercase font-black tracking-widest text-gold/80">
              <span className="w-4 h-4 rounded-full border border-gold/40 flex items-center justify-center text-[8px]">?</span>
              New to the Mehfil?
            </summary>
            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-4 w-64 glass p-6 rounded-2xl border border-gold/20 shadow-2xl animate-fade-in z-50">
              <h4 className="serif text-gold font-bold mb-3 border-b border-gold/20 pb-1">The Court Protocols</h4>
              <ul className="space-y-3 text-xs text-white/80 leading-relaxed font-sans">
                <li className="flex gap-3">
                  <span className="text-gold font-black">1.</span>
                  <span><strong>Solve Poetry:</strong> Work with the court to complete the hidden couplet.</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-gold font-black">2.</span>
                  <span><strong>Find the Plagiarist:</strong> Identify the Naqal-baaz hiding among the poets.</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-gold font-black">3.</span>
                  <span><strong>Stay Silenced:</strong> Don't get "Zabaan-band" or banished from the court.</span>
                </li>
              </ul>
              <div className="mt-4 pt-3 border-t border-gold/10 text-[8px] uppercase tracking-tighter opacity-40 text-center italic">
                Protect your Takhallus. Guard your secret.
              </div>
            </div>
          </details>
        </div>

        {isAutoFilled && roomCode ? (
          <div className="animate-fade-in py-1 px-4 bg-gold/10 border border-gold/20 rounded-full inline-block">
            <p className="text-gold text-[10px] uppercase font-black tracking-widest">
              Welcome to Mehfil <span className="text-white">{roomCode}</span>
            </p>
          </div>
        ) : (
          <p className="text-gold/40 text-[10px] uppercase font-black tracking-[0.4em]">Join an Existing Game</p>
        )}

        <div className="space-y-6 animate-fade-enter-active">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-black text-gold/40 tracking-widest ml-1">Your Takhallus (Name)</label>
              <input
                  type="text"
                  placeholder="Player Name"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:border-gold transition-all text-white text-xl font-serif text-center"
              />
            </div>

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
          </div>

          <button
            onClick={handleJoin}
            disabled={loading}
            className="w-full bg-emerald-600 py-6 rounded-2xl text-white border-emerald-500 shadow-xl text-xl font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? 'Entering...' : 'Join Now'}
          </button>

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

export default function Join() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center text-gold">Loading...</div>}>
      <JoinContent />
    </Suspense>
  );
}
