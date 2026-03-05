import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Music, RefreshCw, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
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

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
    };

    return (
        <div className="min-h-screen p-4 md:p-8 relative overflow-hidden flex flex-col items-center">
            {/* Background decoration in App.jsx */}

            <motion.div
                className="w-full max-w-5xl relative z-10 glass-panel p-6 md:p-10"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
            >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-4">
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => navigate('/')}
                            className="p-3 bg-white/5 border border-white/10 hover:bg-white/10 rounded-2xl transition-colors shadow-inner"
                        >
                            <ArrowLeft className="w-5 h-5 text-zinc-300" />
                        </motion.button>
                        <div>
                            <h1 className="text-4xl font-black font-display tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-white via-purple-200 to-blue-200 drop-shadow-sm">Public Lobby</h1>
                            <p className="text-zinc-400 text-sm mt-1 uppercase tracking-widest font-bold text-[10px]">Discover and join active listening rooms</p>
                        </div>
                    </div>

                    <div className="flex gap-2 w-full sm:w-auto">
                        {!user && (
                            <input
                                type="text"
                                value={nameInput}
                                onChange={(e) => setNameInput(e.target.value)}
                                className="bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-purple-500/50 text-sm flex-1 sm:w-48 placeholder:text-zinc-600 shadow-inner block"
                                placeholder="Temporary Name"
                            />
                        )}
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={fetchRooms}
                            disabled={isLoading}
                            className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white rounded-xl px-4 py-2.5 transition-colors flex items-center justify-center gap-2 text-sm font-semibold whitespace-nowrap shadow-[0_0_15px_rgba(0,0,0,0.5)] border border-white/5"
                        >
                            <RefreshCw className={`w-4 h-4 text-purple-400 ${isLoading ? 'animate-spin' : ''}`} />
                            Refresh
                        </motion.button>
                    </div>
                </div>

                {isLoading && rooms.length === 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6 h-56 animate-pulse"></div>
                        ))}
                    </div>
                ) : rooms.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-black/40 border border-white/10 rounded-3xl p-16 text-center flex flex-col items-center backdrop-blur-md shadow-inner"
                    >
                        <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-purple-500/20 to-blue-500/20 flex items-center justify-center mb-6">
                            <Music className="w-10 h-10 text-purple-400" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2 font-display">No Active Rooms</h3>
                        <p className="text-zinc-400 max-w-sm">The lobby is currently quiet. Head back home to create the first room and start the party!</p>
                    </motion.div>
                ) : (
                    <motion.div
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        {rooms.map((room) => (
                            <motion.div
                                key={room.id}
                                variants={itemVariants}
                                whileHover={{ y: -5, scale: 1.01 }}
                                className="bg-black/40 backdrop-blur-md border border-white/10 hover:border-purple-500/50 rounded-2xl p-6 transition-all group flex flex-col shadow-xl"
                            >
                                <div className="flex justify-between items-start mb-6">
                                    <h3 className="text-2xl font-black text-white font-mono tracking-wider drop-shadow-md">{room.id}</h3>
                                    <div className="flex items-center gap-1.5 bg-black/50 rounded-full px-3 py-1.5 border border-white/10 shadow-inner">
                                        <Users className="w-3.5 h-3.5 text-purple-400" />
                                        <span className="text-xs font-bold text-zinc-300">{room.user_count}</span>
                                    </div>
                                </div>

                                {room.current_song ? (
                                    <div className="flex items-center gap-4 bg-white/5 rounded-2xl p-3 mb-6 border border-white/10 shadow-inner group-hover:bg-white/10 transition-colors">
                                        <div className="w-12 h-12 rounded-xl relative overflow-hidden flex-shrink-0 bg-zinc-900 border border-white/10 shadow-lg">
                                            {room.current_song.thumbnail ? (
                                                <img src={room.current_song.thumbnail} alt="thumb" className="w-full h-full object-cover" />
                                            ) : (
                                                <Music className="w-5 h-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-zinc-500" />
                                            )}
                                            {/* Playing Equalizer Overlay */}
                                            <div className="absolute inset-0 bg-black/40 flex flex-col justify-end p-1 pb-1.5 gap-[2px] opacity-0 group-hover:opacity-100 transition-opacity">
                                                <div className="flex items-end justify-center h-full gap-1">
                                                    <div className="w-1 h-2 bg-purple-500 rounded-t animate-pulse"></div>
                                                    <div className="w-1 h-4 bg-purple-500 rounded-t animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                                                    <div className="w-1 h-3 bg-purple-500 rounded-t animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="overflow-hidden">
                                            <p className="text-[10px] text-purple-400 font-bold uppercase tracking-widest mb-0.5">Now Playing</p>
                                            <p className="text-sm text-zinc-100 truncate font-semibold">{room.current_song.title}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-4 bg-black/20 rounded-2xl p-3 mb-6 border border-white/5 shadow-inner">
                                        <div className="w-12 h-12 rounded-xl bg-zinc-900/50 flex items-center justify-center flex-shrink-0 border border-white/5">
                                            <Music className="w-5 h-5 text-zinc-600" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-0.5">Status</p>
                                            <p className="text-sm text-zinc-400 font-medium">Quiet Room</p>
                                        </div>
                                    </div>
                                )}

                                <div className="mt-auto">
                                    <div className="flex flex-wrap gap-2 mb-5">
                                        {room.users.map((u, i) => (
                                            <span key={i} className="text-xs bg-white/10 border border-white/5 text-zinc-300 px-2.5 py-1 rounded-lg font-medium">
                                                {u.username}
                                            </span>
                                        ))}
                                        {room.user_count > 3 && (
                                            <span className="text-xs bg-zinc-900 border border-zinc-800 text-zinc-500 px-2.5 py-1 rounded-lg">+{room.user_count - 3}</span>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => handleJoinRoom(room.id)}
                                        className="w-full bg-gradient-to-r from-purple-600/20 to-blue-600/20 hover:from-purple-600 hover:to-blue-600 text-white font-bold py-3.5 rounded-xl transition-all text-sm border border-purple-500/30 hover:border-transparent flex items-center justify-center gap-2 group/btn"
                                    >
                                        Join Session
                                        <ArrowLeft className="w-4 h-4 rotate-180 opacity-0 -ml-4 group-hover/btn:opacity-100 group-hover/btn:ml-0 transition-all" />
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </motion.div>
        </div>
    );
}

export default Lobby;
