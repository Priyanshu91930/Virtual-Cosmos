# Virtual Cosmos 🌌

A real-time, 2D proximity-based social environment where users can wander through a digital space, meet others, and engage in context-aware conversations. Built with React, PixiJS, Node.js, and Socket.io.

## ✨ Features

- **Real-time Multiplayer**: See other users moving in the cosmos instantly.
- **Proximity Chat**: Chat functionality that activates only when you are near another user.
- **Rich Visuals**: Powered by PixiJS for high-performance 2D rendering and animations.
- **Personalized Avatars**: Choose your handle and color before entering the cosmos.
- **Persistence**: User sessions and positions are managed with MongoDB.

## 🚀 Tech Stack

**Frontend:**
- React (Vite)
- PixiJS (v8)
- Tailwind CSS
- Socket.io-client
- Lucide React (Icons)

**Backend:**
- Node.js
- Express
- Socket.io
- MongoDB (Mongoose)

---

## 🛠️ Setup Instructions

### Prerequisites
- Node.js (v18+)
- MongoDB Atlas account or local MongoDB instance

### 1. Clone the repository
```bash
git clone https://github.com/Priyanshu91930/Virtual-Cosmos.git
cd Virtual-Cosmos
```

### 2. Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `backend` folder and add your MongoDB connection string:
   ```env
   MONGO_URI=your_mongodb_connection_string
   PORT=5000
   ```
4. Start the backend server:
   ```bash
   npm start
   ```

### 3. Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. (Optional) If your backend is running on a different port or host, update the `SOCKET_URL` in `src/App.jsx`.
4. Start the frontend development server:
   ```bash
   npm run dev
   ```

---

## 🎮 How to Play
1. **Enter Handle**: Type in your username and pick a color.
2. **Move**: Use `Arrow Keys` or `WASD` to move your avatar.
3. **Connect**: Walk close to another player (within the proximity radius).
4. **Chat**: Once close, the chat icon/panel will appear. Send a message to start a conversation!

---

## 📜 License
This project is licensed under the MIT License.
