'use client';

export const dynamic = 'force-dynamic';

import { useParams } from 'next/navigation';
import { useGameState } from '@/hooks/useGameState';
import { usePlayers } from '@/hooks/usePlayers';
import { supabase } from '@/lib/supabase';
import { useState, useEffect } from 'react';
import { Mission } from '@/lib/game-logic';

export default function PlayerClient() {
  const { roomCode } = useParams() as { roomCode: string };
  const { gameState, loading: gameLoading } = useGameState(roomCode);
  const roomId = gameState?.id;
  const { players, loading: playersLoading } = usePlayers(roomId || '');
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [showRole, setShowRole] = useState(false);
  const [votedId, setVotedId] = useState<string | null>(null);
  const [activeMission, setActiveMission] = useState<Mission | null>(null);

  useEffect(() => {
    setPlayerId(localStorage.getItem('playerId'));
  }, []);

  // Fetch Mission Details
  useEffect(() => {
    if (gameState?.current_mission_id) {
      const fetchMission = async () => {
        const { data } = await supabase
          .from('missions')
          .select('*')
          .eq('id', gameState.current_mission_id)
          .single();
        if (data) setActiveMission(data);
      };
      fetchMission();
    } else {
      setActiveMission(null);
    }
  }, [gameState?.current_mission_id]);

  // Reset local voted state if votes are cleared in DB (for Re-Vote)
  useEffect(() => {
    if (roomId && playerId && gameState?.current_phase === 'majlis') {
        const checkVote = async () => {
            const { data } = await supabase
                .from('votes')
                .select('*')
                .eq('room_id', roomId)
                .eq('voter_id', playerId)
                .maybeSingle();
            
            if (!data) {
                setVotedId(null);
            } else {
                setVotedId(data.target_id);
            }
        };
        checkVote();

        // Subscribe to vote changes for this user
        const channel = supabase.channel(`user-votes:${playerId}`)
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'votes', 
                filter: `voter_id=eq.${playerId}` 
            }, (payload) => {
                if (payload.eventType === 'DELETE') {
                    setVotedId(null);
                } else if (payload.new) {
                    setVotedId((payload.new as any).target_id);
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }
  }, [roomId, playerId, gameState?.current_phase, gameState?.tie_protocol]);

  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!gameState?.mission_timer_end || gameState.current_phase !== 'mission') {
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

  if (gameLoading || playersLoading || !playerId) {
    return <div className="min-h-screen bg-crimson-black flex items-center justify-center text-white">Loading...</div>;
  }

  const me = players.find(p => p.id === playerId);
  if (!me) return <div className="min-h-screen bg-crimson-black text-white p-10 text-center uppercase tracking-widest font-bold">Poet not found in this Mehfil.</div>;

  const isTraitor = me.role === 'naqal_baaz';
  const isAlive = me.status === 'alive';
  const isBlindfoldPhase = timeLeft > 90;

  const handleVote = async (targetId: string, roundType: 'majlis' | 'night' = 'majlis') => {
    if (votedId || !roomId) return;
    setVotedId(targetId);
    
    await supabase.from('votes').insert([{
        room_id: roomId,
        round_id: roundType === 'night' ? 99 : (gameState?.current_round || 1), 
        voter_id: playerId,
        target_id: targetId
    }]);
  };

  const handleSabotageTrigger = async () => {
    if (!roomId) return;
    await supabase.from('game_rooms').update({ sabotage_triggered: true }).eq('id', roomId);
  };

  const RoleBadge = () => (
    <div className={`fixed top-4 left-4 z-50 px-3 py-1.5 rounded-full border backdrop-blur-md shadow-lg animate-fade-enter-active flex items-center gap-2 ${
        isTraitor ? 'bg-red-950/40 border-red-500/30' : 'bg-emerald-950/40 border-emerald-500/30'
    }`}>
        <div className={`w-2 h-2 rounded-full animate-pulse ${isTraitor ? 'bg-red-500' : 'bg-emerald-500'}`} />
        <span className="text-[10px] uppercase font-black tracking-[0.2em] text-white/80">
            {me.role.replace('_', ' ')}
        </span>
    </div>
  );

  // --- LOBBY PHASE ---
  if (gameState?.current_phase === 'lobby') {
    return (
      <main className="min-h-screen bg-emerald-deep text-white p-6 flex flex-col items-center justify-center text-center animate-fade-enter-active">
        <div className="glass p-10 rounded-full w-48 h-48 flex items-center justify-center text-6xl mb-8 animate-pulse">🖋️</div>
        <h1 className="text-4xl font-bold text-gold mb-2 serif">Welcome, {me.name}</h1>
        <p className="text-emerald-100/60 italic max-w-xs transition-all">Waiting for the Sultan to gather all the poets... ({players.length}/8)</p>
      </main>
    );
  }

  // --- REVEAL PHASE ---
  if (gameState?.current_phase === 'reveal') {
    return (
      <main 
        onClick={() => setShowRole(true)}
        className={`min-h-screen flex flex-col items-center justify-center p-6 text-center transition-colors duration-1000 ${
            showRole ? (isTraitor ? 'bg-crimson-black' : 'bg-emerald-deep') : 'bg-black'
        }`}
      >
        <RoleBadge />
        {!showRole ? (
          <div className="animate-bounce-slow text-white">
            <p className="text-xl mb-4 italic opacity-50 font-serif">Tap to reveal your fate</p>
            <div className="w-20 h-20 border-2 border-white/20 rounded-full mx-auto flex items-center justify-center font-bold text-2xl">?</div>
          </div>
        ) : (
          <div className="animate-scale-up">
            <h2 className="text-gold text-lg uppercase tracking-widest mb-2 font-black">You are a</h2>
            <h1 className="text-7xl font-bold text-white mb-6 serif uppercase tracking-tighter">{me.role.replace('_', ' ')}</h1>
            <p className="text-white/60 mb-8 max-w-xs mx-auto text-sm italic serif">
                {isTraitor 
                    ? "The Shadows call. Sabotage the mission without being caught by the faithful poets."
                    : "The Verse is sacred. Collaborate on missions and identify the imposters among you."}
            </p>
          </div>
        )}
      </main>
    );
  }

  // --- MISSION PHASE ---
  if (gameState?.current_phase === 'mission') {
    if (!gameState.mission_timer_end) {
      return (
        <main className="min-h-screen bg-slate-900 text-white p-6 flex flex-col items-center justify-center text-center animate-fade-enter-active">
          <RoleBadge />
          <div className="glass p-12 rounded-full w-48 h-48 flex items-center justify-center text-6xl mb-12 animate-bounce-slow border-4 border-gold/20 shadow-[0_0_50px_rgba(255,215,0,0.1)]">⚜️</div>
          <h1 className="text-4xl font-bold text-gold mb-4 serif">The Sultan is Preparing...</h1>
          <p className="text-white/40 italic max-w-xs font-serif leading-relaxed">Wait for the Sultan to announce the poetic challenge and start the mission timer.</p>
        </main>
      );
    }

    if (isBlindfoldPhase && !isTraitor) {
      return (
        <main className="min-h-screen bg-black text-white p-6 flex flex-col items-center justify-center text-center animate-fade-enter-active">
          <RoleBadge />
          <div className="text-8xl mb-12 animate-pulse opacity-20">🌙</div>
          <h1 className="text-4xl font-black text-gray-700 serif uppercase tracking-tighter mb-4">Close Your Eyes</h1>
          <p className="text-gray-800 italic uppercase tracking-[0.3em] font-black text-xs">The Sultan is revealing the logic to the Plagiarists...</p>
          <div className="mt-20 text-gold/20 font-black text-6xl italic serif animate-pulse">
            {timeLeft - 90}s
          </div>
        </main>
      );
    }

    return (
      <main className="min-h-screen bg-slate-900 text-white p-6 flex flex-col justify-between overflow-hidden">
        <RoleBadge />
        <div className="space-y-6">
            <header className="flex justify-between items-center text-white/40 uppercase tracking-widest text-[10px] font-bold">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span>{isBlindfoldPhase ? 'PREPARATION PHASE' : 'MISSION ACTIVE'}</span>
                </div>
                <div className="text-gold font-mono text-xl">
                    {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                </div>
            </header>
            
            {activeMission ? (
              <section className="glass p-8 rounded-3xl border border-white/10 shadow-2xl bg-white/5 animate-fade-enter-active">
                  <h3 className="text-gold uppercase text-[10px] tracking-widest mb-2 font-black">Current Objective</h3>
                  <h2 className="text-3xl font-bold mb-4 serif leading-tight italic">{activeMission.title}</h2>
                  <p className="text-gray-400 text-sm font-serif">"{activeMission.public_goal}"</p>
              </section>
            ) : (
              <div className="p-10 text-center text-gray-500 italic">Waiting for the Sultan to announce the logic...</div>
            )}

            {isTraitor && isAlive && activeMission && (
                <section className="bg-red-950/40 border-2 border-red-500/30 p-8 rounded-3xl animate-fade-enter-active">
                    <h3 className="text-red-500 uppercase text-[10px] tracking-widest mb-4 font-black">Secret Sabotage</h3>
                    <p className="text-red-100 text-xl font-serif italic mb-10">"{activeMission.secret_sabotage}"</p>
                    
                    <button 
                        onClick={handleSabotageTrigger}
                        disabled={gameState.sabotage_triggered || isBlindfoldPhase}
                        className={`btn-premium w-full py-6 rounded-2xl shadow-2xl transition-all ${
                            gameState.sabotage_triggered || isBlindfoldPhase ? 'bg-gray-800 text-gray-500 border-gray-900' : 'bg-red-600 text-white border-red-500'
                        }`}
                    >
                        {gameState.sabotage_triggered ? 'Sabotage Triggered' : isBlindfoldPhase ? 'Wait for Timer...' : 'Complete Sabotage'}
                    </button>
                    {isBlindfoldPhase && (
                        <p className="text-[10px] text-red-500/40 uppercase font-black text-center mt-4 tracking-widest">You have 60s to prepare. Assignment revealed above.</p>
                    )}
                </section>
            )}
        </div>

        {!isAlive && (
            <div className="bg-black/80 backdrop-blur-md p-10 rounded-3xl text-center border border-white/5">
                <p className="text-red-500 font-bold serif italic text-xl">You are {me.status}.</p>
                <p className="text-gray-500 text-xs mt-2 uppercase">Silence is your only companion.</p>
            </div>
        )}
      </main>
    );
  }

  // --- MAJLIS (VOTING) PHASE ---
  if (gameState?.current_phase === 'majlis') {
    return (
        <main className="min-h-screen bg-slate-950 text-white p-6 relative overflow-hidden">
            <RoleBadge />

            {/* Tie Protocol Messaging */}
            {gameState.tie_protocol === 'decree' ? (
                <div className="flex flex-col items-center justify-center h-full space-y-8 animate-fade-enter-active">
                     <div className="text-9xl animate-pulse">👑</div>
                     <div className="text-center space-y-4">
                        <h2 className="text-4xl font-black serif text-gold italic">Sultan's Decree</h2>
                        <p className="text-white/40 uppercase tracking-[0.3em] font-black text-xs">The Sultan is deliberating. Maintain silence.</p>
                     </div>
                </div>
            ) : gameState.tie_protocol === 'spin' ? (
                <div className="flex flex-col items-center justify-center h-full space-y-8 animate-fade-enter-active">
                     <div className="text-9xl animate-spin-slow">✒️</div>
                     <div className="text-center space-y-4">
                        <h2 className="text-4xl font-black serif text-red-500 italic">The Pen of Fate</h2>
                        <p className="text-white/40 uppercase tracking-[0.3em] font-black text-xs">The Ink of destiny is spinning...</p>
                     </div>
                </div>
            ) : (
                <div className="space-y-8 animate-fade-enter-active">
                    <header className="text-center space-y-2">
                        <h2 className="text-5xl font-black text-gold serif italic tracking-tighter uppercase">
                            {gameState.tie_protocol === 'revote' ? 'Re-Vote!' : 'The Majlis'}
                        </h2>
                        <p className="text-white/40 uppercase tracking-[0.4em] font-black text-[10px]">
                            {gameState.tie_protocol === 'revote' ? 'Choose carefully between the tied suspects' : 'Debate and Cast Your Vote'}
                        </p>
                    </header>

                    {votedId ? (
                        <div className="glass p-12 rounded-[3rem] border-2 border-gold/20 text-center space-y-6 animate-scale-up grayscale opacity-50">
                            <div className="text-6xl">🗳️</div>
                            <h3 className="text-2xl font-bold serif text-gold italic">Your Fate is Cast</h3>
                            <p className="text-white/40 text-xs uppercase tracking-widest">Wait for the Sultan's final judgment.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3">
                            {players
                                .filter(p => p.status === 'alive' && p.id !== playerId)
                                .filter(p => !gameState.tie_protocol || gameState.tie_protocol !== 'revote' || gameState.tied_player_ids?.includes(p.id))
                                .map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => handleVote(p.id)}
                                        className="btn-premium bg-white/5 p-8 rounded-[2rem] border-2 border-white/5 flex justify-between items-center group active:scale-95 transition-all"
                                    >
                                        <span className="text-2xl font-black serif italic text-emerald-100 group-hover:text-gold transition-colors">{p.name}</span>
                                        <span className="text-gold text-xs font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Banish 🖋️</span>
                                    </button>
                                ))
                            }
                        </div>
                    )}
                </div>
            )}
        </main>
    );
  }

  // --- NIGHT PHASE ---
  if (gameState?.current_phase === 'night') {
    const potentialVictims = players.filter(p => p.status === 'alive' && p.role === 'sukhan_war');

    return (
      <main className="min-h-screen bg-black text-white p-8 flex flex-col items-center justify-center text-center">
        <RoleBadge />
        {isTraitor && isAlive ? (
            <div className="w-full space-y-8 animate-fade-enter-active">
                <h1 className="text-red-600 font-black mb-4 uppercase tracking-[0.5em] text-[10px]">Zabaan-bandi</h1>
                <h2 className="text-4xl font-bold serif italic text-red-500">Pick a Voice to Silence</h2>
                {votedId ? (
                    <div className="text-gray-500 italic py-10">The order is given. Sleep now.</div>
                ) : (
                    <div className="grid grid-cols-1 gap-3 w-full max-w-xs mx-auto">
                        {potentialVictims.map(p => (
                            <button
                                key={p.id}
                                onClick={() => handleVote(p.id, 'night')}
                                className="btn-premium bg-red-950/40 border-red-900/50 p-6 rounded-2xl text-red-500 shadow-xl"
                            >
                                <span className="text-xl serif italic">{p.name}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        ) : (
            <div className="space-y-6 opacity-30 grayscale">
                <div className="text-6xl mb-8">🌙</div>
                <h2 className="text-5xl font-bold text-gray-500 serif italic uppercase tracking-tighter">Sleep...</h2>
            </div>
        )}
      </main>
    );
  }

  // --- END PHASE ---
  if (gameState?.current_phase === 'end') {
    const winners = gameState.winner_faction;
    const iWon = (winners === 'poets' && !isTraitor) || (winners === 'plagiarists' && isTraitor);

    return (
      <main className={`min-h-screen flex flex-col items-center justify-center p-8 text-center ${iWon ? 'bg-emerald-deep' : 'bg-red-950'}`}>
        <div className="glass p-10 rounded-3xl border border-white/20 animate-scale-up space-y-6">
            <h1 className="text-6xl font-black serif italic text-gold uppercase">{iWon ? 'Victory' : 'Defeat'}</h1>
            <p className="text-white text-xl uppercase tracking-widest font-black opacity-80 decoration-gold underline underline-offset-8">
                The {winners} have prevailed
            </p>
            <div className="pt-10 space-y-2">
                <div className="text-gold font-mono text-3xl font-black">₹{me.private_gold}</div>
                <div className="text-[10px] text-white/40 uppercase tracking-widest">Your Private Eidi Gold</div>
            </div>
        </div>
        <p className="mt-12 text-white/40 text-xs italic tracking-tighter uppercase font-bold">Wait for the Sultan to reset the Mehfil</p>
      </main>
    );
  }

  return null;
}
