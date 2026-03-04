import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { socket } from '../lib/socket';
import { useRoomStore } from '../store/useRoomStore';
import Player from '../components/Player';
import Chat from '../components/Chat';
import Queue from '../components/Queue';
import { Copy, Users, LogOut, MessageSquare, ListMusic } from 'lucide-react';

function Room() {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const {
        username,
        hostId,
        users,
        setRoomState,
        setUsers,
        setCurrentSong,
        setIsPlaying,
        setCurrentTime,
        setQueue,
        resetStore
    } = useRoomStore();

    const [activeTab, setActiveTab] = useState('chat');

    useEffect(() => {
        if (!username) {
            alert("Please set a username first.");
            navigate('/');
            return;
        }

        socket.connect();
        socket.emit('join_room', { roomId, username });

        socket.on('room_state', (state) => {
            setRoomState({ ...state, roomId });
        });

        socket.on('users_updated', (updatedUsers) => {
            setUsers(updatedUsers);
        });

        socket.on('host_changed', ({ newHostId }) => {
            useRoomStore.getState().setHostId(newHostId);
        });

        socket.on('song_playing', ({ currentTime }) => {
            setIsPlaying(true);
            if (currentTime !== undefined) setCurrentTime(currentTime);
        });

        socket.on('song_paused', ({ currentTime }) => {
            setIsPlaying(false);
            if (currentTime !== undefined) setCurrentTime(currentTime);
        });

        socket.on('song_seeked', ({ currentTime }) => {
            setCurrentTime(currentTime);
        });

        socket.on('queue_updated', (queue) => {
            setQueue(queue);
        });

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

    return (
        <div className="h-screen flex flex-col bg-zinc-950 overflow-hidden">

            {/* ─── Header ─── */}
            <header className="flex-shrink-0 h-14 px-3 sm:px-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-950 z-10 safe-top">
                <div className="flex items-center gap-2 sm:gap-4">
                    <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400 hidden sm:block">SyncPlay</h1>
                    <button
                        onClick={copyRoomCode}
                        className="flex items-center gap-1.5 bg-zinc-900 px-2.5 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-600 transition-colors"
                    >
                        <span className="text-zinc-400 text-xs font-mono uppercase hidden xs:inline">Room</span>
                        <span className="font-mono font-bold text-white text-sm tracking-wider">{roomId}</span>
                        <Copy className="w-3.5 h-3.5 text-zinc-500" />
                    </button>
                </div>

                <div className="flex items-center gap-2 sm:gap-4">
                    <div className="flex items-center gap-1.5 text-zinc-400 text-sm bg-zinc-900 px-2.5 py-1.5 rounded-lg">
                        <Users className="w-4 h-4" />
                        <span>{users.length}</span>
                    </div>
                    <button
                        onClick={() => navigate('/')}
                        className="text-red-400 hover:text-red-300 transition-colors p-2 hover:bg-red-500/10 rounded-lg flex items-center gap-1.5 text-sm font-medium touch-target"
                    >
                        <LogOut className="w-4 h-4" />
                        <span className="hidden sm:block">Leave</span>
                    </button>
                </div>
            </header>

            {/* ─── Main content area ─── */}
            {/* On desktop: side-by-side. On mobile: stacked, player on top, sidebar below */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

                {/* Player Column */}
                <main className="
                    flex-shrink-0 md:flex-1
                    overflow-y-auto
                    bg-gradient-to-b from-zinc-900 to-zinc-950
                    border-b md:border-b-0 md:border-r border-zinc-800
                    p-3 sm:p-6
                ">
                    <div className="w-full max-w-4xl mx-auto">
                        <Player isHost={isHost} roomId={roomId} />
                    </div>
                </main>

                {/* ─── Sidebar (Chat / Queue) ─── */}
                {/* On mobile: fixed height at bottom; on desktop: full-height right column */}
                <aside className="
                    flex flex-col
                    w-full md:w-80 lg:w-96
                    flex-1 md:flex-none md:h-auto
                    bg-zinc-950
                    overflow-hidden
                ">
                    {/* Tab Navigation */}
                    <div className="flex-shrink-0 h-12 flex border-b border-zinc-800">
                        <button
                            className={`flex-1 font-semibold text-sm transition-colors border-b-2 flex items-center justify-center gap-2 ${activeTab === 'chat' ? 'border-purple-500 text-purple-400 bg-purple-500/5' : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'}`}
                            onClick={() => setActiveTab('chat')}
                        >
                            <MessageSquare className="w-4 h-4" />
                            Chat
                        </button>
                        <button
                            className={`flex-1 font-semibold text-sm transition-colors border-b-2 flex items-center justify-center gap-2 ${activeTab === 'queue' ? 'border-blue-500 text-blue-400 bg-blue-500/5' : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'}`}
                            onClick={() => setActiveTab('queue')}
                        >
                            <ListMusic className="w-4 h-4" />
                            Queue
                        </button>
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 overflow-hidden flex flex-col">
                        {activeTab === 'chat' ? <Chat roomId={roomId} /> : <Queue isHost={isHost} roomId={roomId} />}
                    </div>
                </aside>
            </div>
        </div>
    );
}

export default Room;
