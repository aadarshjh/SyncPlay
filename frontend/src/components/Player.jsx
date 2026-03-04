import React, { useRef, useState, useEffect } from 'react';
import ReactPlayer from 'react-player';
import { Play, Pause, SkipForward, Search, Volume2, VolumeX, MonitorPlay, Music2, Repeat, Shuffle } from 'lucide-react';
import { socket } from '../lib/socket';
import { useRoomStore } from '../store/useRoomStore';
import { useToast } from '../components/Toast';

// Detect mobile - iOS/Android block JS volume control via hardware policy
const isMobileBrowser = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

// Format seconds → m:ss
const formatTime = (secs) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
};

function Player({ isHost, roomId }) {
    const { currentSong, isPlaying, currentTime, queue, loopMode } = useRoomStore();
    const playerRef = useRef(null);
    const toast = useToast();
    const [searchInput, setSearchInput] = useState('');
    const [volume, setVolume] = useState(0.8);
    const [isMuted, setIsMuted] = useState(false);
    const [audioOnly, setAudioOnly] = useState(false);
    // Seek bar
    const [played, setPlayed] = useState(0);      // 0-1 fraction
    const [duration, setDuration] = useState(0);  // seconds
    const [seeking, setSeeking] = useState(false);
    // Lyrics
    const [showLyrics, setShowLyrics] = useState(false);
    const [lyrics, setLyrics] = useState(null);
    const [lyricsLoading, setLyricsLoading] = useState(false);

    // Handle syncing to socket time changes
    useEffect(() => {
        if (playerRef.current && Math.abs(playerRef.current.getCurrentTime() - currentTime) > 2) {
            playerRef.current.seekTo(currentTime);
        }
    }, [currentTime]);

    // Now Playing Toast
    useEffect(() => {
        if (currentSong && currentSong.title) {
            toast(`🎵 Now Playing: ${currentSong.title}`, 'info');
        }
    }, [currentSong?.id]); // Depend on ID so it triggers properly

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

    const onProgress = ({ played: p, playedSeconds }) => {
        if (!seeking) setPlayed(p);
    };

    const handleSeekMouseDown = () => setSeeking(true);
    const handleSeekChange = (e) => setPlayed(parseFloat(e.target.value));
    const handleSeekMouseUp = (e) => {
        setSeeking(false);
        if (!isHost) return;
        const newTime = parseFloat(e.target.value) * duration;
        playerRef.current?.seekTo(newTime);
        socket.emit('seek_time', { roomId, currentTime: newTime });
    };

    const handleShuffle = () => {
        if (!isHost || queue.length < 2) return;
        socket.emit('shuffle_queue', { roomId });
        toast('Queue shuffled 🔀', 'success');
    };

    const handleToggleLoop = () => {
        if (!isHost) return;
        socket.emit('toggle_loop', { roomId, loopMode: !loopMode });
        toast(`Repeat ${!loopMode ? 'enabled 🔁' : 'disabled'}`, 'info');
    };

    const fetchLyrics = async (title) => {
        setLyricsLoading(true);
        setLyrics(null);
        setShowLyrics(true);
        try {
            // Parse "Artist - Song Title (Official Video)" → artist + clean title
            const parts = title.split('-');
            const artist = parts.length > 1 ? parts[0].trim() : title;
            const song = parts.length > 1 ? parts.slice(1).join('-').trim() : title;
            // Strip YouTube suffixes: (Official Video), [Lyrics], etc.
            const cleanSong = song.replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').trim();

            const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';
            const res = await fetch(
                `${serverUrl}/api/lyrics?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(cleanSong)}`
            );
            const data = await res.json();
            setLyrics(data.lyrics || null);
        } catch {
            setLyrics(null);
        } finally {
            setLyricsLoading(false);
        }
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
                toast('Search failed. Please try again.', 'error');
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
            <div className="w-full max-w-2xl mb-4 sm:mb-8 relative">
                <form onSubmit={handleSearchYoutube} className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-700/50 rounded-xl pl-9 pr-3 py-3 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all placeholder:text-zinc-600 shadow-inner text-sm sm:text-base"
                            placeholder="Search YouTube or paste URL..."
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isSearching}
                        className="flex-shrink-0 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-900 disabled:text-zinc-500 px-5 py-3 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap"
                    >
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
                ) : audioOnly ? (
                    // Audio Only Mode
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                        <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-2xl">
                            <Music2 className={`w-12 h-12 text-white ${isPlaying ? 'animate-pulse' : ''}`} />
                        </div>
                        <p className="text-zinc-400 text-sm font-medium text-center px-4 truncate max-w-full">{currentSong.title}</p>
                        {/* ReactPlayer hidden but still playing audio */}
                        <div className="hidden">
                            <ReactPlayer
                                ref={playerRef}
                                url={currentSong.url}
                                playing={isPlaying}
                                volume={isMuted ? 0 : volume}
                                onPlay={handlePlay}
                                onPause={handlePause}
                                onEnded={handleSkip}
                                onProgress={onProgress}
                            />
                        </div>
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
                        onDuration={setDuration}
                        style={{ pointerEvents: isHost ? 'auto' : 'none' }}
                    />
                )}
            </div>

            {/* ── Seek Bar ── */}
            {currentSong && duration > 0 && (
                <div className="w-full max-w-3xl mt-2 px-1">
                    <input
                        type="range"
                        min={0} max={1} step={0.001}
                        value={played}
                        onMouseDown={handleSeekMouseDown}
                        onChange={handleSeekChange}
                        onMouseUp={handleSeekMouseUp}
                        onTouchEnd={handleSeekMouseUp}
                        disabled={!isHost}
                        className={`w-full h-1.5 rounded-full appearance-none ${isHost ? 'cursor-pointer' : 'cursor-default opacity-70'}`}
                        style={{
                            background: `linear-gradient(to right, rgb(168 85 247) ${played * 100}%, rgb(63 63 70) ${played * 100}%)`
                        }}
                    />
                    <div className="flex justify-between text-[10px] text-zinc-500 mt-1 font-mono">
                        <span>{formatTime(played * duration)}</span>
                        <span>{formatTime(duration)}</span>
                    </div>
                </div>
            )}

            {/* Custom Controls Container */}
            {currentSong && (
                <div className="mt-4 sm:mt-6 glass-panel p-4 sm:p-6 w-full max-w-2xl flex flex-col gap-4">
                    <div className="text-center">
                        <h2 className="text-base sm:text-xl font-bold truncate">{currentSong.title}</h2>
                        <p className="text-zinc-400 text-xs sm:text-sm">Added by {currentSong.addedBy}</p>
                    </div>

                    {/* Controls Row (Shuffle, Play/Pause, Skip, Repeat) */}
                    <div className="flex justify-center items-center gap-4 sm:gap-6">
                        <button
                            onClick={handleShuffle}
                            disabled={!isHost || queue.length < 2}
                            title="Shuffle Queue"
                            className={`p-3 rounded-full flex items-center justify-center transition-all ${!isHost || queue.length < 2
                                    ? 'text-zinc-700 cursor-not-allowed hidden sm:flex'
                                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800 active:scale-95'
                                }`}
                        >
                            <Shuffle className="w-5 h-5 sm:w-6 sm:h-6" />
                        </button>

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
                            title="Skip / Next"
                            className={`p-4 rounded-full flex items-center justify-center transition-all touch-target ${!isHost ? 'text-zinc-600 cursor-not-allowed' : 'text-zinc-400 hover:text-white hover:bg-zinc-800 active:scale-95'
                                }`}
                        >
                            <SkipForward className="w-6 h-6 sm:w-7 sm:h-7" />
                        </button>

                        <button
                            onClick={handleToggleLoop}
                            disabled={!isHost}
                            title={loopMode ? "Repeat is On" : "Repeat is Off"}
                            className={`p-3 rounded-full flex items-center justify-center transition-all ${!isHost
                                    ? 'text-zinc-700 cursor-not-allowed hidden sm:flex'
                                    : loopMode
                                        ? 'text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 active:scale-95'
                                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800 active:scale-95'
                                }`}
                        >
                            <Repeat className="w-5 h-5 sm:w-6 sm:h-6" />
                        </button>
                    </div>

                    {/* Audio/Video Toggle + Lyrics Button */}
                    {currentSong && (
                        <div className="flex justify-center gap-2 flex-wrap">
                            <button
                                onClick={() => setAudioOnly(a => !a)}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white"
                            >
                                {audioOnly
                                    ? <><MonitorPlay className="w-4 h-4" /> Switch to Video</>
                                    : <><Music2 className="w-4 h-4" /> Audio Only</>}
                            </button>
                            <button
                                onClick={() => showLyrics ? setShowLyrics(false) : fetchLyrics(currentSong.title)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all border ${showLyrics
                                    ? 'border-purple-500 text-purple-400 bg-purple-500/10'
                                    : 'border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white'
                                    }`}
                            >
                                🎤 {showLyrics ? 'Hide Lyrics' : 'Show Lyrics'}
                            </button>
                        </div>
                    )}

                    {/* Volume Controls */}
                    {isMobileBrowser ? (
                        <p className="text-center text-xs text-zinc-600 italic">
                            Use your device's volume buttons to adjust volume
                        </p>
                    ) : (
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
                    )}
                </div>
            )}

            {/* ── Lyrics Panel ── */}
            {currentSong && showLyrics && (
                <div className="w-full max-w-2xl mt-4 glass-panel overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                        <span className="text-sm font-semibold text-zinc-300">🎤 Lyrics</span>
                        <button onClick={() => setShowLyrics(false)} className="text-zinc-500 hover:text-white">
                            <span className="text-xs">✕ Close</span>
                        </button>
                    </div>
                    <div className="p-4 max-h-72 overflow-y-auto">
                        {lyricsLoading ? (
                            <p className="text-zinc-500 text-sm text-center animate-pulse">Fetching lyrics...</p>
                        ) : lyrics ? (
                            <pre className="text-zinc-300 text-sm whitespace-pre-wrap font-sans leading-relaxed">{lyrics}</pre>
                        ) : (
                            <div className="text-center text-zinc-500 text-sm py-4">
                                <p>😔 Lyrics not found for this song.</p>
                                <p className="text-xs mt-1 text-zinc-600">Works best with songs in "Artist - Title" format.</p>
                            </div>
                        )}
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
