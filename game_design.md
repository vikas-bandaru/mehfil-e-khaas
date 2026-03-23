# Mehfil-e-Khaas: Game Design & Structural Parallels

## 🕯️ The Concept
"Mehfil-e-Khaas" is a social deduction game set in a high-stakes poetic gathering in historical Hyderabad. The Sultan has offered a collective bounty (`Eidi Pot`) to his most loyal poets. However, the gathering has been infiltrated by Plagiarists (`Naqal-baaz`) whose goal is to sabotage the poetry and steal the wealth for themselves.

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

## ⚙️ Game Engine Design
The engine is built on a **State-Driven Sync** model:
- **Global Phase Manager:** A single `current_phase` flag in the database dictates the UI layout for all participants.
- **Persistent Wealth Engine:** `Private Gold` tracks individual earnings (stolen or awarded), while the `Eidi Pot` tracks the collective pool and potential shares.
- **Liquidation Logic:** A dedicated function computes and distributes the remaining pot to all surviving Poets upon victory.

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
| **End-Game Goal** | Split the Money | Liquidate the Pot |
