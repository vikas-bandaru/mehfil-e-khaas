# 🏗️ The "Traitors" Engine: System Architecture

This document outlines the shared technical DNA behind **Mehfil-e-Khaas** and **Cyber-Shadows**. While the themes differ, the underlying logic, real-time synchronization, and state management are identical.

---

## 🛰️ 1. The Real-Time "Hub-and-Spoke" Model
The engine operates on a **State-Driven Sync** model. Instead of complex API calls, the database acts as the single source of truth for all three concurrent views.

* **The Hub (Supabase):** Manages the global state in the `game_rooms` table and participant states in the `players` table.
* **The Spokes (Client Views):** 
    * **Host Dashboard**: The "Director" who triggers phase transitions.
    * **Player View**: The mobile "Controller" for voting and signaling.
    * **Display View**: The cinematic "TV Stage" for animations and reveals.

---

## ⚙️ 2. The Finite State Machine (FSM)
The game logic is governed by a central state controller: `game_rooms.current_phase`. Every client device subscribes to this column via **Supabase Realtime (CDC)**.

**Phase Flow:**
`Lobby` ➔ `Reveal` ➔ `Mission` ➔ `Majlis/Council` ➔ `Night/Silencing` ➔ `Payout`

* **Atomic Transitions**: When the Host advances the phase, the `game-logic.ts` utility performs a single atomic update to clear timers, reset sabotage flags, and update the phase string.
* **Session Recovery**: We use a **"Refresh Guard"** pattern. If a player’s phone reboots, the client fetches the current `roomId` and `playerId` from local storage and re-syncs with the live database state.

---

## 🛡️ 3. Signaling & Race Condition Handling
To prevent "Double-Signaling" in high-latency environments, we use a **Double-Lock Verification**:

1.  **Client-Side Lock**: The `isSignaling` state prevents a player from clicking the sabotage button twice.
2.  **Database Record**: A record is inserted into the `votes` table with `round_id: 0` to act as a permanent signal log.
3.  **Host "Fresh Fetch"**: Before the Host verifies a sabotage, the engine performs a manual `select` query to confirm the `sabotage_used` status is still `false`, bypassing any stale local cache.

---

## 🎨 4. The Thematic Isolation Layer
The engine is **Theme-Agnostic**. The core logic does not know what a "Sultan" or an "Overlord" is.

* **Configuration Over Coding**: UI labels and mission descriptions are pulled from the `missions` table and local theme config files.
* **CSS Variable Injection**: Visual identities (Gold vs. Cyan) are managed through Tailwind utility classes and CSS variables, allowing for a complete "Thematic Stress Test" in under two hours.

---

## 🛠️ Tech Stack Summary
* **Frontend**: Next.js (App Router) + Tailwind CSS.
* **Backend/Real-time**: Supabase (PostgreSQL + Realtime CDC).
* **Logic Layer**: JavaScript-based state utilities (`game-logic.ts`).

**Let’s see who survives the breach.** 🎭🚀