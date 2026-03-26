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
    - `mission_timer_end` acts as a global signal for active missions (150s: 60s prepare + 90s solve). Setting it to `null` halts the countdown on all connected clients instantly.
    - **Unanimous Sabotage Signaling:** In multi-plagiarist games, the sabotage signal is only valid if **all active plagiarists** signal. This prevents accidental sabotages and forces coordination.
    - `sabotage_triggered` (Flag) persists until mission finalization. It determines if the "Sabotage Tax" (₹1000 reduction in pot gains) applies and triggers the "Plagiarist Heist" (₹1000 reward for signaling plagiarists).
    - `sabotage_used` (Flag) prevent Plagiarists from signaling twice in one mission.

## 5. End-Game Wealth Distribution
- **Decision:** Automated "Liquidation" function with session persistence.
- **Rationale:** Upon victory, the `liquidatePot` utility fetch winners and distributes the `eidi_pot`. Crucially, this is immediately added to the player's `gathering_gold` (Total Session Wealth), and the `eidi_pot` is reset to 0 to prevent double-liquidation. The final pot value is stored in `last_game_pot` for collective verification.
- **Decision:** "Payout Phase" for Gathering Conclusion.
- **Rationale:** To facilitate a proper ending to a multi-game session, a dedicated `payout` phase was added. This phase locks the room and displays a cumulative leaderboard from `gathering_gold`, ensuring players see their total earnings across all rounds played during the gathering.
- **Decision:** **Tabula Rasa Reset Mechanism.**
- **Rationale:** The `resetGame` utility ensures a clean slate for the next game round. It clears all game-specific state (votes, signals, mission data) while meticulously preserving `gathering_gold`. It features error-handling with a fallback mechanism to handle partial schema updates.

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
- **Rationale:** To ensure a "single-glance" experience for public viewing, the `DisplayPage` was optimized to fit all phases within a single viewport.
- **Implementation:** 
    - **QR Code Integration:** A high-contrast QR Code is displayed in the lobby for instant player on-boarding, generated dynamically from the current origin.
    - Used `overflow-hidden` on the main container and global font-size reductions to guarantee a scroll-free experience.
    - Implemented a **5-second state delay** for the banished player highlight to synchronize with the cinematic Pen of Fate spin animation.
    - Used `vh` and `lg:` breakpoints for the Pen of Fate container to maintain visual hierarchy.

## 10. Host Dashboard Hardening
- **Decision:** Critical Transition Guards.
- **Rationale:** To prevent game-breaking skips, the Host Dashboard enforces mandatory actions before advancing phases.
- **Logic:** 
    - During **Majlis (Vote Reveal)**, the Sultan must confirm a banishment or resolve a tie before moving to the next phase.
    - During **Night (Silencing)**, the Sultan must confirm the silenced victim before waking up the court.
    - Added an **Emergency Reset** button with double-confirmation to recover from unforeseen state stalls.

## 11. Cinematic Animations
- **Decision:** Synchronized Transition Delays.
- **Rationale:** Animations like the "Pen of Fate" and "Night Marquee" use timed transitions (e.g., 8s spin, 30s marquee) to create a premium, meditative feel consistent with the Royal Nocturne aesthetic.
- **Interaction Feedback:** The "Signal Sabotage" button on the player client provides immediate `isSignaling` feedback, disabling the button and changing the label to "Signaling..." to prevent double-clicks.

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
## 12. Core JavaScript Utilities (`src/lib/game-logic.ts`)
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

## 13. Project Folder Structure

A high-level overview of the repository's organization and the responsibility of each component.

### Hierarchy & Descriptions

- **`src/app/`**: Root of the App Router, following the `folder/page.tsx` convention.
    - `page.tsx`: Landing page with game overview and join/host navigation.
    - `layout.tsx`: Global root layout and metadata configuration.
    - `globals.css`: "Royal Nocturne" theme variables and Tailwind CSS styles.
    - `host/`:
        - `setup/page.tsx`: Room creation and configuration.
        - `[roomCode]/page.tsx`: The Host Dashboard for game-state control.
    - `play/[roomCode]/page.tsx`: Mobile-first player interface for in-game actions.
    - `display/[roomCode]/page.tsx`: Read-only cinematic view for the audience.
    - `join/page.tsx`: Simple entry point for players to join existing rooms.
    - `test-pen/page.tsx`: Animation testing page for the "Pen of Fate."
- **`src/hooks/`**: Custom React hooks for state management and Supabase interaction.
    - `useGameState.ts`: Manages real-time synchronization of the current room's state from the `game_rooms` table.
    - `usePlayers.ts`: Manages real-time synchronization of the list of players and their statuses.
- **`src/lib/`**: Shared utilities and business logic.
    - `game-logic.ts`: The central game engine that handles phase transitions, role assignments, eidi distribution, and win-condition evaluations.
    - `supabase.ts`: Configuration and initialization of the Supabase client.
- **`supabase/`**: Database infrastructure.
    - `schema.sql`: Contains the complete PostgreSQL schema, including tables (`game_rooms`, `players`, `night_votes`), custom Enums, and RLS policies.
- **`public/`**: Static assets, including brand icons, SVGs, and graphics used throughout the UI.
- **`Root Directory`**: Configuration and documentation.
    - `README.md`: Project overview and development setup.
    - `game_design.md`: Comprehensive guide to game rules, lore, and mechanics.
    - `technical_decisions.md`: This document, outlining architectural and design choices.
    - `package.json`: Project dependencies and scripts.
