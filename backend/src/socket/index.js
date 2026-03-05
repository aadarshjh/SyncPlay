import { supabase } from '../lib/supabase.js';
import ytSearch from 'yt-search';

// In-memory room state storage
// For production scale, you'd use Redis, but an object works perfectly for a college project
const rooms = {};

export default function handleSockets(io) {
    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.id}`);

        // Join Room
        socket.on('join_room', async ({ roomId, username }) => {
            socket.join(roomId);

            if (!rooms[roomId]) {
                // Try to restore from database first
                try {
                    const { data, error } = await supabase
                        .from('rooms')
                        .select('state_json')
                        .eq('id', roomId)
                        .maybeSingle();

                    if (data && data.state_json) {
                        console.log(`Restoring room ${roomId} from database...`);
                        rooms[roomId] = data.state_json;

                        // We must reset transitive connections for the new session
                        rooms[roomId].users = [];
                        rooms[roomId].hostId = socket.id;
                        rooms[roomId].roles = { [socket.id]: 'host' };
                        rooms[roomId].isPlaying = false; // Pause playback on restart
                    }
                } catch (err) {
                    console.error("Error restoring room from DB", err);
                }

                // If still no room (doesn't exist in DB either), create a fresh one
                if (!rooms[roomId]) {
                    // Create new room if it doesn't exist
                    rooms[roomId] = {
                        hostId: socket.id,
                        roles: { [socket.id]: 'host' }, // Map of socketId to 'host', 'co-host'
                        users: [],
                        queue: [],
                        pendingRequests: [], // Guest song suggestions
                        history: [],     // Recently played songs
                        currentSong: null,
                        isPlaying: false,
                        currentTime: 0,
                        loopMode: false, // Repeat all active
                        autoPlay: false, // AI DJ
                    };
                }
            }

            // Prevent duplicate UI entries if user reconnects rapidly
            const existingUserIndex = rooms[roomId].users.findIndex(u => u.id === socket.id);
            if (existingUserIndex === -1) {
                const user = { id: socket.id, username };
                rooms[roomId].users.push(user);
            }

            const user = { id: socket.id, username }; // Reference for the broadcast

            // Notify everyone in the room except the sender
            socket.to(roomId).emit('user_joined', user);

            // Send the current room state back to the newly joined user immediately
            socket.emit('room_state', rooms[roomId]);

            // Also broadcast the updated user list to everyone
            io.to(roomId).emit('users_updated', rooms[roomId].users);
            console.log(`User ${username} joined room ${roomId}`);
        });

        // Playback Sync: Play
        socket.on('play_song', ({ roomId, currentTime }) => {
            if (rooms[roomId]) {
                rooms[roomId].isPlaying = true;
                if (currentTime !== undefined) {
                    rooms[roomId].currentTime = currentTime;
                }
                // Broadcast to everyone in the room (including the host so their local state updates)
                io.to(roomId).emit('song_playing', { currentTime: rooms[roomId].currentTime });
            }
        });

        // Playback Sync: Pause
        socket.on('pause_song', ({ roomId, currentTime }) => {
            if (rooms[roomId]) {
                rooms[roomId].isPlaying = false;
                if (currentTime !== undefined) {
                    rooms[roomId].currentTime = currentTime;
                }
                // Broadcast to everyone in the room
                io.to(roomId).emit('song_paused', { currentTime: rooms[roomId].currentTime });
            }
        });

        // Playback Sync: Seek
        socket.on('seek_time', ({ roomId, currentTime }) => {
            if (rooms[roomId]) {
                const room = rooms[roomId];
                const role = room.roles[socket.id];
                const isAuthorized = role === 'host' || role === 'co-host';

                if (!isAuthorized) return; // Only host/co-host can seek

                room.currentTime = currentTime;
                io.to(roomId).emit('song_seeked', { currentTime });
            }
        });

        // Queue Management: Add song
        // If sender is NOT host/co-host, it goes to pendingRequests
        socket.on('add_to_queue', ({ roomId, song }) => {
            if (rooms[roomId]) {
                const room = rooms[roomId];
                const role = room.roles[socket.id];
                const isAuthorized = role === 'host' || role === 'co-host';

                const songEntry = { ...song, id: Date.now().toString() };

                if (isAuthorized) {
                    // Instantly add to queue
                    room.queue.push(songEntry);

                    // If no song is playing currently, maybe automatically play it
                    if (!room.currentSong) {
                        room.currentSong = songEntry;
                        room.queue.shift(); // Remove from queue
                        room.isPlaying = true;
                        io.to(roomId).emit('room_state', room); // Broadcast full state change
                    } else {
                        io.to(roomId).emit('queue_updated', room.queue);
                    }
                } else {
                    // Add to pending requests instead
                    room.pendingRequests.push(songEntry);
                    // Notify everyone (especially hosts) about new pending requests
                    io.to(roomId).emit('requests_updated', room.pendingRequests);

                    // Alert the host
                    socket.to(room.hostId).emit('receive_message', {
                        id: Date.now().toString(),
                        username: 'System',
                        text: `${song.addedBy} requested to play: ${song.title}`,
                        timestamp: new Date()
                    });
                }
            }
        });

        // Host Approval Flow
        socket.on('approve_request', ({ roomId, songId }) => {
            if (rooms[roomId]) {
                const room = rooms[roomId];
                // Only host can approve requests
                if (room.hostId !== socket.id) return;

                const songIndex = room.pendingRequests.findIndex(s => s.id === songId);
                if (songIndex !== -1) {
                    const song = room.pendingRequests.splice(songIndex, 1)[0];
                    room.queue.push(song);

                    if (!room.currentSong) {
                        room.currentSong = room.queue.shift();
                        room.isPlaying = true;
                        io.to(roomId).emit('room_state', room);
                    } else {
                        io.to(roomId).emit('queue_updated', room.queue);
                        io.to(roomId).emit('requests_updated', room.pendingRequests);
                    }
                }
            }
        });

        socket.on('reject_request', ({ roomId, songId }) => {
            if (rooms[roomId]) {
                const room = rooms[roomId];
                // Only host can reject requests
                if (room.hostId !== socket.id) return;

                room.pendingRequests = room.pendingRequests.filter(s => s.id !== songId);
                io.to(roomId).emit('requests_updated', room.pendingRequests);
            }
        });

        // Queue Management: Skip song (also handles natural song end)
        socket.on('skip_song', async ({ roomId }) => {
            if (rooms[roomId]) {
                const room = rooms[roomId];
                const role = room.roles[socket.id];
                const isAuthorized = role === 'host' || role === 'co-host';

                if (!isAuthorized) return; // Only host/co-host can skip

                const prevSong = room.currentSong;
                // Add finishing song to history (max 50) before picking next
                if (prevSong) {
                    room.history.unshift(prevSong);
                    if (room.history.length > 50) room.history.pop();

                    // If loop mode is ON, add the finished song to the END of the queue
                    if (room.loopMode) {
                        room.queue.push({ ...prevSong, id: Date.now().toString() + Math.random().toString(36).substr(2, 5) });
                    }
                }

                if (room.queue.length > 0) {
                    room.currentSong = room.queue.shift(); // Play next
                    room.currentTime = 0;
                    room.isPlaying = true;
                    io.to(roomId).emit('room_state', room);
                } else {
                    room.currentSong = null; // Nothing left
                    room.isPlaying = false;
                    room.currentTime = 0;
                    io.to(roomId).emit('room_state', room);

                    // Auto-Play (AI DJ)
                    if (room.autoPlay && prevSong) {
                        try {
                            const searchQuery = `${prevSong.title} ${prevSong.author || ''}`.trim();
                            const r = await ytSearch(searchQuery);
                            if (r && r.videos && r.videos.length > 0) {
                                const historyUrls = room.history.map(h => h.url);
                                // Find top video not already played
                                const nextVideo = r.videos.find(v => !historyUrls.includes(v.url));

                                if (nextVideo && rooms[roomId] && rooms[roomId].queue.length === 0 && !rooms[roomId].currentSong) {
                                    room.currentSong = {
                                        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                                        title: nextVideo.title,
                                        url: nextVideo.url,
                                        addedBy: 'AI DJ',
                                        thumbnail: nextVideo.thumbnail,
                                        type: 'youtube',
                                        author: nextVideo.author?.name
                                    };
                                    room.isPlaying = true;
                                    room.currentTime = 0;
                                    io.to(roomId).emit('room_state', room);

                                    io.to(roomId).emit('receive_message', {
                                        id: Date.now().toString(),
                                        username: 'System',
                                        text: `🤖 AI DJ queued: ${nextVideo.title}`,
                                        timestamp: new Date()
                                    });
                                }
                            }
                        } catch (err) {
                            console.error("Auto-Play search error:", err);
                        }
                    }
                }
            }
        });

        // Queue Management: Shuffle
        socket.on('shuffle_queue', ({ roomId }) => {
            if (rooms[roomId]) {
                const room = rooms[roomId];
                const role = room.roles[socket.id];
                if (role !== 'host' && role !== 'co-host') return;

                // Fisher-Yates shuffle algorithm
                for (let i = room.queue.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [room.queue[i], room.queue[j]] = [room.queue[j], room.queue[i]];
                }
                io.to(roomId).emit('queue_updated', room.queue);
            }
        });

        // Loop Toggle
        socket.on('toggle_loop', ({ roomId, loopMode }) => {
            if (rooms[roomId]) {
                const room = rooms[roomId];
                const role = room.roles[socket.id];
                if (role !== 'host' && role !== 'co-host') return;

                room.loopMode = loopMode;
                io.to(roomId).emit('room_state', room); // Broadcast full state to update loop UI
            }
        });

        // Auto-Play Toggle
        socket.on('toggle_autoplay', ({ roomId, autoPlay }) => {
            if (rooms[roomId]) {
                const room = rooms[roomId];
                const role = room.roles[socket.id];
                if (role !== 'host' && role !== 'co-host') return;

                room.autoPlay = autoPlay;
                io.to(roomId).emit('room_state', room);

                io.to(roomId).emit('receive_message', {
                    id: Date.now().toString(),
                    username: 'System',
                    text: `🤖 AI DJ (Auto-Play) is now ${autoPlay ? 'ON' : 'OFF'}.`,
                    timestamp: new Date()
                });
            }
        });

        // Queue Management: Remove a specific song from queue
        socket.on('remove_from_queue', ({ roomId, songId }) => {
            if (rooms[roomId]) {
                rooms[roomId].queue = rooms[roomId].queue.filter(s => s.id !== songId);
                io.to(roomId).emit('queue_updated', rooms[roomId].queue);
            }
        });

        // User Roles: Make Co-Host
        socket.on('make_cohost', ({ roomId, targetSocketId }) => {
            if (rooms[roomId] && rooms[roomId].hostId === socket.id) {
                rooms[roomId].roles[targetSocketId] = 'co-host';
                // Send targeted update that user is cohost
                io.to(targetSocketId).emit('role_updated', 'co-host');
                // Broadcast room state
                io.to(roomId).emit('room_state', rooms[roomId]);

                // Alert the target user
                io.to(targetSocketId).emit('receive_message', {
                    id: Date.now().toString(),
                    username: 'System',
                    text: `You have been promoted to Co-Host. You can now control playback.`,
                    timestamp: new Date()
                });
            }
        });

        // User Roles: Demote Co-Host
        socket.on('demote_cohost', ({ roomId, targetSocketId }) => {
            if (rooms[roomId] && rooms[roomId].hostId === socket.id) {
                delete rooms[roomId].roles[targetSocketId];
                // Send targeted update that user is guest
                io.to(targetSocketId).emit('role_updated', 'guest');
                // Broadcast room state
                io.to(roomId).emit('room_state', rooms[roomId]);

                // Alert the target user
                io.to(targetSocketId).emit('receive_message', {
                    id: Date.now().toString(),
                    username: 'System',
                    text: `Your Co-Host privileges have been revoked.`,
                    timestamp: new Date()
                });
            }
        });

        // Chat: Send message
        socket.on('send_message', ({ roomId, message, username }) => {
            const chatMsg = {
                id: Date.now().toString(),
                username,
                text: message,
                timestamp: new Date()
            };
            // Broadcast to everyone in room including sender
            io.to(roomId).emit('receive_message', chatMsg);
        });

        // Chat: Typing Indicators
        socket.on('typing_start', ({ roomId, username }) => {
            socket.to(roomId).emit('user_typing', { username, isTyping: true });
        });

        socket.on('typing_end', ({ roomId, username }) => {
            socket.to(roomId).emit('user_typing', { username, isTyping: false });
        });

        // Host: Kick a user from the room
        socket.on('kick_user', ({ roomId, targetSocketId }) => {
            if (!rooms[roomId]) return;
            // Only allow if the requester is the host
            if (rooms[roomId].hostId !== socket.id) return;

            // Tell the kicked user to leave
            io.to(targetSocketId).emit('you_were_kicked');

            // Remove them from our room state
            rooms[roomId].users = rooms[roomId].users.filter(u => u.id !== targetSocketId);
            io.to(roomId).emit('users_updated', rooms[roomId].users);
        });

        // Disconnect
        socket.on('disconnect', async () => {
            console.log(`User disconnected: ${socket.id}`);
            // Find which room the user was in and remove them
            for (const roomId in rooms) {
                const room = rooms[roomId];
                const userIndex = room.users.findIndex(u => u.id === socket.id);

                if (userIndex !== -1) {
                    const user = room.users[userIndex];
                    room.users.splice(userIndex, 1);

                    socket.to(roomId).emit('user_left', user);
                    io.to(roomId).emit('users_updated', room.users);

                    if (room.users.length === 0) {
                        // Delete room if empty
                        delete rooms[roomId];
                        console.log(`Room ${roomId} deleted from memory because it is empty.`);
                        // Also delete from Supabase so it doesn't linger in the public lobby
                        try {
                            await supabase.from('rooms').delete().eq('id', roomId);
                            console.log(`Room ${roomId} deleted from database.`);
                        } catch (err) {
                            console.error(`Failed to delete room ${roomId} from DB:`, err);
                        }
                    } else if (room.hostId === socket.id) {
                        // Reassign host if the host left and there are still users
                        room.hostId = room.users[0].id;
                        io.to(roomId).emit('host_changed', { newHostId: room.hostId });
                    }

                    break; // User is only in one room at a time in our architecture
                }
            }
        });
    });

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
}
