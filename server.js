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
    if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set());
    }
    const clients = rooms.get(roomId);
    clients.add(ws);

    if (clients.size >= 2) {
        ws.send(JSON.stringify({ type: 'ready_to_call' }));
    }
}

function broadcastToRoom(sender, roomId, data) {
    const clients = rooms.get(roomId);
    if (clients) {
        clients.forEach(client => {
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
        if (clients.size === 0) {
            rooms.delete(roomId);
        } else {
            clients.forEach(client => {
                client.send(JSON.stringify({ type: 'user_left' }));
            });
        }
    }
}