import { supabase } from './supabase';

// Updated to match PostgreSQL Enums in lowercase
export type GamePhase = 'lobby' | 'reveal' | 'mission' | 'majlis' | 'night' | 'end' | 'payout';
export type PlayerRole = 'sukhan_war' | 'naqal_baaz';
export type PlayerStatus = 'alive' | 'silenced' | 'banished';

export interface GameState {
  id: string; // UUID
  room_code: string;
  current_phase: GamePhase;
  eidi_pot: number;
  current_round: number;
  current_mission_id: number | null;
  sabotage_triggered: boolean;
  winner_faction?: 'poets' | 'plagiarists' | null;
  is_dev_mode: boolean;
  min_players_required: number;
  mission_timer_end: string | null; // ISO string
  tie_protocol?: 'none' | 'decree' | 'revote' | 'spin';
  tied_player_ids?: string[]; // Player UUIDs
  reveal_target_id?: string | null;
  is_revealing?: boolean;
  last_game_pot?: number;
  sabotage_used?: boolean;
}

export interface Player {
  id: string; // UUID
  room_id: string; // references game_rooms(id)
  name: string;
  role: PlayerRole;
  status: PlayerStatus;
  private_gold: number;
  gathering_gold?: number;
  joined_at: string;
}

export interface Mission {
  id: number;
  title: string;
  public_goal: string;
  secret_sabotage: string;
  host_answer_key?: string;
}

/**
 * Core Game Logic Utilities
 */

export const createRoom = async (roomCode: string, hostName: string, shouldPlay: boolean = true, minPlayers: number = 8) => {
  const { data: game, error: gameError } = await supabase
    .from('game_rooms')
    .insert([{ 
      room_code: roomCode, 
      current_phase: 'lobby', 
      eidi_pot: 0,
      min_players_required: minPlayers
    }])
    .select()
    .single();

  if (gameError) throw gameError;

  let player = null;
  if (shouldPlay) {
    const { data: playerData, error: playerError } = await supabase
      .from('players')
      .insert([{ 
        room_id: game.id, 
        name: hostName, 
        role: 'sukhan_war',
        status: 'alive'
      }])
      .select()
      .single();

    if (playerError) throw playerError;
    player = playerData;
  }

  return { game, player };
};

export const joinRoom = async (roomCode: string, playerName: string) => {
  const { data: game, error: gameError } = await supabase
    .from('game_rooms')
    .select('id')
    .eq('room_code', roomCode)
    .single();

  if (gameError || !game) throw new Error('Room not found');

  const { data: player, error: playerError } = await supabase
    .from('players')
    .insert([{ 
      room_id: game.id, 
      name: playerName,
      role: 'sukhan_war',
      status: 'alive'
    }])
    .select()
    .single();

  if (playerError) throw playerError;
  return { player, roomId: game.id };
};

export const advancePhase = async (roomId: string, nextPhase: GamePhase) => {
  const updateData: any = { 
    current_phase: nextPhase,
    mission_timer_end: null, // Clear timer on every transition by default
    sabotage_triggered: false, // Reset trigger on every phase change
    sabotage_used: false,      // Reset verification status
    is_revealing: false,
    reveal_target_id: null
  };

  if (nextPhase === 'mission') {
    // 1. Fetch Room Settings (Dev Mode)
    const { data: roomData } = await supabase.from('game_rooms').select('is_dev_mode').eq('id', roomId).single();
    const isDev = roomData?.is_dev_mode || false;

    // 2. Randomly select a mission
    const { data: missions } = await supabase.from('missions').select('id');
    if (missions && missions.length > 0) {
      const randomMission = missions[Math.floor(Math.random() * missions.length)];
      updateData.current_mission_id = randomMission.id;
    }
    updateData.sabotage_triggered = false;

    // 3. Set the 150s Mission Timer (60s Blindfold + 90s Solving)
    const timerEnd = new Date();
    timerEnd.setSeconds(timerEnd.getSeconds() + 150);
    updateData.mission_timer_end = timerEnd.toISOString();
  }

  const { error } = await supabase
    .from('game_rooms')
    .update(updateData)
    .eq('id', roomId);

  if (error) throw error;
};

export const startMission = async (roomId: string) => {
  // 1. Set the 150s Mission Timer (60s Blindfold + 90s Solving)
  const timerEnd = new Date();
  timerEnd.setSeconds(timerEnd.getSeconds() + 150);

  // 2. Clear previous sabotage signals (round_id 0) to allow a fresh start
  await supabase.from('votes').delete().eq('room_id', roomId).eq('round_id', 0);

  // 3. Update room state
  await supabase.from('game_rooms').update({ 
    mission_timer_end: timerEnd.toISOString(),
    sabotage_triggered: false,
    sabotage_used: false
  }).eq('id', roomId);
};

export const evaluateWinCondition = async (roomId: string) => {
  const { data: players, error } = await supabase
    .from('players')
    .select('role, status')
    .eq('room_id', roomId)
    .in('status', ['alive', 'silenced']);

  if (error || !players) return null;

  const poets = players.filter(p => p.role === 'sukhan_war').length;
  const plagiarists = players.filter(p => p.role === 'naqal_baaz').length;

  if (plagiarists === 0) return 'poets';
  if (plagiarists >= poets) return 'plagiarists';
  
  return null;
};

export const resetGame = async (roomId: string) => {
  console.log("🛠️ Starting Game Reset for Room:", roomId);
  
  const fullUpdate = { 
    current_phase: 'lobby', 
    eidi_pot: 0, 
    current_round: 0,
    current_mission_id: null,
    winner_faction: null,
    mission_timer_end: null,
    sabotage_used: false,
    sabotage_triggered: false,
    tie_protocol: 'none',
    tied_player_ids: [],
    is_revealing: false,
    reveal_target_id: null,
    last_game_pot: 0
  };

  // 1. Try Full Reset
  let { error: roomError } = await supabase
    .from('game_rooms')
    .update(fullUpdate)
    .eq('id', roomId);

  // Fallback: If sabotage columns are missing, try minimal reset
  if (roomError && roomError.message?.includes('column')) {
    console.warn("⚠️ Full reset failed (likely missing columns), attempting minimal reset...");
    const { error: minError } = await supabase
      .from('game_rooms')
      .update({
        current_phase: 'lobby',
        eidi_pot: 0,
        current_round: 0,
        current_mission_id: null,
        winner_faction: null,
        mission_timer_end: null,
        tie_protocol: 'none',
        tied_player_ids: [],
        is_revealing: false,
        reveal_target_id: null,
        last_game_pot: 0
      })
      .eq('id', roomId);
    roomError = minError;
  }

  if (roomError) {
    console.error("❌ Room Reset Failed:", roomError);
    throw roomError;
  }

  // 2. Reset players
  const { error: playerError } = await supabase
    .from('players')
    .update({ 
      status: 'alive', 
      private_gold: 0,
      gathering_gold: 0 
      // Note: We DO NOT reset role here, to avoid triggering evaluateWinCondition('poets') 
      // if any hook runs before the phase transition is fully processed.
      // Roles are re-assigned in handleAssignRoles anyway.
    })
    .eq('room_id', roomId);

  if (playerError) {
    console.error("❌ Player Reset Failed:", playerError);
    throw playerError;
  }

  // 3. Clear votes
  await supabase.from('votes').delete().eq('room_id', roomId);
  await supabase.from('night_votes').delete().eq('room_id', roomId);
  
  console.log("✅ Game Reset Complete");
};

export const deleteRoom = async (roomId: string) => {
  await supabase.from('votes').delete().eq('room_id', roomId);
  await supabase.from('players').delete().eq('room_id', roomId);
  await supabase.from('game_rooms').delete().eq('id', roomId);
};

export const assignRoles = async (roomId: string, manualTraitorCount?: number) => {
  const { data: players, error: fetchError } = await supabase
    .from('players')
    .select('*')
    .eq('room_id', roomId);

  if (fetchError || !players) throw fetchError;

  const shuffled = [...players].sort(() => Math.random() - 0.5);
  
  // Dynamic Role Assignment: 4-7 (1), 8-12 (2), 13+ (3)
  let traitorCount = manualTraitorCount ?? 1;
  if (!manualTraitorCount) {
    if (players.length >= 13) traitorCount = 3;
    else if (players.length >= 8) traitorCount = 2;
    else traitorCount = 1;
  }
  
  // Safety check: traitorCount cannot exceed player count - 1
  traitorCount = Math.min(traitorCount, players.length - 1);
  if (traitorCount < 1) traitorCount = 1;

  const updates = shuffled.map((p, index) => ({
    id: p.id,
    role: index < traitorCount ? 'naqal_baaz' : 'sukhan_war'
  }));

  console.log("Assigning roles to players...");
  for (const update of updates) {
    console.log(`Setting role for ${update.id} to ${update.role}`);
    const { error } = await supabase
      .from('players')
      .update({ role: update.role })
      .eq('id', update.id);
    if (error) {
      console.error(`Failed to assign role to ${update.id}:`, error);
      throw error;
    }
  }
  
  // Set round to 1 for the new game and clear all mission-related state
  await supabase.from('game_rooms').update({ 
    current_round: 1,
    current_mission_id: null,
    mission_timer_end: null,
    sabotage_used: false,
    sabotage_triggered: false,
    winner_faction: null
  }).eq('id', roomId);
  
  console.log("Roles assigned, round set to 1, and mission state cleared.");
};

export const liquidatePot = async (roomId: string, forcedWinner?: 'poets' | 'plagiarists') => {
  // 1. Fetch room data (pot and faction)
  const { data: room, error: roomError } = await supabase
    .from('game_rooms')
    .select('eidi_pot, winner_faction')
    .eq('id', roomId)
    .single();

  const winner = forcedWinner || room?.winner_faction;
  if (roomError || !room || !winner) return;

  const finalPot = room.eidi_pot || 0;
  
  // 2. Award faction shares if pot > 0
  if (finalPot > 0) {
    let query = supabase.from('players').select('id, private_gold').eq('room_id', roomId);
    
    if (winner === 'poets') {
      // Poets Win: Share among ALIVE poets only
      query = query.eq('role', 'sukhan_war').eq('status', 'alive');
    } else {
      // Plagiarists Win: Share among ALIVE plagiarists
      query = query.eq('role', 'naqal_baaz').eq('status', 'alive');
    }

    const { data: winners, error: winnersError } = await query;
    if (!winnersError && winners && winners.length > 0) {
      const share = Math.floor(finalPot / winners.length);
      for (const winnerObj of winners) {
        await supabase
          .from('players')
          .update({ private_gold: (winnerObj.private_gold || 0) + share })
          .eq('id', winnerObj.id);
      }
    }
  }

  // 3. Clear the pot in the DB and store last_game_pot for reference
  await supabase
    .from('game_rooms')
    .update({ eidi_pot: 0, last_game_pot: finalPot })
    .eq('id', roomId);

  // 4. Tally ALL players current game gains (private_gold) into their gathering total
  const { data: allPlayers } = await supabase
    .from('players')
    .select('id, private_gold, gathering_gold')
    .eq('room_id', roomId);

  if (allPlayers) {
    for (const p of allPlayers) {
      const newGatheringGold = (p.gathering_gold || 0) + (p.private_gold || 0);
      await supabase.from('players').update({ 
        gathering_gold: newGatheringGold,
        private_gold: 0 // Reset for the next round within the same gathering
      }).eq('id', p.id);
    }
  }
};
