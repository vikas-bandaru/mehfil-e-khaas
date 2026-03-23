import { supabase } from './supabase';

// Updated to match PostgreSQL Enums in lowercase
export type GamePhase = 'lobby' | 'reveal' | 'mission' | 'majlis' | 'night' | 'end';
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
}

export interface Player {
  id: string; // UUID
  room_id: string; // references game_rooms(id)
  name: string;
  role: PlayerRole;
  status: PlayerStatus;
  private_gold: number;
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

export const createRoom = async (roomCode: string, hostName: string, shouldPlay: boolean = true) => {
  const { data: game, error: gameError } = await supabase
    .from('game_rooms')
    .insert([{ room_code: roomCode, current_phase: 'lobby', eidi_pot: 0 }])
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
    mission_timer_end: null // Clear timer on every transition by default
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
  }

  const { error } = await supabase
    .from('game_rooms')
    .update(updateData)
    .eq('id', roomId);

  if (error) throw error;
};

export const startMission = async (roomId: string) => {
  const timerEnd = new Date();
  // New Flow: 150s total (60s blindfold + 90s solving)
  timerEnd.setSeconds(timerEnd.getSeconds() + 150);

  await supabase.from('game_rooms').update({ 
    mission_timer_end: timerEnd.toISOString(),
    sabotage_triggered: false 
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
  // 1. Reset room
  await supabase
    .from('game_rooms')
    .update({ 
      current_phase: 'lobby', 
      eidi_pot: 0, 
      current_round: 1, 
      current_mission_id: null,
      sabotage_triggered: false,
      winner_faction: null,
      mission_timer_end: null
    })
    .eq('id', roomId);

  // 2. Reset players
  await supabase
    .from('players')
    .update({ role: 'sukhan_war', status: 'alive', private_gold: 0 })
    .eq('room_id', roomId);

  // 3. Clear votes
  await supabase
    .from('votes')
    .delete()
    .eq('room_id', roomId);
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
  
  // Dynamic Role Assignment (Default: 1 for 4-7, 2 for 8+)
  let traitorCount = manualTraitorCount ?? (players.length >= 8 ? 2 : 1);
  
  // Safety check: traitorCount cannot exceed player count
  traitorCount = Math.min(traitorCount, players.length - 1);
  if (traitorCount < 1) traitorCount = 1;

  const updates = shuffled.map((p, index) => ({
    id: p.id,
    role: index < traitorCount ? 'naqal_baaz' : 'sukhan_war'
  }));

  for (const update of updates) {
    await supabase
      .from('players')
      .update({ role: update.role })
      .eq('id', update.id);
  }
};
