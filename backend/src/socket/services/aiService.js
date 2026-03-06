import { GoogleGenAI } from '@google/genai';
import ytSearch from 'yt-search';

const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

export const generateNextSong = async (roomId, room, io) => {
    const prevSong = room.history[0]; // the song that just finished
    if (!prevSong) return;

    if (!ai) {
        console.error("Auto-Play Failed: GEMINI_API_KEY is not set.");
        io.to(roomId).emit('receive_message', {
            id: Date.now().toString(),
            username: 'System',
            text: `❌ AI DJ Error: Gemini API key is missing.`,
            timestamp: new Date()
        });
        return;
    }

    try {
        const recentHistory = room.history.slice(0, 15).map(s => `${s.title} by ${s.author || 'Unknown'}`);

        const prompt = `
        You are an expert, world-class DJ for a collaborative music listening app.
        The users in this room just finished listening to the following songs:
        ${recentHistory.join('\n')}
        
        The last song played was: ${prevSong.title} by ${prevSong.author || 'Unknown'}
        
        Based on these vibes, suggest exactly 3 highly relevant songs that they should listen to next.
        - DO NOT suggest any of the songs listed in the history above.
        - Ensure the genre and energy level transitions smoothly from the last played song.
        - Avoid overly generic top-40 unless it perfectly fits the niche.
        
        Return the result as a JSON array of objects, where each object has "title" and "artist" string properties.
        Focus purely on the data.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });

        let suggestions = [];
        try {
            suggestions = JSON.parse(response.text.trim());
        } catch (e) {
            console.error("Failed to parse Gemini JSON:", e, response.text);
            return;
        }

        console.log(`[Room ${roomId}] AI DJ suggests:`, suggestions);

        let nextVideo = null;
        const historyTitles = room.history.map(h => h.title.toLowerCase());
        const historyUrls = room.history.map(h => h.url);

        for (const suggestion of suggestions) {
            if (nextVideo) break;

            const query = `${suggestion.title} ${suggestion.artist}`;
            const r = await ytSearch(query);

            if (r && r.videos && r.videos.length > 0) {
                for (const v of r.videos.slice(0, 5)) {
                    const vTitleLow = v.title.toLowerCase();

                    if (historyUrls.includes(v.url)) continue;
                    if (vTitleLow.includes('karaoke') || vTitleLow.includes('cover') || vTitleLow.includes('live at')) continue;

                    const isDuplicateInfo = historyTitles.some(ht =>
                        (ht.includes(suggestion.title.toLowerCase()) && ht.includes(suggestion.artist.toLowerCase()))
                    );
                    if (isDuplicateInfo) continue;

                    nextVideo = v;
                    break;
                }
            }
        }

        if (nextVideo && room.queue.length === 0 && !room.currentSong) {
            room.currentSong = {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                title: nextVideo.title,
                url: nextVideo.url,
                addedBy: 'Gemini AI ✨',
                thumbnail: nextVideo.thumbnail,
                type: 'youtube',
                author: nextVideo.author?.name
            };
            room.isPlaying = true;
            room.currentTime = 0;
            io.to(roomId).emit('room_state', room);

            io.to(roomId).emit('receive_message', {
                id: Date.now().toString(),
                username: 'System',
                text: `✨ AI DJ Queued: ${nextVideo.title}`,
                timestamp: new Date()
            });
        }
    } catch (err) {
        console.error("[AI DJ Error]:", err?.message || err);

        let errorMessage = "❌ AI DJ failed to generate the next song.";
        if (err?.status === 429) {
            errorMessage = "⚠️ AI DJ is currently unavailable (API Quota Exceeded for this region). Turning off Auto-Play.";
            room.autoPlay = false;
            io.to(roomId).emit('room_state', room);
        }

        io.to(roomId).emit('receive_message', {
            id: Date.now().toString(),
            username: 'System',
            text: errorMessage,
            timestamp: new Date()
        });
    }
};
