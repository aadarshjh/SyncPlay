import { rooms, isAuthorized } from '../state.js';

export default function playbackController(socket, io) {
    socket.on('play_song', ({ roomId, currentTime }) => {
        try {
            if (rooms[roomId]) {
                const room = rooms[roomId];
                room.isPlaying = true;
                if (currentTime !== undefined) {
                    room.currentTime = currentTime;
                }
                io.to(roomId).emit('song_playing', { currentTime: room.currentTime });
            }
        } catch (error) {
            console.error('[Play Song Error]', error);
        }
    });

    socket.on('pause_song', ({ roomId, currentTime }) => {
        try {
            if (rooms[roomId]) {
                const room = rooms[roomId];
                room.isPlaying = false;
                if (currentTime !== undefined) {
                    room.currentTime = currentTime;
                }
                io.to(roomId).emit('song_paused', { currentTime: room.currentTime });
            }
        } catch (error) {
            console.error('[Pause Song Error]', error);
        }
    });

    socket.on('seek_time', ({ roomId, currentTime }) => {
        try {
            if (rooms[roomId]) {
                const room = rooms[roomId];
                if (!isAuthorized(room, socket.id)) return;

                room.currentTime = currentTime;
                io.to(roomId).emit('song_seeked', { currentTime });
            }
        } catch (error) {
            console.error('[Seek Time Error]', error);
        }
    });

    socket.on('toggle_loop', ({ roomId, loopMode }) => {
        try {
            if (rooms[roomId]) {
                const room = rooms[roomId];
                if (!isAuthorized(room, socket.id)) return;

                room.loopMode = loopMode;
                io.to(roomId).emit('room_state', room);
            }
        } catch (error) {
            console.error('[Toggle Loop Error]', error);
        }
    });

    socket.on('toggle_autoplay', ({ roomId, autoPlay }) => {
        try {
            if (rooms[roomId]) {
                const room = rooms[roomId];
                if (!isAuthorized(room, socket.id)) return;

                room.autoPlay = autoPlay;
                io.to(roomId).emit('room_state', room);

                io.to(roomId).emit('receive_message', {
                    id: Date.now().toString(),
                    username: 'System',
                    text: `🤖 AI DJ (Auto-Play) is now ${autoPlay ? 'ON' : 'OFF'}.`,
                    timestamp: new Date()
                });
            }
        } catch (error) {
            console.error('[Toggle Autoplay Error]', error);
        }
    });
}
