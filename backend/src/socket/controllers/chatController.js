export default function chatController(socket, io, rooms) {
    socket.on('send_message', ({ roomId, message, username }) => {
        try {
            const chatMsg = {
                id: Date.now().toString(),
                username,
                text: message,
                timestamp: new Date()
            };
            io.to(roomId).emit('receive_message', chatMsg);
        } catch (error) {
            console.error('[Chat Error]', error);
            socket.emit('error', { message: 'Failed to send message' });
        }
    });

    socket.on('typing_start', ({ roomId, username }) => {
        try {
            socket.to(roomId).emit('user_typing', { username, isTyping: true });
        } catch (error) {
            console.error('[Typing Error]', error);
        }
    });

    socket.on('typing_end', ({ roomId, username }) => {
        try {
            socket.to(roomId).emit('user_typing', { username, isTyping: false });
        } catch (error) {
            console.error('[Typing Error]', error);
        }
    });
}
