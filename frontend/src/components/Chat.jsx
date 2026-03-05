import React, { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { socket } from '../lib/socket';
import { useRoomStore } from '../store/useRoomStore';

function Chat({ roomId }) {
    const { messages, username, typingUsers, setTypingUsers } = useRoomStore();
    const [inputMsg, setInputMsg] = useState('');
    const messagesEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    // Auto scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Listen to new messages and typing events
    useEffect(() => {
        const handleReceive = (msg) => {
            useRoomStore.getState().addMessage(msg);
        };
        const handleTyping = ({ username: typingUsername, isTyping }) => {
            if (isTyping) {
                setTypingUsers([...new Set([...useRoomStore.getState().typingUsers, typingUsername])]);
            } else {
                setTypingUsers(useRoomStore.getState().typingUsers.filter(u => u !== typingUsername));
            }
        };

        socket.on('receive_message', handleReceive);
        socket.on('user_typing', handleTyping);

        return () => {
            socket.off('receive_message', handleReceive);
            socket.off('user_typing', handleTyping);
        }
    }, [setTypingUsers]);

    const handleInputChange = (e) => {
        setInputMsg(e.target.value);

        socket.emit('typing_start', { roomId, username });

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

        typingTimeoutRef.current = setTimeout(() => {
            socket.emit('typing_end', { roomId, username });
        }, 1500);
    };

    const sendMessage = (e) => {
        e.preventDefault();
        if (!inputMsg.trim()) return;

        socket.emit('send_message', { roomId, message: inputMsg, username });
        socket.emit('typing_end', { roomId, username });
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        setInputMsg('');
    };

    return (
        <div className="flex flex-col h-full bg-transparent">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-sm font-medium italic opacity-70">
                        No messages yet. Say hello!
                    </div>
                ) : (
                    <AnimatePresence initial={false}>
                        {messages.map((msg, i) => {
                            const isMe = msg.username === username;
                            return (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    className={`flex max-w-[85%] gap-2 ${isMe ? 'self-end ml-auto flex-row-reverse' : 'self-start mr-auto flex-row'}`}
                                >
                                    <img
                                        src={`https://api.dicebear.com/7.x/initials/svg?seed=${msg.username}&backgroundColor=5b21b6,4c1d95,7c3aed`}
                                        alt={msg.username}
                                        className="w-8 h-8 rounded-full shadow-sm mt-4 flex-shrink-0 border border-white/10"
                                    />
                                    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                        <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1 mx-1">{msg.username}</span>
                                        <div
                                            className={`px-4 py-2.5 rounded-2xl text-sm shadow-md ${isMe
                                                ? 'bg-gradient-to-tr from-purple-600 to-blue-600 text-white rounded-tr-none border border-white/20'
                                                : 'bg-black/40 backdrop-blur-md text-zinc-200 border border-white/10 rounded-tl-none'
                                                }`}
                                        >
                                            {msg.text}
                                        </div>
                                    </div>
                                </motion.div>
                            )
                        })}
                    </AnimatePresence>
                )}

                {/* Typing Indicator */}
                {typingUsers.length > 0 && (
                    <div className="flex items-center gap-2 text-zinc-500 text-xs italic mt-2 ml-2 animate-pulse">
                        <div className="flex gap-1">
                            <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        {typingUsers.length === 1
                            ? `${typingUsers[0]} is typing...`
                            : `${typingUsers.join(', ')} are typing...`}
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-white/10 bg-black/20 backdrop-blur-md">
                <form onSubmit={sendMessage} className="relative flex items-center group">
                    <input
                        type="text"
                        value={inputMsg}
                        onChange={handleInputChange}
                        className="w-full bg-black/50 backdrop-blur-sm border border-white/10 rounded-full pl-5 pr-12 py-3.5 text-sm text-white focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all placeholder:text-zinc-500 shadow-inner"
                        placeholder="Type a message..."
                    />
                    <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        type="submit"
                        className="absolute right-2 text-purple-400 hover:text-white p-2 rounded-full hover:bg-purple-500/20 transition-colors"
                    >
                        <Send className="w-5 h-5" />
                    </motion.button>
                </form>
            </div>
        </div>
    );
}

export default Chat;
