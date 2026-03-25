'use client';

export const dynamic = 'force-dynamic';

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
      if (now >= target - 1000) {
        playBuzzer();
      }
    }
  }, [timeLeft, phase, gameState?.mission_timer_end]);

  if (gameLoading || playersLoading) return <div className="min-h-screen bg-crimson-black flex items-center justify-center text-gold serif italic text-4xl animate-pulse">Loading Mehfil...</div>;
  if (!gameState) return <div className="min-h-screen bg-crimson-black flex items-center justify-center text-red-500 font-bold">Room {roomCode} Not Found</div>;

  const joinUrl = `${origin}/?code=${roomCode}`;

  return (
    <main className="h-screen bg-crimson-black text-white flex flex-col overflow-hidden">
      
      <div className="h-1 bg-gradient-to-r from-gold via-emerald-deep to-gold w-full" />

      <header className="p-4 lg:p-10 flex justify-between items-start shrink-0">
        <div className="space-y-2">
            <h1 className="text-5xl lg:text-7xl font-black serif text-gold tracking-tighter uppercase leading-none italic drop-shadow-2xl">Mehfil-e-Khaas</h1>
            <div className="flex items-center gap-4 opacity-50">
                <span className="h-[1px] w-12 bg-white" />
                <span className="uppercase tracking-[0.5em] text-[10px] font-bold">Social Deduction Engine</span>
            </div>
        </div>
        
        <div className="text-right glass p-3 lg:p-6 rounded-2xl border border-gold/20 flex flex-col items-center shadow-2xl bg-gold/5 min-w-[140px] lg:min-w-[200px]">
            <div className="text-[10px] lg:text-xs uppercase font-black text-gold/60 tracking-widest mb-1">Room Code</div>
            <div className="text-4xl lg:text-6xl font-black tracking-tighter text-white leading-none drop-shadow-glow">{roomCode}</div>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center text-center p-4 lg:p-10 relative">
        
        {phase === 'lobby' && (
            <div className="space-y-8 animate-fade-enter-active">
                <div className="text-6xl animate-bounce-slow drop-shadow-[0_0_30px_rgba(255,215,0,0.3)]">🖋️</div>
                <h2 className="text-4xl lg:text-6xl font-bold serif text-gold italic">Gathering the Poets...</h2>
                <div className="flex gap-4 justify-center">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className={`w-6 h-6 rounded-full border-2 transition-all duration-700 ${players[i] ? 'bg-gold border-gold scale-125 shadow-[0_0_15px_rgba(255,215,0,0.5)]' : 'bg-white/5 border-white/20'}`} />
                    ))}
                </div>
                <div className="space-y-2">
                    <p className="text-white/40 uppercase tracking-[0.3em] font-black text-[10px]">Join the Mehfil at</p>
                    <p className="text-gold font-mono text-xl lg:text-3xl font-black bg-white/5 px-6 py-3 rounded-xl border border-white/10 select-all cursor-pointer hover:bg-white/10 transition-all">
                        {joinUrl.replace('http://', '').replace('https://', '')}
                    </p>
                </div>
            </div>
        )}

        {phase === 'reveal' && (
            <div className="space-y-6 animate-scale-up">
                <h2 className="text-5xl lg:text-7xl font-black italic serif text-emerald-100 uppercase tracking-tighter">The Fate is Sealed</h2>
                <div className="h-[1px] w-32 bg-gold mx-auto opacity-30" />
                <p className="text-gold/60 text-lg uppercase tracking-[0.5em] font-black">Check your screens in absolute silence</p>
            </div>
        )}

        {phase === 'mission' && (
            <div className="space-y-6 animate-fade-enter-active max-w-4xl text-center">
                {!gameState.mission_timer_end ? (
                    <div className="space-y-8 py-10">
                        <div className="text-8xl animate-bounce-slow drop-shadow-[0_0_80px_rgba(255,215,0,0.3)] select-none">🔱</div>
                        <div className="space-y-4">
                            <h2 className="text-5xl lg:text-7xl font-black italic serif text-gold uppercase tracking-tighter">Preparing the Logic...</h2>
                            <p className="text-white/40 text-xl uppercase tracking-[0.5em] font-black">The Sultan is selecting the poetic challenge</p>
                        </div>
                    </div>
                ) : timeLeft > 90 ? (
                    <div className="space-y-8 py-10 animate-pulse">
                        <div className="text-8xl select-none opacity-20">🌙</div>
                        <div className="space-y-4">
                            <h2 className="text-5xl lg:text-7xl font-black italic serif text-white uppercase tracking-widest">Close Your Eyes</h2>
                            <p className="text-gold/40 text-xl uppercase tracking-[0.5em] font-black">The Mehfil is reflected in silence...</p>
                            <div className="text-8xl font-black text-gold mt-10 serif italic">
                                {timeLeft - 90}s
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex flex-col items-center gap-2 lg:gap-6 mb-4 lg:mb-10">
                             <h2 className="text-sm lg:text-2xl uppercase tracking-[0.5em] text-gold font-black opacity-40">Mission Count Down</h2>
                            <div className={`text-6xl lg:text-[8rem] font-black leading-none italic serif transition-all duration-500 shadow-gold/20 drop-shadow-2xl ${timeLeft <= 10 ? 'text-red-500 animate-pulse scale-105' : 'text-white'}`}>
                                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                            </div>
                        </div>
                                                <div className="glass p-10 lg:p-14 rounded-[3rem] border-4 border-gold/20 bg-white/5 relative overflow-hidden group shadow-2xl">
                            <div className="absolute inset-0 bg-gold/5 animate-pulse" />
                            <div className="relative z-10">
                                <div className="text-4xl mb-6 opacity-80 group-hover:scale-110 transition-transform duration-1000">🔱</div>
                                <p className="text-3xl lg:text-4xl font-bold serif leading-tight text-white mb-4 italic">Watch closely for any sabotage in the verse...</p>
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
                         <h2 className="text-6xl lg:text-8xl font-black italic serif text-red-500 uppercase tracking-tighter drop-shadow-glow">The Pen of Fate</h2>
                         
                         <div className="relative w-[700px] h-[700px] flex items-center justify-center">
                            {/* Player Cards in Circle */}
                            {gameState.tied_player_ids?.map((id, i) => {
                                const p = players.find(p => p.id === id);
                                const tiedCount = gameState.tied_player_ids?.length || 1;
                                const angle = (i * 360) / tiedCount;
                                const isWinner = gameState.reveal_target_id === id;
                                
                                return (
                                    <div 
                                        key={id} 
                                        className={`absolute transform -translate-x-1/2 -translate-y-1/2 glass p-10 rounded-[2.5rem] border-4 transition-all duration-1000 min-w-[220px] text-center ${
                                            isWinner ? 'border-gold scale-125 shadow-[0_0_100px_rgba(255,215,0,0.4)] z-50 bg-gold/10' : 'border-white/10 opacity-30 scale-90 grayscale'
                                        }`}
                                        style={{ 
                                            left: `${50 + 44 * Math.cos((angle * Math.PI) / 180)}%`,
                                            top: `${50 + 44 * Math.sin((angle * Math.PI) / 180)}%`
                                        }}
                                    >
                                        <div className={`text-4xl font-black serif italic tracking-tight ${isWinner ? 'text-gold' : 'text-white'}`}>{p?.name}</div>
                                        {isWinner && <div className="text-[12px] text-gold font-black uppercase tracking-[0.3em] mt-3 animate-bounce-slow">The Seal is Set</div>}
                                    </div>
                                );
                            })}

                             {/* THE PEN OF FATE */}
                             {(() => {
                                 const tiedIds = gameState?.tied_player_ids || [];
                                 const winnerIndex = (gameState?.reveal_target_id && tiedIds.length > 0) ? tiedIds.indexOf(gameState.reveal_target_id) : -1;
                                 const hasWinner = winnerIndex !== -1;
                                 
                                 // 0 degrees is Right (3 o'clock)
                                 // The Pen tip is at Top (12 o'clock) relative to its center pivot
                                 // To point at 0 degrees, we need rotate(90deg)
                                 const baseRotation = 90;
                                 const targetAngle = hasWinner ? (winnerIndex * 360 / tiedIds.length) : 0;
                                 const rotations = 360 * 12; // 12 full cycles for drama
                                 const finalRotation = hasWinner ? (rotations + targetAngle + baseRotation) : 0;

                                 return (
                                     <div 
                                         key={hasWinner ? `winner-${gameState.reveal_target_id}` : 'spinning'}
                                         className={`w-96 h-96 relative flex items-center justify-center transition-all ${hasWinner ? 'animate-spin-to-stop' : 'animate-spin-slow'}`}
                                         style={{ 
                                             '--target-rotation': `${finalRotation}deg`,
                                             transformOrigin: 'center center'
                                         } as any}
                                     >
                                         {/* Outer Ring Decoration */}
                                         <div className="absolute inset-0 rounded-full border border-white/5 animate-pulse" />
                                         
                                         {/* Pen Handle & Body */}
                                         <div className="absolute top-0 bottom-1/2 left-1/2 -translate-x-1/2 w-8 bg-gradient-to-b from-red-600 via-gold to-red-900 rounded-full shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col items-center">
                                             {/* The Nib / Tip - Specifically aligned to point precisely */}
                                             <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-7xl select-none filter drop-shadow-[0_0_15px_rgba(255,215,0,0.7)]">
                                                 ✒️
                                             </div>
                                         </div>
                                         
                                         {/* Center Pivot Point */}
                                         <div className="w-12 h-12 rounded-full bg-gold border-[6px] border-red-950 z-20 shadow-[0_0_30px_rgba(255,215,0,0.3)]" />
                                     </div>
                                 );
                             })()}
                         </div>
                         <p className="text-white/40 text-2xl uppercase tracking-[0.5em] font-black animate-pulse bg-white/5 px-10 py-3 rounded-full border border-white/5">
                            {gameState.reveal_target_id ? "The Ink of Fate has dried." : "Fate is deciding the Plagiarist..."}
                         </p>
                    </div>
                ) : null}
            </div>
        )}

        {phase === 'night' && (
            <div className="space-y-6 animate-pulse text-gray-500">
                <div className="text-8xl mb-6 opacity-30 select-none">🌙</div>
                <h2 className="text-6xl font-black serif italic tracking-tighter">The City Sleeps...</h2>
                <div className="overflow-hidden whitespace-nowrap border-y border-red-950/30 py-3 bg-red-950/10">
                    <div className="inline-block animate-marquee-slow min-w-[200%]">
                        <span className="text-red-600/60 text-lg uppercase tracking-[1em] font-black mx-20">"The court has fallen. The Plagiarists rule the night."</span>
                        <span className="text-red-600/60 text-lg uppercase tracking-[1em] font-black mx-20">"The court has fallen. The Plagiarists rule the night."</span>
                    </div>
                </div>
            </div>
        )}


        {phase === 'end' && (
                 <div className="flex-1 flex flex-col items-center justify-center w-full max-w-6xl animate-scale-up overflow-hidden py-4">
                    <div className="text-4xl lg:text-6xl mb-2 drop-shadow-[0_0_80px_rgba(255,215,0,0.5)] animate-bounce-slow">🏆</div>
                    <h2 className="text-3xl lg:text-6xl font-black serif text-gold uppercase tracking-tighter italic drop-shadow-2xl text-center leading-tight">
                        {gameState.winner_faction === 'poets' ? 'The Sukhan-war (Poets) prevail!' : 'The Naqal-baaz (Plagiarists) rule the City!'}
                    </h2>

                    {gameState.winner_faction === 'poets' && (
                        <div className="mt-4 space-y-1 animate-fade-enter-active text-center shrink-0">
                            <p className="text-lg lg:text-2xl font-serif text-white/80 italic leading-snug">
                                "Saff-e-Matam Na Bichao Ke Sukhan Zinda Hai, Ahl-e-Zauq Dekh Lo, Har Lafz-e-Kohan Zinda Hai."
                            </p>
                            <p className="text-[10px] lg:text-xs uppercase tracking-[0.4em] text-gold/40 font-black">
                                (Do not mourn, for the Word is alive; the ancient verse lives.)
                            </p>
                        </div>
                    )}
                    
                    <div className="w-full mt-4 space-y-4 flex-1 overflow-hidden flex flex-col min-h-0">
                        <div className="flex justify-between items-center border-b border-gold/10 pb-2 shrink-0">
                            <h3 className="text-gold/40 uppercase tracking-[0.5em] font-black text-[10px]">Wealth Distribution</h3>
                            <div className="text-right">
                                <span className="text-[10px] text-white/40 uppercase font-black tracking-widest mr-2">Eidi Pot:</span>
                                <span className="text-2xl font-black text-white italic serif">₹{gameState.eidi_pot > 0 ? gameState.eidi_pot : (gameState.last_game_pot || 0)}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 lg:gap-4 overflow-y-auto pr-2 pb-4 scrollbar-hide">
                            {[...players].sort((a, b) => (b.private_gold || 0) - (a.private_gold || 0)).map((p, i) => {
                                const isWinner = p.role === 'sukhan_war' && p.status === 'alive';
                                const isPlagiarist = p.role === 'naqal_baaz';
                                
                                return (
                                    <div key={p.id} className={`glass flex items-center justify-between p-3 lg:p-4 rounded-xl border transition-all duration-700 ${isWinner ? 'bg-gold/10 border-gold/20' : 'border-white/5 opacity-60'}`}>
                                        <div className="flex items-center gap-3 lg:gap-4 overflow-hidden">
                                            <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${i === 0 ? 'bg-gold text-black' : 'bg-white/10 text-white'}`}>
                                                #{i + 1}
                                            </div>
                                            <div className="text-left truncate">
                                                <div className={`text-lg lg:text-xl font-black serif italic truncate ${isWinner ? 'text-white' : 'text-white/60'}`}>{p.name}</div>
                                                <div className="flex gap-2 items-center">
                                                    <span className={`text-[8px] uppercase font-black tracking-widest ${isPlagiarist ? 'text-red-500' : 'text-emerald-500'}`}>{p.role.replace('_', ' ')}</span>
                                                    <span className="text-[8px] uppercase font-black tracking-widest text-white/20 whitespace-nowrap">{p.status}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="text-[8px] uppercase font-black text-gold/60 tracking-widest">Share</div>
                                            <div className="text-lg lg:text-xl font-mono font-black text-gold">₹{p.private_gold || 0}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

      </div>

      {phase === 'payout' && (
        <div className="fixed inset-0 z-[150] bg-crimson-black flex flex-col items-center justify-center p-4 lg:p-12 overflow-hidden">
            <div className="max-w-6xl w-full space-y-4 lg:space-y-6 animate-fade-enter-active flex flex-col max-h-full">
                <div className="text-center space-y-4">
                    <h2 className="text-3xl lg:text-6xl font-black serif text-gold uppercase tracking-tighter italic drop-shadow-[0_0_30px_rgba(255,215,0,0.4)]">
                        The Final Gathering
                    </h2>
                    <div className="h-1 lg:h-2 w-32 lg:w-48 bg-gold/40 mx-auto rounded-full" />
                    <p className="text-gold/60 text-[10px] lg:text-sm uppercase font-black tracking-[0.4em]">Cumulative Wealth Distribution</p>
                </div>

                <div className="grid grid-cols-2 gap-3 lg:gap-4 overflow-y-auto pr-2 pb-4 scrollbar-hide py-2 flex-1">
                    {players.sort((a, b) => (b.gathering_gold || 0) - (a.gathering_gold || 0)).map((p, idx) => (
                        <div key={p.id} className="glass p-4 lg:p-6 rounded-2xl border border-gold/20 flex items-center justify-between transition-all duration-300">
                            <div className="flex items-center gap-6 lg:gap-12">
                                <span className={`text-2xl lg:text-4xl font-black italic ${idx < 3 ? 'text-gold' : 'text-gray-600'}`}>
                                    #{idx + 1}
                                </span>
                                <div className="space-y-1">
                                    <div className="text-lg lg:text-2xl font-black text-white">{p.name} {p.status === 'banished' ? '👻' : ''}</div>
                                    <div className="text-xs lg:text-sm text-gray-500 uppercase font-bold tracking-widest">{p.role === 'naqal_baaz' ? 'Plagiarist' : 'Poet'}</div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] uppercase font-black text-gold/40 tracking-widest mb-1">Total Wealth</div>
                                <div className="text-xl lg:text-3xl font-mono font-black text-gold">₹{p.gathering_gold || 0}</div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="text-center py-2">
                    <p className="text-white/20 text-[10px] lg:text-xs italic font-serif">"Wealth is but ink on paper, but a legacy lasts forever."</p>
                </div>
            </div>
        </div>
      )}

      <footer className="fixed bottom-0 left-0 right-0 p-6 lg:p-12 flex justify-between items-end bg-gradient-to-t from-black/80 to-transparent pointer-events-none z-50">
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
                <div className="text-[8px] lg:text-[10px] uppercase font-black text-gold/40 tracking-widest mb-1 lg:mb-2 font-mono">Real-time Pot Balance</div>
                <div className="text-4xl lg:text-7xl font-black text-gold drop-shadow-[0_0_20px_rgba(255,215,0,0.3)]">₹{phase === 'lobby' ? 0 : (gameState.eidi_pot > 0 ? gameState.eidi_pot : (gameState.last_game_pot || 0))}</div>
            </div>
        </div>
      </footer>
      {gameState.is_revealing && (
        <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center p-6 lg:p-20 text-center animate-fade-enter-active">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(220,38,38,0.2)_0%,transparent_70%)] animate-pulse" />
            
            <div className="relative space-y-6 lg:space-y-12 animate-scale-up max-w-full">
                <div className="space-y-2 lg:space-y-4">
                    <h3 className="text-red-600 font-black uppercase tracking-[0.5em] lg:tracking-[1em] text-sm lg:text-2xl animate-marquee-slow">Al-Shams: Breaking News</h3>
                    <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-red-600 to-transparent" />
                </div>

                <div className="space-y-3 lg:space-y-6">
                   <h2 className="text-4xl md:text-6xl lg:text-9xl font-black serif italic text-white uppercase tracking-tighter drop-shadow-[0_0_50px_rgba(220,38,38,0.5)]">
                     A Voice is Stolen
                   </h2>
                   <p className="text-red-500/60 text-lg lg:text-3xl uppercase tracking-[0.3em] lg:tracking-[0.5em] font-black italic">Consensus in the Darkness</p>
                </div>

                {gameState.reveal_target_id && (
                  <div className="glass p-8 lg:p-16 rounded-[2rem] lg:rounded-[4rem] border-2 lg:border-4 border-red-500/30 bg-red-950/20 shadow-[0_0_100px_rgba(220,38,38,0.3)] animate-bounce-subtle">
                      <div className="text-5xl lg:text-8xl font-black serif italic text-red-100 mb-2 lg:mb-4 uppercase">
                        {players.find(p => p.id === gameState.reveal_target_id)?.name}
                      </div>
                      <p className="text-red-500 font-black text-xl lg:text-2xl uppercase tracking-widest">Has Been Silenced</p>
                  </div>
                )}

                <div className="pt-10 lg:pt-20 text-white/20 text-sm lg:text-xl italic font-serif">
                   "The Mehfil continues, but one ink-well has run dry..."
                </div>
            </div>
        </div>
      )}
    </main>
  );
}
