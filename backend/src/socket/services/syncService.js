import { supabase } from '../../lib/supabase.js';
import { rooms } from '../state.js';

export const startDbSyncService = () => {
    // Background sync: Persist all active rooms to the database every 10 seconds
    setInterval(() => {
        Object.keys(rooms).forEach(async (roomId) => {
            const room = rooms[roomId];
            if (room && room.users.length > 0) {
                try {
                    await supabase.from('rooms').upsert({
                        id: roomId,
                        host_id: room.hostId,
                        state_json: room
                    });
                } catch (err) {
                    console.error(`Failed to persist room ${roomId}:`, err);
                }
            }
        });
    }, 10000);
};
