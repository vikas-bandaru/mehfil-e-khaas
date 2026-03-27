# 🕯️ Mehfil-e-Khaas: Social Deduction Game Engine

**Mehfil-e-Khaas** is a premium, real-time social deduction game engine set in the atmospheric landscape of a historical Hyderabadi poetic gathering. Inspired by modern social deduction classics like *The Traitors*, this platform enables groups of up to 20 players to engage in a high-stakes battle of wits, creative challenges, and professional deception.

> [!IMPORTANT]
> **Aesthetically Premium**: Designed with the "Royal Nocturne" theme, featuring deep charcoal backgrounds, gold accents, and elegant serif typography to evoke a cinematic experience.

---

## 🎭 The Concept
The Sultan has invited his most loyal poets (**Sukhan-war**) to a grand gathering, offering a collective bounty (**Eidi Pot**). However, **Plagiarists** (**Naqal-baaz**) have infiltrated the court. Their goal is simple: sabotage the Sultan's missions, steal the wealth for themselves, and remain undetected.

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v18 or later.
- **Supabase Account**: Required for real-time state synchronization.

### 2. Local Setup
1. **Clone & Install**:
   ```bash
   npm install
   ```
2. **Environment Configuration**: Create a `.env.local` file:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   ```
3. **Database Setup**: Execute the contents of `supabase/schema.sql` in your Supabase SQL Editor.
4. **Launch**:
   ```bash
   npm run dev
   ```

## 🕹️ How to Play

### 🕌 For the Host (The Sultan)
1. Navigate to `/host/setup` to create a new gathering.
2. Share the generated **Room Code** or the direct join link with your guests.
3. Use the **Host Dashboard** to advance the game through its phases (Lobby, Mission, Majlis, Night).
4. **Hardened Transitions**: The dashboard enforces mandatory actions (like confirming a banishment) before the game can progress.

### 📜 For the Players (The Poets & Plagiarists)
1. Join via the direct link or enter the code at `/join`.
2. **Session Recovery**: Don't worry about signal drops—the "Refresh Guard" will automatically restore your role and status upon reconnection.
3. **Unanimous Sabotage**: As a Plagiarist, you must coordinate. A sabotage is only verified if *all* active plagiarists signal for it.

### 🏛️ For the Public Display
1. Open `/display/[roomCode]` on a large screen or TV.
2. This view is the **Source of Truth**, showing cinematic reveals, mission timers, and the synchronized **Pen of Fate** animation.

## 📖 Documentation

For a deeper dive into the mechanics and architecture of Mehfil-e-Khaas, please refer to the following documents:

- **[Game Design Guide](file:///Users/vikas/Documents/project_experiments/mehfil-e-khaas/game_design.md)**: A comprehensive breakdown of game rules, lore, the synchronized state machine, and data flow diagrams.
- **[Technical Decisions](file:///Users/vikas/Documents/project_experiments/mehfil-e-khaas/technical_decisions.md)**: Detailed rationale behind our architectural choices, database schema repairs, and component responsibilities.

## 🛠️ Technical Architecture
- **Framework**: Next.js (App Router)
- **State Sync**: **Supabase Realtime** (Hub-and-Spoke model).
- **Styling**: Vanilla CSS with a custom design system.
- **Data Integrity**: Postgres CDC (Change Data Capture) ensures every device stays in perfect sync.

## 🤝 Contributing
We welcome contributions that improve the engine logic, UI polish, or developer experience!

1. **Architecture Research**: Read `game_design.md` for a deep dive into the state machine and data flow.
2. **Technical Decisions**: Check `technical_decisions.md` to understand the *why* behind our core abstractions.
3. **Branching**: Please create a feature branch for any significant changes.

---

*Set the stage, light the candles, and let the gathering begin.*
