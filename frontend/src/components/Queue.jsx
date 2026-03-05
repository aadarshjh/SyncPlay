import React, { useRef, useState } from 'react';
import { useRoomStore } from '../store/useRoomStore';
import { Music, Upload, Loader2, X, Check } from 'lucide-react';
import { socket } from '../lib/socket';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/Toast';
import { motion, AnimatePresence } from 'framer-motion';

function Queue({ isAuthorized, isHost, roomId }) {
    const { queue, history, pendingRequests, currentSong, username } = useRoomStore();
    const fileInputRef = useRef(null);
    const [isUploading, setIsUploading] = useState(false);
    const toast = useToast();

    const handleRemoveFromQueue = (songId) => {
        socket.emit('remove_from_queue', { roomId, songId });
    };

    const handleApproveRequest = (songId) => {
        socket.emit('approve_request', { roomId, songId });
        toast('Request approved', 'success');
    };

    const handleRejectRequest = (songId) => {
        socket.emit('reject_request', { roomId, songId });
        toast('Request rejected', 'info');
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('audio/')) {
            toast('Please upload an audio file (.mp3, .wav, etc)', 'error');
            return;
        }

        try {
            setIsUploading(true);
            // Clean filename to prevent weird spaces/characters in URL
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
            const filePath = `room-${roomId}/${fileName}`;

            // 1. Upload to Supabase 'music' bucket
            const { error: uploadError, data } = await supabase.storage
                .from('music')
                .upload(filePath, file);

            if (uploadError) {
                console.error("Full Supabase Error:", uploadError);
                throw new Error(`Upload failed: ${uploadError.message || 'Unknown Supabase error'}`);
            }

            // 2. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('music')
                .getPublicUrl(filePath);

            // 3. Emit to socket as a new song
            socket.emit('add_to_queue', {
                roomId,
                song: {
                    title: file.name,
                    url: publicUrl,
                    addedBy: username,
                    type: 'local'
                }
            });

        } catch (err) {
            toast(err.message || 'Failed to upload file', 'error');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="flex flex-col h-full bg-transparent">
            {/* ── Now Playing Mini Banner ── */}
            <div className="p-4 border-b border-white/10 bg-black/20 backdrop-blur-md">
                <h3 className="font-black text-[10px] uppercase tracking-widest flex items-center gap-2 text-purple-400 mb-2">
                    <Music className="w-3.5 h-3.5" /> Now Playing
                </h3>
                {currentSong ? (
                    <motion.div
                        key={currentSong.id || currentSong.title}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white/5 border border-white/10 rounded-xl p-3 shadow-inner flex flex-col justify-center"
                    >
                        <p className="font-bold text-sm text-zinc-100 truncate">{currentSong.title}</p>
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Added by <span className="text-zinc-300">{currentSong.addedBy}</span></p>
                    </motion.div>
                ) : (
                    <p className="text-zinc-600 text-xs font-medium italic">Nothing playing right now</p>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">

                {/* ── Pending Requests (Host / Co-Host Only) ── */}
                {isAuthorized && pendingRequests.length > 0 && (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-sm text-yellow-400">Pending Requests</h3>
                            <span className="text-xs font-mono bg-yellow-500/20 px-2 py-0.5 rounded text-yellow-300">{pendingRequests.length}</span>
                        </div>
                        <ul className="space-y-2">
                            {pendingRequests.map((song) => (
                                <li key={song.id} className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-3 flex items-center justify-between">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="truncate">
                                            <p className="text-sm font-medium text-zinc-200 truncate">{song.title}</p>
                                            <p className="text-xs text-yellow-500/80 truncate">Requested by {song.addedBy}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                                        <button
                                            onClick={() => handleApproveRequest(song.id)}
                                            title="Approve request"
                                            className="p-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                                        >
                                            <Check className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleRejectRequest(song.id)}
                                            title="Reject request"
                                            className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* ── Active Queue ── */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-black text-xs uppercase tracking-widest text-zinc-300">Up Next</h3>
                        <span className="text-[10px] font-bold bg-white/10 px-2 py-0.5 rounded-full text-zinc-300 shadow-inner">{queue.length}</span>
                    </div>

                    {queue.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className="text-center text-zinc-500 text-xs font-medium border border-dashed border-white/10 bg-white/5 p-8 rounded-2xl shadow-inner"
                        >
                            Queue is empty. <br /> Use the search bar to add tracks.
                        </motion.div>
                    ) : (
                        <AnimatePresence mode='popLayout'>
                            <ul className="space-y-2">
                                {queue.map((song, idx) => (
                                    <motion.li
                                        layout
                                        initial={{ opacity: 0, scale: 0.95, x: -20 }}
                                        animate={{ opacity: 1, scale: 1, x: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, x: 20 }}
                                        transition={{ duration: 0.2 }}
                                        key={song.id}
                                        className="bg-black/40 backdrop-blur-md border border-white/10 rounded-xl p-3 flex items-center justify-between group hover:border-purple-500/50 transition-colors shadow-lg"
                                    >
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="text-[10px] text-zinc-600 font-bold w-4">{idx + 1}</div>
                                            <div className="truncate">
                                                <p className="text-sm font-bold text-zinc-200 truncate">{song.title}</p>
                                                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 truncate mt-0.5">Added by {song.addedBy}</p>
                                            </div>
                                        </div>
                                        {/* Authorized users or song-owner remove button */}
                                        {(isAuthorized || song.addedBy === username) && (
                                            <button
                                                onClick={() => handleRemoveFromQueue(song.id)}
                                                title="Remove from queue"
                                                className="ml-2 flex-shrink-0 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-1.5 rounded-lg hover:bg-red-500/20"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                    </motion.li>
                                ))}
                            </ul>
                        </AnimatePresence>
                    )}
                </div>

                {/* ── History ── */}
                {history.length > 0 && (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-sm text-zinc-400">Recently Played</h3>
                            <span className="text-xs font-mono bg-zinc-800/50 px-2 py-0.5 rounded text-zinc-500">{history.length}</span>
                        </div>
                        <ul className="space-y-2 opacity-75">
                            {history.map((song, idx) => (
                                <li key={`${song.id}-${idx}`} className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-2.5 flex items-center justify-between group hover:bg-zinc-900 transition-colors">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="truncate">
                                            <p className="text-xs font-medium text-zinc-400 truncate line-through decoration-zinc-600">{song.title}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            socket.emit('add_to_queue', { roomId, song: { ...song, addedBy: username } });
                                            toast('Re-added to queue', 'success');
                                        }}
                                        title="Re-add to queue"
                                        className="text-[10px] font-semibold text-purple-400 bg-purple-500/10 px-2 py-1 rounded opacity-0 flex-shrink-0 group-hover:opacity-100 transition-opacity hover:bg-purple-500/20"
                                    >
                                        + Re-Add
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            <div className="p-4 border-t border-white/10 bg-black/20 backdrop-blur-md">
                <input
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                />
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="w-full border border-dashed border-white/20 bg-white/5 text-zinc-400 hover:text-white hover:border-white/40 hover:bg-white/10 transition-all rounded-xl py-3.5 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed shadow-inner"
                >
                    {isUploading ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
                    ) : (
                        <><Upload className="w-4 h-4 group-hover:-translate-y-1 transition-transform text-purple-400" /> Upload Local MP3</>
                    )}
                </motion.button>
            </div>
        </div>
    );
}

export default Queue;
