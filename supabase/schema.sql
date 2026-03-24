-- ==========================================
-- PROJECT: MEHFIL-E-KHAAS (Database Schema)
-- ==========================================

-- 1. Custom Enums (The Domain Logic)
CREATE TYPE game_phase AS ENUM ('lobby', 'reveal', 'mission', 'majlis', 'night', 'end');
CREATE TYPE player_role AS ENUM ('sukhan_war', 'naqal_baaz');
CREATE TYPE player_status AS ENUM ('alive', 'silenced', 'banished');

-- 2. The Game Room (The State Machine)
CREATE TABLE game_rooms (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_code VARCHAR(6) UNIQUE NOT NULL,
    current_phase game_phase DEFAULT 'lobby' NOT NULL,
    eidi_pot INTEGER DEFAULT 0 NOT NULL,
    current_round INTEGER DEFAULT 1 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. The Players (The Actors)
CREATE TABLE players (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id UUID REFERENCES game_rooms(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(50) NOT NULL,
    role player_role NOT NULL,
    status player_status DEFAULT 'alive' NOT NULL,
    private_gold INTEGER DEFAULT 0 NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. The Missions (The Static Seed Data)
CREATE TABLE missions (
    id SERIAL PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    public_goal TEXT NOT NULL,
    secret_sabotage TEXT NOT NULL
);

-- 5. The Votes (The Alliance Tracker)
CREATE TABLE votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id UUID REFERENCES game_rooms(id) ON DELETE CASCADE NOT NULL,
    round_id INTEGER NOT NULL,
    voter_id UUID REFERENCES players(id) ON DELETE CASCADE NOT NULL,
    target_id UUID REFERENCES players(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(room_id, round_id, voter_id) -- Prevents double voting in the same round
);

-- ==========================================
-- REALTIME & SECURITY CONFIGURATION
-- ==========================================
-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE game_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE players;
ALTER PUBLICATION supabase_realtime ADD TABLE votes;

-- Disable RLS for ease of use in a local physical gathering
-- (Alternatively, you can add 'Allow All' policies)
ALTER TABLE game_rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE players DISABLE ROW LEVEL SECURITY;
ALTER TABLE missions DISABLE ROW LEVEL SECURITY;
ALTER TABLE votes DISABLE ROW LEVEL SECURITY;

-- ==========================================
-- SEED DATA: THE 8 MISSIONS
-- ==========================================
INSERT INTO missions (title, public_goal, secret_sabotage) VALUES
('The Ghalib Gambit', 'Find the second line to: "Hazaron khwaishen aisi ke har khwaish pe dam nikle..."', 'Force the group to debate using the word "Hum" instead of "Kam" for at least 20 seconds.'),
('The Lughat Riddle', 'Define these three words correctly: Wasl, Gurez, Aatish-fishan.', 'Convince the group with absolute conviction that "Wasl" means separation/heartbreak.'),
('The Iqbal Insight', 'Find and recite a famous verse containing the word "Khudi".', 'Use the word "Aina" (Mirror) in a sentence at least twice while discussing the poetry.'),
('The Bait-Baazi Blitz', 'Play 3 rounds of Antakshari. Start with a verse ending in the letter Noon (N).', 'When it is your turn to help, stall and pretend to think deeply for 15 seconds to drain the clock.'),
('The Tashreeh Trap', 'Agree on a one-sentence English summary for: "Bas-ke dushvaar hai har kaam ka aasaan hona".', 'Ensure the word "Impossible" is included in the final English summary.'),
('The Qafiya Quest', 'Find 5 verses where the rhyming word (Qafiya) rhymes with "Dil".', 'Confidently suggest a false rhyme (like "Gul") and defend it for 30 seconds before backing down.'),
('The Zamana Search', 'Order these poets chronologically: Mir Taqi Mir, Faiz Ahmed Faiz, Allama Iqbal.', 'Adamantly claim that Faiz Ahmed Faiz lived and wrote before Allama Iqbal.'),
('The Visual Verse', 'Decode this emoji poem and recite it: 👣 + 🏠 + 🚫 + 💔', 'Offer a completely hilarious, distracting interpretation of the emojis to waste 45 seconds of their time.');

-- disable RLS for game-related tables

ALTER TABLE game_rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE players DISABLE ROW LEVEL SECURITY;
ALTER TABLE missions DISABLE ROW LEVEL SECURITY;
ALTER TABLE votes DISABLE ROW LEVEL SECURITY;

-- 1. Grant everything to the anonymous role (which the app uses)
GRANT ALL ON TABLE game_rooms TO anon;
GRANT ALL ON TABLE players TO anon;
GRANT ALL ON TABLE missions TO anon;
GRANT ALL ON TABLE votes TO anon;

-- 2. Explicitly force RLS off (again, for double-measure)
ALTER TABLE game_rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE players DISABLE ROW LEVEL SECURITY;
ALTER TABLE missions DISABLE ROW LEVEL SECURITY;
ALTER TABLE votes DISABLE ROW LEVEL SECURITY;

-- 3. Make sure the 'authenticated' role also has access (just in case)
GRANT ALL ON TABLE game_rooms TO authenticated;
GRANT ALL ON TABLE players TO authenticated;
GRANT ALL ON TABLE missions TO authenticated;
GRANT ALL ON TABLE votes TO authenticated;

-- Add the active mission tracker to the room
ALTER TABLE game_rooms 
ADD COLUMN current_mission_id INTEGER REFERENCES missions(id);

-- truncate tables
TRUNCATE TABLE votes, players, game_rooms RESTART IDENTITY CASCADE;

-- ALTER TABLE game_rooms 
ADD COLUMN is_dev_mode BOOLEAN DEFAULT FALSE,
ADD COLUMN min_players_required INTEGER DEFAULT 8;

-- ALTER TABLE game_rooms 
ADD COLUMN IF NOT EXISTS current_mission_id INTEGER,
ADD COLUMN IF NOT EXISTS sabotage_triggered BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS winner_faction TEXT,
ADD COLUMN IF NOT EXISTS is_dev_mode BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS min_players_required INTEGER DEFAULT 8;

ALTER TABLE game_rooms 
ADD COLUMN IF NOT EXISTS mission_timer_end TIMESTAMP WITH TIME ZONE;

-- 1. Add the Answer Key column
ALTER TABLE missions 
ADD COLUMN host_answer_key TEXT;

-- 2. Backfill the exact Answer Keys for the Host to verify
UPDATE missions SET host_answer_key = 'Answer: "...Bohat niklay mairay armaan, lekin phir bhi kam niklay."' WHERE title = 'The Ghalib Gambit';
UPDATE missions SET host_answer_key = 'Wasl = Union/Meeting with a lover. Gurez = Avoidance/Escape. Aatish-fishan = Volcano.' WHERE title = 'The Lughat Riddle';
UPDATE missions SET host_answer_key = 'Host Judgment: Accept any valid verse containing "Khudi" (e.g., Khudi ko kar buland itna...).' WHERE title = 'The Iqbal Insight';
UPDATE missions SET host_answer_key = 'Host Judgment: Verify they successfully chain 3 verses starting with the correct last letter.' WHERE title = 'The Bait-Baazi Blitz';
UPDATE missions SET host_answer_key = 'Host Judgment: Consensus required. Example: "It is difficult for everything to be easy; it is hard even for a man to be truly human."' WHERE title = 'The Tashreeh Trap';
UPDATE missions SET host_answer_key = 'Verify 5 distinct rhymes for Dil. (e.g., Mehfil, Mushkil, Sahil, Qatil, Manzil, Bismil).' WHERE title = 'The Qafiya Quest';
UPDATE missions SET host_answer_key = 'Correct Chronology: 1. Mir Taqi Mir (1723) -> 2. Allama Iqbal (1877) -> 3. Faiz Ahmed Faiz (1911).' WHERE title = 'The Zamana Search';
UPDATE missions SET host_answer_key = 'Acceptable Answer: "Ishq ne Ghalib nikamma kar diya, varna hum bhi aadmi the kaam ke." or any accurate translation of the emojis.' WHERE title = 'The Visual Verse';

SELECT * FROM missions;

-- add rooms tie handling columns
ALTER TABLE game_rooms ADD COLUMN IF NOT EXISTS tie_protocol TEXT DEFAULT 'none';
ALTER TABLE game_rooms ADD COLUMN IF NOT EXISTS tied_player_ids UUID[] DEFAULT '{}';

-- 1. Create Night Votes Table
CREATE TABLE IF NOT EXISTS night_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id UUID REFERENCES game_rooms(id) ON DELETE CASCADE NOT NULL,
    voter_id UUID REFERENCES players(id) ON DELETE CASCADE NOT NULL,
    target_id UUID REFERENCES players(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(room_id, voter_id)
);
ALTER TABLE night_votes DISABLE ROW LEVEL SECURITY;
ALTER PUBLICATION supabase_realtime ADD TABLE night_votes;

-- 2. Update Game Rooms for Reveal State
ALTER TABLE game_rooms ADD COLUMN IF NOT EXISTS reveal_target_id UUID REFERENCES players(id);
ALTER TABLE game_rooms ADD COLUMN IF NOT EXISTS is_revealing BOOLEAN DEFAULT FALSE;

-- 1. GAME ROOMS: Allow anyone to create, view, and update room phases
CREATE POLICY "Allow public insert to game_rooms" ON "public"."game_rooms" FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow public select on game_rooms" ON "public"."game_rooms" FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public update on game_rooms" ON "public"."game_rooms" FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- 2. PLAYERS: Allow joining, role updates, and state changes
CREATE POLICY "Allow public insert to players" ON "public"."players" FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow public select on players" ON "public"."players" FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public update on players" ON "public"."players" FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- 3. VOTES & NIGHT VOTES: Allow casting and clearing votes
CREATE POLICY "Allow public insert to votes" ON "public"."votes" FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow public select on votes" ON "public"."votes" FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public delete on votes" ON "public"."votes" FOR DELETE TO anon USING (true);

CREATE POLICY "Allow public insert to night_votes" ON "public"."night_votes" FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow public select on night_votes" ON "public"."night_votes" FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public delete on night_votes" ON "public"."night_votes" FOR DELETE TO anon USING (true);

-- 4. MISSIONS: Read-only for everyone
CREATE POLICY "Allow public select on missions" ON "public"."missions" FOR SELECT TO anon USING (true);
