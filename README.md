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
- **Host Dashboard**: Control the game flow and manage transitions.
- **Player Mobile View**: Each player's private screen for role reveal and actions.
- **Public Display**: The "Source of Truth" showing collective status and cinematic reveals.

## 🛠️ Tech Stack
- **Framework**: Next.js 14+ (App Router)
- **Database/Real-time**: Supabase
- **Styling**: Tailwind CSS
- **State Management**: React Hooks + Supabase Realtime Subscriptions
