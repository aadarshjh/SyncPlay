// In-memory room state storage
// For production scale, you'd use Redis, but an object works perfectly for a college project
const rooms = {};

export default function handleSockets(io) {
    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.id}`);

        // Join Room
        socket.on('join_room', ({ roomId, username }) => {
            socket.join(roomId);

            if (!rooms[roomId]) {
                // Create new room if it doesn't exist
                rooms[roomId] = {
                    hostId: socket.id,
                    users: [],
                    queue: [],
                    currentSong: null,
                    isPlaying: false,
                    currentTime: 0,
                };
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
                rooms[roomId].currentTime = currentTime;
                io.to(roomId).emit('song_seeked', { currentTime });
            }
        });

        // Queue Management: Add song
        socket.on('add_to_queue', ({ roomId, song }) => {
            if (rooms[roomId]) {
                // Add unique ID to the song in queue for easy removal/reordering
                const songEntry = { ...song, id: Date.now().toString() };
                rooms[roomId].queue.push(songEntry);

                // If no song is playing currently, maybe automatically play it
                if (!rooms[roomId].currentSong) {
                    rooms[roomId].currentSong = songEntry;
                    rooms[roomId].queue.shift(); // Remove from queue
                    rooms[roomId].isPlaying = true;
                    io.to(roomId).emit('room_state', rooms[roomId]); // Broadcast full state change
                } else {
                    io.to(roomId).emit('queue_updated', rooms[roomId].queue);
                }
            }
        });

        // Queue Management: Skip song
        socket.on('skip_song', ({ roomId }) => {
            if (rooms[roomId]) {
                if (rooms[roomId].queue.length > 0) {
                    rooms[roomId].currentSong = rooms[roomId].queue.shift(); // Play next
                    rooms[roomId].currentTime = 0;
                    rooms[roomId].isPlaying = true;
                } else {
                    rooms[roomId].currentSong = null; // Nothing left
                    rooms[roomId].isPlaying = false;
                    rooms[roomId].currentTime = 0;
                }
                io.to(roomId).emit('room_state', rooms[roomId]);
            }
        });

        // Queue Management: Remove a specific song from queue
        socket.on('remove_from_queue', ({ roomId, songId }) => {
            if (rooms[roomId]) {
                rooms[roomId].queue = rooms[roomId].queue.filter(s => s.id !== songId);
                io.to(roomId).emit('queue_updated', rooms[roomId].queue);
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
        socket.on('disconnect', () => {
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

                    // Reassign host if the host left
                    if (room.hostId === socket.id) {
                        if (room.users.length > 0) {
                            room.hostId = room.users[0].id;
                            io.to(roomId).emit('host_changed', { newHostId: room.hostId });
                        } else {
                            // Delete room if empty
                            delete rooms[roomId];
                            console.log(`Room ${roomId} deleted because it is empty.`);
                        }
                    }
                    break; // User is only in one room at a time in our architecture
                }
            }
        });
    });
}
