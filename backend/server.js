const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/virtual-cosmos';
mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    // Clear old users on startup for a clean slate
    await User.deleteMany({});
    console.log('Cleared old user sessions');
  })
  .catch(err => console.error('MongoDB connection error:', err));

const userSchema = new mongoose.Schema({
  userId: String,
  username: String,
  x: Number,
  y: Number,
  color: String,
  lastActive: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// In-memory user state for real-time tracking
const players = {};

io.on('connection', async (socket) => {
  console.log('User connected:', socket.id);

  // Initialize player
  const initialPlayer = {
    id: socket.id,
    socketId: socket.id,
    userId: socket.id,
    x: Math.random() * 800,
    y: Math.random() * 600,
    color: `#${Math.floor(Math.random()*16777215).toString(16)}`,
    username: `User-${socket.id.substring(0, 4)}`
  };

  players[socket.id] = initialPlayer;

  // Save to MongoDB
  try {
    await User.findOneAndUpdate(
      { userId: socket.id },
      { ...initialPlayer, userId: socket.id, lastActive: new Date() },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error('Error saving user to MongoDB:', err);
  }

  // Send current players to new connection
  socket.emit('initialPlayers', players);

  // Notify others about new player
  socket.broadcast.emit('playerJoined', players[socket.id]);

  // Handle movement
  socket.on('move', async (data) => {
    if (players[socket.id]) {
      players[socket.id] = { ...players[socket.id], ...data };
      socket.broadcast.emit('playerMoved', players[socket.id]);

      // Update MongoDB asynchronously
      User.findOneAndUpdate(
        { userId: socket.id },
        { ...data, lastActive: new Date() }
      ).catch(err => console.error('Error updating move in MongoDB:', err));
    }
  });

  // Handle proximity-based chat messages
  socket.on('chatMessage', (data) => {
    // data: { recipientId, message }
    // In a more complex app, we might check radius here too, 
    // but the task says "if distance < radius -> connect".
    // We'll broadcast to rooms if we use them, but for now simple direct message or broadcast.
    if (data.recipientId) {
      io.to(data.recipientId).emit('receiveMessage', {
        senderId: socket.id,
        message: data.message
      });
    }
  });

  socket.on('disconnect', async () => {
    console.log('User disconnected:', socket.id);
    delete players[socket.id];
    io.emit('playerLeft', socket.id);

    try {
      await User.deleteOne({ userId: socket.id });
    } catch (err) {
      console.error('Error deleting user from MongoDB:', err);
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
