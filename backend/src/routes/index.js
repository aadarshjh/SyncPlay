import express from 'express';
import ytSearch from 'yt-search';

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

export default router;
