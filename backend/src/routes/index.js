import express from 'express';
import ytSearch from 'yt-search';
import { supabase } from '../lib/supabase.js';

const router = express.Router();

router.get('/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) {
            return res.status(400).json({ error: 'Search query is required' });
        }

        // ytSearch searches youtube without needing an API key
        const r = await ytSearch(query);

        // Take top 5 results
        const videos = r.videos.slice(0, 5).map(v => ({
            title: v.title,
            url: v.url,
            duration: v.timestamp,
            author: v.author.name,
            thumbnail: v.thumbnail
        }));

        res.json({ results: videos });
    } catch (error) {
        console.error("Search Error:", error);
        res.status(500).json({ error: 'Failed to search YouTube' });
    }
});

// Proxy lyrics.ovh to avoid CORS issues from the browser
router.get('/lyrics', async (req, res) => {
    try {
        const { artist, title } = req.query;
        if (!artist || !title) return res.status(400).json({ error: 'artist and title are required' });

        const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.lyrics) {
            res.json({ lyrics: data.lyrics });
        } else {
            res.json({ lyrics: null });
        }
    } catch (error) {
        console.error('Lyrics Error:', error);
        res.json({ lyrics: null });
    }
});

router.get('/playlist', async (req, res) => {
    try {
        const { listId } = req.query;
        if (!listId) {
            return res.status(400).json({ error: 'listId is required' });
        }

        const playlist = await ytSearch({ listId });

        if (!playlist || !playlist.videos) {
            return res.status(404).json({ error: 'Playlist not found or empty' });
        }

        const videos = playlist.videos.map(v => ({
            title: v.title,
            url: `https://youtube.com/watch?v=${v.videoId}`,
            author: v.author.name,
            thumbnail: v.thumbnail
        }));

        res.json({ results: videos });
    } catch (error) {
        console.error("Playlist Error:", error);
        res.status(500).json({ error: 'Failed to fetch playlist' });
    }
});

// Fetch active rooms for the public lobby
router.get('/rooms', async (req, res) => {
    try {
        const { data: rooms, error } = await supabase
            .from('rooms')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(50); // Get latest 50 active rooms

        if (error) throw error;

        // Process and filter rooms to only send necessary public info
        const activeRooms = rooms
            .filter(r => r.state_json && r.state_json.users && r.state_json.users.length > 0) // Only rooms with people in them
            .map(r => ({
                id: r.id,
                host_id: r.host_id,
                user_count: r.state_json.users.length,
                current_song: r.state_json.currentSong ? {
                    title: r.state_json.currentSong.title,
                    thumbnail: r.state_json.currentSong.thumbnail,
                    artist: r.state_json.currentSong.author || 'Unknown Artist'
                } : null,
                users: r.state_json.users.slice(0, 3).map(u => ({ username: u.username })) // Preview up to 3 users
            }));

        res.json({ rooms: activeRooms });
    } catch (err) {
        console.error("Failed to fetch public rooms:", err);
        res.status(500).json({ error: 'Failed to fetch public rooms' });
    }
});

export default router;
