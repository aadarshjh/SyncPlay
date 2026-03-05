import { rooms, isAuthorized } from '../state.js';
import { generateNextSong } from '../services/aiService.js';

export default function queueController(socket, io) {
    socket.on('add_to_queue', ({ roomId, song }) => {
        try {
            if (rooms[roomId]) {
                const room = rooms[roomId];
                const isAuth = isAuthorized(room, socket.id);
                const songEntry = { ...song, id: Date.now().toString() };

                if (isAuth) {
                    room.queue.push(songEntry);

                    if (!room.currentSong) {
                        room.currentSong = songEntry;
                        room.queue.shift();
                        room.isPlaying = true;
                        io.to(roomId).emit('room_state', room);
                    } else {
                        io.to(roomId).emit('queue_updated', room.queue);
                    }
                } else {
                    room.pendingRequests.push(songEntry);
                    io.to(roomId).emit('requests_updated', room.pendingRequests);

                    socket.to(room.hostId).emit('receive_message', {
                        id: Date.now().toString(),
                        username: 'System',
                        text: `${song.addedBy} requested to play: ${song.title}`,
                        timestamp: new Date()
                    });
                }
            }
        } catch (error) {
            console.error('[Add to Queue Error]', error);
        }
    });

    socket.on('approve_request', ({ roomId, songId }) => {
        try {
            if (rooms[roomId]) {
                const room = rooms[roomId];
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
        } catch (error) {
            console.error('[Approve Request Error]', error);
        }
    });

    socket.on('reject_request', ({ roomId, songId }) => {
        try {
            if (rooms[roomId]) {
                const room = rooms[roomId];
                if (room.hostId !== socket.id) return;

                room.pendingRequests = room.pendingRequests.filter(s => s.id !== songId);
                io.to(roomId).emit('requests_updated', room.pendingRequests);
            }
        } catch (error) {
            console.error('[Reject Request Error]', error);
        }
    });

    socket.on('skip_song', async ({ roomId }) => {
        try {
            if (rooms[roomId]) {
                const room = rooms[roomId];
                if (!isAuthorized(room, socket.id)) return;

                const prevSong = room.currentSong;
                if (prevSong) {
                    room.history.unshift(prevSong);
                    if (room.history.length > 50) room.history.pop();

                    if (room.loopMode) {
                        room.queue.push({ ...prevSong, id: Date.now().toString() + Math.random().toString(36).substr(2, 5) });
                    }
                }

                if (room.queue.length > 0) {
                    room.currentSong = room.queue.shift();
                    room.currentTime = 0;
                    room.isPlaying = true;
                    io.to(roomId).emit('room_state', room);
                } else {
                    room.currentSong = null;
                    room.isPlaying = false;
                    room.currentTime = 0;
                    io.to(roomId).emit('room_state', room);

                    if (room.autoPlay && prevSong) {
                        await generateNextSong(roomId, room, io);
                    }
                }
            }
        } catch (error) {
            console.error('[Skip Song Error]', error);
        }
    });

    socket.on('shuffle_queue', ({ roomId }) => {
        try {
            if (rooms[roomId]) {
                const room = rooms[roomId];
                if (!isAuthorized(room, socket.id)) return;

                for (let i = room.queue.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [room.queue[i], room.queue[j]] = [room.queue[j], room.queue[i]];
                }
                io.to(roomId).emit('queue_updated', room.queue);
            }
        } catch (error) {
            console.error('[Shuffle Queue Error]', error);
        }
    });

    socket.on('remove_from_queue', ({ roomId, songId }) => {
        try {
            if (rooms[roomId]) {
                rooms[roomId].queue = rooms[roomId].queue.filter(s => s.id !== songId);
                io.to(roomId).emit('queue_updated', rooms[roomId].queue);
            }
        } catch (error) {
            console.error('[Remove From Queue Error]', error);
        }
    });
}
