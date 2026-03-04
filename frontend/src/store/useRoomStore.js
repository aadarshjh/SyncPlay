import { create } from 'zustand';

export const useRoomStore = create((set) => ({
    username: '',
    roomId: null,
    hostId: null,
    users: [],
    queue: [],
    currentSong: null,
    isPlaying: false,
    isPlaying: false,
    currentTime: 0,
    messages: [],
    typingUsers: [],

    // Setters
    setUsername: (username) => set({ username }),
    setRoomState: (state) => set({
        roomId: state.roomId,
        hostId: state.hostId,
        users: state.users || [],
        queue: state.queue || [],
        currentSong: state.currentSong || null,
        isPlaying: state.isPlaying || false,
        currentTime: state.currentTime || 0,
    }),
    setUsers: (users) => set({ users }),
    setQueue: (queue) => set({ queue }),
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
