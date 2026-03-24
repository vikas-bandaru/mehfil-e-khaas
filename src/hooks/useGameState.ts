import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { GameState } from '@/lib/game-logic';

export function useGameState(roomCode: string) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomCode) return;

    // 1. Initial Fetch
    const fetchGameState = async () => {
      const { data, error } = await supabase
        .from('game_rooms')
        .select('*')
        .eq('room_code', roomCode)
        .single();

      if (!error && data) {
        setGameState(data as GameState);
      } else {
        setGameState(null);
      }
      setLoading(false);
    };

    fetchGameState();

    // 2. Real-time Subscription
    let channel: any;
    
    const startSubscription = (id: string) => {
      channel = supabase
        .channel(`room:${id}`)
        .on(
          'postgres_changes',
          {
            event: '*', 
            schema: 'public',
            table: 'game_rooms',
            // No filter here - we filter manually in JS for reliability
          },
          (payload) => {
            console.log("Real-time Update (game_rooms):", payload);
            if (payload.new && (payload.new as any).id === id) {
              setGameState(payload.new as GameState);
            }
          }
        )
        .subscribe((status) => {
          console.log("Subscription Status:", status);
        });
    };

    fetchGameState().then(async () => {
      console.log("Hook: Initial fetch complete for", roomCode);
      // Need the ID from the fetch to subscribe reliably
      const { data } = await supabase
        .from('game_rooms')
        .select('id')
        .eq('room_code', roomCode)
        .single();
        
      if (data?.id) {
        console.log("Hook: Subscribing to room ID", data.id);
        startSubscription(data.id);
      }
    });

    // 3. Polling Fallback (Every 5 seconds)
    // Real-time can be flaky in some environments, polling ensures eventual consistency.
    const pollInterval = setInterval(() => {
      fetchGameState();
    }, 5000);

    return () => {
      console.log("Hook: Cleaning up for", roomCode);
      if (channel) supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [roomCode]);

  return { gameState, loading, setGameState };
}
