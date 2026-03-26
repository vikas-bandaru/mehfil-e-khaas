import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Player } from '@/lib/game-logic';

export function usePlayers(roomId: string) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomId) return;

    // 1. Initial Fetch
    const fetchPlayers = async () => {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', roomId);

      if (!error && data) {
        setPlayers(data as Player[]);
      }
      setLoading(false);
    };

    fetchPlayers();

    // 2. Real-time Subscription
    const channel = supabase
      .channel(`players:all`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'players',
          // Broad subscription; filter in callback or just refetch
        },
        (payload) => {
          console.log("Real-time Update (players):", payload);
          if (payload.eventType === 'DELETE') {
            // Refetch on any deletion to ensure we catch room-wide wipes 
            // where room_id might not be in the 'old' payload
            fetchPlayers();
          } else if (payload.new && (payload.new as any).room_id === roomId) {
            fetchPlayers();
          }
        }
      )
      .subscribe();

    // 3. Polling Fallback
    const pollInterval = setInterval(() => {
      fetchPlayers();
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [roomId]);

  return { players, loading };
}
