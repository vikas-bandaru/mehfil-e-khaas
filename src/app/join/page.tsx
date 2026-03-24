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

  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      setRoomCode(code.toUpperCase());
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
          <h1 className="text-4xl font-bold text-gold serif tracking-wide">Enter the Mehfil</h1>
          <p className="text-gold/40 text-[10px] uppercase font-black tracking-[0.4em]">Join an Existing Game</p>
        </div>

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
