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

  useEffect(() => {
    if (typeof window !== 'undefined' && roomId) {
        const revealed = localStorage.getItem(`mehfil_role_revealed_${roomId}`);
        if (revealed === 'true') {
            setShowRole(true);
        }
    }
  }, [roomId]);

  const handleReveal = () => {
    setShowRole(true);
    if (typeof window !== 'undefined' && roomId) {
        localStorage.setItem(`mehfil_role_revealed_${roomId}`, 'true');
    }
  };
  const [votedId, setVotedId] = useState<string | null>(null);
  const [activeMission, setActiveMission] = useState<Mission | null>(null);
  const [nightVotes, setNightVotes] = useState<any[]>([]);

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

  const me = players.find(p => p.id === playerId);
  const isTraitor = me?.role === 'naqal_baaz';

  // Realtime subscription for coordination
  useEffect(() => {
    if (gameState?.current_phase === 'night' && isTraitor && roomId) {
        const fetchNightVotes = async () => {
            const { data } = await supabase.from('night_votes').select('*').eq('room_id', roomId);
            if (data) setNightVotes(data);
        };
        fetchNightVotes();

        const channel = supabase.channel('night-votes-sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'night_votes', filter: `room_id=eq.${roomId}` }, () => {
                fetchNightVotes();
            })
            .subscribe();
        
        return () => { supabase.removeChannel(channel); };
    }
  }, [gameState?.current_phase, isTraitor, roomId]);

  if (gameLoading || playersLoading || !playerId) {
    return (
      <div className="h-screen w-full bg-crimson-black flex flex-col items-center justify-center text-white overflow-hidden">
        <div className="w-16 h-16 border-4 border-gold/20 border-t-gold rounded-full animate-spin mb-4"></div>
        <p className="text-gold/60 text-xs uppercase font-black tracking-widest animate-pulse font-serif italic">Entering the Mehfil...</p>
      </div>
    );
  }

  if (!me) return (
    <div className="h-screen w-full bg-crimson-black text-white p-10 flex flex-col items-center justify-center text-center overflow-hidden">
        <h1 className="text-4xl font-black serif text-gold mb-4 italic uppercase tracking-tighter shadow-gold/10">Poet not found.</h1>
        <p className="text-white/40 mb-8 italic serif">Your seat in this Mehfil seems to have vanished.</p>
        <button 
            onClick={() => window.location.href = '/'}
            className="btn-premium bg-gold text-black py-4 px-8 rounded-2xl active:scale-95 transition-all text-xs font-black uppercase tracking-widest"
        >
            Return to Entrance
        </button>
    </div>
  );

  const isAlive = me.status === 'alive';
  const isBlindfoldPhase = timeLeft > 90;

  const handleVote = async (targetId: string, roundType: 'majlis' | 'night' = 'majlis') => {
    if (votedId || !roomId || me.status !== 'alive') return;
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

  const handleNightVote = async (targetId: string) => {
    if (!roomId || !playerId || votedId === targetId) return;
    setVotedId(targetId);
    
    // Using upsert for night_votes (room_id, voter_id is unique)
    const { error } = await supabase.from('night_votes').upsert([{
        room_id: roomId,
        voter_id: playerId,
        target_id: targetId
    }]);
    if (error) console.error("Night vote error:", error);
  };

  const alivePoetsCount = players.filter(p => p.role === 'sukhan_war' && p.status === 'alive').length;
  const potentialShare = alivePoetsCount > 0 ? Math.floor((gameState?.eidi_pot || 0) / alivePoetsCount) : 0;

  const RoleBadge = () => {
    if (!showRole) return null;
    return (
      <div className={`fixed top-4 left-4 z-50 px-3 py-1.5 rounded-full border backdrop-blur-md shadow-lg animate-fade-enter-active flex items-center gap-2 ${
          isTraitor ? 'bg-red-950/40 border-red-500/30' : 'bg-emerald-950/40 border-emerald-500/30'
      }`}>
          <div className={`w-2 h-2 rounded-full animate-pulse ${isTraitor ? 'bg-red-500' : 'bg-emerald-500'}`} />
          <span className="text-[10px] uppercase font-black tracking-[0.2em] text-white/80">
              {me.role.replace('_', ' ')}
          </span>
      </div>
    );
  };

  const GoldBadge = () => (
    <div className="fixed top-4 right-4 z-50 px-4 py-2 rounded-2xl bg-black/40 border border-gold/20 backdrop-blur-md shadow-xl animate-fade-enter-active flex flex-col items-end">
        <div className="flex items-center gap-2">
            <span className="text-gold font-mono font-black">₹{me.private_gold}</span>
            <span className="text-[8px] uppercase font-black text-white/40 tracking-widest">My Gold</span>
        </div>
        {!isTraitor && isAlive && gameState?.current_phase !== 'end' && (
            <div className="text-[8px] text-emerald-400 font-bold uppercase tracking-tighter mt-0.5">
                Potential Share: ₹{potentialShare}
            </div>
        )}
    </div>
  );

  // --- SILENCED OVERLAY (Zabaan-bandi) ---
  if (me.status === 'silenced') {
    return (
      <div className="fixed inset-0 z-[100] bg-red-950 flex flex-col items-center justify-center p-8 text-center animate-fade-enter-active overflow-hidden touch-none h-screen w-full">
          <div className="w-32 h-32 rounded-full bg-red-900/50 border-4 border-red-500 flex items-center justify-center text-6xl shadow-[0_0_50px_rgba(220,38,38,0.5)] animate-pulse mb-10">
              🤐
          </div>
          <h1 className="text-5xl font-black serif italic text-white uppercase tracking-tighter mb-4 shadow-red-500/20">Zabaan-bandi</h1>
          <p className="text-red-100 text-xl font-serif italic mb-10 leading-relaxed">
              "The Plagiarists have found you.<br/>Your voice has been stolen by the shadows."
          </p>
          <div className="glass p-8 rounded-3xl border border-red-500/20 max-w-xs mx-auto">
              <p className="text-[10px] uppercase font-black text-red-500 tracking-[0.2em] mb-2">Current Restrictions</p>
              <ul className="text-xs text-red-200/60 space-y-2 text-left italic font-serif">
                  <li>• You cannot speak during the Majlis.</li>
                  <li>• You cannot vote to banish others.</li>
                  <li>• You must remain silent until the end.</li>
              </ul>
          </div>
      </div>
    );
  }

  // --- BANISHED OVERLAY (Spirit World) ---
  if (me.status === 'banished') {
    return (
      <div className="fixed inset-0 z-[100] bg-zinc-950 flex flex-col items-center justify-center p-8 text-center animate-fade-enter-active overflow-hidden touch-none h-screen w-full">
          <div className="w-32 h-32 rounded-full bg-zinc-900 border-4 border-zinc-700 flex items-center justify-center text-6xl shadow-[0_0_50px_rgba(255,255,255,0.05)] mb-10 opacity-40">
              👻
          </div>
          <h1 className="text-5xl font-black serif italic text-zinc-500 uppercase tracking-tighter mb-4">Spirit World</h1>
          <p className="text-zinc-400 text-xl font-serif italic mb-10 leading-relaxed max-w-sm">
              "You have been banished from the Mehfil.<br/>You may watch, but you must remain silent."
          </p>
          <div className="p-6 rounded-3xl border border-white/5 bg-white/5 max-w-xs mx-auto">
               <p className="text-[10px] uppercase font-black text-zinc-600 tracking-[0.2em]">The Veil has Fallen</p>
          </div>
      </div>
    );
  }

  // --- LOBBY PHASE ---
  if (gameState?.current_phase === 'lobby') {
    return (
      <main className="h-screen w-full overflow-hidden flex flex-col items-center justify-center text-center bg-emerald-deep text-white p-6 animate-fade-enter-active touch-none">
        <div className="glass p-10 rounded-full w-48 h-48 flex items-center justify-center text-6xl mb-8 animate-pulse">🖋️</div>
        <GoldBadge />
        <h1 className="text-4xl font-bold text-gold mb-2 serif">Welcome, {me.name}</h1>
        <p className="text-emerald-100/60 italic max-w-xs transition-all">Waiting for the Sultan to gather all the poets... ({players.length}/4)</p>
      </main>
    );
  }

  // --- REVEAL PHASE ---
  if (gameState?.current_phase === 'reveal') {
    return (
      <main 
        onClick={handleReveal}
        className={`min-h-screen flex flex-col items-center justify-center p-6 text-center transition-colors duration-1000 ${
            showRole ? (isTraitor ? 'bg-crimson-black' : 'bg-emerald-deep') : 'bg-black'
        }`}
      >
        <RoleBadge />
        <GoldBadge />
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
                    ? "The Shadows call. Sabotage the mission without being caught. Tip: You can safely check your secret assignment during the 60s Blindfold phase."
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
          <GoldBadge />
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
          <GoldBadge />
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
        <GoldBadge />
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
                        disabled={gameState.sabotage_triggered || gameState.sabotage_used || isBlindfoldPhase || !gameState.mission_timer_end}
                        className="btn-premium w-full bg-red-600 text-white py-6 rounded-2xl border-red-400 font-black uppercase tracking-widest shadow-[0_10px_40px_rgba(220,38,38,0.3)] disabled:opacity-20 active:scale-95 transition-all font-mono min-h-[44px]"
                    >
                        {gameState.sabotage_triggered ? "Sabotage Active" : (gameState.sabotage_used ? "Sabotage Used" : (!gameState.mission_timer_end ? "Mission Concluded" : "Signal Sabotage"))}
                    </button>
                    {gameState.sabotage_used && (
                        <div className="mt-4 p-4 bg-red-950/20 border border-red-500/30 rounded-2xl flex justify-between items-center animate-fade-enter-active">
                            <span className="text-red-500 font-black uppercase text-[10px] tracking-[0.2em]">Sabotage Bounty</span>
                            <span className="text-white font-black text-xl">₹500</span>
                        </div>
                    )}
                    {isBlindfoldPhase && (
                        <p className="text-[10px] text-red-500/40 uppercase font-black text-center mt-4 tracking-widest">You have 60s to prepare. Assignment revealed above.</p>
                    )}
                </section>
            )}

            {!isTraitor && gameState.sabotage_used && (
                <div className="bg-red-950/20 border border-red-500/30 p-4 rounded-2xl flex justify-between items-center animate-pulse">
                    <span className="text-red-500 font-bold uppercase text-[10px] tracking-widest">Security Breach Detected</span>
                    <span className="text-white/40 text-[10px]">(-₹1000 from Pot)</span>
                </div>
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
            <GoldBadge />

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
                                        className="btn-premium bg-white/5 p-8 rounded-[2rem] border-2 border-white/5 flex justify-between items-center group active:scale-95 transition-all min-h-[44px]"
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
    
    // Tally for Plagiarist coordination
    const tally = nightVotes.reduce((acc: any, v) => {
        acc[v.target_id] = (acc[v.target_id] || 0) + 1;
        return acc;
    }, {});

    return (
      <main className="min-h-screen bg-black text-white p-6 flex flex-col items-center justify-center text-center relative overflow-hidden">
        <RoleBadge />
        <GoldBadge />

        {isTraitor && isAlive ? (
            <div className="w-full space-y-8 animate-fade-enter-active">
                <div className="space-y-2">
                    <h1 className="text-red-600 font-black uppercase tracking-[0.5em] text-[10px]">Al-Shams: Coordination</h1>
                    <h2 className="text-4xl font-bold serif italic text-red-500">Seal a Poet's Fate</h2>
                    <p className="text-white/20 text-[10px] uppercase tracking-widest italic">Signal your intent. Consensus is key.</p>
                </div>

                <div className="grid grid-cols-1 gap-4 w-full max-w-sm mx-auto">
                    {potentialVictims.map(p => {
                        const voteCount = tally[p.id] || 0;
                        const isMyVote = votedId === p.id;

                        return (
                            <button
                                key={p.id}
                                onClick={() => handleNightVote(p.id)}
                                className={`relative p-6 rounded-3xl border-2 active:scale-95 transition-all flex justify-between items-center group min-h-[44px] ${
                                    isMyVote 
                                    ? 'bg-red-600/20 border-red-500 shadow-[0_0_20px_rgba(220,38,38,0.2)]' 
                                    : 'bg-white/5 border-white/10 hover:border-red-500/30'
                                }`}
                            >
                                <div className="flex flex-col items-start translate-x-2">
                                    <span className="text-2xl font-black serif italic text-red-100">{p.name}</span>
                                    {isMyVote && <span className="text-[10px] uppercase font-bold text-red-500 tracking-tighter">My Selection</span>}
                                </div>
                                
                                {voteCount > 0 && (
                                    <div className="flex items-center gap-2">
                                        <div className="flex -space-x-2">
                                            {[...Array(voteCount)].map((_, i) => (
                                                <div key={i} className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_10px_rgba(220,38,38,1)] animate-pulse" />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>

                <div className="glass p-6 rounded-3xl border border-red-500/10 text-white/40 italic text-xs max-w-xs mx-auto leading-relaxed">
                    The Sultan will confirm the final silence based on your collective intention.
                </div>
            </div>
        ) : (
            <div className="space-y-8 opacity-20 grayscale transition-all duration-1000 scale-90">
                <div className="text-9xl mb-4 animate-pulse">🌙</div>
                <div className="space-y-2">
                    <h2 className="text-5xl font-black text-gray-400 serif italic uppercase tracking-tighter">Sleep...</h2>
                    <p className="text-xs uppercase tracking-[0.4em] font-bold">The Mehfil is quiet</p>
                </div>
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
            <div className="pt-10 space-y-6">
                {winners === 'poets' && (
                   <div className="space-y-2 pb-6 border-b border-white/10">
                       <div className="text-gold font-mono text-3xl font-black">₹{gameState.eidi_pot}</div>
                       <div className="text-[10px] text-white/40 uppercase tracking-widest">Total Khazana Secured</div>
                   </div>
                )}
                <div className="space-y-2">
                    <div className="text-gold font-mono text-3xl font-black">₹{me.private_gold}</div>
                    <div className="text-[10px] text-white/40 uppercase tracking-widest">
                        {!isTraitor ? 'Your Share of the Eidi' : 'Total Stolen from Sabotages'}
                    </div>
                </div>
            </div>
        </div>
        <p className="mt-12 text-white/40 text-xs italic tracking-tighter uppercase font-bold">Wait for the Sultan to reset the Mehfil</p>
      </main>
    );
  }

  return null;
}
