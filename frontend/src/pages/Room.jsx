import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { socket } from '../lib/socket';
import { useRoomStore } from '../store/useRoomStore';
import Player from '../components/Player';
import Chat from '../components/Chat';
import Queue from '../components/Queue';
import { Copy, Users, LogOut, MessageSquare, ListMusic, X, Crown, UserMinus } from 'lucide-react';

function Room() {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const {
        username, hostId, users, queue,
        setRoomState, setUsers, setCurrentSong,
        setIsPlaying, setCurrentTime, setQueue, resetStore
    } = useRoomStore();

    const [activeTab, setActiveTab] = useState('chat');
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [showUserList, setShowUserList] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (!username) { navigate('/'); return; }

        socket.connect();
        socket.emit('join_room', { roomId, username });

        socket.on('room_state', (state) => setRoomState({ ...state, roomId }));
        socket.on('users_updated', (u) => setUsers(u));
        socket.on('host_changed', ({ newHostId }) => useRoomStore.getState().setHostId(newHostId));
        socket.on('song_playing', ({ currentTime }) => { setIsPlaying(true); if (currentTime !== undefined) setCurrentTime(currentTime); });
        socket.on('song_paused', ({ currentTime }) => { setIsPlaying(false); if (currentTime !== undefined) setCurrentTime(currentTime); });
        socket.on('song_seeked', ({ currentTime }) => setCurrentTime(currentTime));
        socket.on('queue_updated', (q) => setQueue(q));

        // Listen to being kicked
        socket.on('you_were_kicked', () => {
            alert('You were removed from the room by the host.');
            navigate('/');
        });

        return () => {
            socket.off('room_state'); socket.off('users_updated'); socket.off('host_changed');
            socket.off('song_playing'); socket.off('song_paused'); socket.off('song_seeked');
            socket.off('queue_updated'); socket.off('you_were_kicked');
            socket.disconnect();
            resetStore();
        };
    }, [roomId, username, navigate]);

    const copyRoomCode = () => {
        navigator.clipboard.writeText(`${window.location.origin}/room/${roomId}`);
        alert('Invite link copied!');
    };

    const handleKick = (targetSocketId) => {
        socket.emit('kick_user', { roomId, targetSocketId });
        setShowUserList(false);
    };

    const isHost = socket.id === hostId;

    const sidebarContent = (
        <>
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
                    <ListMusic className="w-4 h-4" />
                    Queue {queue.length > 0 && <span className="bg-blue-500/20 text-blue-400 text-[10px] px-1.5 py-0.5 rounded-full">{queue.length}</span>}
                </button>
            </div>
            <div className="flex-1 overflow-hidden flex flex-col">
                {activeTab === 'chat' ? <Chat roomId={roomId} /> : <Queue isHost={isHost} roomId={roomId} />}
            </div>
        </>
    );

    return (
        <div className="h-screen flex flex-col bg-zinc-950 overflow-hidden">

            {/* Header */}
            <header className="flex-shrink-0 h-14 px-3 sm:px-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-950 z-20">
                <div className="flex items-center gap-2 sm:gap-4">
                    <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400 hidden sm:block">SyncPlay</h1>
                    <button onClick={copyRoomCode} className="flex items-center gap-1.5 bg-zinc-900 px-2.5 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-600 transition-colors">
                        <span className="font-mono font-bold text-white text-sm tracking-wider">{roomId}</span>
                        <Copy className="w-3.5 h-3.5 text-zinc-500" />
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    {/* Users button - opens user list with kick */}
                    <div className="relative">
                        <button
                            onClick={() => setShowUserList(o => !o)}
                            className="flex items-center gap-1.5 text-zinc-400 text-sm bg-zinc-900 px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors border border-zinc-800 hover:border-zinc-700"
                        >
                            <Users className="w-4 h-4" />
                            <span>{users.length}</span>
                        </button>

                        {/* User list popover */}
                        {showUserList && (
                            <div className="absolute right-0 top-10 w-60 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                                <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
                                    <span className="text-xs font-semibold text-zinc-400 uppercase">In Room</span>
                                    <button onClick={() => setShowUserList(false)} className="text-zinc-500 hover:text-white">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                                <ul className="divide-y divide-zinc-800/50 max-h-64 overflow-y-auto">
                                    {users.map(user => (
                                        <li key={user.id} className="flex items-center gap-3 px-3 py-2.5">
                                            <img
                                                src={`https://api.dicebear.com/7.x/initials/svg?seed=${user.username}&backgroundColor=5b21b6,4c1d95`}
                                                className="w-7 h-7 rounded-full flex-shrink-0"
                                                alt={user.username}
                                            />
                                            <span className="flex-1 text-sm font-medium text-zinc-200 truncate">{user.username}</span>
                                            {user.id === hostId && (
                                                <Crown className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" title="Host" />
                                            )}
                                            {/* Host can kick everyone else */}
                                            {isHost && user.id !== socket.id && (
                                                <button
                                                    onClick={() => handleKick(user.id)}
                                                    className="text-zinc-600 hover:text-red-400 transition-colors p-1 hover:bg-red-500/10 rounded"
                                                    title={`Kick ${user.username}`}
                                                >
                                                    <UserMinus className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    <button onClick={() => navigate('/')} className="text-red-400 hover:text-red-300 transition-colors p-2 hover:bg-red-500/10 rounded-lg flex items-center gap-1.5 text-sm font-medium">
                        <LogOut className="w-4 h-4" /><span className="hidden sm:block">Leave</span>
                    </button>
                </div>
            </header>

            {/* Main layout */}
            <div className="flex-1 flex overflow-hidden">
                <main className="flex-1 overflow-y-auto bg-gradient-to-b from-zinc-900 to-zinc-950 p-3 sm:p-6 md:border-r md:border-zinc-800">
                    <div className="w-full max-w-4xl mx-auto">
                        <Player isHost={isHost} roomId={roomId} />
                    </div>
                </main>

                {!isMobile && (
                    <aside className="flex flex-col w-80 lg:w-96 bg-zinc-950 flex-shrink-0">
                        {sidebarContent}
                    </aside>
                )}
            </div>

            {/* MOBILE: Floating chat button */}
            {isMobile && (
                <button
                    onClick={() => setDrawerOpen(o => !o)}
                    className="fixed bottom-5 right-4 z-40 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl bg-gradient-to-tr from-purple-600 to-blue-600 active:scale-90 transition-transform"
                >
                    {drawerOpen ? <X className="w-6 h-6 text-white" /> : <MessageSquare className="w-6 h-6 text-white" />}
                    {!drawerOpen && queue.length > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                            {queue.length}
                        </span>
                    )}
                </button>
            )}

            {/* MOBILE: Bottom sheet drawer */}
            {isMobile && (
                <>
                    {drawerOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30" onClick={() => setDrawerOpen(false)} />}
                    <div
                        className={`fixed bottom-0 left-0 right-0 z-40 bg-zinc-950 border-t border-zinc-800 rounded-t-3xl shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${drawerOpen ? 'translate-y-0' : 'translate-y-full'}`}
                        style={{ height: '75vh' }}
                    >
                        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                            <div className="w-10 h-1 bg-zinc-700 rounded-full" />
                        </div>
                        {drawerOpen && sidebarContent}
                    </div>
                </>
            )}
        </div>
    );
}

export default Room;
