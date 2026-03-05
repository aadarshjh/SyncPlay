export const rooms = {};

// Helper functions for state management

export const getRoom = (roomId) => {
    return rooms[roomId];
};

export const createRoom = (roomId, socketId) => {
    if (!rooms[roomId]) {
        rooms[roomId] = {
            hostId: socketId,
            roles: { [socketId]: 'host' },
            users: [],
            queue: [],
            pendingRequests: [],
            history: [],
            currentSong: null,
            isPlaying: false,
            currentTime: 0,
            loopMode: false,
            autoPlay: false,
        };
    }
    return rooms[roomId];
};

export const restoreRoomState = (roomId, stateJson, socketId) => {
    rooms[roomId] = stateJson;
    // Reset transitive connection state for the new session
    rooms[roomId].users = [];
    rooms[roomId].hostId = socketId;
    rooms[roomId].roles = { [socketId]: 'host' };
    rooms[roomId].isPlaying = false;
    return rooms[roomId];
};

export const removeRoom = (roomId) => {
    delete rooms[roomId];
};

export const getUserRoom = (socketId) => {
    for (const roomId in rooms) {
        if (rooms[roomId] && rooms[roomId].users) {
            const userExists = rooms[roomId].users.some((u) => u.id === socketId);
            if (userExists) {
                return { roomId, room: rooms[roomId] };
            }
        }
    }
    return { roomId: null, room: null };
};

export const isAuthorized = (room, socketId) => {
    if (!room) return false;
    const role = room.roles[socketId];
    return role === 'host' || role === 'co-host';
};
