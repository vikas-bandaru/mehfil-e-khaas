# Mehfil-e-Khaas: Game Design & Structural Parallels

## 🕯️ The Concept
"Mehfil-e-Khaas" is a social deduction game set in a high-stakes poetic gathering in historical Hyderabad. The Sultan has offered a collective bounty (`Eidi Pot`) to his most loyal poets. However, the gathering has been infiltrated by Plagiarists (`Naqal-baaz`) whose goal is to sabotage the poetry and steal the wealth for themselves.

## 🎭 Visual Identity: Royal Nocturne
The game features a premium, cinematic aesthetic defined by:
- **Palette**: Deep charcoal backgrounds with Gold (`#D4AF37`) accents.
- **Typography**: Sophisticated Serif (Lora) for headings to evoke a "Historical Manuscript" feel.
- **Atmosphere**: Glassmorphism, subtle gold glows, and smooth transitions.

## 🕹️ Gameplay Loop

### 1. Mission Phase (The Poetic Challenge)
- **Objective:** Poets must complete a logical or creative challenge set by the Sultan.
- **Two-Stage Timing:**
    - **60 seconds Preparation:** All players (except Plagiarists) are blindfolded. Plagiarists use this time to view their secret assignment.
    - **90 seconds Solving:** All players open their eyes. The group works together to solve the challenge.
- **Sabotage:** Plagiarists can secretly trigger a "Sabotage" signal. If verified by the Host, they steal gold from the collective pot into their `private_gold` (Black Money).

### 2. Majlis Phase (The Banishment)
- **Objective:** Debate and identify the infiltrators.
- **Banishment:** Players vote on who they suspect to be a Plagiarist. 
- **Tie-Breaking:** If the vote is tied, the Host utilizes "Sultan's Decree" (manual), "Re-vote," or "Spin the Pen" (random) to decide the fate of the suspects.
- **Outcome:** Banished players enter the "Spirit World" (Spectator State).

### 3. Night Phase (The Silencing)
- **Objective:** Plagiarists choose a target to silence.
- **The Vote:** Plagiarists cast a secret ballot. The Host confirms the most-voted target.
- **Silencing:** The victim is "Zabaan-bandi" (Silenced) and is prohibited from speaking or interacting in the next Majlis.

### 3. Payout Phase (The Final Reward)
- **Objective:** Showcase the final wealth accumulated across the entire gathering.
- **Trigger:** The Host clicks "End Gathering & Pay Out" after any game ends.
- **Outcome:** The room transitions to a special "Payout" screen showing a session-wide leaderboard ranked by `Gathering Gold`.

## ⚙️ Game Engine Design
The engine is built on a **State-Driven Sync** model:
- **Global Phase Manager:** A single `current_phase` flag in the database dictates the UI layout for all participants.
- **Persistent Wealth Engine:** `Private Gold` tracks individual earnings (stolen or awarded), while the `Eidi Pot` tracks the collective pool and potential shares.
- **Session Resilience (Refresh Guard):** Identity (`playerId`) and role reveal status are anchored in `localStorage`, allowing the engine to re-sync a player's exact state (including Silenced or Banished views) after a browser refresh.
- **Liquidation Logic:** A dedicated function computes and distributes the remaining pot to all surviving Poets upon victory. This function also moves `private_gold` into `gathering_gold` (Cumulative Total) before resetting the game.

## 🏛️ The Gathering (Multi-Game Session)
Mehfil-e-Khaas is designed for a full evening of play. A "Gathering" consists of multiple games played with the same group.

- **Session Wealth (`Gathering Gold`):** Total wealth accumulated across all games in a room. This is the persistent score that defines the ultimate winners of the evening.
- **Game Wealth (`Private Gold`):** Wealth earned within a single game through missions or sabotages. This is converted into "Session Wealth" at the end of each game and then reset.
- **Pot Share:** At the end of each game, the remaining `Eidi Pot` is liquidated and shared with the winning faction, becoming part of their cumulative Session Wealth.
- **Verification:** The final pot value from the last game (`Last Game Pot`) is stored so players can verify the distribution was accurate even after the pot is reset for a new round.
- **End of Gathering:** When the Host decides to conclude the evening, they transition to the `Payout` phase to reveal the final Sultan's favorites.

## 🏰 Parallels with "The Traitors"

| Feature | The Traitors (UK/US) | Mehfil-e-Khaas |
| :--- | :--- | :--- |
| **Loyal Faction** | Faithfuls | Poets (`Sukhan-war`) |
| **Infiltrator Faction** | Traitors | Plagiarists (`Naqal-baaz`) |
| **Daily Activity** | Mission (Shield/Money) | Mission (`Eidi Pot` / Sabotage) |
| **Banishment Ceremony** | The Round Table | The Majlis |
| **Infiltrator Action** | The Murder | The Silencing (`Zabaan-bandi`) |
| **Eliminated Players** | Murders/Banishments | Banished (Spirit World) / Silenced |
| **The Reward** | Winning Pool | `Eidi Pot` Distribution |
| **Gathering Goal** | The Full Season | The Gathering (`Gathering Gold`) |
