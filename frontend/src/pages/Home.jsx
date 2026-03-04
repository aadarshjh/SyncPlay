import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PlusCircle, LogIn, AlertCircle } from 'lucide-react';
import { useRoomStore } from '../store/useRoomStore';
import { useToast } from '../components/Toast';

function Home() {
    const [username, setUsernameInput] = useState('');
    const { roomId } = useParams();
    const [roomIdToJoin, setRoomIdToJoin] = useState(roomId || '');
    const navigate = useNavigate();
    const setStoreUsername = useRoomStore((state) => state.setUsername);
    const toast = useToast();
    const isInviteLink = !!roomId;

    const generateRoomId = () => {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    };

    const handleCreateRoom = (e) => {
        e.preventDefault();
        if (!username.trim()) return toast('Please enter a username', 'error');
        setStoreUsername(username);
        const newRoomId = generateRoomId();
        navigate(`/room/${newRoomId}`);
    };

    const handleJoinRoom = (e) => {
        e.preventDefault();
        if (!username.trim()) return toast('Please enter a username', 'error');
        if (!roomIdToJoin.trim()) return toast('Please enter a room code', 'error');
        setStoreUsername(username);
        navigate(`/room/${roomIdToJoin.toUpperCase()}`);
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px]" />

            <div className="glass-panel max-w-md w-full p-8 relative z-10 flex flex-col items-center">
                <div className="w-16 h-16 bg-gradient-to-tr from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-purple-500/20">
                    <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                </div>

                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400 mb-2">SyncPlay</h1>
                <p className="text-zinc-400 mb-8 text-center text-sm">Listen to music together with friends in real-time, no matter where you are.</p>

                <div className="w-full space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-zinc-400 uppercase mb-1 drop-shadow">Your Name</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsernameInput(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all placeholder:text-zinc-600"
                            placeholder="E.g. Alex"
                        />
                    </div>

                    <div className="pt-4 border-t border-zinc-800">
                        {isInviteLink ? (
                            <button
                                onClick={handleJoinRoom}
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl px-4 py-3 transition-colors flex items-center justify-center gap-2 group"
                            >
                                <LogIn className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                Join Room {roomIdToJoin}
                            </button>
                        ) : (
                            <button
                                onClick={handleCreateRoom}
                                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl px-4 py-3 transition-colors flex items-center justify-center gap-2 group"
                            >
                                <PlusCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                Create New Room
                            </button>
                        )}
                    </div>

                    {!isInviteLink && (
                        <>
                            <div className="relative py-2 flex items-center">
                                <div className="flex-grow border-t border-zinc-800"></div>
                                <span className="flex-shrink-0 mx-4 text-zinc-500 text-xs uppercase font-medium">Or join existing</span>
                                <div className="flex-grow border-t border-zinc-800"></div>
                            </div>

                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={roomIdToJoin}
                                    onChange={(e) => setRoomIdToJoin(e.target.value)}
                                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-zinc-600 font-mono"
                                    placeholder="ROOM CODE"
                                />
                                <button
                                    onClick={handleJoinRoom}
                                    className="bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-xl px-6 py-3 transition-colors flex items-center justify-center"
                                >
                                    <LogIn className="w-5 h-5" />
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Home;
