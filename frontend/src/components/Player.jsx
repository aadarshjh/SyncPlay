import React, { useRef, useState, useEffect } from 'react';
import ReactPlayer from 'react-player';
import { Play, Pause, SkipForward, Search, Volume2, VolumeX, MonitorPlay, Music2, Repeat, Shuffle, Sparkles } from 'lucide-react';
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
                            placeholder="Search YouTube or paste a URL (YouTube / SoundCloud)..."
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isSearching}
                        className="flex-shrink-0 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-900 disabled:text-zinc-500 px-5 py-3 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap"
                    >
                        {isSearching ? '...' : 'Search'}
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

            {/* Video / Album Art Area */}
            <div className={`w-full max-w-3xl bg-zinc-900 rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden relative transition-all duration-500 ease-in-out ${audioOnly || currentSong?.type === 'local' ? 'h-48 sm:h-64 flex flex-col items-center justify-center p-6' : 'aspect-video'}`}>
                {!currentSong ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 text-center px-4">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-zinc-800/50 flex items-center justify-center mb-4 border border-zinc-700">
                            <Play className="w-7 h-7 sm:w-8 sm:h-8 ml-1" />
                        </div>
                        <p className="text-sm">No active song. Search YouTube or upload audio to start listening.</p>
                    </div>
                ) : audioOnly || currentSong?.type === 'local' ? (
                    // Audio Only / Local Audio Mode
                    <div className="flex flex-col items-center justify-center gap-4 w-full h-full z-10">
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-2xl relative overflow-hidden group">
                            {/* Animated background glow for playing */}
                            {isPlaying && <div className="absolute inset-0 bg-white/20 animate-pulse" />}
                            <Music2 className="w-10 h-10 sm:w-12 sm:h-12 text-white relative z-10" />
                        </div>

                        <div className="text-center w-full max-w-md px-4">
                            <h2 className="text-zinc-200 text-base sm:text-lg font-bold truncate leading-tight">{currentSong.title}</h2>
                            <p className="text-zinc-500 text-xs sm:text-sm mt-1 mb-2">Streaming High Quality Audio</p>
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
                <div className="mt-4 sm:mt-6 glass-panel p-4 sm:p-6 w-full max-w-2xl flex flex-col gap-4">
                    <div className="text-center">
                        <h2 className="text-base sm:text-xl font-bold truncate">{currentSong.title}</h2>
                        <p className="text-zinc-400 text-xs sm:text-sm">Added by {currentSong.addedBy}</p>
                    </div>

                    {/* Controls Row (Shuffle, Play/Pause, Skip, Repeat) */}
                    <div className="flex justify-center items-center gap-4 sm:gap-6">
                        <button
                            onClick={handleShuffle}
                            disabled={!isAuthorized || queue.length < 2}
                            title="Shuffle Queue"
                            className={`p-3 rounded-full flex items-center justify-center transition-all ${!isAuthorized || queue.length < 2
                                ? 'text-zinc-700 cursor-not-allowed hidden sm:flex'
                                : 'text-zinc-400 hover:text-white hover:bg-zinc-800 active:scale-95'
                                }`}
                        >
                            <Shuffle className="w-5 h-5 sm:w-6 sm:h-6" />
                        </button>

                        <button
                            onClick={isPlaying ? handlePause : handlePlay}
                            disabled={!isAuthorized}
                            className={`w-16 h-16 sm:w-14 sm:h-14 rounded-full flex items-center justify-center shadow-lg transition-all touch-target ${!isAuthorized ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' : 'bg-gradient-to-tr from-purple-500 to-blue-500 active:scale-95 hover:scale-105 text-white'
                                }`}
                        >
                            {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-1" />}
                        </button>

                        <button
                            onClick={handleSkip}
                            disabled={!isAuthorized}
                            title="Skip / Next"
                            className={`p-4 rounded-full flex items-center justify-center transition-all touch-target ${!isAuthorized ? 'text-zinc-600 cursor-not-allowed' : 'text-zinc-400 hover:text-white hover:bg-zinc-800 active:scale-95'
                                }`}
                        >
                            <SkipForward className="w-6 h-6 sm:w-7 sm:h-7" />
                        </button>

                        <button
                            onClick={handleToggleLoop}
                            disabled={!isAuthorized}
                            title={loopMode ? "Repeat is On" : "Repeat is Off"}
                            className={`p-3 rounded-full flex items-center justify-center transition-all ${!isAuthorized
                                ? 'text-zinc-700 cursor-not-allowed hidden sm:flex'
                                : loopMode
                                    ? 'text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 active:scale-95'
                                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800 active:scale-95'
                                }`}
                        >
                            <Repeat className="w-5 h-5 sm:w-6 sm:h-6" />
                        </button>

                        <button
                            onClick={handleToggleAutoPlay}
                            disabled={!isAuthorized}
                            title={autoPlay ? "Auto-Play (AI DJ) is On" : "Auto-Play (AI DJ) is Off"}
                            className={`p-3 rounded-full flex items-center justify-center transition-all ${!isAuthorized
                                ? 'text-zinc-700 cursor-not-allowed hidden sm:flex'
                                : autoPlay
                                    ? 'text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20 active:scale-95'
                                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800 active:scale-95'
                                }`}
                        >
                            <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
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
            {!isAuthorized && currentSong && (
                <p className="text-xs text-zinc-500 mt-4 bg-zinc-900/50 px-3 py-1.5 rounded-full border border-zinc-800">
                    Host or Co-Hosts control playback
                </p>
            )}
        </div>
    );
}

export default Player;
