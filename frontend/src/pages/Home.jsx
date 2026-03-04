import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PlusCircle, LogIn, LogOut, Compass, Star } from 'lucide-react';
import { useRoomStore } from '../store/useRoomStore';
import { useToast } from '../components/Toast';
import { supabase } from '../lib/supabase';

function Home() {
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
                    {/* Auth Section */}
                    {user ? (
                        <div className="space-y-3">
                            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {user.user_metadata?.avatar_url && (
                                        <img src={user.user_metadata.avatar_url} alt="avatar" className="w-10 h-10 rounded-full bg-zinc-800" />
                                    )}
                                    <div>
                                        <p className="text-sm text-zinc-400">Signed in as</p>
                                        <p className="text-white font-medium">{user.user_metadata?.full_name || user.email}</p>
                                    </div>
                                </div>
                                <button onClick={handleSignOut} title="Sign Out" className="p-2 text-zinc-500 hover:text-red-400 transition-colors rounded-lg hover:bg-zinc-800">
                                    <LogOut className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Favorite Rooms List */}
                            {favoriteRooms.length > 0 && (
                                <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-xl p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Star className="w-4 h-4 text-yellow-500" fill="currentColor" />
                                        <h3 className="text-sm font-semibold text-zinc-300">Favorite Rooms</h3>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {favoriteRooms.map(room => (
                                            <button
                                                key={room.room_id}
                                                onClick={() => {
                                                    setStoreUsername(user?.user_metadata?.full_name || 'Guest');
                                                    navigate(`/room/${room.room_id}`);
                                                }}
                                                className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg p-2.5 text-left transition-colors flex flex-col justify-center"
                                            >
                                                <span className="font-mono text-white text-sm truncate">{room.room_id}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <button
                            onClick={handleGoogleLogin}
                            className="w-full bg-white text-black hover:bg-zinc-200 font-semibold rounded-xl px-4 py-3 transition-colors flex items-center justify-center gap-3"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            Continue with Google
                        </button>
                    )}

                    {!user && (
                        <div>
                            <label className="block text-xs font-semibold text-zinc-400 uppercase mb-1 drop-shadow mt-4">Or continue as guest</label>
                            <input
                                type="text"
                                value={usernameInput}
                                onChange={(e) => setUsernameInput(e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all placeholder:text-zinc-600"
                                placeholder="Enter a temporary name"
                            />
                        </div>
                    )}

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

                            <button
                                onClick={() => navigate('/lobby')}
                                className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-xl px-4 py-3 transition-colors flex items-center justify-center gap-2 group"
                            >
                                <Compass className="w-5 h-5 group-hover:scale-110 transition-transform text-blue-400" />
                                Browse Public Lobby
                            </button>

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
