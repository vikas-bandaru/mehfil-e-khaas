'use client';

export const dynamic = 'force-dynamic';

import { useParams, useRouter } from 'next/navigation';
import { useGameState } from '@/hooks/useGameState';
import { usePlayers } from '@/hooks/usePlayers';
import { advancePhase, assignRoles, evaluateWinCondition, resetGame, deleteRoom, startMission, liquidatePot, GamePhase, Player, Mission } from '@/lib/game-logic';
import { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import * as Popover from '@radix-ui/react-popover';
import { motion, AnimatePresence } from 'framer-motion';

export default function HostDashboard() {
  const { roomCode } = useParams() as { roomCode: string };
  const router = useRouter();
  const { gameState, loading: gameLoading, setGameState } = useGameState(roomCode);
  const phase = gameState?.current_phase || 'lobby';
  const roomId = gameState?.id;
  const { players, loading: playersLoading } = usePlayers(roomId || '');
  
  const [votes, setVotes] = useState<any[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
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
  const [isSabotageVerified, setIsSabotageVerified] = useState(false);
  const [showScript, setShowScript] = useState(false);
  const [showTooltips, setShowTooltips] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(1);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [hostName, setHostName] = useState<string | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isBanishmentConfirmed, setIsBanishmentConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);

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
  const mostVotedPlayers = (alivePlayers.length === 2 && maxVotes === 0) ? alivePlayers : alivePlayers.filter(p => (voteTallies[p.id] || 0) === maxVotes && maxVotes > 0);

  const topAliveVictors = useMemo(() => {
    if (!gameState?.winner_faction) return [];
    const winningRole = gameState.winner_faction === 'poets' ? 'sukhan_war' : 'naqal_baaz';
    const factionAlive = players.filter(p => p.role === winningRole && p.status === 'alive');
    if (factionAlive.length === 0) return [];
    const maxScore = Math.max(...factionAlive.map(p => p.private_gold || 0));
    return factionAlive.filter(p => (p.private_gold || 0) === maxScore);
  }, [players, gameState?.winner_faction]);
  const isTie = alivePlayers.length === 2 
    ? (gameState?.tie_protocol === 'none' || !gameState?.tie_protocol)
    : isVotesLocked && mostVotedPlayers.length > 1 && (gameState?.tie_protocol === 'none' || !gameState?.tie_protocol);

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
  
  const currentSignals = useMemo(() => players.filter(p => p.has_signaled === true).length, [players]);
  const canVerifySabotage = useMemo(() => {
    if (!gameState || isVerifying || gameState.sabotage_used || isSabotageVerified || currentSignals === 0) return false;
    
    const requiredSignals = alivePlagiarists.length;
    const isUnanimous = currentSignals === requiredSignals && requiredSignals > 0;
    const isTimeout = timeLeft === 0 && phase === 'mission';
    
    return isUnanimous || isTimeout;
  }, [currentSignals, alivePlagiarists.length, timeLeft, phase, gameState?.sabotage_used, isVerifying, isSabotageVerified]);

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
        if (nextPhase === 'end' || nextPhase === 'night' || (gameState?.current_phase === 'night' && nextPhase === 'mission')) {
            const winner = await evaluateWinCondition(roomId);
            if (winner) {
                await supabase.from('game_rooms').update({ current_phase: 'end', winner_faction: winner }).eq('id', roomId);
                await liquidatePot(roomId, winner);
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
            setIsSabotageVerified(false);
            setSilenceConfirmed(false);
            setIsBanishmentConfirmed(false);
            
            // Clear reveal state when moving to a new phase
            await supabase.from('game_rooms').update({ 
                is_revealing: false, 
                reveal_target_id: null 
            }).eq('id', roomId);
        }
                // Optimistic UI Update
        console.log("Optimistic Transition to:", nextPhase);
        if (nextPhase === 'mission') {
            const timerEnd = new Date();
            timerEnd.setSeconds(timerEnd.getSeconds() + 90);
            setGameState(prev => prev ? { ...prev, current_phase: nextPhase, mission_timer_end: timerEnd.toISOString() } : null);
        } else {
            setGameState(prev => prev ? { ...prev, current_phase: nextPhase } : null);
        }

        await advancePhase(roomId, nextPhase);
    } catch (err: any) {
        console.error("Transition Error:", err);
        alert(`Error during ${nextPhase} transition: ${err.message || JSON.stringify(err)}`);
    }
  };

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    
    const hasSeenTutorial = localStorage.getItem('hasSeenHostTutorial');
    if (hasSeenTutorial === null) {
      setShowTooltips(true);
      setTutorialStep(1);
    }
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const tutorialContent = [
    {
      step: 1,
      title: "The Canvas",
      heading: "Cast the Court",
      text: "Open this on a TV or Projector so all poets can see the secret couplet.",
      target: "Step 1: Open Public Display"
    },
    {
      step: 2,
      title: "The Gathering",
      heading: "Assemble the Court",
      text: `Invite poets using the room code. You need ${gameState?.min_players_required ?? 8} players to begin.`,
      target: "Step 2: Join Link"
    },
    {
      step: 3,
      title: "The Decree",
      heading: "Begin the Mehfil",
      text: "Once everyone is here, click 'Assign Roles' to start the performance.",
      target: "Step 3: Start Button"
    }
  ];

  const handleAssignRoles = async () => {
    const minRequired = gameState?.min_players_required ?? (gameState?.is_dev_mode ? 1 : 4);
    if (players.length < minRequired) {
      console.log("Start Blocked:", { current: players.length, required: minRequired });
      return alert(`Minimum ${minRequired} players required to start.`);
    }
    
    setIsAssigning(true);
    console.log("Starting game with", players.length, "players...");
    
    // 1. Immediate Optimistic UI Update for the Sultan
    // This ensures the Teleprompter updates and the button changes INSTANTLY
    setGameState(prev => prev ? { ...prev, current_phase: 'reveal' } : null);
    
    const manualCount = gameState?.is_dev_mode ? devPlagiaristCount : undefined;
    
    try {
      console.log("Assigning roles...");
      await assignRoles(roomId!, manualCount);
      
      console.log("Advancing phase to reveal...");
      await handleTransition('reveal');
      
      // Tutorial Completion
      localStorage.setItem('hasSeenHostTutorial', 'true');
      setShowTooltips(false);
    } catch (err: any) {
      console.error("Critical Game Start Failure:", err);
      const errorMsg = err.message || JSON.stringify(err);
      const errorDetails = err.details || "No further details.";
      alert(`Critical Failure: ${errorMsg}\n\nDetails: ${errorDetails}\n\nThis is likely a Supabase RLS (Row Level Security) issue. Please ensure 'UPDATE' is enabled for the 'game_rooms' and 'players' tables.`);
      
      // Rollback on absolute failure
      setGameState(prev => prev ? { ...prev, current_phase: 'lobby' } : null);
    } finally {
      setIsAssigning(false);
    }
  };

  const toggleDevMode = async (enabled: boolean) => {
    if (!roomId) return;
    
    // Optimistic Update
    console.log("Optimistic Toggle Dev Mode:", enabled);
    setGameState(prev => prev ? { ...prev, is_dev_mode: enabled } : null);
    
    const { error } = await supabase.from('game_rooms').update({ is_dev_mode: enabled }).eq('id', roomId);
    if (error) {
      console.error("Supabase Update Error (is_dev_mode):", error);
      // Rollback on error
      setGameState(prev => prev ? { ...prev, is_dev_mode: !enabled } : null);
      alert("Error enabling dev mode: " + error.message);
    }
  };

  const updateMinPlayers = async (count: number) => {
    if (!roomId) return;
    await supabase.from('game_rooms').update({ min_players_required: count }).eq('id', roomId);
  };

  const handleBanish = async (playerId?: string) => {
    const targetId = playerId || banishedPlayerId;
    if (!targetId) return;
    
    // Optimistic Update
    setIsBanishmentConfirmed(true);
    
    const { error } = await supabase.from('players').update({ status: 'banished' }).eq('id', targetId);
    if (error) {
        console.error("Banishment Failed:", error);
        setIsBanishmentConfirmed(false);
        alert("Banishment failed: " + error.message);
        return;
    }
    
    // Reset tie protocol after banishment
    await supabase.from('game_rooms').update({ tie_protocol: 'none', tied_player_ids: [] }).eq('id', roomId);
    
    // Check win condition immediately after banishment
    const winner = await evaluateWinCondition(roomId!);
    if (winner) {
        await handleTransition('end');
    }
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
    if (!roomId) return;
    setIsSpinning(true);
    
    const tiedIds = gameState?.tied_player_ids || [];
    if (tiedIds.length === 0) {
        setIsSpinning(false);
        return;
    }

    // 1. Determine winner and sync to Display Page immediately
    const winnerId = tiedIds[Math.floor(Math.random() * tiedIds.length)];
    await supabase.from('game_rooms').update({ reveal_target_id: winnerId }).eq('id', roomId);
    
    // 2. Wait 15 seconds (5s spin + 10s showing the result)
    setTimeout(async () => {
        await handleBanish(winnerId);
        // Clear reveal target so next round is fresh
        await supabase.from('game_rooms').update({ reveal_target_id: null }).eq('id', roomId);
        setIsSpinning(false);
    }, 15000);
  };

  const handleSilence = async (targetId: string) => {
    if (!roomId) return;
    await supabase.from('players').update({ status: 'silenced' }).eq('id', targetId);
    await supabase.from('night_votes').delete().eq('room_id', roomId);
    // Persist target for plagiarist lockout
    await supabase.from('game_rooms').update({ reveal_target_id: targetId }).eq('id', roomId);
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
    if (missionOutcome || !gameState || isVerifying || gameState.sabotage_used) return; 
    
    setIsVerifying(true);

    if (!roomId) {
        console.error("Sabotage Verification Failed: Room ID is missing.");
        alert("Error: Room ID missing. Refresh and try again.");
        setIsVerifying(false);
        return;
    }

    // Fresh fetch to prevent race conditions
    // Use select('*') to bypass potential schema cache issues with specific columns
    const { data: latestRoom, error: fetchError } = await supabase.from('game_rooms').select('*').eq('id', roomId).single();
    if (fetchError) {
        console.error("Sabotage Fetch Failed:", fetchError);
        alert(`Verification Error: ${fetchError.message}`);
        setIsVerifying(false);
        return;
    }

    if (latestRoom?.sabotage_used) {
        setIsVerifying(false);
        setIsSabotageVerified(true);
        return;
    }

    // 1. Update Game Room State (Consolidated)
    // We set sabotage_triggered to true to signal the finalize logic to apply the tax
    const { error: roomError } = await supabase.from('game_rooms').update({ 
        sabotage_used: true,
        sabotage_triggered: true 
    }).eq('id', roomId);
    
    if (roomError) {
        console.error("Sabotage Room Update Failed Detail:", JSON.stringify(roomError, null, 2));
        alert(`Failed to update sabotage status: ${roomError.message}`);
        setIsVerifying(false);
        return;
    }
    
    // 2. Clear mission signals (round_id 0) is deferred until missionFinalized 
    // to ensure we can still identify signalers in final payout handlers
    
    // 3. Clear mission signals (round_id 0)
    await supabase.from('votes').delete().eq('room_id', roomId).eq('round_id', 0);
    
    // 4. Hard lock locally (Independent of mission outcome)
    setIsSabotageVerified(true);
    setIsVerifying(false); 
  };

  const handleMissionSuccess = async () => {
    if (missionOutcome || !roomId) return;
    
    try {
        const hasSabotage = gameState?.sabotage_triggered || false;
        const addAmount = hasSabotage ? 1000 : 2000;
        
        // 1. Update the Pot
        await supabase.from('game_rooms').update({ 
            eidi_pot: (gameState!.eidi_pot || 0) + addAmount,
            mission_timer_end: null 
        }).eq('id', roomId);

        // 2. If Sabotaged, award signaling plagiarists
        if (hasSabotage) {
            const signalingIds = votes.filter(v => v.round_id === 0).map(v => v.voter_id);
            if (signalingIds.length > 0) {
                // Fetch current golds for these specific players
                const { data: playersToAward } = await supabase
                    .from('players')
                    .select('id, private_gold')
                    .in('id', signalingIds);
                
                for (const p of playersToAward || []) {
                    await supabase.from('players').update({ 
                        private_gold: (p.private_gold || 0) + 1000 
                    }).eq('id', p.id);
                }
            }
        }

        setMissionOutcome('success');
    } catch (err) {
        console.error("Success update failed:", err);
        alert("Failed to update mission outcome.");
    }
  };

  const handleMissionFailure = async () => {
    if (missionOutcome || !roomId) return;
    
    try {
        const hasSabotage = gameState?.sabotage_triggered || false;
        
        // 1. Stop timer
        await supabase.from('game_rooms').update({ 
            mission_timer_end: null 
        }).eq('id', roomId);

        // 2. If Sabotaged, award signaling plagiarists (even on failure!)
        if (hasSabotage) {
            const signalingIds = votes.filter(v => v.round_id === 0).map(v => v.voter_id);
            if (signalingIds.length > 0) {
                const { data: playersToAward } = await supabase
                    .from('players')
                    .select('id, private_gold')
                    .in('id', signalingIds);
                
                for (const p of playersToAward || []) {
                    await supabase.from('players').update({ 
                        private_gold: (p.private_gold || 0) + 1000 
                    }).eq('id', p.id);
                }
            }
        }

        setMissionOutcome('failed');
    } catch (err) {
        console.error("Failure update failed:", err);
        alert("Failed to update mission outcome.");
    }
  };

  const handleStartMission = async () => {
    if (!roomId) return;
    // Reset local verification and outcome states for the new mission
    setIsSabotageVerified(false);
    setIsVerifying(false);
    setMissionOutcome(null);
    await startMission(roomId);
  };

  const handleResetGame = async () => {
    if (!roomId) return;
    
    try {
      // 1. Reset Local State (Instant UI Response)
      // This is critical to prevent the UI from flickering old state before the DB syncs
      setVotes([]);
      setNightVotes([]);
      setIsVotesLocked(false);
      setBanishedPlayerId(null);
      setMissionOutcome(null);
      setIsSabotageVerified(false);
      setActiveMission(null); // Clear previous mission details
      setSilenceConfirmed(false);
      setIsBanishmentConfirmed(false);
      setIsVerifying(false);
      
      // 2. Optimistic Phase Reset
      // Force the Sultan's view to Lobby immediately
      setGameState(prev => prev ? { 
        ...prev, 
        current_phase: 'lobby', 
        eidi_pot: 0, 
        current_round: 0, 
        current_mission_id: null,
        winner_faction: null,
        mission_timer_end: null
      } : null);

      // 3. Reset Database State
      await resetGame(roomId);
      
      console.log("Game Reset Successfully");
    } catch (err: any) {
      console.error("Reset Error:", err);
      alert("Error resetting game: " + err.message);
    }
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

  if (gameLoading || playersLoading) {
    return (
      <div className="min-h-screen bg-crimson-black flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-gold border-t-transparent rounded-full animate-spin mx-auto" />
          <h2 className="serif text-2xl text-gold animate-pulse">Loading God View...</h2>
        </div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="min-h-screen bg-crimson-black flex flex-col items-center justify-center p-6 text-center">
        <div className="glass p-12 rounded-3xl border border-gold/20 max-w-md">
          <h1 className="serif text-4xl text-gold mb-4">Room Not Found</h1>
          <p className="text-white/60 mb-8 font-sans">The Sultan has moved to another court, or this room code has expired.</p>
          <button 
            onClick={() => router.push('/')}
            className="btn-premium bg-gold text-background px-8 py-3 rounded-xl font-bold uppercase tracking-widest"
          >
            Return to Entrance
          </button>
        </div>
      </div>
    );
  }

  const currentMission = activeMission;
  return (
    <main className="min-h-screen bg-crimson-black text-white p-4 lg:p-10 space-y-6 relative">
      
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
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className={`btn-premium px-3 py-1.5 rounded-lg border transition-all ${
                  copied 
                    ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/40' 
                    : 'bg-white/10 text-white/80 border-white/20 hover:bg-white/20'
                }`}
              >
                {copied ? 'Copied!' : 'Copy'}
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
            <Popover.Root open={showTooltips && !isMobile && tutorialStep === 1}>
              <Popover.Trigger asChild>
                <button 
                  onClick={() => {
                    window.open(`/display/${roomCode}`, '_blank');
                    setTutorialStep(2);
                  }}
                  className={`btn-premium bg-gold/10 text-gold border-gold/40 px-6 py-4 rounded-full shadow-lg relative ${showTooltips && tutorialStep === 1 ? 'animate-pulse-gold' : ''}`}
                >
                  Open Public Display 📺
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content 
                  side="right" 
                  align="center" 
                  sideOffset={12}
                  className="z-50 outline-none"
                >
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="w-64 glass p-6 rounded-2xl border border-gold/30 shadow-[0_0_40px_rgba(212,175,55,0.2)] animate-float"
                  >
                    <div className="text-[10px] font-black text-gold uppercase mb-1 tracking-widest flex justify-between">
                      <span>Step 1: The Canvas</span>
                      <span>1/3</span>
                    </div>
                    <h4 className="serif text-white font-bold mb-2">Cast the Court</h4>
                    <p className="text-xs text-white/70 leading-relaxed mb-4">Open this on a TV or Projector so all poets can see the secret couplet and phase updates.</p>
                    <button 
                      onClick={() => setTutorialStep(2)}
                      className="text-[10px] font-black uppercase text-gold hover:text-white transition-colors flex items-center gap-2"
                    >
                      Got it, Next Step →
                    </button>
                    <Popover.Arrow className="fill-gold/20" />
                  </motion.div>
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
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
      <Popover.Root open={showTooltips && !isMobile && tutorialStep === 3}>
        <Popover.Trigger asChild>
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
                    {phase === 'end' ? (gameState.winner_faction === 'poets' ? "Justice is served! The Sukhan-war (Poets) prevail!" : "The Naqal-baaz (Plagiarists) rule the City!") 
                     : (phase === 'night' ? "The court has fallen. The Plagiarists rule the night." : "The Sultan's word is law. Listen closely to the decree.") }
                 </p>
              </div>
            )}
          </section>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content 
            side="top" 
            align="center" 
            sideOffset={12}
            className="z-50 outline-none"
          >
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-72 glass p-6 rounded-2xl border border-gold/30 shadow-[0_0_40px_rgba(212,175,55,0.2)] font-sans"
            >
              <div className="text-[10px] font-black text-gold uppercase mb-1 tracking-widest flex justify-between">
                <span>Step 3: The Decree</span>
                <span>3/3</span>
              </div>
              <h4 className="serif text-white font-bold mb-2">The Sultan's Power</h4>
              <p className="text-xs text-white/70 leading-relaxed mb-4">Once poets have gathered, click <strong>Assign Roles & Start</strong> in the panel below to begin the Mehfil.</p>
              <div className="flex justify-between items-center">
                <button 
                  onClick={() => setTutorialStep(2)}
                  className="text-[10px] font-black uppercase text-white/40 hover:text-white transition-colors"
                >
                  ← Back
                </button>
                <button 
                  onClick={() => setShowTooltips(false)}
                  className="text-[10px] font-black uppercase text-gold hover:text-white transition-colors"
                >
                  Finish
                </button>
              </div>
              <Popover.Arrow className="fill-gold/20" />
            </motion.div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

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
                <h3 className="text-2xl font-bold serif mb-2 text-white">{activeMission?.title ?? "Untitled Mission"}</h3>
                <p className="text-emerald-100/70 italic">"{activeMission?.public_goal ?? ""}"</p>
              </div>
              <div className="bg-red-900/20 border border-red-500/30 p-6 rounded-3xl">
                <h4 className="text-xs uppercase font-black text-red-500 mb-2 tracking-widest">Classified: Classified</h4>
                <p className="text-xl font-bold text-red-500 serif italic">"{activeMission?.secret_sabotage ?? ""}"</p>
              </div>
              
              {/* THE SOURCE OF TRUTH CARD */}
              <div className="md:col-span-2 bg-emerald-950/40 border-4 border-emerald-500 rounded-3xl p-8 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-150 transition-transform duration-1000">👑</div>
                  <h4 className="text-xs uppercase font-black text-emerald-500 mb-4 tracking-[0.3em]">The Source of Truth: Answer Key</h4>
                  <p className="text-3xl lg:text-4xl font-black text-white serif italic leading-tight">
                      {activeMission?.host_answer_key || "No answer key provided for this mission."}
                  </p>
              </div>

              {/* START MISSION BUTTON (Only if timer not started) */}
              {!gameState?.mission_timer_end && (
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
              <Popover.Root open={showTooltips && !isMobile && tutorialStep === 2}>
                <Popover.Trigger asChild>
                  <h2 className="text-xl font-bold serif text-gold cursor-help">Gathered Poets ({players.length}/{gameState.min_players_required ?? 4})</h2>
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Content 
                    side="left" 
                    align="center" 
                    sideOffset={12}
                    className="z-50 outline-none"
                  >
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="w-72 glass p-6 rounded-2xl border border-gold/30 shadow-2xl"
                    >
                      <div className="text-[10px] font-black text-gold uppercase mb-1 tracking-widest flex justify-between">
                        <span>Step 2: The Gathering</span>
                        <span>2/3</span>
                      </div>
                      <h4 className="serif text-white font-bold mb-2">Assemble the Court</h4>
                      <p className="text-xs text-white/70 leading-relaxed mb-4">Share the link above. Once we reach <strong>{gameState.min_players_required ?? 4} poets</strong>, the Sultan can start the session.</p>
                      <div className="flex justify-between items-center">
                        <button 
                          onClick={() => setTutorialStep(1)}
                          className="text-[10px] font-black uppercase text-white/40 hover:text-white transition-colors"
                        >
                          ← Back
                        </button>
                        <button 
                          onClick={() => setTutorialStep(3)}
                          className="text-[10px] font-black uppercase text-gold hover:text-white transition-colors"
                        >
                          Next Step →
                        </button>
                      </div>
                      <Popover.Arrow className="fill-gold/20" />
                    </motion.div>
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
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
          <section className="glass p-6 rounded-3xl border border-gold/20 bg-gold/5 flex flex-col h-full relative z-10">
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
                              type="range" min="1" max="12" 
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

                  <div className="relative z-20">
                    <button 
                      onClick={handleAssignRoles}
                      disabled={isAssigning || players.length < (gameState?.min_players_required ?? (gameState?.is_dev_mode ? 1 : 4))}
                      className={`btn-premium w-full bg-emerald-600 py-6 rounded-2xl shadow-2xl border-emerald-500/50 text-lg active:scale-95 transition-all ${isAssigning ? 'opacity-50 cursor-not-allowed' : ''} ${showTooltips && tutorialStep === 3 && players.length >= (gameState?.min_players_required ?? 4) ? 'animate-pulse-gold' : ''}`}
                    >
                      {isAssigning ? 'Assigning Roles...' : 'Assign Roles & Start'}
                    </button>
                  </div>
                  {players.length < (gameState?.min_players_required ?? 4) && !gameState?.is_dev_mode && (
                    <p className="text-center text-red-500 text-[10px] uppercase font-black tracking-widest mt-4 animate-pulse">Minimum {gameState?.min_players_required ?? 4} players required to start the Mehfil.</p>
                  )}
                </div>
              )}

              {phase === 'reveal' && (
                <button 
                    onClick={() => handleTransition('mission')}
                    disabled={gameState.current_mission_id !== null}
                    className={`btn-premium w-full bg-gold text-crimson-black py-6 rounded-2xl border-gold/50 text-lg ${gameState.current_mission_id ? 'opacity-20 grayscale' : ''}`}
                >
                    {gameState.current_mission_id ? 'Mission in Progress...' : 'Begin First Mission'}
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
                        Success: Answer Matches ({gameState?.sabotage_triggered ? '+₹1000 Taxed' : '+₹2000'})
                    </button>
                    
                    <button 
                        onClick={handleMissionFailure} 
                        disabled={timeLeft > 0 || !!missionOutcome}
                        className="btn-premium w-full bg-red-900/50 text-red-400 border-red-500/30 py-5 rounded-2xl disabled:opacity-20"
                    >
                        {timeLeft > 0 ? `Solving Phase Active...` : `Failed: Incorrect or Time Out`}
                    </button>
                    
                    <button 
                      onClick={handleVerifySabotage}
                      disabled={!canVerifySabotage || isVerifying || isSabotageVerified}
                      className="btn-premium w-full bg-red-600/20 text-red-500 border-red-600/40 py-4 rounded-2xl disabled:opacity-20"
                    >
                      {gameState?.sabotage_used ? "Sabotage Verified" : `Verify Sabotage (${currentSignals}/${alivePlagiarists.length})`}
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
                    {alivePlayers.length > 2 && (
                        <button 
                            onClick={() => setIsVotesLocked(true)}
                            disabled={votes.length < alivePlayers.length || isVotesLocked}
                            className="btn-premium w-full bg-gold/20 text-gold border-gold/40 py-5 rounded-2xl"
                        >
                            {isVotesLocked ? "Votes Locked" : "Lock Votes & Reveal"}
                        </button>
                    )}
                    
                    {isVotesLocked && !isTie && gameState?.tie_protocol === 'none' && !isBanishmentConfirmed && (
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
                                {alivePlayers.length > 2 && (
                                    <button onClick={() => handleTieProtocolSelect('revote')} className="btn-premium w-full bg-white/10 text-gold border-gold/40 py-4 rounded-xl font-bold">🗳️ The Re-Vote</button>
                                )}
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
                            <h3 className="text-emerald-500 font-black uppercase tracking-widest text-xs animate-pulse">
                                {isVotesLocked ? "Re-Vote Results" : "Re-Vote in Progress"}
                            </h3>
                            <p className="text-white/40 text-[10px]">Tied: {gameState.tied_player_ids?.map(id => players.find(p => p.id === id)?.name).join(' vs ')}</p>
                            
                            {!isVotesLocked ? (
                                <>
                                    <div className="text-2xl font-black tabular-nums">{votes.length} / {alivePlayers.length}</div>
                                    <button 
                                        onClick={() => setIsVotesLocked(true)}
                                        disabled={votes.length < alivePlayers.length || isVotesLocked}
                                        className="btn-premium w-full bg-emerald-600 py-4 rounded-xl text-sm"
                                    >
                                        Lock Re-Votes
                                    </button>
                                </>
                            ) : (
                                <div className="space-y-3 pt-4 border-t border-white/10">
                                    <p className="text-[10px] text-center text-gray-500 uppercase font-black tracking-widest">Select Player to Banish</p>
                                    {mostVotedPlayers.map(p => (
                                        <button key={p.id} onClick={() => setBanishedPlayerId(p.id)} className={`btn-premium w-full py-4 rounded-xl border ${banishedPlayerId === p.id ? 'bg-red-600 border-red-400' : 'bg-white/5 border-white/10'}`}>
                                            Banish {p.name} ({votes.filter(v => v.target_id === p.id).length} votes)
                                        </button>
                                    ))}
                                    <button 
                                        onClick={() => handleBanish()}
                                        disabled={!banishedPlayerId || isBanishmentConfirmed}
                                        className="btn-premium w-full bg-red-600 py-4 rounded-xl border-red-500 disabled:opacity-20"
                                    >
                                        Confirm Banishment
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {isBanishmentConfirmed && (
                        <div className="p-4 bg-red-600/10 rounded-2xl border border-red-500/40 text-center animate-pulse">
                            <p className="text-red-500 font-bold uppercase tracking-widest text-xs">Banishment Executed</p>
                            <p className="text-[10px] text-white/40 italic">The word has been struck from the books.</p>
                        </div>
                    )}

                    <button 
                        onClick={() => potentialWinner ? handleTransition('end') : handleTransition('night')}
                        disabled={(!isBanishmentConfirmed && !potentialWinner) || (!isVotesLocked && !potentialWinner)} 
                        className="btn-premium w-full bg-white text-black py-6 rounded-2xl border-gray-300 mt-4 text-lg"
                    >
                        {potentialWinner ? 'Reveal Scores (Victory!)' : 'Proceed to Night'}
                    </button>
                </div>
              )}

              {phase === 'night' && (
                <div className="space-y-4">
                    <div className="bg-black/40 p-6 rounded-2xl border border-white/10">
                        <h3 className="text-xs uppercase font-bold text-gray-500 mb-4 tracking-widest text-center">{alivePlagiarists.length > 1 ? "Plagiarist Coordination" : "Plagiarist Selection"}</h3>
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

              
              {phase === 'payout' && (
                <div className="space-y-6">
                    <div className="p-8 bg-emerald-900/40 rounded-3xl border-4 border-emerald-400/30 text-center mb-6 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-pulse" />
                        <h2 className="text-6xl font-black serif text-white uppercase tracking-tighter italic mb-2">Final Gathering Payout</h2>
                        <p className="text-emerald-400/60 uppercase text-xs font-black tracking-[0.3em]">The Mehfil concludes and the Sultan rewards his poets</p>
                        
                        <div className="mt-10 space-y-3">
                            {players.sort((a, b) => (b.gathering_gold || 0) - (a.gathering_gold || 0)).map((p, idx) => (
                                <div key={p.id} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10 hover:border-white/20 transition-all">
                                    <div className="flex items-center gap-4">
                                        <span className="text-emerald-400 font-black text-xl w-8">#{idx + 1}</span>
                                        <span className="text-white font-bold text-lg">{p.name} {p.status === 'banished' ? '👻' : ''}</span>
                                    </div>
                                    <div className="text-gold font-mono text-2xl font-black">₹{p.gathering_gold || 0}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <button 
                        onClick={handleResetGame}
                        className="btn-premium w-full bg-emerald-600 py-6 rounded-2xl border-emerald-500 shadow-xl text-xl font-black uppercase tracking-[0.2em]"
                    >
                        Start New Game in Room
                    </button>
                    <button 
                        onClick={() => router.push('/')} 
                        className="btn-premium w-full bg-white/10 text-white/40 py-4 rounded-xl border-white/10 text-sm font-black uppercase tracking-[0.2em]"
                    >
                        Exit to Main Menu
                    </button>
                    <button 
                        onClick={async () => {
                          await deleteRoom(roomId!);
                          router.push('/');
                        }}
                        className="w-full text-white/20 text-[10px] uppercase font-bold tracking-widest mt-4 hover:text-red-500 transition-colors"
                    >
                        Destroy Room & Exit
                    </button>
                </div>
              )}

              {phase === 'end' && (
                <div className="space-y-4">
                    <div className="p-8 bg-gold/20 rounded-3xl border-4 border-gold/40 text-center mb-6 shadow-2xl space-y-6">
                        <div className="space-y-2">
                             <h2 className="text-7xl font-black serif text-gold uppercase tracking-tighter italic drop-shadow-2xl">
                                {gameState.winner_faction === 'poets' ? 'The Sukhan-war (Poets) prevail!' : 
                                 gameState.winner_faction === 'plagiarists' ? 'The Naqal-baaz (Plagiarists) rule the City!' : 'The Mehfil Concludes'}
                             </h2>
                             <p className="text-gold/60 uppercase text-[10px] font-black tracking-widest border-t border-gold/20 pt-4">Final Eidi Pot: ₹{gameState.eidi_pot > 0 ? gameState.eidi_pot : gameState.last_game_pot}</p>
                        </div>

                        {topAliveVictors.length > 0 && (
                            <div className="p-6 bg-gold/10 rounded-2xl border border-gold/30 animate-scale-up">
                                <p className="text-[10px] text-gold font-black uppercase tracking-[0.3em] mb-4">✨ Supreme Victor ✨</p>
                                <div className="flex flex-wrap justify-center gap-6">
                                    {topAliveVictors.map(v => (
                                        <div key={v.id} className="text-center">
                                            <div className="text-4xl font-black serif italic text-white drop-shadow-lg">{v.name}</div>
                                            <div className="text-gold font-mono font-bold">₹{v.private_gold}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <button onClick={handleResetGame} className="btn-premium w-full bg-emerald-600 py-5 rounded-2xl border-emerald-500 shadow-xl">Play Again</button>
                    <button 
                        onClick={() => handleTransition('payout')} 
                        className="btn-premium w-full bg-white/10 text-white/60 py-4 rounded-xl border-white/10 hover:bg-white/20 active:scale-95 transition-all"
                    >
                        End Gathering & Pay Out
                    </button>
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
