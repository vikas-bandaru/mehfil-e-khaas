'use client';

export const dynamic = 'force-dynamic';

import { useParams, useRouter } from 'next/navigation';
import { useGameState } from '@/hooks/useGameState';
import { usePlayers } from '@/hooks/usePlayers';
import { advancePhase, assignRoles, evaluateWinCondition, resetGame, deleteRoom, startMission, liquidatePot, GamePhase, Player, Mission } from '@/lib/game-logic';
import { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export default function HostDashboard() {
  const { roomCode } = useParams() as { roomCode: string };
  const router = useRouter();
  const { gameState, loading: gameLoading } = useGameState(roomCode);
  const phase = gameState?.current_phase || 'lobby';
  const roomId = gameState?.id;
  const { players, loading: playersLoading } = usePlayers(roomId || '');
  
  const [votes, setVotes] = useState<any[]>([]);
  const [nightVotes, setNightVotes] = useState<any[]>([]);
  const [activeMission, setActiveMission] = useState<Mission | null>(null);
  const [missionOutcome, setMissionOutcome] = useState<'success' | 'failed' | null>(null);
  const [isVotesLocked, setIsVotesLocked] = useState(false);
  const [banishedPlayerId, setBanishedPlayerId] = useState<string | null>(null);
  const [silenceConfirmed, setSilenceConfirmed] = useState(false);
  const [origin, setOrigin] = useState('');
  const [devPlagiaristCount, setDevPlagiaristCount] = useState(1);
  const [showDevSettings, setShowDevSettings] = useState(false);
  const [isToolkitOpen, setIsToolkitOpen] = useState(false);
  const [showScript, setShowScript] = useState(false);
  const [showTooltips, setShowTooltips] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [hostName, setHostName] = useState<string | null>(null);

  useEffect(() => {
    setHostName(localStorage.getItem('playerName'));
  }, []);

  const isHostAPlayer = useMemo(() => {
    return players.some(p => p.name === hostName);
  }, [players, hostName]);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

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

  useEffect(() => {
    if (roomId) {
      const voteChannel = supabase
        .channel(`votes:${roomId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'votes', filter: `room_id=eq.${roomId}` }, (payload) => {
          setVotes(prev => [...prev, payload.new]);
        })
        .subscribe();

      const fetchInitialVotes = async () => {
        const { data } = await supabase.from('votes').select('*').eq('room_id', roomId);
        if (data) setVotes(data);
      };
      fetchInitialVotes();

      // Night Votes Subscription
      const nightVoteChannel = supabase
        .channel(`night_votes:${roomId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'night_votes', filter: `room_id=eq.${roomId}` }, () => {
          fetchInitialNightVotes();
        })
        .subscribe();

      const fetchInitialNightVotes = async () => {
        const { data } = await supabase.from('night_votes').select('*').eq('room_id', roomId);
        if (data) setNightVotes(data);
      };
      fetchInitialNightVotes();

      return () => { 
        supabase.removeChannel(voteChannel); 
        supabase.removeChannel(nightVoteChannel);
      };
    }
  }, [roomId]);

  // Derived Data
  const alivePlayers = players.filter(p => p.status === 'alive');
  const alivePoets = players.filter(p => p.status === 'alive' && p.role === 'sukhan_war');
  const alivePlagiarists = players.filter(p => p.status === 'alive' && p.role === 'naqal_baaz');
  
  const voteTallies = useMemo(() => {
    const tallies: Record<string, number> = {};
    votes.forEach(v => {
      // Only count actual votes (round_id >= 1 or 99 for night)
      if (v.round_id >= 1 || v.round_id === 99) {
        tallies[v.target_id] = (tallies[v.target_id] || 0) + 1;
      }
    });
    return tallies;
  }, [votes]);

  const maxVotes = Math.max(...Object.values(voteTallies), 0);
  const mostVotedPlayers = alivePlayers.filter(p => (voteTallies[p.id] || 0) === maxVotes && maxVotes > 0);
  const isTie = isVotesLocked && mostVotedPlayers.length > 1 && (gameState?.tie_protocol === 'none' || !gameState?.tie_protocol);

  const nightVoteTallies = useMemo(() => {
    const tallies: Record<string, number> = {};
    nightVotes.forEach(v => {
      tallies[v.target_id] = (tallies[v.target_id] || 0) + 1;
    });
    return tallies;
  }, [nightVotes]);

  const maxNightVotes = Math.max(...Object.values(nightVoteTallies), 0);
  const nightConsensusPlayers = alivePlayers.filter(p => (nightVoteTallies[p.id] || 0) === maxNightVotes && maxNightVotes > 0);
  const activeNightTargetId = nightConsensusPlayers.length === 1 ? nightConsensusPlayers[0].id : null;

  const potentialWinner = useMemo(() => {
    if (playersLoading || players.length === 0 || phase === 'lobby' || phase === 'reveal') return null;
    const poetsCount = players.filter(p => p.role === 'sukhan_war' && (p.status === 'alive' || p.status === 'silenced')).length;
    const plagiaristsCount = players.filter(p => p.role === 'naqal_baaz' && (p.status === 'alive' || p.status === 'silenced')).length;
    
    if (plagiaristsCount === 0) return 'poets';
    if (plagiaristsCount >= poetsCount) return 'plagiarists';
    return null;
  }, [players, playersLoading, phase]);

  const hasPlayedRef = useRef(false);

  useEffect(() => {
    // Reset the buzzer flag when a new mission starts or phase changes
    hasPlayedRef.current = false;
  }, [gameState?.mission_timer_end, phase]);

  const playBuzzer = async () => {
    if (hasPlayedRef.current) return;
    hasPlayedRef.current = true;
    
    if (process.env.NODE_ENV === 'development') {
      console.log("🔊 MISSION TIMER OVER - PLAYING BUZZER");
    }
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

  // FSM Phase Logic
  const handleTransition = async (nextPhase: GamePhase) => {
    if (!roomId) return;
    
    try {
        // Auto Win Condition Check before critical transitions
        if (nextPhase === 'night' || (gameState?.current_phase === 'night' && nextPhase === 'mission')) {
            const winner = await evaluateWinCondition(roomId);
            if (winner) {
                await supabase.from('game_rooms').update({ current_phase: 'end', winner_faction: winner }).eq('id', roomId);
                if (winner === 'poets') {
                    await liquidatePot(roomId);
                }
                return;
            }
        }

        // Phase Cleanup
        if (nextPhase === 'majlis' || nextPhase === 'night' || nextPhase === 'mission') {
            await supabase.from('votes').delete().eq('room_id', roomId);
            await supabase.from('night_votes').delete().eq('room_id', roomId);
            setVotes([]);
            setNightVotes([]);
            setIsVotesLocked(false);
            setBanishedPlayerId(null);
            setMissionOutcome(null);
            setSilenceConfirmed(false);
            
            // Clear reveal state when moving to a new phase
            await supabase.from('game_rooms').update({ 
                is_revealing: false, 
                reveal_target_id: null 
            }).eq('id', roomId);
        }

        await advancePhase(roomId, nextPhase);
    } catch (err: any) {
        console.error("Transition Error:", err);
        alert(`Error during ${nextPhase} transition: ${err.message || JSON.stringify(err)}`);
    }
  };

  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem('hasSeenHostTutorial');
    if (hasSeenTutorial === null) {
      setShowTooltips(true);
    }
  }, []);

  const handleAssignRoles = async () => {
    const minRequired = gameState?.min_players_required ?? (gameState?.is_dev_mode ? 1 : 8);
    if (players.length < minRequired) return alert(`Strict Rule: ${minRequired} players required to start.`);
    
    const manualCount = gameState?.is_dev_mode ? devPlagiaristCount : undefined;
    await assignRoles(roomId!, manualCount);
    await handleTransition('reveal');
    
    // Tutorial Completion
    localStorage.setItem('hasSeenHostTutorial', 'true');
    setShowTooltips(false);
  };

  const toggleDevMode = async (enabled: boolean) => {
    if (!roomId || process.env.NODE_ENV !== 'development') return;
    await supabase.from('game_rooms').update({ is_dev_mode: enabled }).eq('id', roomId);
  };

  const updateMinPlayers = async (count: number) => {
    if (!roomId) return;
    await supabase.from('game_rooms').update({ min_players_required: count }).eq('id', roomId);
  };

  const handleBanish = async (playerId?: string) => {
    const targetId = playerId || banishedPlayerId;
    if (!targetId) return;
    await supabase.from('players').update({ status: 'banished' }).eq('id', targetId);
    // Reset tie protocol after banishment
    await supabase.from('game_rooms').update({ tie_protocol: 'none', tied_player_ids: [] }).eq('id', roomId);
  };

  const handleTieProtocolSelect = async (protocol: 'decree' | 'revote' | 'spin') => {
    if (!roomId) return;
    await supabase.from('game_rooms').update({ 
        tie_protocol: protocol, 
        tied_player_ids: mostVotedPlayers.map(p => p.id) 
    }).eq('id', roomId);

    if (protocol === 'revote') {
        // Reset votes for revote
        await supabase.from('votes').delete().eq('room_id', roomId);
        setVotes([]);
        setIsVotesLocked(false);
    }
  };

  const [isSpinning, setIsSpinning] = useState(false);
  const handleSpinThePen = async () => {
    setIsSpinning(true);
    // Simulation for Host view, real sync via Supabase
    setTimeout(async () => {
        const tiedIds = gameState?.tied_player_ids || [];
        const winnerId = tiedIds[Math.floor(Math.random() * tiedIds.length)];
        await handleBanish(winnerId);
        setIsSpinning(false);
    }, 3000);
  };

  const handleSilence = async (targetId: string) => {
    if (!roomId) return;
    await supabase.from('players').update({ status: 'silenced' }).eq('id', targetId);
    await supabase.from('night_votes').delete().eq('room_id', roomId);
    setSilenceConfirmed(true);
  };

  const handleWakeUpReveal = async (targetId: string | null) => {
    if (!roomId) return;
    // 1. Set reveal state
    await supabase.from('game_rooms').update({ 
        is_revealing: true, 
        reveal_target_id: targetId 
    }).eq('id', roomId);

    // 2. Evaluate win condition
    const winner = await evaluateWinCondition(roomId);
    
    // 3. Transition to mission after delay (handled by Host clicking button again or auto)
    // For now, let's keep it manual so Host can control the cinematic length.
  };

  const handleVerifySabotage = async () => {
    if (missionOutcome) return; // Already concluded
    
    // Award gold to plagiarists and update pot
    const plagiarists = players.filter(p => p.role === 'naqal_baaz' && p.status === 'alive');
    for (const p of plagiarists) {
      await supabase.from('players').update({ private_gold: (p.private_gold || 0) + 500 }).eq('id', p.id);
    }
    await supabase.from('game_rooms').update({ 
        eidi_pot: (gameState!.eidi_pot || 0) + 1000, 
        sabotage_triggered: false,
        sabotage_used: true
    }).eq('id', roomId);
    // DO NOT set missionOutcome or clear timer here
  };

  const handleMissionSuccess = async () => {
    if (missionOutcome) return;
    
    await supabase.from('game_rooms').update({ 
        eidi_pot: (gameState!.eidi_pot || 0) + 2000,
        mission_timer_end: null 
    }).eq('id', roomId);
    setMissionOutcome('success');
  };

  const handleStartMission = async () => {
    if (!roomId) return;
    await startMission(roomId);
  };

  const handleEmergencyReset = async () => {
    if (!roomId) return;
    if (confirm("🚨 EMERGENCY RESET: This will permanently delete this room and all its data. Are you sure?")) {
        await deleteRoom(roomId);
        localStorage.removeItem('playerName');
        localStorage.removeItem('playerId');
        localStorage.removeItem('roomId');
        localStorage.removeItem('isHost');
        router.push('/');
    }
  };

  if (gameLoading || playersLoading) return <div className="p-10 text-white">Loading God View...</div>;
  if (!gameState) return <div className="p-10 text-white">Room {roomCode} not found.</div>;

  return (
    <main className="min-h-screen bg-crimson-black text-white p-4 lg:p-10 space-y-6">
      
      {/* HEADER: Room Code & Public View */}
      <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/10 gap-4">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <div className="text-[10px] uppercase font-black text-gold/40 tracking-widest mb-1">Room Code</div>
            <span className="text-3xl font-black text-gold leading-none">{roomCode}</span>
          </div>
          <div className="h-10 w-[1px] bg-white/10" />
          <div className="flex flex-col">
            <div className="text-[10px] uppercase font-black text-white/40 tracking-widest mb-1">Join Link</div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-white/60">{origin}/?code={roomCode}</span>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(`${origin}/?code=${roomCode}`);
                  alert('Link copied to clipboard!');
                }}
                className="btn-premium bg-white/10 px-3 py-1.5 rounded-lg border-white/20 hover:bg-white/20"
              >
                Copy
              </button>
            </div>
          </div>
        </div>
        <div className="flex gap-4 items-center">
          {isHostAPlayer && (
            <button 
              onClick={() => window.open(`/play/${roomCode}`, '_blank')}
              className="btn-premium bg-emerald-600/10 text-emerald-500 border-emerald-500/40 px-6 py-4 rounded-full shadow-lg"
            >
              Open My Player View 🖋️
            </button>
          )}
          <div className="relative">
            <button 
              onClick={() => window.open(`/display/${roomCode}`, '_blank')}
              className={`btn-premium bg-gold/10 text-gold border-gold/40 px-6 py-4 rounded-full shadow-lg relative ${showTooltips ? 'animate-pulse-gold' : ''}`}
            >
              Open Public Display 📺
            </button>
            {showTooltips && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 w-48 glass p-4 rounded-2xl border border-gold/30 shadow-2xl z-20 animate-bounce-subtle pointer-events-none">
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#050505] border-t border-l border-gold/30 rotate-45" />
                <p className="text-[10px] font-bold text-gold uppercase mb-1 tracking-widest">Step 1: Cast</p>
                <p className="text-xs text-white/90 leading-snug">Open this on a TV or Projector for the room.</p>
              </div>
            )}
          </div>
          <div className="flex flex-col items-center gap-1">
            <button 
              onClick={() => setIsToolkitOpen(true)}
              className="w-12 h-12 rounded-full bg-gold text-background border-4 border-gold/50 flex items-center justify-center text-xl font-black shadow-lg hover:scale-110 active:scale-90 transition-all font-sans"
              title="Host Toolkit"
            >
              ?
            </button>
            <button 
              onClick={() => setShowTooltips(!showTooltips)}
              className={`text-[8px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-full border transition-all ${showTooltips ? 'bg-gold text-background border-gold' : 'bg-transparent text-gold/40 border-gold/20'}`}
            >
              Guide {showTooltips ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      </div>
      
      {/* 1. THE TELEPROMPTER */}
      <section className="bg-gold text-crimson-black p-6 rounded-2xl shadow-xl border-4 border-gold/50 animate-bounce-subtle relative overflow-hidden">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-xs uppercase font-black tracking-widest opacity-70">Sultan's Teleprompter</h3>
          <button 
            onClick={() => setShowScript(!showScript)}
            className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border transition-all ${
              showScript ? 'bg-background text-gold border-background' : 'bg-transparent text-background/40 border-background/20'
            }`}
          >
            {showScript ? '📜 Script Active' : '📜 Show Script'}
          </button>
        </div>
        
        <div className="space-y-4">
          <p className="text-2xl lg:text-3xl font-bold serif leading-tight">
            {phase === 'lobby' && `Wait for at least ${gameState.min_players_required ?? 4} poets. Once gathered, click 'Assign Roles'.`}
          {phase === 'reveal' && "Role Reveal: Tell everyone to look at their screens. One or more among them are Plagiarists. They must keep it secret!"}
          {phase === 'mission' && !gameState.mission_timer_end && "Announce: 60s Blindfold Session. Tell everyone to close their eyes. Plagiarists, check your assignments. Silence for 60s!"}
          {phase === 'mission' && gameState.mission_timer_end && "Mission in progress. Poets are solving. Elect a Speaker to state the final answer quietly to you."}
          {phase === 'majlis' && (
            gameState?.tie_protocol === 'revote' ? "The poets are divided. A Re-Vote is in progress. Only the tied candidates can be selected." :
            gameState?.tie_protocol === 'spin' ? "The Pen of Fate will decide the Plagiarist." :
            gameState?.tie_protocol === 'decree' ? "Sultan's Decree: You must hold the final power to banish a poet." :
            "Majlis Open: Debate and cast votes to banish suspects. Lead the debate!"
          )}
          {phase === 'night' && (
            silenceConfirmed 
            ? "Poet silenced. Ready to announce the results to the room." 
            : "Shhh! Tell everyone to close their eyes. Wait for the Plagiarists to vote on their phones. Once identified, click Confirm."
          )}
          {phase === 'end' && "The Mehfil is over. Reveal the identities and announce the winners!"}
          </p>
        </div>

        {showScript && (
          <div className="animate-fade-in py-3 px-4 bg-background/5 border-t border-background/10 mt-4 rounded-xl">
             <div className="text-[8px] uppercase font-black opacity-40 mb-1 tracking-widest">Narrator Script (Read Aloud)</div>
             <p className="text-lg italic font-medium opacity-90">
                {phase === 'lobby' && "Welcome to the Mehfil-e-Khaas! Today, poetry meets betrayal. Poets, gather your thoughts. Plagiarists, sharpen your knives."}
                {phase === 'reveal' && "Look to your devices. Your destiny in this court is written. Keep your secret guarded with your life."}
                {phase === 'mission' && !gameState.mission_timer_end && "The court falls dark. Poets, close your eyes. Plagiarists... reveal yourselves to one another."}
                {phase === 'mission' && gameState.mission_timer_end && "The challenge is set. Solve the couplet before the sand runs out. Speaker, state your case."}
                {phase === 'majlis' && "Let the Majlis begin! The scent of a Plagiarist is in the air. Debate, discuss... and decide who leaves the court."}
                {phase === 'night' && "The night deepens. Everyone, eyes closed. Plagiarists... choose the voice you wish to silence."}
                {phase === 'end' && gameState.winner_faction === 'poets' ? "Justice is served! The poets have reclaimed the court." : "The court has fallen. The Plagiarists rule the night."}
             </p>
          </div>
        )}
      </section>

      {/* HOST TOOLKIT DRAWER */}
      <div className={`fixed inset-y-0 right-0 w-80 bg-[#f4e4bc] text-[#2c1810] shadow-2xl z-50 transform transition-transform duration-500 ease-in-out border-l-8 border-[#d4af37]/30 ${isToolkitOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="h-full flex flex-col p-8 serif relative overflow-hidden">
          {/* Manuscript Texture Overlay */}
          <div className="absolute inset-0 opacity-5 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/paper.png')]" />
          
          <div className="flex justify-between items-center mb-8 relative z-10">
            <h2 className="text-2xl font-bold italic border-b-2 border-[#2c1810]/20 pb-1">The Sultan's Toolkit</h2>
            <div className="flex gap-2 items-center">
              <button 
                onClick={() => setShowTooltips(!showTooltips)}
                className={`w-6 h-6 rounded-full border border-[#2c1810]/20 flex items-center justify-center text-[8px] font-black transition-all ${showTooltips ? 'bg-[#8b0000] text-white border-[#8b0000]' : 'hover:bg-[#2c1810]/10'}`}
                title="Toggle Guide"
              >
                i
              </button>
              <button onClick={() => setIsToolkitOpen(false)} className="text-2xl hover:scale-125 transition-transform">×</button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-8 relative z-10 custom-scrollbar pr-2">
            <section className="space-y-4">
              <h3 className="text-[10px] uppercase font-black tracking-widest opacity-50 border-l-2 border-[#d4af37] pl-2">Glossary of the Court</h3>
              <div className="space-y-4">
                <div className="group">
                  <div className="font-bold italic text-lg text-[#8b0000]">Sukhan-war</div>
                  <div className="text-sm opacity-80 leading-relaxed font-sans">The True Poet. Your mission is to solve the couplet and identify the Naqal-baaz.</div>
                </div>
                <div className="group">
                  <div className="font-bold italic text-lg text-[#8b0000]">Naqal-baaz</div>
                  <div className="text-sm opacity-80 leading-relaxed font-sans">The Plagiarist. You must sabotage the mission while remaining undetected.</div>
                </div>
                <div className="group">
                  <div className="font-bold italic text-lg text-[#8b0000]">Zabaan-bandi</div>
                  <div className="text-sm opacity-80 leading-relaxed font-sans">The Silencing. The Plagiarists choose one poet to lose their vote each night.</div>
                </div>
                <div className="group">
                  <div className="font-bold italic text-lg text-[#8b0000]">Majlis</div>
                  <div className="text-sm opacity-80 leading-relaxed font-sans">The Grand Assembly. The time of debate, accusation, and banishment.</div>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-[10px] uppercase font-black tracking-widest opacity-50 border-l-2 border-[#d4af37] pl-2">Sultan's Protocols</h3>
              <ul className="text-xs space-y-2 list-disc pl-4 opacity-80 font-sans">
                <li>Verify the "Source of Truth" answer with the Speaker.</li>
                <li>Ensure the Plagiarists remain silent during the Blindfold sessions.</li>
                <li>In case of a tie, use the Pen of Fate or your own Decree.</li>
              </ul>
            </section>
          </div>
          
          <div className="mt-8 pt-4 border-t border-[#2c1810]/10 text-center relative z-10">
            <div className="text-[8px] uppercase font-bold opacity-30 mt-2">© Mehfil-e-Khaas • Protocol 1.0</div>
          </div>
        </div>
      </div>
      
      {/* OVERLAY */}
      {isToolkitOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity" 
          onClick={() => setIsToolkitOpen(false)}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* 2. THE DATA VIEW */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Mission Display */}
          {phase === 'mission' && activeMission && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-emerald-900/20 border border-emerald-500/30 p-6 rounded-3xl">
                <h4 className="text-xs uppercase font-black text-emerald-500 mb-2 tracking-widest">Public: Read Aloud</h4>
                <h3 className="text-2xl font-bold serif mb-2 text-white">{activeMission.title}</h3>
                <p className="text-emerald-100/70 italic">"{activeMission.public_goal}"</p>
              </div>
              <div className="bg-red-900/20 border border-red-500/30 p-6 rounded-3xl">
                <h4 className="text-xs uppercase font-black text-red-500 mb-2 tracking-widest">Classified: Classified</h4>
                <p className="text-xl font-bold text-red-500 serif italic">"{activeMission.secret_sabotage}"</p>
              </div>
              
              {/* THE SOURCE OF TRUTH CARD */}
              <div className="md:col-span-2 bg-emerald-950/40 border-4 border-emerald-500 rounded-3xl p-8 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-150 transition-transform duration-1000">👑</div>
                  <h4 className="text-xs uppercase font-black text-emerald-500 mb-4 tracking-[0.3em]">The Source of Truth: Answer Key</h4>
                  <p className="text-3xl lg:text-4xl font-black text-white serif italic leading-tight">
                      {activeMission.host_answer_key || "No answer key provided for this mission."}
                  </p>
              </div>

              {/* START MISSION BUTTON (Only if timer not started) */}
              {!gameState.mission_timer_end && (
                <div className="md:col-span-2 py-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <button 
                        onClick={handleStartMission}
                        className="w-full bg-gold hover:bg-gold-light text-crimson-black py-8 rounded-3xl text-3xl font-black uppercase tracking-[0.2em] shadow-[0_20px_50px_rgba(255,215,0,0.3)] border-4 border-white/20 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-4"
                    >
                        <span>🔱 Begin Mission</span>
                        <span className="text-sm font-bold opacity-60">(Start Timer & Reveal Logic)</span>
                    </button>
                    <p className="text-center text-gold/40 text-[10px] uppercase font-black mt-6 tracking-widest">
                        Clicking this will reveal the objective to all players and start the 2.5-minute countdown.
                    </p>
                </div>
              )}
            </div>
          )}

          <section className="glass p-6 rounded-3xl border border-white/10 h-full">
            <div className="flex justify-between items-center mb-6 relative">
                <h2 className="text-xl font-bold serif text-gold">Gathered Poets ({players.length}/{gameState.min_players_required ?? 8})</h2>
                {showTooltips && (
                  <div className="absolute top-full left-0 mt-2 w-56 glass p-4 rounded-2xl border border-gold/30 shadow-2xl z-20 animate-bounce-subtle pointer-events-none">
                    <div className="absolute -top-2 left-8 w-4 h-4 bg-[#050505] border-t border-l border-gold/30 rotate-45" />
                    <p className="text-[10px] font-bold text-gold uppercase mb-1 tracking-widest">Step 2: Gathering</p>
                    <p className="text-xs text-white/90 leading-snug">Share the link. Wait for {gameState.min_players_required ?? 8} poets to join.</p>
                  </div>
                )}
                <div className="text-sm font-mono text-gold/60">POT: ₹{gameState.eidi_pot}</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {players.map(p => (
                <div key={p.id} className={`p-4 rounded-xl border transition-all ${
                  p.status === 'alive' ? 'bg-white/5 border-white/10' : 'bg-black/40 border-white/5 grayscale opacity-50'
                }`}>
                  <div className="flex justify-between items-center">
                    <div>
                        <div className="font-bold serif flex items-center gap-2">
                          {p.name}
                          {p.name === hostName && (
                            <span className="text-[8px] bg-gold/20 text-gold px-1.5 py-0.5 rounded-full font-black uppercase tracking-widest border border-gold/20">Host</span>
                          )}
                        </div>
                        <div className="text-[10px] uppercase text-gray-500">
                            {p.role} • {p.status}
                        </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Voting Chart */}
            {phase === 'majlis' && (
                <div className="mt-8 pt-8 border-t border-white/10">
                    <h3 className="text-xs uppercase font-bold text-gray-500 mb-4 tracking-widest">Real-time Vote Tally ({votes.length}/{alivePlayers.length})</h3>
                    <div className="space-y-3">
                        {alivePlayers.map(p => {
                            const count = voteTallies[p.id] || 0;
                            const percentage = (count / (alivePlayers.length || 1)) * 100;
                            return (
                                <div key={p.id} className="space-y-1">
                                    <div className="flex justify-between text-[10px] uppercase font-bold">
                                        <span>{p.name}</span>
                                        <span>{count} Votes</span>
                                    </div>
                                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                        <div className="h-full bg-gold transition-all duration-500" style={{ width: `${percentage}%` }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
          </section>
        </div>

        {/* 3. THE CONTROL PANEL */}
        <div className="space-y-6">
          <section className="glass p-6 rounded-3xl border border-gold/20 bg-gold/5 flex flex-col h-full">
            <h2 className="text-xl font-bold serif text-gold mb-6">Execution Panel</h2>
            
            <div className="flex-1 space-y-3">
              {phase === 'lobby' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center mb-4">
                    {process.env.NODE_ENV === 'development' && (
                      <button 
                        onClick={() => setShowDevSettings(!showDevSettings)}
                        className="text-[10px] uppercase font-black text-gold/60 hover:text-gold transition-all flex items-center gap-2"
                      >
                        {showDevSettings ? 'Hide Settings' : '⚙️ Dev Settings'}
                      </button>
                    )}
                    {gameState?.is_dev_mode && (
                      <span className="text-[10px] bg-red-600/20 text-red-500 px-2 py-0.5 rounded-full font-black uppercase tracking-widest border border-red-500/20">Dev Mode Active</span>
                    )}
                  </div>

                  {showDevSettings && (
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-4 animate-fade-enter-active mb-6">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-gray-400">Enable Dev Mode</span>
                        <input 
                          type="checkbox" 
                          checked={gameState?.is_dev_mode || false}
                          onChange={(e) => toggleDevMode(e.target.checked)}
                          className="w-5 h-5 accent-emerald-500"
                        />
                      </div>

                      {gameState?.is_dev_mode && (
                        <>
                          <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-black uppercase">
                              <span>Min Players to Start</span>
                              <span>{gameState.min_players_required}</span>
                            </div>
                            <input 
                              type="range" min="1" max="8" 
                              value={gameState.min_players_required}
                              onChange={(e) => updateMinPlayers(parseInt(e.target.value))}
                              className="w-full accent-gold"
                            />
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-black uppercase">
                              <span>Plagiarist Count</span>
                              <span>{devPlagiaristCount}</span>
                            </div>
                            <input 
                              type="range" min="1" max={Math.max(1, players.length - 1)} 
                              value={devPlagiaristCount}
                              onChange={(e) => setDevPlagiaristCount(parseInt(e.target.value))}
                              className="w-full accent-red-500"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  <div className="relative">
                    <button 
                      onClick={handleAssignRoles}
                      disabled={players.length < (gameState?.min_players_required ?? (gameState?.is_dev_mode ? 1 : 4))}
                      className={`btn-premium w-full bg-emerald-600 py-6 rounded-2xl shadow-2xl border-emerald-500/50 text-lg active:scale-95 transition-all ${showTooltips && players.length >= (gameState?.min_players_required ?? 4) ? 'animate-pulse-gold' : ''}`}
                    >
                      Assign Roles & Start
                    </button>
                    {showTooltips && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-56 glass p-4 rounded-2xl border border-gold/30 shadow-2xl z-20 animate-bounce-subtle pointer-events-none">
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#050505] border-b border-r border-gold/30 rotate-45" />
                        <p className="text-[10px] font-bold text-gold uppercase mb-1 tracking-widest">Step 3: Start</p>
                        <p className="text-xs text-white/90 leading-snug">Click once everyone is in. This starts the game!</p>
                      </div>
                    )}
                  </div>
                  {players.length < (gameState?.min_players_required ?? 4) && !gameState?.is_dev_mode && (
                    <p className="text-center text-red-500 text-[10px] uppercase font-black tracking-widest mt-4 animate-pulse">Minimum {gameState?.min_players_required ?? 4} players required to start the Mehfil.</p>
                  )}
                </div>
              )}

              {phase === 'reveal' && (
                <button 
                    onClick={() => handleTransition('mission')}
                    className="btn-premium w-full bg-gold text-crimson-black py-6 rounded-2xl border-gold/50 text-lg"
                >
                    Begin First Mission
                </button>
              )}

              {phase === 'mission' && (
                <div className="space-y-4">
                    <div className="bg-black/40 p-6 rounded-2xl border border-white/10 text-center mb-4">
                        <div className="text-[10px] uppercase font-black text-gold/40 tracking-widest mb-1">Time Remaining</div>
                        <div className={`text-5xl font-black serif tabular-nums ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                            {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                        </div>
                    </div>
                    <button 
                        onClick={handleMissionSuccess} 
                        disabled={timeLeft > 90 || !!missionOutcome}
                        className="btn-premium w-full bg-emerald-900/50 text-emerald-400 border-emerald-500/30 py-5 rounded-2xl disabled:opacity-20"
                    >
                        Success: Answer Matches (+₹2000)
                    </button>
                    
                    <button 
                        onClick={() => setMissionOutcome('failed')} 
                        disabled={timeLeft > 0 || !!missionOutcome}
                        className="btn-premium w-full bg-red-900/50 text-red-400 border-red-500/30 py-5 rounded-2xl disabled:opacity-20"
                    >
                        {timeLeft > 0 ? `Solving Phase Active...` : `Failed: Incorrect or Time Out`}
                    </button>
                    
                    <button 
                      onClick={handleVerifySabotage}
                      disabled={timeLeft > 90 || !gameState.sabotage_triggered || !!missionOutcome}
                      className="btn-premium w-full bg-red-600/20 text-red-500 border-red-600/40 py-4 rounded-2xl disabled:opacity-20"
                    >
                      Verify Sabotage {gameState.sabotage_triggered && "(Alert!)"}
                    </button>

                    <button 
                        onClick={() => handleTransition('majlis')}
                        disabled={!missionOutcome && !potentialWinner}
                        className="btn-premium w-full bg-white text-black py-6 rounded-2xl border-gray-300 mt-4 text-lg"
                    >
                        {potentialWinner ? 'Reveal Scores (Victory!)' : 'Proceed to Majlis'}
                    </button>
                </div>
              )}

              {phase === 'majlis' && (
                <div className="space-y-4">
                    <button 
                        onClick={() => setIsVotesLocked(true)}
                        disabled={votes.length < alivePlayers.length || isVotesLocked}
                        className="btn-premium w-full bg-gold/20 text-gold border-gold/40 py-5 rounded-2xl"
                    >
                        {isVotesLocked ? "Votes Locked" : "Lock Votes & Reveal"}
                    </button>
                    
                    {isVotesLocked && !isTie && gameState?.tie_protocol === 'none' && (
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-3">
                            <p className="text-[10px] text-center text-gray-500 uppercase font-black tracking-widest">Select Player to Banish</p>
                            {mostVotedPlayers.map(p => (
                                <button key={p.id} onClick={() => setBanishedPlayerId(p.id)} className={`btn-premium w-full py-4 rounded-xl border ${banishedPlayerId === p.id ? 'bg-red-600 border-red-400' : 'bg-white/5 border-white/10'}`}>
                                    Banish {p.name}
                                </button>
                            ))}
                            <button 
                                onClick={() => handleBanish()}
                                disabled={!banishedPlayerId}
                                className="btn-premium w-full bg-red-600 py-4 rounded-xl border-red-500 disabled:opacity-20"
                            >
                                Confirm Banishment
                            </button>
                        </div>
                    )}

                    {isTie && (
                        <div className="p-6 bg-gold/10 rounded-3xl border-2 border-gold/40 animate-scale-up space-y-6">
                            <div className="text-center">
                                <h3 className="text-gold font-black uppercase tracking-[0.2em] text-xs mb-2">Tie Detected!</h3>
                                <p className="text-white/60 text-[10px] italic">Choose the Law of the Land</p>
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                                <button onClick={() => handleTieProtocolSelect('decree')} className="btn-premium w-full bg-gold text-black py-4 rounded-xl font-bold">🔱 Sultan's Decree</button>
                                <button onClick={() => handleTieProtocolSelect('revote')} className="btn-premium w-full bg-white/10 text-gold border-gold/40 py-4 rounded-xl font-bold">🗳️ The Re-Vote</button>
                                <button onClick={() => handleTieProtocolSelect('spin')} className="btn-premium w-full bg-red-950/40 text-red-500 border-red-900/50 py-4 rounded-xl font-bold">✒️ Spin the Pen</button>
                            </div>
                        </div>
                    )}

                    {gameState?.tie_protocol === 'decree' && (
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-3">
                            <p className="text-[10px] text-center text-gold uppercase font-black tracking-widest animate-pulse">Establishing the Decree...</p>
                            {gameState.tied_player_ids?.map(id => {
                                const player = players.find(p => p.id === id);
                                return (
                                    <button key={id} onClick={() => handleBanish(id)} className="btn-premium w-full bg-red-600/20 border-red-500/40 text-red-500 py-4 rounded-xl font-bold">
                                        Banish {player?.name}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {gameState?.tie_protocol === 'spin' && (
                         <div className="p-6 bg-red-950/40 rounded-3xl border-2 border-red-900 animate-pulse text-center space-y-6">
                            <h3 className="text-red-500 font-black uppercase tracking-widest text-xs">Pen of Fate</h3>
                            <button 
                                onClick={handleSpinThePen} 
                                disabled={isSpinning}
                                className={`w-24 h-24 rounded-full border-4 flex items-center justify-center text-4xl mx-auto transition-all ${isSpinning ? 'animate-spin border-red-500' : 'border-red-900 bg-red-600/20'}`}
                            >
                                ✒️
                            </button>
                            <p className="text-red-100/60 text-[10px] uppercase font-black">{isSpinning ? 'The spin has begun...' : 'Click to Spin!'}</p>
                         </div>
                    )}

                    {gameState?.tie_protocol === 'revote' && (
                        <div className="p-6 bg-emerald-950/40 rounded-3xl border-2 border-emerald-500/40 text-center space-y-3">
                            <h3 className="text-emerald-500 font-black uppercase tracking-widest text-xs animate-pulse">Re-Vote in Progress</h3>
                            <p className="text-white/40 text-[10px]">Tied: {gameState.tied_player_ids?.map(id => players.find(p => p.id === id)?.name).join(' vs ')}</p>
                            <div className="text-2xl font-black tabular-nums">{votes.length} / {alivePlayers.length}</div>
                            <button 
                                onClick={() => setIsVotesLocked(true)}
                                disabled={votes.length < alivePlayers.length || isVotesLocked}
                                className="btn-premium w-full bg-emerald-600 py-4 rounded-xl text-sm"
                            >
                                Lock Re-Votes
                            </button>
                        </div>
                    )}

                    <button 
                        onClick={() => potentialWinner ? handleTransition('end') : handleTransition('night')}
                        disabled={!players.some(p => p.status === 'banished') && !potentialWinner} 
                        className="btn-premium w-full bg-white text-black py-6 rounded-2xl border-gray-300 mt-4 text-lg"
                    >
                        {potentialWinner ? 'Reveal Scores (Victory!)' : 'Proceed to Night'}
                    </button>
                </div>
              )}

              {phase === 'night' && (
                <div className="space-y-4">
                    <div className="bg-black/40 p-6 rounded-2xl border border-white/10">
                        <h3 className="text-xs uppercase font-bold text-gray-500 mb-4 tracking-widest text-center">Plagiarist Coordination</h3>
                        <div className="space-y-3">
                            {alivePoets.map(p => {
                                const count = nightVoteTallies[p.id] || 0;
                                const isConsensus = activeNightTargetId === p.id;
                                const percentage = (count / (alivePlagiarists.length || 1)) * 100;
                                
                                return (
                                    <div key={p.id} className="space-y-1">
                                        <div className="flex justify-between text-[10px] uppercase font-bold">
                                            <span className={isConsensus ? 'text-red-500' : ''}>{p.name} {isConsensus && '🎯'}</span>
                                            <span>{count} Votes</span>
                                        </div>
                                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                            <div className={`h-full transition-all duration-500 ${isConsensus ? 'bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)]' : 'bg-gray-600'}`} style={{ width: `${percentage}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {!silenceConfirmed ? (
                        <div className="space-y-3">
                             <p className="text-[10px] text-center text-red-500/60 uppercase font-black tracking-widest animate-pulse">
                                {nightConsensusPlayers.length > 1 ? "Tie detected! Choose between the tied suspects." : "Waiting for Consensus..."}
                             </p>
                             
                             <div className="grid grid-cols-1 gap-2">
                                {(nightConsensusPlayers.length > 1 ? nightConsensusPlayers : (activeNightTargetId ? [players.find(p => p.id === activeNightTargetId)!] : [])).map(p => (
                                    <button 
                                        key={p.id}
                                        onClick={() => handleSilence(p.id)}
                                        className="btn-premium w-full bg-red-600 py-4 rounded-xl border-red-500 text-sm font-bold uppercase tracking-widest"
                                    >
                                        Silence {p.name}
                                    </button>
                                ))}
                             </div>
                        </div>
                    ) : (
                        <div className="space-y-4 animate-scale-up">
                            <div className="p-4 bg-emerald-900/20 border border-emerald-500/30 rounded-2xl text-center">
                                <p className="text-[10px] uppercase text-emerald-500 font-black tracking-widest">Silence Executed</p>
                            </div>
                            
                            <button 
                                onClick={() => potentialWinner ? handleTransition('end') : handleWakeUpReveal(nightVotes[0]?.target_id || null)}
                                disabled={gameState.is_revealing && !potentialWinner}
                                className="btn-premium w-full bg-gold text-black py-6 rounded-2xl border-gold/50 text-lg font-black uppercase tracking-[0.2em] shadow-[0_10px_30px_rgba(255,215,0,0.2)] active:scale-95 transition-all"
                            >
                                {potentialWinner ? "Reveal Scores (Victory!)" : gameState.is_revealing ? "Reveal in Progress..." : "Wake Up & Reveal"}
                            </button>

                            {gameState.is_revealing && (
                                <button 
                                    onClick={() => handleTransition(potentialWinner ? 'end' : 'mission')}
                                    className="btn-premium w-full bg-white text-black py-4 rounded-xl border-gray-300 animate-fade-enter-active"
                                >
                                    {potentialWinner ? "End Game & Reveal Scores" : "Dismiss Reveal & Next Mission"}
                                </button>
                            )}
                        </div>
                    )}
                </div>
              )}

              {phase === 'end' && (
                <div className="space-y-4">
                    <div className="p-8 bg-gold/20 rounded-3xl border-4 border-gold/40 text-center mb-6 shadow-2xl">
                        <h2 className="text-5xl font-black text-gold serif mb-3 uppercase tracking-tighter italic">{gameState.winner_faction} WIN!</h2>
                        <p className="text-gold/60 uppercase text-[10px] font-black tracking-widest border-t border-gold/20 pt-4">Final Eidi Pot: ₹{gameState.eidi_pot}</p>
                    </div>
                    <button onClick={() => resetGame(roomId!)} className="btn-premium w-full bg-emerald-600 py-5 rounded-2xl border-emerald-500 shadow-xl">Play Again</button>
                    <button onClick={() => deleteRoom(roomId!)} className="btn-premium w-full bg-white/5 text-gray-500 py-4 rounded-xl border-white/10">End Gathering</button>
                </div>
              )}
            </div>

            <button 
                onClick={handleEmergencyReset}
                className="mt-10 pt-4 border-t border-white/5 text-[9px] uppercase tracking-[0.4em] text-gray-700 hover:text-red-500 transition-colors text-center w-full"
            >
                Emergency Reset
            </button>
          </section>
        </div>
      </div>
    </main>
  );
}
