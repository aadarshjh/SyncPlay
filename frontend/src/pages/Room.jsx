import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { socket } from '../lib/socket';
import { useRoomStore } from '../store/useRoomStore';
import Player from '../components/Player';
import Chat from '../components/Chat';
import Queue from '../components/Queue';
import { Copy, Users, LogOut, MessageSquare, ListMusic, X, ChevronUp } from 'lucide-react';

function Room() {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const {
        username,
        hostId,
        users,
        messages,
        queue,
        setRoomState,
        setUsers,
        setCurrentSong,
        setIsPlaying,
        setCurrentTime,
        setQueue,
        resetStore
    } = useRoomStore();

    const [activeTab, setActiveTab] = useState('chat');
    // Mobile drawer state
    const [drawerOpen, setDrawerOpen] = useState(false);

    useEffect(() => {
        if (!username) {
            navigate('/');
            return;
        }

        socket.connect();
        socket.emit('join_room', { roomId, username });

        socket.on('room_state', (state) => setRoomState({ ...state, roomId }));
        socket.on('users_updated', (updatedUsers) => setUsers(updatedUsers));
        socket.on('host_changed', ({ newHostId }) => useRoomStore.getState().setHostId(newHostId));
        socket.on('song_playing', ({ currentTime }) => { setIsPlaying(true); if (currentTime !== undefined) setCurrentTime(currentTime); });
        socket.on('song_paused', ({ currentTime }) => { setIsPlaying(false); if (currentTime !== undefined) setCurrentTime(currentTime); });
        socket.on('song_seeked', ({ currentTime }) => setCurrentTime(currentTime));
        socket.on('queue_updated', (queue) => setQueue(queue));

        return () => {
            socket.off('room_state');
            socket.off('users_updated');
            socket.off('host_changed');
            socket.off('song_playing');
            socket.off('song_paused');
            socket.off('song_seeked');
            socket.off('queue_updated');
            socket.disconnect();
            resetStore();
        };
    }, [roomId, username, navigate]);

    const copyRoomCode = () => {
        const inviteLink = `${window.location.origin}/room/${roomId}`;
        navigator.clipboard.writeText(inviteLink);
        alert('Invite link copied!');
    };

    const isHost = socket.id === hostId;

    // Unread count for the drawer button badge
    const chatBadge = messages.length;
    const queueBadge = queue.length;

    return (
        <div className="h-screen flex flex-col bg-zinc-950 overflow-hidden">

            {/* ─── Header ─── */}
            <header className="flex-shrink-0 h-14 px-3 sm:px-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-950 z-10">
                <div className="flex items-center gap-2 sm:gap-4">
                    <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400 hidden sm:block">SyncPlay</h1>
                    <button
                        onClick={copyRoomCode}
                        className="flex items-center gap-1.5 bg-zinc-900 px-2.5 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-600 transition-colors"
                    >
                        <span className="font-mono font-bold text-white text-sm tracking-wider">{roomId}</span>
                        <Copy className="w-3.5 h-3.5 text-zinc-500" />
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-zinc-400 text-sm bg-zinc-900 px-2.5 py-1.5 rounded-lg">
                        <Users className="w-4 h-4" />
                        <span>{users.length}</span>
                    </div>
                    <button
                        onClick={() => navigate('/')}
                        className="text-red-400 hover:text-red-300 transition-colors p-2 hover:bg-red-500/10 rounded-lg flex items-center gap-1.5 text-sm font-medium"
                    >
                        <LogOut className="w-4 h-4" />
                        <span className="hidden sm:block">Leave</span>
                    </button>
                </div>
            </header>

            {/* ─── Desktop: side-by-side | Mobile: player fills screen ─── */}
            <div className="flex-1 flex overflow-hidden">

                {/* Player (always visible, fills screen on mobile) */}
                <main className="flex-1 overflow-y-auto bg-gradient-to-b from-zinc-900 to-zinc-950 p-3 sm:p-6 md:border-r md:border-zinc-800">
                    <div className="w-full max-w-4xl mx-auto">
                        <Player isHost={isHost} roomId={roomId} />
                    </div>
                </main>

                {/* ─── DESKTOP Sidebar (hidden on mobile) ─── */}
                <aside className="hidden md:flex flex-col w-80 lg:w-96 bg-zinc-950 flex-shrink-0">
                    <div className="flex-shrink-0 h-12 flex border-b border-zinc-800">
                        <button
                            className={`flex-1 font-semibold text-sm transition-colors border-b-2 flex items-center justify-center gap-2 ${activeTab === 'chat' ? 'border-purple-500 text-purple-400 bg-purple-500/5' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
                            onClick={() => setActiveTab('chat')}
                        >
                            <MessageSquare className="w-4 h-4" /> Chat
                        </button>
                        <button
                            className={`flex-1 font-semibold text-sm transition-colors border-b-2 flex items-center justify-center gap-2 ${activeTab === 'queue' ? 'border-blue-500 text-blue-400 bg-blue-500/5' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
                            onClick={() => setActiveTab('queue')}
                        >
                            <ListMusic className="w-4 h-4" /> Queue
                        </button>
                    </div>
                    <div className="flex-1 overflow-hidden flex flex-col">
                        {activeTab === 'chat' ? <Chat roomId={roomId} /> : <Queue isHost={isHost} roomId={roomId} />}
                    </div>
                </aside>
            </div>

            {/* ─── MOBILE: Floating Button to open drawer ─── */}
            <div className="md:hidden fixed bottom-6 right-4 z-40 flex flex-col items-end gap-2">
                {/* Quick-access tab buttons */}
                {drawerOpen && (
                    <div className="flex gap-2 mb-1">
                        <button
                            onClick={() => setActiveTab('chat')}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold shadow-lg transition-all ${activeTab === 'chat' ? 'bg-purple-600 text-white' : 'bg-zinc-800 text-zinc-300'}`}
                        >
                            <MessageSquare className="w-3.5 h-3.5" /> Chat
                        </button>
                        <button
                            onClick={() => setActiveTab('queue')}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold shadow-lg transition-all ${activeTab === 'queue' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-300'}`}
                        >
                            <ListMusic className="w-3.5 h-3.5" /> Queue {queueBadge > 0 && <span className="bg-blue-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">{queueBadge}</span>}
                        </button>
                    </div>
                )}

                {/* Main toggle button */}
                <button
                    onClick={() => setDrawerOpen(o => !o)}
                    className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all ${drawerOpen ? 'bg-zinc-700 rotate-0' : 'bg-gradient-to-tr from-purple-600 to-blue-600'}`}
                >
                    {drawerOpen
                        ? <X className="w-6 h-6 text-white" />
                        : <MessageSquare className="w-6 h-6 text-white" />
                    }
                </button>
            </div>

            {/* ─── MOBILE: Slide-up Bottom Sheet Drawer ─── */}
            {/* Backdrop */}
            {drawerOpen && (
                <div
                    className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-30"
                    onClick={() => setDrawerOpen(false)}
                />
            )}

            {/* Drawer panel */}
            <div className={`
                md:hidden fixed bottom-0 left-0 right-0 z-40
                bg-zinc-950 border-t border-zinc-800
                rounded-t-3xl shadow-2xl
                transition-transform duration-300 ease-in-out
                ${drawerOpen ? 'translate-y-0' : 'translate-y-full'}
            `} style={{ height: '75vh' }}>
                {/* Drawer handle */}
                <div className="flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 bg-zinc-700 rounded-full" />
                </div>

                {/* Drawer tab nav */}
                <div className="flex border-b border-zinc-800 mx-4">
                    <button
                        className={`flex-1 py-3 font-semibold text-sm transition-colors border-b-2 flex items-center justify-center gap-2 ${activeTab === 'chat' ? 'border-purple-500 text-purple-400' : 'border-transparent text-zinc-500'}`}
                        onClick={() => setActiveTab('chat')}
                    >
                        <MessageSquare className="w-4 h-4" /> Chat
                    </button>
                    <button
                        className={`flex-1 py-3 font-semibold text-sm transition-colors border-b-2 flex items-center justify-center gap-2 ${activeTab === 'queue' ? 'border-blue-500 text-blue-400' : 'border-transparent text-zinc-500'}`}
                        onClick={() => setActiveTab('queue')}
                    >
                        <ListMusic className="w-4 h-4" /> Queue {queueBadge > 0 && <span className="bg-blue-500 text-white text-[10px] rounded-full px-1.5">{queueBadge}</span>}
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden" style={{ height: 'calc(100% - 96px)' }}>
                    {activeTab === 'chat' ? <Chat roomId={roomId} /> : <Queue isHost={isHost} roomId={roomId} />}
                </div>
            </div>
        </div>
    );
}

export default Room;
