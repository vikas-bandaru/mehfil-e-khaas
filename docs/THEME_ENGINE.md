# 🎨 Thematic Isolation Layer

The "Traitors" engine is designed to be **Theme-Agnostic**. This means the core logic (timer, signaling, state machine) does not care if the game is set in a historical court or a cyberpunk future.

## 🛠️ How it works
The theme is controlled through two primary vectors:

### 1. Database-Driven Content (`missions` table)
* **Secret Instructions**: Instead of hardcoding text, the `mission_description` is fetched from Supabase based on the active `mission_id`.
* **Role Labels**: The names for the "Poets" vs. "Runners" are mapped using a thematic dictionary in the UI.

### 2. Design System Tokens (Tailwind & CSS)
* **Color Palettes**: We use global CSS variables for the "Accent" colors (e.g., Gold `#D4AF37` vs. Cyan `#00F3FF`).
* **Typography**: The switch from Serif (Lora) to Monospace (Roboto Mono) is managed at the root layout level.

## 🧪 The "Cyber-Shadows" Stress Test
To verify this architecture, we successfully "exorcised" the project in a single session. By swapping the CSS variables and the SQL mission data, we transformed the entire atmosphere while keeping 100% of the `game-logic.ts` intact.