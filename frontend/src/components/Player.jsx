import React, { useRef, useState, useEffect } from 'react';
import ReactPlayer from 'react-player';
import { Play, Pause, SkipForward, Search, Volume2, VolumeX } from 'lucide-react';
import { socket } from '../lib/socket';
import { useRoomStore } from '../store/useRoomStore';

function Player({ isHost, roomId }) {
    const { currentSong, isPlaying, currentTime } = useRoomStore();
    const playerRef = useRef(null);
    const [searchInput, setSearchInput] = useState('');
    const [volume, setVolume] = useState(0.8);
    const [isMuted, setIsMuted] = useState(false);

    // Handle syncing to socket time changes
    useEffect(() => {
        if (playerRef.current && Math.abs(playerRef.current.getCurrentTime() - currentTime) > 2) {
            playerRef.current.seekTo(currentTime);
        }
    }, [currentTime]);

    const handlePlay = () => {
        if (!isHost) return;
        const time = playerRef.current?.getCurrentTime() || 0;
        socket.emit('play_song', { roomId, currentTime: time });
    };

    const handlePause = () => {
        if (!isHost) return;
        const time = playerRef.current?.getCurrentTime() || 0;
        socket.emit('pause_song', { roomId, currentTime: time });
    };

    const handleSeek = (e) => {
        if (!isHost) return;
        // Debounce seek emits in a real app, here we emit simply
        socket.emit('seek_time', { roomId, currentTime: parseFloat(e) });
    };

    const handleSkip = () => {
        if (!isHost) return;
        socket.emit('skip_song', { roomId });
    };

    const onProgress = (state) => {
        // Optionally emit progress if you want strict sync continuously, but usually play/pause/seek is enough
    };

    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    const handleSearchYoutube = async (e) => {
        e.preventDefault();
        if (!searchInput.trim()) return;

        const urlPattern = /^(http|https):\/\/[^ "]+$/;
        if (urlPattern.test(searchInput)) {
            // Direct Link pasted
            socket.emit('add_to_queue', {
                roomId,
                song: {
                    title: 'YouTube Link',
                    url: searchInput,
                    addedBy: useRoomStore.getState().username,
                    type: 'youtube'
                }
            });
            setSearchInput('');
            setSearchResults([]);
        } else {
            // Text search
            setIsSearching(true);
            try {
                // Pointing to our backend proxy route
                const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';
                const res = await fetch(`${serverUrl}/api/search?q=${encodeURIComponent(searchInput)}`);
                const data = await res.json();
                if (data.results) {
                    setSearchResults(data.results);
                }
            } catch (err) {
                console.error("Search failed:", err);
                alert("Search failed. Please try again.");
            } finally {
                setIsSearching(false);
            }
        }
    };

    const handleSelectSearchResult = (video) => {
        socket.emit('add_to_queue', {
            roomId,
            song: {
                title: video.title,
                url: video.url,
                addedBy: useRoomStore.getState().username,
                type: 'youtube'
            }
        });
        setSearchInput('');
        setSearchResults([]);
    };

    return (
        <div className="flex flex-col items-center w-full">

            {/* Search Bar / Add Song */}
            <div className="w-full max-w-2xl mb-4 sm:mb-8 flex gap-2 flex-col relative">
                <form onSubmit={handleSearchYoutube} className="w-full relative">
                    <Search className="w-5 h-5 absolute left-3 top-3.5 text-zinc-500" />
                    <input
                        type="text"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-700/50 rounded-xl pl-10 pr-20 py-3 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all placeholder:text-zinc-600 shadow-inner text-base"
                        placeholder="Search or paste YouTube URL..."
                    />
                    <button type="submit" disabled={isSearching} className="absolute right-2 top-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 disabled:text-zinc-400 px-4 py-2 rounded-lg text-sm font-semibold transition-colors touch-target">
                        {isSearching ? '...' : 'Add'}
                    </button>
                </form>

                {/* Search Results Dropdown */}
                {searchResults.length > 0 && (
                    <div className="absolute top-14 left-0 w-full bg-zinc-900 border border-zinc-700/50 rounded-xl shadow-2xl overflow-hidden z-50">
                        {searchResults.map((video, idx) => (
                            <div
                                key={idx}
                                onClick={() => handleSelectSearchResult(video)}
                                className="flex items-center gap-3 p-3 hover:bg-zinc-800 cursor-pointer border-b border-zinc-800/50 last:border-0 transition-colors"
                            >
                                <img src={video.thumbnail} alt="thumb" className="w-16 h-10 object-cover rounded" />
                                <div className="flex-1 overflow-hidden">
                                    <p className="text-sm font-medium text-white truncate">{video.title}</p>
                                    <p className="text-xs text-zinc-400">{video.author} • {video.duration}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Video / Album Art Area — responsive aspect ratio */}
            <div className="w-full max-w-3xl aspect-video bg-zinc-900 rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden relative">
                {!currentSong ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 text-center px-4">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-zinc-800/50 flex items-center justify-center mb-4 border border-zinc-700">
                            <Play className="w-7 h-7 sm:w-8 sm:h-8 ml-1" />
                        </div>
                        <p className="text-sm">No active song. Add something to the queue to start listening.</p>
                    </div>
                ) : (
                    <ReactPlayer
                        ref={playerRef}
                        url={currentSong.url}
                        playing={isPlaying}
                        volume={isMuted ? 0 : volume}
                        controls={isHost}
                        width="100%"
                        height="100%"
                        onPlay={handlePlay}
                        onPause={handlePause}
                        onEnded={handleSkip}
                        onProgress={onProgress}
                        style={{ pointerEvents: isHost ? 'auto' : 'none' }}
                    />
                )}
            </div>

            {/* Custom Controls Container */}
            {currentSong && (
                <div className="mt-4 sm:mt-8 glass-panel p-4 sm:p-6 w-full max-w-2xl flex flex-col gap-4">
                    <div className="text-center">
                        <h2 className="text-base sm:text-xl font-bold truncate">{currentSong.title}</h2>
                        <p className="text-zinc-400 text-xs sm:text-sm">Added by {currentSong.addedBy}</p>
                    </div>

                    {/* Play/Skip Buttons - Big tap areas for mobile */}
                    <div className="flex justify-center items-center gap-6 sm:gap-8">
                        <button
                            onClick={isPlaying ? handlePause : handlePlay}
                            disabled={!isHost}
                            className={`w-16 h-16 sm:w-14 sm:h-14 rounded-full flex items-center justify-center shadow-lg transition-all touch-target ${!isHost ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' : 'bg-gradient-to-tr from-purple-500 to-blue-500 active:scale-95 hover:scale-105 text-white'
                                }`}
                        >
                            {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-1" />}
                        </button>

                        <button
                            onClick={handleSkip}
                            disabled={!isHost}
                            className={`p-4 rounded-full flex items-center justify-center transition-all touch-target ${!isHost ? 'text-zinc-600 cursor-not-allowed' : 'text-zinc-400 hover:text-white hover:bg-zinc-800 active:scale-95'
                                }`}
                        >
                            <SkipForward className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Volume Controls (local — does not sync, each user controls their own volume) */}
                    <div className="flex items-center gap-3 justify-center">
                        <button
                            onClick={() => setIsMuted(m => !m)}
                            className="text-zinc-400 hover:text-white transition-colors p-1"
                            title={isMuted ? 'Unmute' : 'Mute'}
                        >
                            {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                        </button>
                        <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.02}
                            value={isMuted ? 0 : volume}
                            onChange={e => { setVolume(parseFloat(e.target.value)); setIsMuted(false); }}
                            className="w-32 accent-purple-500 cursor-pointer"
                        />
                        <span className="text-xs text-zinc-500 w-8 text-right">
                            {isMuted ? '0' : Math.round(volume * 100)}%
                        </span>
                    </div>
                </div>
            )}

            {/* Host Notice */}
            {!isHost && currentSong && (
                <p className="text-xs text-zinc-500 mt-4 bg-zinc-900/50 px-3 py-1.5 rounded-full border border-zinc-800">
                    You are listening along. Only the host can control playback.
                </p>
            )}
        </div>
    );
}

export default Player;
