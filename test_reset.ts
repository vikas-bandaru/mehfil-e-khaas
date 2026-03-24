
import { resetGame } from './src/lib/game-logic';
import { supabase } from './src/lib/supabase';

async function testReset() {
    console.log("Fetching room V7Y3...");
    const { data: room } = await supabase.from('game_rooms').select('id, room_code, current_phase').eq('room_code', 'V7Y3').single();
    if (!room) {
        console.error("Room V7Y3 not found.");
        return;
    }
    console.log(`Testing reset for room: ${room.room_code} (ID: ${room.id}, Phase: ${room.current_phase})`);
    
    try {
        console.log("Calling resetGame...");
        // Modify resetGame to return or log errors if you were editing it, 
        // but here we just call it and then check the DB.
        await resetGame(room.id);
        console.log("resetGame call finished.");

        const { data: updatedRoom } = await supabase.from('game_rooms').select('current_phase, eidi_pot').eq('id', room.id).single();
        console.log("Updated Room State:", updatedRoom);
    } catch (err) {
        console.error("Critical error in testReset:", err);
    }
}

testReset();
