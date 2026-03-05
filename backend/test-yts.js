import ytSearch from 'yt-search';

async function test() {
    try {
        const videoId = 'dQw4w9WgXcQ';
        const video = await ytSearch({ videoId });
        console.log("Video title:", video.title);
        console.log("Video genre:", video.genre);

        if (video.genre) {
             const r = await ytSearch(`${video.genre} mix`);
             console.log(`\n== Results for [${video.genre} mix] ==`);
             r.videos.slice(0, 5).forEach(v => console.log(v.title));
        }
    } catch(e) {
        console.error(e);
    }
}
test();
