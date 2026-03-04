import React, { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
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
        <div className="flex flex-col h-full">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-zinc-500 text-sm italic">
                        No messages yet. Say hello!
                    </div>
                ) : (
                    messages.map((msg, i) => {
                        const isMe = msg.username === username;
                        return (
                            <div key={i} className={`flex max-w-[85%] gap-2 ${isMe ? 'self-end ml-auto flex-row-reverse' : 'self-start mr-auto flex-row'}`}>
                                <img
                                    src={`https://api.dicebear.com/7.x/initials/svg?seed=${msg.username}&backgroundColor=5b21b6,4c1d95,7c3aed`}
                                    alt={msg.username}
                                    className="w-8 h-8 rounded-full shadow-sm mt-4 flex-shrink-0"
                                />
                                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                    <span className="text-xs text-zinc-500 mb-1 mx-1">{msg.username}</span>
                                    <div
                                        className={`px-4 py-2 rounded-2xl text-sm shadow-sm ${isMe
                                            ? 'bg-purple-600 text-white rounded-tr-none'
                                            : 'bg-zinc-800 text-zinc-200 border border-zinc-700/50 rounded-tl-none'
                                            }`}
                                    >
                                        {msg.text}
                                    </div>
                                </div>
                            </div>
                        )
                    })
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
            <div className="p-4 border-t border-zinc-800 bg-zinc-950">
                <form onSubmit={sendMessage} className="relative flex items-center">
                    <input
                        type="text"
                        value={inputMsg}
                        onChange={handleInputChange}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-full pl-4 pr-12 py-3 text-sm text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all placeholder:text-zinc-600"
                        placeholder="Type a message..."
                    />
                    <button
                        type="submit"
                        className="absolute right-2 text-purple-500 hover:text-purple-400 p-2 rounded-full hover:bg-purple-500/10 transition-colors"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </form>
            </div>
        </div>
    );
}

export default Chat;
