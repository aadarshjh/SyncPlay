import React, { useRef, useState } from 'react';
import { useRoomStore } from '../store/useRoomStore';
import { Music, Upload, Loader2, X, Check } from 'lucide-react';
import { socket } from '../lib/socket';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/Toast';

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
        <div className="flex flex-col h-full bg-zinc-950">
            <div className="p-4 border-b border-zinc-800 bg-zinc-900/30">
                <h3 className="font-semibold text-sm flex items-center gap-2 text-purple-400">
                    <Music className="w-4 h-4" /> Now Playing
                </h3>
                {currentSong ? (
                    <div className="mt-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-3 shadow-inner">
                        <p className="font-medium text-sm text-white truncate">{currentSong.title}</p>
                        <p className="text-xs text-zinc-400 mt-1">Added by {currentSong.addedBy}</p>
                    </div>
                ) : (
                    <p className="text-zinc-500 text-xs mt-2 italic">Nothing playing right now</p>
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
                        <h3 className="font-semibold text-sm text-zinc-300">Up Next</h3>
                        <span className="text-xs font-mono bg-zinc-800 px-2 py-0.5 rounded text-zinc-400">{queue.length}</span>
                    </div>

                    {queue.length === 0 ? (
                        <div className="text-center text-zinc-500 text-sm border border-dashed border-zinc-800 p-8 rounded-xl">
                            Queue is empty. <br /> Use the search bar in the player to add YouTube links.
                        </div>
                    ) : (
                        <ul className="space-y-2">
                            {queue.map((song, idx) => (
                                <li key={song.id} className="bg-zinc-900 border border-zinc-800/80 rounded-xl p-3 flex items-center justify-between group hover:border-zinc-700 transition-colors">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="text-xs text-zinc-600 font-mono w-4">{idx + 1}</div>
                                        <div className="truncate">
                                            <p className="text-sm font-medium text-zinc-200 truncate">{song.title}</p>
                                            <p className="text-xs text-zinc-500 truncate">Added by {song.addedBy}</p>
                                        </div>
                                    </div>
                                    {/* Authorized users or song-owner remove button */}
                                    {(isAuthorized || song.addedBy === username) && (
                                        <button
                                            onClick={() => handleRemoveFromQueue(song.id)}
                                            title="Remove from queue"
                                            className="ml-2 flex-shrink-0 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-1 rounded-lg hover:bg-red-500/10"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </li>
                            ))}
                        </ul>
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

            <div className="p-4 border-t border-zinc-800 bg-zinc-900/30">
                <input
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="w-full border border-dashed border-zinc-600 text-zinc-400 hover:text-white hover:border-zinc-400 transition-all rounded-xl py-3 text-sm flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isUploading ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
                    ) : (
                        <><Upload className="w-4 h-4 group-hover:-translate-y-1 transition-transform" /> Upload Local MP3</>
                    )}
                </button>
            </div>
        </div>
    );
}

export default Queue;
