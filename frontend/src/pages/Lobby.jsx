import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Music, RefreshCw, ArrowLeft } from 'lucide-react';
import { useRoomStore } from '../store/useRoomStore';
import { useToast } from '../components/Toast';

const serverUrl = import.meta.env.VITE_SERVER_URL;

function Lobby() {
    const [rooms, setRooms] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const { username, user, setUsername: setStoreUsername } = useRoomStore((state) => ({
        username: state.username,
        user: state.user,
        setUsername: state.setUsername
    }));
    const [nameInput, setNameInput] = useState(username);
    const navigate = useNavigate();
    const toast = useToast();

    const fetchRooms = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${serverUrl}/api/rooms`);
            const data = await res.json();
            if (data.rooms) {
                setRooms(data.rooms);
            }
        } catch (err) {
            console.error("Failed to fetch rooms:", err);
            toast('Failed to load active rooms', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchRooms();
        const interval = setInterval(fetchRooms, 15000); // refresh every 15s
        return () => clearInterval(interval);
    }, []);

    const handleJoinRoom = (roomId) => {
        if (!nameInput.trim() && !user) return toast('Please enter a username or sign in', 'error');
        setStoreUsername(nameInput || user?.user_metadata?.full_name || 'Guest');
        navigate(`/room/${roomId}`);
    };

    return (
        <div className="min-h-screen p-4 md:p-8 relative overflow-hidden flex flex-col items-center">
            {/* Background decoration */}
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

            <div className="w-full max-w-5xl relative z-10">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/')}
                            className="p-2 bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 rounded-xl transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-zinc-400" />
                        </button>
                        <div>
                            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400">Public Lobby</h1>
                            <p className="text-zinc-400 text-sm mt-1">Discover and join active listening rooms</p>
                        </div>
                    </div>

                    <div className="flex gap-2 w-full sm:w-auto">
                        {!user && (
                            <input
                                type="text"
                                value={nameInput}
                                onChange={(e) => setNameInput(e.target.value)}
                                className="bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-purple-500 text-sm flex-1 sm:w-48 placeholder:text-zinc-600"
                                placeholder="Your Name"
                            />
                        )}
                        <button
                            onClick={fetchRooms}
                            disabled={isLoading}
                            className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white rounded-xl px-4 py-2 transition-colors flex items-center justify-center gap-2 text-sm whitespace-nowrap"
                        >
                            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                    </div>
                </div>

                {isLoading && rooms.length === 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 h-48 animate-pulse"></div>
                        ))}
                    </div>
                ) : rooms.length === 0 ? (
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-12 text-center flex flex-col items-center">
                        <Music className="w-12 h-12 text-zinc-600 mb-4" />
                        <h3 className="text-xl font-semibold text-white mb-2">No Active Rooms</h3>
                        <p className="text-zinc-400 max-w-sm">There aren't any public rooms running right now. Go back and create the first one!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {rooms.map((room) => (
                            <div key={room.id} className="bg-zinc-900 border border-zinc-800 hover:border-purple-500/50 rounded-2xl p-6 transition-all group flex flex-col shadow-lg shadow-black/20">
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="text-xl font-bold text-white font-mono">{room.id}</h3>
                                    <div className="flex items-center gap-1.5 bg-zinc-800 rounded-full px-3 py-1 border border-zinc-700">
                                        <Users className="w-3.5 h-3.5 text-purple-400" />
                                        <span className="text-xs font-medium text-zinc-300">{room.user_count}</span>
                                    </div>
                                </div>

                                {room.current_song ? (
                                    <div className="flex items-center gap-3 bg-zinc-950/50 rounded-xl p-3 mb-6 border border-zinc-800 border-dashed">
                                        <div className="w-10 h-10 rounded relative overflow-hidden flex-shrink-0 bg-zinc-800">
                                            {room.current_song.thumbnail ? (
                                                <img src={room.current_song.thumbnail} alt="thumb" className="w-full h-full object-cover opacity-80" />
                                            ) : (
                                                <Music className="w-5 h-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-zinc-500" />
                                            )}
                                        </div>
                                        <div className="overflow-hidden">
                                            <p className="text-xs text-zinc-500 font-semibold uppercase mb-0.5">Now Playing</p>
                                            <p className="text-sm text-zinc-200 truncate font-medium">{room.current_song.title}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3 bg-zinc-950/50 rounded-xl p-3 mb-6 border border-zinc-800 border-dashed">
                                        <div className="w-10 h-10 rounded bg-zinc-800 flex items-center justify-center flex-shrink-0">
                                            <Music className="w-4 h-4 text-zinc-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm text-zinc-400">Nothing playing right now</p>
                                        </div>
                                    </div>
                                )}

                                <div className="mt-auto">
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {room.users.map((u, i) => (
                                            <span key={i} className="text-xs bg-zinc-800 text-zinc-300 px-2 py-1 rounded">
                                                {u.username}
                                            </span>
                                        ))}
                                        {room.user_count > 3 && (
                                            <span className="text-xs bg-zinc-800 text-zinc-500 px-2 py-1 rounded">+{room.user_count - 3} more</span>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => handleJoinRoom(room.id)}
                                        className="w-full bg-purple-600/10 hover:bg-purple-600 text-purple-400 hover:text-white font-semibold py-2.5 rounded-xl transition-colors text-sm border border-purple-500/20 hover:border-transparent"
                                    >
                                        Join Room
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default Lobby;
