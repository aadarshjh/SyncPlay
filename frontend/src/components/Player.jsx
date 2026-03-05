import React, { useRef, useState, useEffect } from 'react';
import ReactPlayer from 'react-player';
import { Play, Pause, SkipForward, Search, Volume2, VolumeX, MonitorPlay, Music2, Repeat, Shuffle, Sparkles, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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

function Player({ isHost, isAuthorized, roomId }) {
    const { currentSong, isPlaying, currentTime, queue, loopMode, autoPlay } = useRoomStore();
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
        if (!isAuthorized) return;
        const time = playerRef.current?.getCurrentTime() || 0;
        socket.emit('play_song', { roomId, currentTime: time });
    };

    const handlePause = () => {
        if (!isAuthorized) return;
        const time = playerRef.current?.getCurrentTime() || 0;
        socket.emit('pause_song', { roomId, currentTime: time });
    };

    const handleSeek = (e) => {
        if (!isAuthorized) return;
        // Debounce seek emits in a real app, here we emit simply
        socket.emit('seek_time', { roomId, currentTime: parseFloat(e) });
    };

    const handleToggleAutoPlay = () => {
        if (!isAuthorized) return;
        socket.emit('toggle_autoplay', { roomId, autoPlay: !autoPlay });
    };

    const handleSkip = () => {
        if (!isAuthorized) return;
        socket.emit('skip_song', { roomId });
    };

    const onProgress = ({ played: p, playedSeconds }) => {
        if (!seeking) setPlayed(p);
    };

    const handleSeekMouseDown = () => setSeeking(true);
    const handleSeekChange = (e) => setPlayed(parseFloat(e.target.value));
    const handleSeekMouseUp = (e) => {
        setSeeking(false);
        if (!isAuthorized) return;
        const newTime = parseFloat(e.target.value) * duration;
        playerRef.current?.seekTo(newTime);
        socket.emit('seek_time', { roomId, currentTime: newTime });
    };

    const handleShuffle = () => {
        if (!isAuthorized || queue.length < 2) return;
        socket.emit('shuffle_queue', { roomId });
        toast('Queue shuffled 🔀', 'success');
    };

    const handleToggleLoop = () => {
        if (!isAuthorized) return;
        socket.emit('toggle_loop', { roomId, loopMode: !loopMode });
        toast(`Repeat ${!loopMode ? 'enabled 🔁' : 'disabled'}`, 'info');
    };

    const fetchLyrics = async (title) => {
        setLyricsLoading(true);
        setLyrics(null);
        setShowLyrics(true);
        try {
            const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';
            const res = await fetch(
                `${serverUrl}/api/lyrics?q=${encodeURIComponent(title)}`
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

        const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';

        // Check for playlist
        if (searchInput.includes('list=')) {
            setIsSearching(true);
            try {
                // Extract list ID. This handles full links and shortened links with list params.
                const url = new URL(searchInput);
                const listId = url.searchParams.get('list');

                if (listId) {
                    const res = await fetch(`${serverUrl}/api/playlist?listId=${encodeURIComponent(listId)}`);
                    const data = await res.json();

                    if (data.results && data.results.length > 0) {
                        data.results.forEach(video => {
                            socket.emit(isAuthorized ? 'add_to_queue' : 'request_song', {
                                roomId,
                                song: {
                                    title: video.title,
                                    url: video.url,
                                    addedBy: useRoomStore.getState().username,
                                    thumbnail: video.thumbnail,
                                    type: 'youtube'
                                }
                            });
                        });

                        if (isAuthorized) {
                            toast(`Added ${data.results.length} songs from playlist`, 'success');
                        } else {
                            toast(`Requested ${data.results.length} songs from playlist`, 'info');
                        }
                        setSearchInput('');
                        return; // Exit early
                    }
                }
            } catch (err) {
                console.error("Playlist fetch failed:", err);
                toast('Failed to load playlist.', 'error');
            } finally {
                setIsSearching(false);
            }
        }

        if (ReactPlayer.canPlay(searchInput) || searchInput.includes('soundcloud.com')) {
            // It's a valid link (YouTube, SoundCloud, etc.), just add it directly.
            // For SoundCloud tracks, ReactPlayer handles them natively but we may not have title/thumb right away
            socket.emit(isAuthorized ? 'add_to_queue' : 'request_song', {
                roomId,
                song: {
                    title: searchInput.includes('soundcloud.com') ? 'SoundCloud Track' : '(Link)',
                    url: searchInput,
                    addedBy: useRoomStore.getState().username,
                    type: searchInput.includes('soundcloud.com') ? 'soundcloud' : 'link'
                }
            });
            if (isAuthorized) {
                toast('Added to queue', 'success');
            } else {
                toast('Song requested! Waiting for host approval.', 'info');
            }
            setSearchInput('');
            setSearchResults([]);
        } else {
            // Text search
            setIsSearching(true);
            try {
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
        socket.emit(isAuthorized ? 'add_to_queue' : 'request_song', {
            roomId,
            song: {
                title: video.title,
                url: video.url,
                addedBy: useRoomStore.getState().username,
                type: 'youtube'
            }
        });
        if (isAuthorized) {
            toast('Added to queue', 'success');
        } else {
            toast('Song requested! Waiting for host approval.', 'info');
        }
        setSearchInput('');
        setSearchResults([]);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="flex flex-col items-center w-full"
        >

            {/* Search Bar / Add Song */}
            <div className="w-full max-w-2xl mb-6 sm:mb-8 relative z-30">
                <form onSubmit={handleSearchYoutube} className="flex gap-2">
                    <div className="relative flex-1 group">
                        <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-purple-400 transition-colors pointer-events-none" />
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="w-full bg-black/50 backdrop-blur-md border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all placeholder:text-zinc-500 shadow-inner text-sm sm:text-base font-medium"
                            placeholder="Search YouTube or paste a URL..."
                        />
                    </div>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.95 }}
                        type="submit"
                        disabled={isSearching}
                        className="flex-shrink-0 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-500 px-6 py-4 rounded-2xl text-sm font-bold transition-all whitespace-nowrap shadow-[0_0_20px_rgba(147,51,234,0.3)] disabled:shadow-none border border-white/10"
                    >
                        {isSearching ? <span className="animate-pulse">...</span> : 'Search'}
                    </motion.button>
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

            {/* Video / Album Art Area */}
            <motion.div
                layout
                className={`w-full max-w-3xl bg-black/40 backdrop-blur-xl rounded-3xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden relative transition-all duration-500 ease-in-out ${audioOnly || currentSong?.type === 'local' ? 'h-56 sm:h-72 flex flex-col items-center justify-center p-8' : 'aspect-video'}`}
            >
                {!currentSong ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 text-center px-4">
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-purple-500/10 to-blue-500/10 flex items-center justify-center mb-6 border border-white/5 shadow-inner">
                            <Play className="w-8 h-8 sm:w-10 sm:h-10 ml-2 text-purple-500/50" />
                        </div>
                        <p className="text-sm font-medium">No active song. Search or drop a link to start.</p>
                    </motion.div>
                ) : audioOnly || currentSong?.type === 'local' ? (
                    // Audio Only / Local Audio Mode
                    <div className="flex flex-col items-center justify-center gap-6 w-full h-full z-10">
                        <motion.div
                            animate={isPlaying ? { scale: [1, 1.05, 1], rotate: [0, 5, -5, 0] } : {}}
                            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                            className="w-24 h-24 sm:w-32 sm:h-32 rounded-3xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-[0_0_40px_rgba(147,51,234,0.4)] relative overflow-hidden group"
                        >
                            {/* Animated background glow for playing */}
                            {isPlaying && <div className="absolute inset-0 bg-white/20 animate-pulse" />}
                            {currentSong.thumbnail ? (
                                <img src={currentSong.thumbnail} alt="thumb" className="w-full h-full object-cover mix-blend-overlay opacity-50" />
                            ) : null}
                            <Music2 className="w-12 h-12 sm:w-16 sm:h-16 text-white relative z-10 drop-shadow-md" />
                        </motion.div>

                        <div className="text-center w-full max-w-md px-4">
                            <h2 className="text-zinc-100 text-lg sm:text-2xl font-black font-display truncate leading-tight drop-shadow-sm">{currentSong.title}</h2>
                            <p className="text-purple-400 font-bold tracking-widest uppercase mt-2 mb-2 text-[10px]">High Quality Audio</p>
                        </div>

                        {/* ReactPlayer hidden but still playing audio */}
                        <div className="hidden">
                            <ReactPlayer
                                ref={playerRef}
                                url={currentSong.url}
                                playing={isPlaying}
                                volume={isMuted ? 0 : volume}
                                controls={false} // NEVER show messy html5 audio controls
                                onPlay={handlePlay}
                                onPause={handlePause}
                                onEnded={handleSkip}
                                onProgress={onProgress}
                                onDuration={setDuration}
                            />
                        </div>
                    </div>
                ) : (
                    // Standard Video Player Mode
                    <ReactPlayer
                        ref={playerRef}
                        url={currentSong.url}
                        playing={isPlaying}
                        volume={isMuted ? 0 : volume}
                        controls={isAuthorized}
                        width="100%"
                        height="100%"
                        onPlay={handlePlay}
                        onPause={handlePause}
                        onEnded={handleSkip}
                        onProgress={onProgress}
                        onDuration={setDuration}
                        style={{ pointerEvents: isAuthorized ? 'auto' : 'none', position: 'absolute', top: 0, left: 0 }}
                    />
                )}
            </motion.div>

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
                        disabled={!isAuthorized}
                        className={`w-full h-1.5 rounded-full appearance-none ${isAuthorized ? 'cursor-pointer' : 'cursor-default opacity-70'}`}
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
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mt-6 sm:mt-8 glass-panel border border-white/10 p-6 sm:p-8 w-full max-w-3xl flex flex-col gap-6 shadow-[0_10px_40px_rgba(0,0,0,0.5)] rounded-3xl"
                >
                    <div className="text-center px-4">
                        <h2 className="text-lg sm:text-2xl font-black font-display truncate drop-shadow-sm">{currentSong.title}</h2>
                        <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest mt-1">Added by {currentSong.addedBy}</p>
                    </div>

                    {/* Controls Row (Shuffle, Play/Pause, Skip, Repeat) */}
                    <div className="flex justify-center items-center gap-5 sm:gap-8 my-2">
                        <motion.button
                            whileHover={isAuthorized && queue.length > 1 ? { scale: 1.1 } : {}}
                            whileTap={isAuthorized && queue.length > 1 ? { scale: 0.9 } : {}}
                            onClick={handleShuffle}
                            disabled={!isAuthorized || queue.length < 2}
                            title="Shuffle Queue"
                            className={`p-3 rounded-full flex items-center justify-center ${!isAuthorized || queue.length < 2
                                ? 'text-zinc-700 cursor-not-allowed hidden sm:flex'
                                : 'text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/10'
                                }`}
                        >
                            <Shuffle className="w-5 h-5 sm:w-6 sm:h-6" />
                        </motion.button>

                        <motion.button
                            whileHover={isAuthorized ? { scale: 1.05 } : {}}
                            whileTap={isAuthorized ? { scale: 0.95 } : {}}
                            onClick={isPlaying ? handlePause : handlePlay}
                            disabled={!isAuthorized}
                            className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center shadow-xl touch-target ${!isAuthorized ? 'bg-white/5 text-zinc-600 cursor-not-allowed border border-white/5' : 'bg-gradient-to-tr from-purple-500 to-blue-500 text-white border border-white/20 shadow-[0_0_30px_rgba(168,85,247,0.4)]'
                                }`}
                        >
                            {isPlaying ? <Pause className="w-8 h-8 sm:w-10 sm:h-10" /> : <Play className="w-8 h-8 sm:w-10 sm:h-10 ml-2" />}
                        </motion.button>

                        <motion.button
                            whileHover={isAuthorized ? { scale: 1.1 } : {}}
                            whileTap={isAuthorized ? { scale: 0.9 } : {}}
                            onClick={handleSkip}
                            disabled={!isAuthorized}
                            title="Skip / Next"
                            className={`p-4 rounded-full flex items-center justify-center touch-target ${!isAuthorized ? 'text-zinc-600 cursor-not-allowed' : 'text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/10'
                                }`}
                        >
                            <SkipForward className="w-6 h-6 sm:w-8 sm:h-8" />
                        </motion.button>

                        <motion.button
                            whileHover={isAuthorized ? { scale: 1.1 } : {}}
                            whileTap={isAuthorized ? { scale: 0.9 } : {}}
                            onClick={handleToggleLoop}
                            disabled={!isAuthorized}
                            title={loopMode ? "Repeat is On" : "Repeat is Off"}
                            className={`p-3 rounded-full flex items-center justify-center ${!isAuthorized
                                ? 'text-zinc-700 cursor-not-allowed hidden sm:flex'
                                : loopMode
                                    ? 'text-purple-400 bg-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.3)] border border-purple-500/30'
                                    : 'text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/10'
                                }`}
                        >
                            <Repeat className="w-5 h-5 sm:w-6 sm:h-6" />
                        </motion.button>

                        <motion.button
                            whileHover={isAuthorized ? { scale: 1.1 } : {}}
                            whileTap={isAuthorized ? { scale: 0.9 } : {}}
                            onClick={handleToggleAutoPlay}
                            disabled={!isAuthorized}
                            title={autoPlay ? "Auto-Play (AI DJ) is On" : "Auto-Play (AI DJ) is Off"}
                            className={`p-3 rounded-full flex items-center justify-center ${!isAuthorized
                                ? 'text-zinc-700 cursor-not-allowed hidden sm:flex'
                                : autoPlay
                                    ? 'text-yellow-400 bg-yellow-500/20 shadow-[0_0_15px_rgba(234,179,8,0.3)] border border-yellow-500/30'
                                    : 'text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/10'
                                }`}
                        >
                            <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
                        </motion.button>
                    </div>

                    {/* Audio/Video Toggle + Lyrics Button */}
                    {currentSong && (
                        <div className="flex justify-center gap-3 flex-wrap mt-2">
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setAudioOnly(a => !a)}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all bg-white/5 border border-white/10 hover:bg-white/10 text-zinc-300 hover:text-white uppercase tracking-widest shadow-inner"
                            >
                                {audioOnly
                                    ? <><MonitorPlay className="w-4 h-4 text-blue-400" /> Switch to Video</>
                                    : <><Music2 className="w-4 h-4 text-purple-400" /> Audio Only</>}
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => showLyrics ? setShowLyrics(false) : fetchLyrics(currentSong.title)}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all uppercase tracking-widest shadow-inner ${showLyrics
                                    ? 'border-purple-500 text-white bg-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                                    : 'bg-white/5 border border-white/10 hover:bg-white/10 text-zinc-300 hover:text-white'
                                    }`}
                            >
                                🎤 {showLyrics ? 'Hide Lyrics' : 'Show Lyrics'}
                            </motion.button>
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
                </motion.div>
            )}

            {/* ── Lyrics Panel ── */}
            <AnimatePresence>
                {currentSong && showLyrics && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="w-full max-w-2xl mt-4 glass-panel border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
                    >
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/20">
                            <span className="text-xs font-bold text-zinc-300 uppercase tracking-widest flex items-center gap-2"><Music2 className="w-4 h-4 text-purple-400" /> Lyrics</span>
                            <button onClick={() => setShowLyrics(false)} className="text-zinc-500 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg border border-white/5 transition-colors">
                                <span className="text-xs font-bold uppercase">Close</span>
                            </button>
                        </div>
                        <div className="p-6 max-h-96 overflow-y-auto">
                            {lyricsLoading ? (
                                <div className="flex flex-col items-center justify-center py-10 gap-4">
                                    <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin"></div>
                                    <p className="text-purple-400 text-xs font-bold uppercase tracking-widest animate-pulse">Fetching lyrics...</p>
                                </div>
                            ) : lyrics ? (
                                <pre className="text-zinc-300 text-sm md:text-base whitespace-pre-wrap font-sans leading-relaxed text-center font-medium">{lyrics}</pre>
                            ) : (
                                <div className="text-center text-zinc-500 text-sm py-10 flex flex-col items-center gap-2">
                                    <AlertCircle className="w-8 h-8 text-zinc-600 mb-2" />
                                    <p className="font-bold text-zinc-400">Lyrics not found for this track.</p>
                                    <p className="text-xs mt-1 text-zinc-500">Ensure the song title format is clear (Artist - Title).</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Host Notice */}
            {!isAuthorized && currentSong && (
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-[10px] font-bold tracking-widest uppercase text-yellow-500/80 mt-6 bg-yellow-500/10 px-4 py-2 rounded-full border border-yellow-500/20 shadow-inner"
                >
                    Host or Co-Hosts control playback
                </motion.p>
            )}
        </motion.div>
    );
}

export default Player;
