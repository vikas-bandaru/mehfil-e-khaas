# Mehfil-e-Khaas: Social Deduction Poetry Game

A real-time, multi-platform social deduction game set in a poetic gathering in Hyderabad. Inspired by "The Traitors," players take on roles as Poets (`Sukhan-war`) or Plagiarists (`Naqal-baaz`) to compete for the Sultan's Eidi.

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v18 or later.
- **Supabase**: Access to a project with `game_rooms`, `players`, `votes`, and `night_votes` tables.

### 2. Environment Variables
Create a `.env.local` file in the root directory and add your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Installation
```bash
npm install
```

### 4. Running the Application
```bash
# Start the development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🎭 Roles & Access
The application is designed to be played across multiple devices simultaneously:
- **Cinematic Landing Page**: A premium "Royal Nocturne" portal for players and hosts.
- **Host Setup (`/host/setup`)**: Dedicated flow for the Sultan to host a new Mehfil.
- **Join Portal (`/join`)**: Streamlined experience for guests to enter the game.
- **Host Dashboard**: Control the game flow with the Sultan's Teleprompter—a live guide for first-time hosts.
- **Player Mobile View**: Each player's private screen, fully optimized for touch with 44px targets and session recovery (Refresh Guard).
- **Public Display**: The "Source of Truth" showing collective status and cinematic reveals.

## 🕯️ Key Features
- **The Gathering**: Multi-game session tracking with persistent `Gathering Gold`.
- **Imperial Scale**: Support for large gatherings of up to **20 players** with dynamic role assignment.
- **Session Recovery**: Refresh Guard ensures no one loses their role or status.

## ✨ Thematic Experience
- **Royal Nocturne Aesthetic**: A premium dark-mode interface with gold accents and elegant typography.
- **Cinematic Displays**: Viewport-locked public display with responsive font-scaling (`clamp()`) for perfect presentation on any screen.
- **Atmospheric Animations**: Slow, meditative marquees and smooth glassmorphic transitions.
- **Immediate Feedback**: Reactive button states with "Signaling..." indicators to ensure a smooth, low-latency feel for players.

## 🛠️ Tech Stack
- **Framework**: Next.js 16+ (App Router, Turbopack)
- **Database/Real-time**: Supabase
- **Styling**: Vanilla CSS (Premium "Royal Nocturne" System)
- **State Management**: React Hooks + Supabase Realtime Subscriptions
