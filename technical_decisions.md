# Technical Decisions - Mehfil-e-Khaas

This document outlines the architectural and technical choices made during the development of Mehfil-e-Khaas.

## 1. Real-time Synchronization: Supabase
The core mechanic of the game depends on tight synchronization across three distinct views (Host, Player, Public Display).
- **Decision:** We utilized **Supabase Realtime Subscriptions** (`postgres_changes`) for primary state sync.
- **Rationale:** This provides near-instant updates without the overhead of constant polling. By subscribing to the `game_rooms` and `players` tables, clients can react to phase changes, timer starts, and vote tallies as they happen.

## 2. Perspective-Driven UI Architecture
The application is split into three primary entry points:
- `/host/setup`: Dedicated page for hosting a new Mehfil.
- `/host/[roomCode]`: Elevated control, private logic reveal, and game state transitions.
- `/join`: Dedicated portal for players to enter a room code.
- `/play/[roomCode]`: Mobile-first player interface with hidden roles and action buttons.
- `/display/[roomCode]`: Cinematic public view for collective tracking and phase reveals.
- **Decision:** We used conditional rendering within these routes to manage "Inner Phases" (e.g., Blindfold vs. Solving within a Mission).

## 3. Persistent State Management
- **Database:** Used for cross-client critical data: `current_phase`, `eidi_pot`, `player_status`, and `votes`.
- **Decision:** Role reveal status and session identity (`playerId`, `roomCode`) are stored in `localStorage`.
- **Rationale:** This ensures that if a player refreshes their browser, the `PlayerClient` can immediately recover their identity and active role without requiring a re-join. This is critical for maintaining game flow during time-sensitive missions or voting phases.

## 4. Mission Control & Interlocking
- **Decision:** Implemented a "One-Click" state machine for mission outcomes.
- **Logic:** 
    - `mission_timer_end` acts as a global signal for active missions. Setting it to `null` halts the countdown on all connected clients instantly.
    - `sabotage_triggered` (Flag) persists until mission finalization. It determines if the "Sabotage Tax" (₹1000 reduction in pot gains) applies and triggers the "Plagiarist Heist" (₹1000 reward for signaling plagiarists).
    - `sabotage_used` (Flag) prevent Plagiarists from signaling twice in one mission.

## 5. End-Game Wealth Distribution
- **Decision:** Automated "Liquidation" function with session persistence.
- **Rationale:** Upon victory, the `liquidatePot` utility fetch winners and distributes the `eidi_pot`. Crucially, this is immediately added to the player's `gathering_gold` (Total Session Wealth), and the `eidi_pot` is reset to 0 to prevent double-liquidation. The final pot value is stored in `last_game_pot` for collective verification.
- **Decision:** "Payout Phase" for Gathering Conclusion.
- **Rationale:** To facilitate a proper ending to a multi-game session, a dedicated `payout` phase was added. This phase locks the room and displays a cumulative leaderboard from `gathering_gold`, ensuring players see their total earnings across all rounds played during the gathering.
- **Decision:** Robust Reset Logic.
- **Rationale:** The `resetGame` utility was enhanced with error-handling and a fallback mechanism to clear critical mission state even if schema updates are partially successful. This ensures the room always returns to a playable lobby state.

## 6. Thematic Components
- **Spirit World:** A desaturated, zinc-themed UI state for banished players to prevent them from interacting while allowing them to spectate.
- **Zabaan-bandi:** A restrictive overlay for silenced players that enforces the "social death" mechanic of the night phase.
- **Tie-Breaking Protocols:** Three distinct manual and randomized protocols (`Decree`, `Re-vote`, `Spin the Pen`) to ensure the game never stalls.

## 7. Public Readiness & Mobile Optimization
- **Button Standards:** All primary action buttons (Vote, Sabotage, Silence) are enforced with a `min-h-[44px]` touch target to ensure accessibility on small mobile screens.
- **Visual Feedback:** Buttons use `active:scale-95` to provide tactile confirmation of actions, reducing accidental double-clicks.
- **Layout Stability:** The `PlayerClient` uses `h-screen overflow-hidden` and `touch-none` overlays for restricted states (Silenced, Banished) to prevent "pull-to-refresh" or accidental scrolling from breaking the immersion.

## 9. Responsive Display Layout
- **Decision:** Viewport-Locked (`h-screen`) Cinematic Display.
- **Rationale:** To ensure a "single-glance" experience for public viewing, the `DisplayPage` was optimized to fit all phases (Lobby, Mission, Night, Payout) within a single viewport without scrolling.
- **Implementation:** 
    - Used `overflow-hidden` on the main container and global font-size reductions (e.g., 32px header, 10px room code labels) to guarantee a scroll-free experience.
    - Implemented a **5-second state delay** for the banished player highlight to perfectly synchronize with the cinematic Pen of Fate spin animation.
    - Used `vh` and `lg:` breakpoints for the Pen of Fate container to maintain visual hierarchy across different aspect ratios.

## 10. Cinematic Animations
- **Decision:** Customized Marquee Speed.
- **Rationale:** The "Night Phase" and "Breaking News" marquees were adjusted to a slow, 30-second duration (`animate-marquee-slow`) to maintain a premium, meditative feel consistent with the Royal Nocturne aesthetic.
- **Interaction Feedback:** The "Signal Sabotage" button on the player client was updated to provide immediate `isSignaling` feedback, disabling the button and changing the label to "Signaling..." to prevent double-clicks and reduce latency anxiety.

### Database Schema Repair (Run in Supabase SQL Editor)
Execute the following block to ensure all required columns exist for the gathering system and sabotage mechanics:

```sql
-- 1. Game Rooms: Sabotage & Multi-Game State
ALTER TABLE game_rooms ADD COLUMN IF NOT EXISTS sabotage_used BOOLEAN DEFAULT FALSE;
ALTER TABLE game_rooms ADD COLUMN IF NOT EXISTS sabotage_triggered BOOLEAN DEFAULT FALSE;
ALTER TABLE game_rooms ADD COLUMN IF NOT EXISTS last_game_pot INTEGER DEFAULT 0 NOT NULL;

-- 2. Game Rooms: Reveal & Tie-Breaking
ALTER TABLE game_rooms ADD COLUMN IF NOT EXISTS is_revealing BOOLEAN DEFAULT FALSE;
ALTER TABLE game_rooms ADD COLUMN IF NOT EXISTS reveal_target_id UUID REFERENCES players(id);
ALTER TABLE game_rooms ADD COLUMN IF NOT EXISTS tie_protocol TEXT DEFAULT 'none';
ALTER TABLE game_rooms ADD COLUMN IF NOT EXISTS tied_player_ids UUID[];

-- 3. Players: Gathering Wealth
ALTER TABLE players ADD COLUMN IF NOT EXISTS gathering_gold INTEGER DEFAULT 0 NOT NULL;

-- 4. Night Coordination Table
CREATE TABLE IF NOT EXISTS night_votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES game_rooms(id) ON DELETE CASCADE,
    voter_id UUID REFERENCES players(id) ON DELETE CASCADE,
    target_id UUID REFERENCES players(id) ON DELETE CASCADE,
    UNIQUE(room_id, voter_id)
);
-- 5. Enum Synchronization (Phases)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'game_phase' AND e.enumlabel = 'payout') THEN
        ALTER TYPE game_phase ADD VALUE 'payout';
    END IF;
END $$;
```
## 10. Core JavaScript Utilities (`src/lib/game-logic.ts`)
We encapsulated the game's state transitions and calculations into reusable utility functions:

- `assignRoles(roomId, manualCount)`: Dynamically calculates the number of Plagiarists based on room size:
    - 4-7 Players: 1 Plagiarist
    - 8-12 Players: 2 Plagiarists
    - 13-20 Players: 3 Plagiarists
  It then shuffles the `players` table and assigns roles accordingly.
- `startMission(roomId)`: Sets the `mission_timer_end` to now + 150 seconds and resets mission-specific flags like `sabotage_triggered` and `sabotage_used`.
- `evaluateWinCondition(roomId)`: Checks the remaining alive players. Returns `'poets'` if no Plagiarists remain, or `'plagiarists'` if they equal or outnumber the Poets.
- `liquidatePot(roomId)`: A critical end-game function that divides the `eidi_pot` among surviving Poets and updates their `private_gold` (Private Khazana).
- `resetGame(roomId)`: Restores the room to the lobby phase while maintaining session wealth (`gathering_gold`) but resetting current game earnings (`private_gold`) to 0.
- `advancePhase(roomId, nextPhase)`: Orchestrates global phase transitions and mission selection.
