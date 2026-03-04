import { io } from 'socket.io-client';

// Map to your backend URL (in production this would be an env var)
const SOCKET_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';

export const socket = io(SOCKET_URL, {
    autoConnect: false, // We connect manually when user sets username
});
