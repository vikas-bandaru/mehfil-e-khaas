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
    - `sabotage_used` (Flag) prevents Plagiarists from signaling twice in one mission, even if the Host clears the visual alert.

## 5. End-Game Wealth Distribution
- **Decision:** Automated "Liquidation" function.
- **Rationale:** Upon a Poet victory, the `liquidatePot` utility fetches all surviving Poets and distributes the `eidi_pot` equally into their `private_gold`. This ensures the reward feels tangible and reflects the "collective security" theme.

## 6. Thematic Components
- **Spirit World:** A desaturated, zinc-themed UI state for banished players to prevent them from interacting while allowing them to spectate.
- **Zabaan-bandi:** A restrictive overlay for silenced players that enforces the "social death" mechanic of the night phase.
- **Tie-Breaking Protocols:** Three distinct manual and randomized protocols (`Decree`, `Re-vote`, `Spin the Pen`) to ensure the game never stalls.

## 7. Public Readiness & Mobile Optimization
- **Button Standards:** All primary action buttons (Vote, Sabotage, Silence) are enforced with a `min-h-[44px]` touch target to ensure accessibility on small mobile screens.
- **Visual Feedback:** Buttons use `active:scale-95` to provide tactile confirmation of actions, reducing accidental double-clicks.
- **Layout Stability:** The `PlayerClient` uses `h-screen overflow-hidden` and `touch-none` overlays for restricted states (Silenced, Banished) to prevent "pull-to-refresh" or accidental scrolling from breaking the immersion.

## 8. Visual Systems & Thematic UI
- **Decision**: Implemented the **"Royal Nocturne"** design system across all routes.
- **Rationale**: Uses a deep charcoal (`#050505`) and gold (`#D4AF37`) palette with Lora (Serif) typography to evoke a high-stakes, historical manuscript aesthetic.
- **Interaction**: Integrated `IntersectionObserver` on the landing page to automatically expand the rules section once the CTA enters the viewport, ensuring a premium onboarding flow.

## 9. Database Schema Queries (PostgreSQL)
The following SQL queries were executed to evolve the database schema to support the Mehfil's game mechanics:

### Game Rooms Table Updates
```sql
-- Track cinematic reveal state
ALTER TABLE game_rooms ADD COLUMN IF NOT EXISTS is_revealing BOOLEAN DEFAULT FALSE;
ALTER TABLE game_rooms ADD COLUMN IF NOT EXISTS reveal_target_id UUID REFERENCES players(id);

-- Implement Tie-Breaking Protocols
ALTER TABLE game_rooms ADD COLUMN IF NOT EXISTS tie_protocol TEXT DEFAULT 'none';
ALTER TABLE game_rooms ADD COLUMN IF NOT EXISTS tied_player_ids UUID[];

-- Mission Sabotage Interlocking
ALTER TABLE game_rooms ADD COLUMN IF NOT EXISTS sabotage_used BOOLEAN DEFAULT FALSE;
```

### Votes & Night Activity
```sql
-- Create Night Votes for Plagiarist coordination
CREATE TABLE IF NOT EXISTS night_votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES game_rooms(id) ON DELETE CASCADE,
    voter_id UUID REFERENCES players(id) ON DELETE CASCADE,
    target_id UUID REFERENCES players(id) ON DELETE CASCADE,
    UNIQUE(room_id, voter_id)
);
```

## 10. Core JavaScript Utilities (`src/lib/game-logic.ts`)
We encapsulated the game's state transitions and calculations into reusable utility functions:

- `assignRoles(roomId, manualCount)`: Dynamically calculates the number of Plagiarists based on room size:
    - 4-7 Players: 1 Plagiarist
    - 8-12 Players: 2 Plagiarists
    - 13+ Players: 3 Plagiarists
  It then shuffles the `players` table and assigns roles accordingly.
- `startMission(roomId)`: Sets the `mission_timer_end` to now + 150 seconds and resets mission-specific flags like `sabotage_triggered` and `sabotage_used`.
- `evaluateWinCondition(roomId)`: Checks the remaining alive players. Returns `'poets'` if no Plagiarists remain, or `'plagiarists'` if they equal or outnumber the Poets.
- `liquidatePot(roomId)`: A critical end-game function that divides the `eidi_pot` among surviving Poets and updates their `private_gold` (Private Khazana).
- `resetGame(roomId)`: Restores the room to the lobby phase while maintaining player wealth (`private_gold`) for cumulative session reveals.
- `advancePhase(roomId, nextPhase)`: Orchestrates global phase transitions and mission selection.
