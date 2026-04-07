import React, { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { io } from 'socket.io-client';
import { MessageSquare, Users, Send, X } from 'lucide-react';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
const PROXIMITY_RADIUS = 100;

function App() {
  const pixiContainerRef = useRef(null);
  const [joined, setJoined] = useState(false);
  const [username, setUsername] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [socket, setSocket] = useState(null);
  const [players, setPlayers] = useState({});
  const [myId, setMyId] = useState(null);
  const [nearbyPlayers, setNearbyPlayers] = useState([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  
  const playersRef = useRef({});
  const graphicsRef = useRef({});
  const appRef = useRef(null);

  // Initialize Socket.io
  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to server');
      setMyId(newSocket.id);
    });

    newSocket.on('initialPlayers', (serverPlayers) => {
      playersRef.current = serverPlayers;
      setPlayers({ ...serverPlayers });
    });

    newSocket.on('playerJoined', (player) => {
      const pid = player.id || player.userId || player.socketId;
      playersRef.current[pid] = player;
      setPlayers(prev => ({ ...prev, [pid]: player }));
    });

    newSocket.on('playerMoved', (player) => {
      const pid = player.id || player.userId || player.socketId;
      playersRef.current[pid] = player;
      setPlayers(prev => ({ ...prev, [pid]: player }));
    });

    newSocket.on('playerLeft', (id) => {
      delete playersRef.current[id];
      if (graphicsRef.current[id]) {
        if (appRef.current && appRef.current.stage) {
          appRef.current.stage.removeChild(graphicsRef.current[id]);
        }
        delete graphicsRef.current[id];
      }
      setPlayers(prev => {
        const newPlayers = { ...prev };
        delete newPlayers[id];
        return newPlayers;
      });
    });

    newSocket.on('receiveMessage', (data) => {
      setMessages(prev => [...prev, { ...data, timestamp: new Date() }]);
      setChatOpen(true);
    });

    return () => newSocket.disconnect();
  }, []);

  useEffect(() => {
    const initPixi = async () => {
      // Clear old state before starting a new app instance
      graphicsRef.current = {};
      
      const app = new PIXI.Application();
      try {
        await app.init({
          width: window.innerWidth,
          height: window.innerHeight,
          backgroundColor: 0x0f172a,
          antialias: true,
          resolution: window.devicePixelRatio || 1,
        });
      } catch (error) {
        console.error("PixiJS initialization failed:", error);
        return;
      }
      
      appRef.current = app;
      if (pixiContainerRef.current) {
        pixiContainerRef.current.appendChild(app.canvas);
      }

      // Resize handler
      const handleResize = () => {
        app.renderer.resize(window.innerWidth, window.innerHeight);
      };
      window.addEventListener('resize', handleResize);

      // Movement Ticker
      const keys = {};
      window.addEventListener('keydown', (e) => keys[e.code] = true);
      window.addEventListener('keyup', (e) => keys[e.code] = false);

      app.ticker.add(() => {
        if (!myId || !playersRef.current[myId] || !joined) return;

        let moved = false;
        const speed = 5;
        const me = playersRef.current[myId];

        if (keys['ArrowUp'] || keys['KeyW']) { me.y -= speed; moved = true; }
        if (keys['ArrowDown'] || keys['KeyS']) { me.y += speed; moved = true; }
        if (keys['ArrowLeft'] || keys['KeyA']) { me.x -= speed; moved = true; }
        if (keys['ArrowRight'] || keys['KeyD']) { me.x += speed; moved = true; }

        if (moved) {
          // Boundary check
          me.x = Math.max(0, Math.min(app.screen.width, me.x));
          me.y = Math.max(0, Math.min(app.screen.height, me.y));
          
          socket.emit('move', { x: me.x, y: me.y });
          setPlayers(prev => ({ ...prev, [myId]: { ...me } }));
        }

      // Proximity Detection
      const nearby = [];
      Object.keys(playersRef.current).forEach(pid => {
        const p = playersRef.current[pid];
        if (pid !== myId) {
          const dist = Math.sqrt(Math.pow(p.x - me.x, 2) + Math.pow(p.y - me.y, 2));
          if (dist < PROXIMITY_RADIUS) {
            nearby.push(p);
          }
        }
      });
      setNearbyPlayers(nearby);
      
      // Automatic chat engagement
      if (nearby.length > 0 && !chatOpen) {
        // Optional: auto-open chat logic could go here
      } else if (nearby.length === 0 && chatOpen) {
        setChatOpen(false);
      }

      // Update Graphics
      Object.keys(playersRef.current).forEach(pid => {
        const p = playersRef.current[pid];
        if (!graphicsRef.current[pid]) {
          const container = new PIXI.Container();
          
          const circle = new PIXI.Graphics();
          circle.circle(0, 0, 20);
          circle.fill(p.color || '#3b82f6');
          
          if (pid === myId) {
            circle.stroke({ width: 3, color: 'white', alpha: 1 });
            circle.circle(0, 0, 22);
          }

          const text = new PIXI.Text(p.username || 'User', {
            fontSize: 14,
            fill: 0xffffff,
            align: 'center',
            fontWeight: 'bold'
          });
          text.anchor.set(0.5);
          text.y = -40;

          container.addChild(circle);
          container.addChild(text);
          
          if (appRef.current && appRef.current.stage) {
            appRef.current.stage.addChild(container);
          }
          graphicsRef.current[pid] = container;
        }
        
        const graphic = graphicsRef.current[pid];
        if (graphic) {
          graphic.x = p.x;
          graphic.y = p.y;
          
          // Update username text if it changed
          const textObj = graphic.children[1];
          if (textObj && textObj instanceof PIXI.Text && textObj.text !== p.username) {
            textObj.text = p.username || 'User';
          }
          
          // Update color if it changed (optimization: could track previous color, but simple for now)
          const circleObj = graphic.children[0];
          if (circleObj && circleObj instanceof PIXI.Graphics) {
            // Only update color if the graphic hasn't been synced or if we want to be safe
            // In v8, we can use tint or just redraw. Redrawing is simpler for this case.
            // But since it's a ticker, we should avoid redrawing EVERY frame.
            // For now, let's just make sure the name is fixed, as that's the primary issue.
          }
        }
      });
    });

    };

    if (joined && myId) {
      initPixi();
    }

    return () => {
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
      graphicsRef.current = {};
    };
  }, [myId, socket, joined]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || nearbyPlayers.length === 0) return;

    const data = {
      recipientId: nearbyPlayers[0].id || nearbyPlayers[0].userId || nearbyPlayers[0].socketId, 
      message: inputMessage
    };

    socket.emit('chatMessage', data);
    setMessages(prev => [...prev, { senderId: myId, message: inputMessage, timestamp: new Date() }]);
    setInputMessage('');
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (!username.trim() || !socket) return;
    
    // Notify server about username and color (we'll update the server too or just emit a 'join' event if needed)
    // For now the server creates a default, but we can emit an update.
    const updatedPlayer = {
      ...playersRef.current[myId],
      username: username.trim(),
      color: color
    };
    playersRef.current[myId] = updatedPlayer;
    socket.emit('move', updatedPlayer); // Use 'move' event to sync the name/color for now
    setJoined(true);
  };

  if (!joined) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#090e1a] overflow-hidden relative font-sans">
        {/* Animated Background Elements */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/20 blur-[120px] rounded-full" />
        
        <div className="z-10 bg-slate-900/40 backdrop-blur-2xl p-10 rounded-[2.5rem] shadow-2xl border border-slate-700/50 w-full max-w-md text-center">
          <div className="mb-8">
            <div className="w-20 h-20 bg-indigo-600 rounded-3xl mx-auto flex items-center justify-center shadow-[0_0_40px_rgba(79,70,229,0.4)] rotate-12 mb-6">
              <Users size={40} className="text-white -rotate-12" />
            </div>
            <h1 className="text-4xl font-black text-white tracking-tight mb-2">Virtual Cosmos</h1>
            <p className="text-slate-400">Step into the 2D universe</p>
          </div>

          <form onSubmit={handleJoin} className="space-y-6">
            <div className="text-left">
              <label className="text-sm font-semibold text-slate-300 ml-1 mb-2 block">Choose your handle</label>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ex: StarGazer"
                required
                className="w-full bg-slate-950/50 border border-slate-700 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-lg"
              />
            </div>

            <div className="text-left">
              <label className="text-sm font-semibold text-slate-300 ml-1 mb-2 block">Avatar Color</label>
              <div className="flex justify-between gap-2">
                {['#6366f1', '#a855f7', '#ec4899', '#f43f5e', '#22c55e', '#3b82f6'].map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-10 h-10 rounded-full border-2 transition-all scale-110 ${color === c ? 'border-white scale-125' : 'border-transparent opacity-60 hover:opacity-100'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <button 
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-2xl shadow-[0_10px_30px_rgba(79,70,229,0.3)] hover:shadow-[0_15px_40px_rgba(79,70,229,0.4)] transition-all active:scale-95 text-lg"
            >
              Enter the Cosmos
            </button>
          </form>
          
          <div className="mt-8 text-slate-500 text-xs flex items-center justify-center gap-4">
            <span className="flex items-center gap-1"><Users size={12} /> Real-time Proximity</span>
            <span className="flex items-center gap-1"><MessageSquare size={12} /> Global Chat</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-900 font-sans text-white">
      {/* PixiJS Canvas */}
      <div ref={pixiContainerRef} className="absolute inset-0 z-0" />

      {/* UI Overlay */}
      <div className="absolute top-6 left-6 z-10 pointer-events-none">
        <div className="bg-slate-800/80 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-slate-700/50 pointer-events-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
            <h1 className="font-bold text-xl tracking-tight">Virtual Cosmos</h1>
          </div>
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Users size={16} />
            <span>{Object.keys(players).length} Users Online</span>
          </div>
        </div>
      </div>

      {/* Nearby Players Badge */}
      {nearbyPlayers.length > 0 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
          <div className="bg-indigo-600/90 backdrop-blur-md px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-bounce">
            <div className="w-2 h-2 rounded-full bg-white animate-ping" />
            <span className="font-medium">You are in proximity with {nearbyPlayers.map(p => p.username).join(', ')}</span>
          </div>
        </div>
      )}

      {/* Chat Panel */}
      {chatOpen && nearbyPlayers.length > 0 && (
        <div className="absolute bottom-6 right-6 z-20 w-80 max-h-[500px] flex flex-col bg-slate-800/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-indigo-500/30 overflow-hidden animate-in slide-in-from-right-10 duration-300">
          <div className="p-4 bg-indigo-600 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare size={18} />
              <span className="font-semibold">Proximity Chat</span>
            </div>
            <button onClick={() => setChatOpen(false)} className="hover:bg-indigo-500 p-1 rounded-lg transition-colors">
              <X size={18} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[200px]">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex flex-col ${msg.senderId === myId ? 'items-end' : 'items-start'}`}>
                <div className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm ${
                  msg.senderId === myId 
                    ? 'bg-indigo-600 text-white rounded-tr-none' 
                    : 'bg-slate-700 text-slate-200 rounded-tl-none'
                }`}>
                  {msg.message}
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={sendMessage} className="p-4 border-t border-slate-700/50 flex gap-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-slate-900/50 border border-slate-600 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 p-2 rounded-xl transition-all active:scale-95 text-white">
              <Send size={18} />
            </button>
          </form>
        </div>
      )}
      
      {!chatOpen && nearbyPlayers.length > 0 && (
        <button 
          onClick={() => setChatOpen(true)}
          className="absolute bottom-6 right-6 z-20 p-4 bg-indigo-600 rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all text-white"
        >
          <MessageSquare size={24} />
        </button>
      )}
    </div>
  );
}

export default App;
