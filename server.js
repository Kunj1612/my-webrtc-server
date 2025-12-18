const WebSocket = require('ws');

// Render provides the port in the environment variable PORT
// If not found, defaults to 3000
const port = process.env.PORT || 3000;
const wss = new WebSocket.Server({ port: port });

const rooms = new Map();

console.log(`Server started on port ${port}`);

wss.on('connection', (ws) => {
    console.log("New connection");

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            const { type, roomId } = data;

            if (type === 'join') {
                handleJoin(ws, roomId);
            } else if (roomId) {
                broadcastToRoom(ws, roomId, data);
            }
        } catch (e) {
            console.error("Invalid JSON", e);
        }
    });

    ws.on('close', () => {
        if (ws.roomId) handleLeave(ws, ws.roomId);
    });
});

function handleJoin(ws, roomId) {
    ws.roomId = roomId;
    
    // Create room if it doesn't exist
    if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set());
    }
    
    const clients = rooms.get(roomId);
    clients.add(ws);
    
    console.log(`User joined room ${roomId}. Total users: ${clients.size}`);

    // If 2 users are present, tell the FIRST user (not the new one) to start the call
    if (clients.size >= 2) {
        clients.forEach(client => {
            // FIX: Send 'ready_to_call' to the OTHER client (the one who was already waiting)
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                console.log(`Triggering call for room ${roomId}`);
                client.send(JSON.stringify({ type: 'ready_to_call' }));
            }
        });
    }
}

function broadcastToRoom(sender, roomId, data) {
    const clients = rooms.get(roomId);
    if (clients) {
        clients.forEach(client => {
            // Forward message to everyone EXCEPT the sender
            if (client !== sender && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(data));
            }
        });
    }
}

function handleLeave(ws, roomId) {
    const clients = rooms.get(roomId);
    if (clients) {
        clients.delete(ws);
        console.log(`User left room ${roomId}. Remaining: ${clients.size}`);
        
        if (clients.size === 0) {
            rooms.delete(roomId);
        } else {
            // Notify remaining user that the peer left
            clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'user_left' }));
                }
            });
        }
    }
}