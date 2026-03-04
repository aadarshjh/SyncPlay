import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useParams, Navigate } from 'react-router-dom';
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
            <div className="min-h-screen bg-zinc-950 text-white selection:bg-purple-500/30">
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/lobby" element={<Lobby />} />
                    <Route path="/room/:roomId" element={<RoomWrapper />} />
                </Routes>
            </div>
        </BrowserRouter>
    );
}

export default App;
