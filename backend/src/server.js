import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import handleSockets from './socket/index.js';
import apiRoutes from './routes/index.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = http.createServer(app);

// Use CORS
app.use(cors({ origin: '*' }));
app.use(express.json());

// Routes
app.use('/api', apiRoutes);

// Initialize Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Pass the 'io' instance to our socket handler function
handleSockets(io);

// Basic health check
app.get('/', (req, res) => {
  res.send('Music Sync API is running...');
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
