'use client';

import { useParams } from 'next/navigation';
import { useGameState } from '@/hooks/useGameState';
import { usePlayers } from '@/hooks/usePlayers';
import { useState, useEffect, useRef } from 'react';

export default function PublicDisplay() {
  const { roomCode } = useParams() as { roomCode: string };
  const { gameState, loading: gameLoading } = useGameState(roomCode);
  const phase = gameState?.current_phase || 'lobby';
  const roomId = gameState?.id;
  const { players, loading: playersLoading } = usePlayers(roomId || '');
  const [origin, setOrigin] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const hasPlayedRef = useRef(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    // Reset the buzzer flag when a new mission starts or phase changes
    hasPlayedRef.current = false;
  }, [gameState?.mission_timer_end, phase]);

  useEffect(() => {
    if (!gameState?.mission_timer_end) {
        setTimeLeft(0);
        return;
    }
    
    const target = new Date(gameState.mission_timer_end).getTime();
    const interval = setInterval(() => {
        const now = new Date().getTime();
        const diff = Math.max(0, Math.floor((target - now) / 1000));
        setTimeLeft(diff);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [gameState?.mission_timer_end, gameState?.current_phase]);

  const playBuzzer = async () => {
    if (hasPlayedRef.current) return;
    hasPlayedRef.current = true;

    console.log("🔊 MISSION TIMER OVER - PLAYING BUZZER");
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(150, audioCtx.currentTime);
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.1);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.5);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 1.5);
    } catch (err) {
      console.error("Audio Playback Error:", err);
    }
  };

  useEffect(() => {
    if (phase === 'mission' && timeLeft === 0 && !hasPlayedRef.current && gameState?.mission_timer_end) {
      const now = Date.now();
      const target = new Date(gameState.mission_timer_end).getTime();
      // Only play if the timer has effectively reached zero naturally
      if (now >= target - 1000) {
        playBuzzer();
      }
    }
  }, [timeLeft, phase, gameState?.mission_timer_end]);

  if (gameLoading || playersLoading) return <div className="min-h-screen bg-crimson-black flex items-center justify-center text-gold serif italic text-4xl animate-pulse">Loading Mehfil...</div>;
  if (!gameState) return <div className="min-h-screen bg-crimson-black flex items-center justify-center text-red-500 font-bold">Room {roomCode} Not Found</div>;

  const joinUrl = `${origin}/?code=${roomCode}`;

  return (
    <main className="min-h-screen bg-crimson-black text-white flex flex-col overflow-hidden">
      
      {/* TOP DECORATIVE BAR */}
      <div className="h-2 bg-gradient-to-r from-gold via-emerald-deep to-gold w-full" />

      {/* HEADER SECTION */}
      <header className="p-8 lg:p-16 flex justify-between items-start">
        <div className="space-y-4">
            <h1 className="text-7xl lg:text-9xl font-black serif text-gold tracking-tighter uppercase leading-none italic drop-shadow-2xl">Mehfil-e-Khaas</h1>
            <div className="flex items-center gap-4 opacity-50">
                <span className="h-[1px] w-20 bg-white" />
                <span className="uppercase tracking-[0.5em] text-sm font-bold">Social Deduction Engine</span>
            </div>
        </div>
        
        <div className="text-right glass p-8 rounded-3xl border border-gold/20 flex flex-col items-center shadow-2xl bg-gold/5">
            <div className="text-[10px] uppercase font-black text-gold/60 tracking-widest mb-1">Room Code</div>
            <div className="text-7xl font-black tracking-tighter text-white">{roomCode}</div>
        </div>
      </header>

      {/* CENTRAL MESSAGE AREA */}
      <div className="flex-1 flex flex-col items-center justify-center text-center p-10 relative">
        
        {phase === 'lobby' && (
            <div className="space-y-12 animate-fade-enter-active">
                <div className="text-8xl animate-bounce-slow drop-shadow-[0_0_30px_rgba(255,215,0,0.3)]">🖋️</div>
                <h2 className="text-5xl lg:text-7xl font-bold serif text-gold italic">Gathering the Poets...</h2>
                <div className="flex gap-4 justify-center">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className={`w-8 h-8 rounded-full border-2 transition-all duration-700 ${players[i] ? 'bg-gold border-gold scale-125 shadow-[0_0_15px_rgba(255,215,0,0.5)]' : 'bg-white/5 border-white/20'}`} />
                    ))}
                </div>
                <div className="space-y-2">
                    <p className="text-white/40 uppercase tracking-[0.3em] font-black text-sm">Join the Mehfil at</p>
                    <p className="text-gold font-mono text-2xl lg:text-4xl font-black bg-white/5 px-8 py-4 rounded-2xl border border-white/10 select-all cursor-pointer hover:bg-white/10 transition-all">
                        {joinUrl.replace('http://', '').replace('https://', '')}
                    </p>
                </div>
            </div>
        )}

        {phase === 'reveal' && (
            <div className="space-y-8 animate-scale-up">
                <h2 className="text-6xl lg:text-8xl font-black italic serif text-emerald-100 uppercase tracking-tighter">The Fate is Sealed</h2>
                <div className="h-[2px] w-48 bg-gold mx-auto opacity-30" />
                <p className="text-gold/60 text-xl uppercase tracking-[0.5em] font-black">Check your screens in absolute silence</p>
            </div>
        )}

        {phase === 'mission' && (
            <div className="space-y-10 animate-fade-enter-active max-w-4xl text-center">
                {!gameState.mission_timer_end ? (
                    <div className="space-y-12 py-20">
                        <div className="text-[12rem] animate-bounce-slow drop-shadow-[0_0_80px_rgba(255,215,0,0.3)] select-none">🔱</div>
                        <div className="space-y-6">
                            <h2 className="text-6xl lg:text-8xl font-black italic serif text-gold uppercase tracking-tighter">Preparing the Logic...</h2>
                            <p className="text-white/40 text-2xl uppercase tracking-[0.5em] font-black">The Sultan is selecting the poetic challenge</p>
                        </div>
                    </div>
                ) : timeLeft > 90 ? (
                    <div className="space-y-12 py-20 animate-pulse">
                        <div className="text-[12rem] select-none opacity-20">🌙</div>
                        <div className="space-y-6">
                            <h2 className="text-6xl lg:text-9xl font-black italic serif text-white uppercase tracking-widest">Close Your Eyes</h2>
                            <p className="text-gold/40 text-2xl uppercase tracking-[0.5em] font-black">Plagiarists are receiving their assignments</p>
                            <div className="text-8xl font-black text-gold mt-10 serif italic">
                                {timeLeft - 90}s
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex flex-col items-center gap-6 mb-10">
                            <h2 className="text-4xl uppercase tracking-[0.5em] text-gold font-black opacity-40">Mission Count Down</h2>
                            <div className={`text-[12rem] font-black leading-none italic serif transition-all duration-500 shadow-gold/20 drop-shadow-2xl ${timeLeft <= 10 ? 'text-red-500 animate-pulse scale-110' : 'text-white'}`}>
                                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                            </div>
                        </div>
                        
                        <div className="glass p-20 rounded-[4rem] border-4 border-gold/20 bg-white/5 relative overflow-hidden group shadow-2xl">
                            <div className="absolute inset-0 bg-gold/5 animate-pulse" />
                            <div className="relative z-10">
                                <div className="text-6xl mb-12 opacity-80 group-hover:scale-110 transition-transform duration-1000">🔱</div>
                                <p className="text-4xl lg:text-6xl font-bold serif leading-tight text-white mb-6 italic">Watch closely for any sabotage in the verse...</p>
                            </div>
                        </div>
                    </>
                )}
            </div>
        )}

        {phase === 'majlis' && (
            <div className="space-y-10 animate-fade-enter-active w-full max-w-6xl">
                {!gameState.tie_protocol || gameState.tie_protocol === 'none' ? (
                    <>
                        <h2 className="text-7xl lg:text-9xl font-black italic serif text-gold tracking-tighter uppercase italic drop-shadow-2xl">The Majlis</h2>
                        <p className="text-2xl text-white/50 uppercase tracking-[0.4em] font-black underline underline-offset-8 decoration-gold/30">Debate. Suspect. Banish.</p>
                        <div className="grid grid-cols-4 gap-6 pt-20">
                            {players.filter(p => p.status === 'alive').map(p => (
                                <div key={p.id} className="glass p-8 rounded-3xl border border-white/10 shadow-xl hover:border-gold/30 transition-all">
                                    <div className="text-2xl font-bold serif italic text-emerald-100">{p.name}</div>
                                    <div className="text-[10px] uppercase tracking-widest text-white/20 mt-2 font-black">Present</div>
                                </div>
                            ))}
                        </div>
                    </>
                ) : gameState.tie_protocol === 'decree' ? (
                    <div className="space-y-12 animate-scale-up py-20">
                         <div className="text-[12rem] animate-pulse drop-shadow-[0_0_80px_rgba(255,215,0,0.3)]">👑</div>
                         <div className="space-y-6">
                            <h2 className="text-6xl lg:text-8xl font-black italic serif text-gold uppercase tracking-tighter">The Sultan is Deliberating</h2>
                            <p className="text-white/40 text-2xl uppercase tracking-[0.5em] font-black">Hold your breath. The final decree is being established.</p>
                         </div>
                    </div>
                ) : gameState.tie_protocol === 'revote' ? (
                    <div className="space-y-12 animate-fade-enter-active py-20">
                         <h2 className="text-7xl lg:text-9xl font-black italic serif text-red-500 uppercase tracking-tighter animate-pulse">TIE DETECTED</h2>
                         <p className="text-white/60 text-3xl uppercase tracking-[0.3em] font-black">Final Deliberation: {gameState.tied_player_ids?.map(id => players.find(p => p.id === id)?.name).join(' vs ')}</p>
                         <div className="flex justify-center gap-10 pt-10">
                            {gameState.tied_player_ids?.map(id => {
                                const p = players.find(p => p.id === id);
                                return (
                                    <div key={id} className="glass p-12 rounded-[3rem] border-4 border-gold/20 bg-gold/5 min-w-[300px]">
                                        <div className="text-5xl font-black serif italic text-white mb-4">{p?.name}</div>
                                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                            <div className="h-full bg-gold animate-shimmer w-full" />
                                        </div>
                                    </div>
                                );
                            })}
                         </div>
                    </div>
                ) : gameState.tie_protocol === 'spin' ? (
                    <div className="space-y-12 animate-fade-enter-active py-10 flex flex-col items-center">
                         <h2 className="text-6xl lg:text-8xl font-black italic serif text-red-500 uppercase tracking-tighter">The Pen of Fate</h2>
                         
                         <div className="relative w-[600px] h-[600px] flex items-center justify-center">
                            {/* Tied Players in a Circle */}
                            {gameState.tied_player_ids?.map((id, i) => {
                                const p = players.find(p => p.id === id);
                                const angle = (i * 360) / (gameState.tied_player_ids?.length || 1);
                                return (
                                    <div 
                                        key={id} 
                                        className="absolute transform -translate-x-1/2 -translate-y-1/2 glass p-8 rounded-2xl border-2 border-white/10 min-w-[180px]"
                                        style={{ 
                                            left: `${50 + 40 * Math.cos((angle * Math.PI) / 180)}%`,
                                            top: `${50 + 40 * Math.sin((angle * Math.PI) / 180)}%`
                                        }}
                                    >
                                        <div className="text-2xl font-black serif italic text-white">{p?.name}</div>
                                    </div>
                                );
                            })}

                            {/* The Spinning Pen */}
                            <div className="w-64 h-64 relative animate-spin-slow duration-[3000ms]">
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-48 bg-gradient-to-b from-red-600 via-gold to-transparent rounded-full shadow-[0_0_30px_rgba(255,0,0,0.5)]">
                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 text-4xl">✒️</div>
                                </div>
                            </div>
                         </div>
                         <p className="text-white/40 text-2xl uppercase tracking-[0.5em] font-black animate-pulse">Fate is deciding the Plagiarist...</p>
                    </div>
                ) : null}
            </div>
        )}

        {phase === 'night' && (
            <div className="space-y-8 animate-pulse text-gray-500">
                <div className="text-[10rem] mb-10 opacity-30 select-none">🌙</div>
                <h2 className="text-8xl font-black serif italic tracking-tighter">The City Sleeps...</h2>
                <p className="text-xl uppercase tracking-[1em] font-black opacity-20">Silence descending upon Hyderabad</p>
            </div>
        )}

        {phase === 'end' && (
            <div className="space-y-12 animate-scale-up">
                <div className="text-[12rem] mb-10 drop-shadow-[0_0_80px_rgba(255,215,0,0.5)] animate-bounce-slow">🏆</div>
                <h2 className="text-9xl font-black serif text-gold uppercase tracking-tighter italic drop-shadow-2xl">
                  {gameState.winner_faction === 'poets' ? 'The Poets Have Prevailed' : 'The Plagiarists Rule the City'}
                </h2>
                <div className="flex justify-center gap-24 items-end pt-10">
                    <div className="text-center group">
                        <div className="text-9xl font-black text-white italic serif group-hover:text-gold transition-colors duration-500">₹{gameState.eidi_pot}</div>
                        <div className="text-sm uppercase tracking-[0.3em] text-gold/60 font-black mt-4 border-t border-gold/20 pt-4">Total Eidi Pot Distributed</div>
                    </div>
                </div>
            </div>
        )}

      </div>

      {/* FOOTER: LIVE POT STATUS */}
      <footer className="p-8 lg:p-16 border-t border-white/5 flex justify-between items-end bg-black/60 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
        <div className="flex flex-col gap-6">
            <div className="flex items-center gap-4">
                <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                <div className="text-xs uppercase font-black text-white/40 tracking-[0.4em]">Mehfil Central Server Live</div>
            </div>
            <div className="px-8 py-3 bg-emerald-950/40 text-emerald-400 rounded-2xl border border-emerald-500/20 font-black uppercase tracking-widest text-sm shadow-inner">
                Current Phase: <span className="text-white ml-2">{phase.replace('_', ' ')}</span>
            </div>
        </div>
        <div className="flex items-center gap-12">
            <div className="text-right">
                <div className="text-[10px] uppercase font-black text-gold/40 tracking-widest mb-2 font-mono">Real-time Pot Balance</div>
                <div className="text-7xl font-black text-gold drop-shadow-[0_0_20px_rgba(255,215,0,0.3)]">₹{gameState.eidi_pot}</div>
            </div>
        </div>
      </footer>
    </main>
  );
}
