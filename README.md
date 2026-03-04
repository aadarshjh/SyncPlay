# SyncPlay 🎵

A real-time collaborative music streaming web application, similar to Spotify Jam.
Listen together with friends, manage a shared queue via YouTube, or upload your own local MP3 files!

## System Architecture

- **Frontend**: React (Vite), TailwindCSS, Zustand (State), React Router.
- **Backend**: Node.js, Express, Socket.IO.
- **Database & Storage**: Supabase (Free Tier - no credit card required).
- **Video/Audio Parsing**: React-Player (supporting YouTube streams & standard HTML5 audio).

This architecture keeps state transient in the Socket.IO memory (great for low latency control) and uses Supabase purely for binary file storage when uploading local MP3s.

## Project Structure
- `/backend`: The Node.js Express server. Responsible for maintaining active rooms and forwarding WebSockets.
- `/frontend`: The React UI.

## Getting Started

### 1. Supabase Setup (Required for MP3 Uploads)
1. Go to [Supabase](https://supabase.com) and create a free project.
2. Go to **Storage**, and create a new public bucket called `music`.
3. Go to **Project Settings -> API** and copy your `Project URL` and `anon public key`.
4. In the `frontend` directory, create a `.env` file:
   ```env
   VITE_SUPABASE_URL=your_project_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   VITE_SERVER_URL=http://localhost:4000
   ```
*(Note: If you only want to use YouTube links, you can test it locally without Supabase setup.)*

### 2. Running Locally

Open two terminal windows.

**Terminal 1 (Backend):**
```bash
cd backend
npm install
npm run dev
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser. Create a room as the Host. Open another incognito window to join the room and see real-time interaction!

---

## Technical Features Implemented
1. **Room System**: Auto-generates 6-character room codes. Tracks Host vs. Listener privileges.
2. **Real-Time Sync**: Seek, Play, Pause, and new Queue items are instantly emitted to all clients via Socket.IO.
3. **Dual Media Source**: Play YouTube links or local MP3 files seamlessly via `react-player`.
4. **Zustand State**: Clean, boilerplate-free state management in React.
5. **Aesthetics**: Premium Glassmorphism UI using Tailwind CSS utilities.

---

## 🚀 Advanced Features for Future Versions

1. **Voting System for Songs**: Implement a `socket.emit('upvote_song')` mechanism. Backend sorts the array (`rooms[roomId].queue.sort()`) based on votes and broadcasts the `queue_updated` event.
2. **AI Playlist Recommendations**: Integrate Spotify API or gemini-pro to suggest 5 songs dynamically based on the current vibe/genres in the queue.
3. **Voice Chat**: Integrate WebRTC directly into the Room, sharing audio tracks between connected socket peers using SimplePeer.
4. **Mobile App Version**: Wrap the frontend in React Native or Capacitor, switching the drag-and-drop web UI for mobile touch surfaces.
5. **Collaborative Playlist Editing**: Save queues persistently to a Supabase Postgres database so users can revisit a specific room URL days later.
