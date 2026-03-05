import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PlusCircle, LogIn, LogOut, Compass, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import { useRoomStore } from '../store/useRoomStore';
import { useToast } from '../components/Toast';
import { supabase } from '../lib/supabase';

function Home() {
    const { roomId } = useParams();
    const { username, user, setUsername: setStoreUsername } = useRoomStore((state) => ({
        username: state.username,
        user: state.user,
        setUsername: state.setUsername
    }));
    const [roomIdToJoin, setRoomIdToJoin] = useState(roomId || '');
    const [usernameInput, setUsernameInput] = useState(username);
    const [favoriteRooms, setFavoriteRooms] = useState([]);
    const navigate = useNavigate();
    const toast = useToast();
    const isInviteLink = !!roomId;

    useEffect(() => {
        if (user) {
            const fetchFavorites = async () => {
                const { data, error } = await supabase
                    .from('favorite_rooms')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false });

                if (data) setFavoriteRooms(data);
            };
            fetchFavorites();
        } else {
            setFavoriteRooms([]);
        }
    }, [user]);

    const handleGoogleLogin = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        });
        if (error) toast(error.message, 'error');
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        toast('Signed out successfully', 'success');
    };

    const generateRoomId = () => {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    };

    const handleCreateRoom = (e) => {
        e.preventDefault();
        if (!usernameInput.trim() && !user) return toast('Please enter a username or sign in', 'error');
        setStoreUsername(usernameInput || user?.user_metadata?.full_name || 'Guest');
        const newRoomId = generateRoomId();
        navigate(`/room/${newRoomId}`);
    };

    const handleJoinRoom = (e) => {
        e.preventDefault();
        if (!usernameInput.trim() && !user) return toast('Please enter a username or sign in', 'error');
        if (!roomIdToJoin.trim()) return toast('Please enter a room code', 'error');
        setStoreUsername(usernameInput || user?.user_metadata?.full_name || 'Guest');
        navigate(`/room/${roomIdToJoin.toUpperCase()}`);
    };

    const containerVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                duration: 0.6,
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background decoration moved to App.jsx, but keeping relative flow here */}

            <motion.div
                className="glass-panel max-w-md w-full p-8 relative z-10 flex flex-col items-center"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                <motion.div variants={itemVariants} className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(168,85,247,0.4)] border border-white/10">
                    <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                </motion.div>

                <motion.h1 variants={itemVariants} className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-br from-white via-purple-200 to-blue-200 mb-2 drop-shadow-sm font-display tracking-tight">SyncPlay</motion.h1>
                <motion.p variants={itemVariants} className="text-zinc-400 mb-8 text-center text-sm">Listen to music together with friends in real-time, no matter where you are.</motion.p>

                <div className="w-full space-y-4">
                    {/* Auth Section */}
                    {user ? (
                        <motion.div variants={itemVariants} className="space-y-3">
                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between backdrop-blur-sm">
                                <div className="flex items-center gap-3">
                                    {user.user_metadata?.avatar_url && (
                                        <img src={user.user_metadata.avatar_url} alt="avatar" className="w-10 h-10 rounded-full bg-zinc-800 border-2 border-white/10" />
                                    )}
                                    <div>
                                        <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Signed in as</p>
                                        <p className="text-white font-semibold">{user.user_metadata?.full_name || user.email}</p>
                                    </div>
                                </div>
                                <button onClick={handleSignOut} title="Sign Out" className="p-2 text-zinc-400 hover:text-red-400 transition-colors rounded-lg hover:bg-white/5">
                                    <LogOut className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Favorite Rooms List */}
                            {favoriteRooms.length > 0 && (
                                <div className="bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-sm">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Star className="w-4 h-4 text-yellow-500" fill="currentColor" />
                                        <h3 className="text-sm font-semibold text-zinc-200">Favorite Rooms</h3>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {favoriteRooms.map(room => (
                                            <button
                                                key={room.room_id}
                                                onClick={() => {
                                                    setStoreUsername(user?.user_metadata?.full_name || 'Guest');
                                                    navigate(`/room/${room.room_id}`);
                                                }}
                                                className="bg-zinc-900/50 hover:bg-white/10 border border-white/5 rounded-lg p-2.5 text-left transition-all flex flex-col justify-center group"
                                            >
                                                <span className="font-mono text-zinc-300 group-hover:text-white text-sm truncate">{room.room_id}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    ) : (
                        <motion.button
                            variants={itemVariants}
                            onClick={handleGoogleLogin}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="w-full bg-white text-black hover:bg-zinc-200 font-bold rounded-xl px-4 py-3.5 transition-all flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            Continue with Google
                        </motion.button>
                    )}

                    {!user && (
                        <motion.div variants={itemVariants}>
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 mt-6">Or continue as guest</label>
                            <input
                                type="text"
                                value={usernameInput}
                                onChange={(e) => setUsernameInput(e.target.value)}
                                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all placeholder:text-zinc-600 shadow-inner"
                                placeholder="Enter a temporary name"
                            />
                        </motion.div>
                    )}

                    <motion.div variants={itemVariants} className="pt-4 border-t border-white/10 mt-2">
                        {isInviteLink ? (
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={handleJoinRoom}
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl px-4 py-3.5 transition-all flex items-center justify-center gap-2 group shadow-[0_0_20px_rgba(37,99,235,0.3)]"
                            >
                                <LogIn className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                Join Room {roomIdToJoin}
                            </motion.button>
                        ) : (
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={handleCreateRoom}
                                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold rounded-xl px-4 py-3.5 transition-all flex items-center justify-center gap-2 group shadow-[0_0_20px_rgba(147,51,234,0.3)]"
                            >
                                <PlusCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                Create New Room
                            </motion.button>
                        )}
                    </motion.div>

                    {!isInviteLink && (
                        <motion.div variants={itemVariants}>
                            <div className="relative py-3 flex items-center">
                                <div className="flex-grow border-t border-white/10"></div>
                                <span className="flex-shrink-0 mx-4 text-zinc-500 text-[10px] tracking-widest uppercase font-bold">Or join existing</span>
                                <div className="flex-grow border-t border-white/10"></div>
                            </div>

                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => navigate('/lobby')}
                                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold rounded-xl px-4 py-3.5 transition-all flex items-center justify-center gap-2 group mb-3"
                            >
                                <Compass className="w-5 h-5 group-hover:scale-110 transition-transform text-blue-400" />
                                Browse Public Lobby
                            </motion.button>

                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={roomIdToJoin}
                                    onChange={(e) => setRoomIdToJoin(e.target.value)}
                                    className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-zinc-600 font-mono text-center tracking-widest uppercase shadow-inner"
                                    placeholder="ROOM CODE"
                                />
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleJoinRoom}
                                    className="bg-white/10 hover:bg-white/20 border border-white/10 text-white font-semibold rounded-xl px-6 py-3 transition-colors flex items-center justify-center"
                                >
                                    <LogIn className="w-5 h-5" />
                                </motion.button>
                            </div>
                        </motion.div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}

export default Home;
