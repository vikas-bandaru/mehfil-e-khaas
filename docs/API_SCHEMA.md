# 📊 Database Schema & Data Contracts

The "Natak" engine relies on a **Postgres-First** architecture. We use Custom Enums for state control and Atomic Functions to handle complex win-condition payouts.

---

## 🏗️ 1. Domain Logic (Custom Enums)
To ensure data integrity, we use strict Enums across the platform:
* **`game_phase`**: `lobby`, `reveal`, `mission`, `majlis`, `night`, `end`, `payout`.
* **`player_role`**: `sukhan_war` (Poet/Runner), `naqal_baaz` (Plagiarist/Spy).
* **`player_status`**: `alive`, `silenced`, `banished`.

---

## 🏛️ 2. Core Tables & Relationships

### `game_rooms` (The Global State)
This is the "Brain" of the room. Every view subscribes to this table for real-time updates.
* **`current_phase`**: Controls the UI state of every connected device.
* **`sabotage_triggered`**: Boolean flag that turns TRUE once the Host verifies the Spy signals.
* **`tie_protocol`**: Stores the method for breaking ties (`spin`, `decree`, etc.).
* **`reveal_target_id`**: Foreign key pointing to the player currently being "Ejected" or "Revealed".

### `players` (The Actors)
* **`private_gold`**: Wealth earned in the *current* game round.
* **`gathering_gold`**: Persistent wealth accumulated across multiple games in a session.
* **`has_signaled`**: The temporary flag used by Spies to "Trigger" a sabotage.

### `votes` & `night_votes`
* **`round_id`**: Signals are stored in `votes` with `round_id: 0` to differentiate them from standard banishment votes.
* **Uniqueness**: Both tables use `UNIQUE` constraints to prevent double-voting in the same round.

---

## 🧪 3. Atomic Operations (PostgreSQL Functions)

### `liquidate_gathering_pot`
This function is the "Financial Heart" of the engine. It prevents race conditions by processing the end-of-game payout in a single database transaction:
1. Adds the `share_amount` to winners' `private_gold`.
2. Transfers all `private_gold` to the session-wide `gathering_gold`.
3. Resets the room to `lobby` and clears all sabotage flags.

---

## 🛰️ 4. Real-time Configuration
The following tables are added to the `supabase_realtime` publication. If you modify these, the changes will broadcast to all clients in milliseconds:
* `game_rooms`
* `players`
* `votes`
* `night_votes`

---

## 🛡️ 5. Security (RLS)
While we have **Allow All** policies for ease of use in physical gatherings, the schema is prepared for strict Row Level Security (RLS). 
* **Current Policy**: `Public Access` (All users can perform `ALL` actions to avoid friction during local play).