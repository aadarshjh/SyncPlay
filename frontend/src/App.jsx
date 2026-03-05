import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useParams, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Home from './pages/Home';
import Room from './pages/Room';
import Lobby from './pages/Lobby';
import { useRoomStore } from './store/useRoomStore';
import { supabase } from './lib/supabase';

// Wrapper to check if we have a username before entering a room directly from a URL
function RoomWrapper() {
    const { roomId } = useParams();
    const username = useRoomStore((state) => state.username);

    // If no username, send them to Home to enter one, but keep the roomId in the URL
    if (!username) {
        return <Home />;
    }

    return <Room />;
}

function App() {
    useEffect(() => {
        const { setUser, setUsername } = useRoomStore.getState();

        // Check current session
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                setUser(session.user);
                setUsername(session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || '');
            }
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                setUser(session.user);
                setUsername(session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || '');
            } else {
                setUser(null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    return (
        <BrowserRouter>
            <div className="min-h-screen bg-zinc-950 text-white selection:bg-purple-500/30 relative overflow-hidden font-sans">
                {/* Animated Background Mesh */}
                <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-purple-600/20 bg-blob"></div>
                    <div className="absolute top-[20%] right-[-10%] w-[35vw] h-[35vw] bg-blue-600/20 bg-blob animation-delay-2000"></div>
                    <div className="absolute bottom-[-20%] left-[20%] w-[45vw] h-[45vw] bg-pink-600/20 bg-blob animation-delay-4000"></div>
                    {/* Noise overlay for texture */}
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
                </div>

                <motion.div
                    className="relative z-10 w-full min-h-screen flex flex-col safe-top safe-bottom"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.8 }}
                >
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/lobby" element={<Lobby />} />
                        <Route path="/room/:roomId" element={<RoomWrapper />} />
                    </Routes>
                </motion.div>
            </div>
        </BrowserRouter>
    );
}

export default App;
