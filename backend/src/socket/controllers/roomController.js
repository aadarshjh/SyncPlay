import { supabase } from '../../lib/supabase.js';
import { createRoom, restoreRoomState, rooms } from '../state.js';

export default function roomController(socket, io) {
    socket.on('join_room', async ({ roomId, username }) => {
        try {
            socket.join(roomId);

            if (!rooms[roomId]) {
                try {
                    const { data, error } = await supabase
                        .from('rooms')
                        .select('state_json')
                        .eq('id', roomId)
                        .maybeSingle();

                    if (data && data.state_json) {
                        console.log(`Restoring room ${roomId} from database...`);
                        restoreRoomState(roomId, data.state_json, socket.id);
                    }
                } catch (err) {
                    console.error("Error restoring room from DB", err);
                }

                if (!rooms[roomId]) {
                    createRoom(roomId, socket.id);
                }
            }

            const room = rooms[roomId];
            const existingUserIndex = room.users.findIndex(u => u.id === socket.id);
            if (existingUserIndex === -1) {
                const user = { id: socket.id, username };
                room.users.push(user);
            }

            const user = { id: socket.id, username };
            socket.to(roomId).emit('user_joined', user);
            socket.emit('room_state', room);
            io.to(roomId).emit('users_updated', room.users);
            console.log(`User ${username} joined room ${roomId}`);
        } catch (error) {
            console.error('[Join Room Error]', error);
            socket.emit('error', { message: 'Failed to join room' });
        }
    });

    socket.on('make_cohost', ({ roomId, targetSocketId }) => {
        try {
            if (rooms[roomId] && rooms[roomId].hostId === socket.id) {
                rooms[roomId].roles[targetSocketId] = 'co-host';
                io.to(targetSocketId).emit('role_updated', 'co-host');
                io.to(roomId).emit('room_state', rooms[roomId]);

                io.to(targetSocketId).emit('receive_message', {
                    id: Date.now().toString(),
                    username: 'System',
                    text: `You have been promoted to Co-Host. You can now control playback.`,
                    timestamp: new Date()
                });
            }
        } catch (error) {
            console.error('[Make Cohost Error]', error);
        }
    });

    socket.on('demote_cohost', ({ roomId, targetSocketId }) => {
        try {
            if (rooms[roomId] && rooms[roomId].hostId === socket.id) {
                delete rooms[roomId].roles[targetSocketId];
                io.to(targetSocketId).emit('role_updated', 'guest');
                io.to(roomId).emit('room_state', rooms[roomId]);

                io.to(targetSocketId).emit('receive_message', {
                    id: Date.now().toString(),
                    username: 'System',
                    text: `Your Co-Host privileges have been revoked.`,
                    timestamp: new Date()
                });
            }
        } catch (error) {
            console.error('[Demote Cohost Error]', error);
        }
    });

    socket.on('kick_user', ({ roomId, targetSocketId }) => {
        try {
            if (!rooms[roomId]) return;
            if (rooms[roomId].hostId !== socket.id) return;

            io.to(targetSocketId).emit('you_were_kicked');
            rooms[roomId].users = rooms[roomId].users.filter(u => u.id !== targetSocketId);
            io.to(roomId).emit('users_updated', rooms[roomId].users);
        } catch (error) {
            console.error('[Kick User Error]', error);
        }
    });

    socket.on('disconnect', async () => {
        try {
            console.log(`User disconnected: ${socket.id}`);
            for (const roomId in rooms) {
                const room = rooms[roomId];
                const userIndex = room.users.findIndex(u => u.id === socket.id);

                if (userIndex !== -1) {
                    const user = room.users[userIndex];
                    room.users.splice(userIndex, 1);

                    socket.to(roomId).emit('user_left', user);
                    io.to(roomId).emit('users_updated', room.users);

                    if (room.users.length === 0) {
                        delete rooms[roomId];
                        console.log(`Room ${roomId} deleted from memory because it is empty.`);
                        try {
                            await supabase.from('rooms').delete().eq('id', roomId);
                            console.log(`Room ${roomId} deleted from database.`);
                        } catch (err) {
                            console.error(`Failed to delete room ${roomId} from DB:`, err);
                        }
                    } else if (room.hostId === socket.id) {
                        room.hostId = room.users[0].id;
                        io.to(roomId).emit('host_changed', { newHostId: room.hostId });
                    }
                    break;
                }
            }
        } catch (error) {
            console.error('[Disconnect Error]', error);
        }
    });
}
