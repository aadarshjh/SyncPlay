import React from 'react';
import { BrowserRouter, Routes, Route, useParams, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Room from './pages/Room';
import { useRoomStore } from './store/useRoomStore';

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
    return (
        <BrowserRouter>
            <div className="min-h-screen bg-zinc-950 text-white selection:bg-purple-500/30">
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/room/:roomId" element={<RoomWrapper />} />
                </Routes>
            </div>
        </BrowserRouter>
    );
}

export default App;
