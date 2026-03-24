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

## 🛠️ Tech Stack
- **Framework**: Next.js 16+ (App Router, Turbopack)
- **Database/Real-time**: Supabase
- **Styling**: Vanilla CSS (Premium "Royal Nocturne" System)
- **State Management**: React Hooks + Supabase Realtime Subscriptions
