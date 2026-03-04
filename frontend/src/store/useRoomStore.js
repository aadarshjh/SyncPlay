import { create } from 'zustand';

export const useRoomStore = create((set) => ({
    user: null, // Track Supabase auth session globally
    username: '',
    roomId: null,
    hostId: null,
    roles: {}, // Add roles mapping
    users: [],
    queue: [],
    pendingRequests: [], // Add pending requests tracking
    history: [],
    currentSong: null,
    isPlaying: false,
    currentTime: 0,
    loopMode: false,
    messages: [],
    typingUsers: [],

    // Setters
    setUser: (user) => set({ user }),
    setUsername: (username) => set({ username }),
    setRoomState: (state) => set({
        roomId: state.roomId,
        hostId: state.hostId,
        roles: state.roles || {},
        users: state.users || [],
        queue: state.queue || [],
        pendingRequests: state.pendingRequests || [],
        history: state.history || [],
        currentSong: state.currentSong || null,
        isPlaying: state.isPlaying || false,
        currentTime: state.currentTime || 0,
        loopMode: state.loopMode || false,
    }),
    setUsers: (users) => set({ users }),
    setQueue: (queue) => set({ queue }),
    setPendingRequests: (pendingRequests) => set({ pendingRequests }),
    setRole: (socketId, role) => set((state) => ({ roles: { ...state.roles, [socketId]: role } })),
    setCurrentSong: (song) => set({ currentSong: song }),
    setIsPlaying: (isPlaying) => set({ isPlaying }),
    setCurrentTime: (currentTime) => set({ currentTime }),
    addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
    setHostId: (hostId) => set({ hostId }),
    setTypingUsers: (typingUsers) => set({ typingUsers }),

    // Player Sync actions (local optimistic update, actual sync relies on socket)
    togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

    // Cleanup
    resetStore: () => set({
        roomId: null,
        hostId: null,
        users: [],
        queue: [],
        currentSong: null,
        isPlaying: false,
        currentTime: 0,
        messages: [],
        typingUsers: [],
    })
}));
