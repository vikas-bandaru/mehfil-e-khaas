-- ==========================================
-- PROJECT: SOCIAL DEDUCTION ENGINE (Generic Schema)
-- DOCUMENTATION ONLY: DO NOT RUN ON LIVE DB
-- ==========================================

-- 1. Custom Enums (Core Logic)
CREATE TYPE game_phase AS ENUM ('lobby', 'reveal', 'mission', 'discussion', 'elimination_round', 'end', 'leaderboard');
CREATE TYPE player_role AS ENUM ('loyalist', 'traitor');
CREATE TYPE player_status AS ENUM ('alive', 'silenced', 'eliminated');

-- 2. The Game Room (The Hub)
CREATE TABLE game_rooms (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_code VARCHAR(6) UNIQUE NOT NULL,
    current_phase game_phase DEFAULT 'lobby' NOT NULL,
    prize_pool INTEGER DEFAULT 0 NOT NULL,
    current_round INTEGER DEFAULT 1 NOT NULL,
    last_round_pool INTEGER DEFAULT 0 NOT NULL,
    mission_timer_end TIMESTAMP WITH TIME ZONE,
    sabotage_triggered BOOLEAN DEFAULT FALSE,
    sabotage_used BOOLEAN DEFAULT FALSE,
    is_revealing BOOLEAN DEFAULT FALSE,
    reveal_target_id UUID REFERENCES players(id),
    tie_protocol TEXT DEFAULT 'none',
    tied_player_ids UUID[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. The Players (The Actors)
CREATE TABLE players (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id UUID REFERENCES game_rooms(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(50) NOT NULL,
    role player_role NOT NULL,
    status player_status DEFAULT 'alive' NOT NULL,
    private_score INTEGER DEFAULT 0 NOT NULL,
    session_score INTEGER DEFAULT 0 NOT NULL,
    has_signaled BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. The Missions (Static Seed Data)
CREATE TABLE missions (
    id SERIAL PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    public_goal TEXT NOT NULL,
    secret_sabotage TEXT NOT NULL,
    host_answer_key TEXT
);

-- 5. The Votes (Standard Voting)
CREATE TABLE votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id UUID REFERENCES game_rooms(id) ON DELETE CASCADE NOT NULL,
    round_id INTEGER NOT NULL,
    voter_id UUID REFERENCES players(id) ON DELETE CASCADE NOT NULL,
    target_id UUID REFERENCES players(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(room_id, round_id, voter_id)
);

-- 6. The Night Actions (Coordinated Traitor Voting)
CREATE TABLE night_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id UUID REFERENCES game_rooms(id) ON DELETE CASCADE NOT NULL,
    voter_id UUID REFERENCES players(id) ON DELETE CASCADE NOT NULL,
    target_id UUID REFERENCES players(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(room_id, voter_id)
);

-- ==========================================
-- REALTIME BROADCAST CONFIGURATION
-- ==========================================
ALTER PUBLICATION supabase_realtime ADD TABLE game_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE players;
ALTER PUBLICATION supabase_realtime ADD TABLE votes;
ALTER PUBLICATION supabase_realtime ADD TABLE night_votes;

-- ==========================================
-- ATOMIC LIQUIDATION FUNCTION (Pseudo-code logic)
-- ==========================================
-- CREATE OR REPLACE FUNCTION liquidate_round_pool(...)
-- 1. Calculate individual shares of prize_pool.
-- 2. Update player.private_score for winners.
-- 3. Accumulate player.private_score into player.session_score.
-- 4. Reset round-specific metrics (private_score, prize_pool).
