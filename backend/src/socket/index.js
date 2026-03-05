import chatController from './controllers/chatController.js';
import playbackController from './controllers/playbackController.js';
import queueController from './controllers/queueController.js';
import roomController from './controllers/roomController.js';
import { startDbSyncService } from './services/syncService.js';

export default function handleSockets(io) {
    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.id}`);

        // Register domain controllers
        roomController(socket, io);
        playbackController(socket, io);
        queueController(socket, io);
        chatController(socket, io, /* rooms */); // The chat controller doesn't strictly need `rooms` injected if we don't access it, but keeping the signature clean
    });

    // Start background Supabase persistence
    startDbSyncService();
}
