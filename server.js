import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { createClient } from 'minecraft-protocol';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const PORT = process.env.PORT || 3000;
const clients = new Map();

// WebSocket обработчик
wss.on('connection', (ws) => {
  console.log('Новый клиент подключился');
  let mcClient = null;
  const clientId = Date.now().toString();
  clients.set(clientId, { ws, mcClient: null });

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data);
      console.log('Получено сообщение:', message.type);

      switch (message.type) {
        case 'connect':
          handleConnect(message, ws, clientId);
          break;
        case 'disconnect':
          handleDisconnect(clientId);
          break;
        case 'move':
          handleMove(message, clientId);
          break;
        case 'chat':
          handleChat(message, clientId);
          break;
        case 'blockBreak':
          handleBlockBreak(message, clientId);
          break;
        case 'blockPlace':
          handleBlockPlace(message, clientId);
          break;
      }
    } catch (error) {
      console.error('Ошибка обработки сообщения:', error);
    }
  });

  ws.on('close', () => {
    console.log('Клиент отключился');
    handleDisconnect(clientId);
  });

  ws.on('error', (error) => {
    console.error('WebSocket ошибка:', error);
  });
});

function handleConnect(message, ws, clientId) {
  const { host, port, username } = message;
  console.log(`Подключение к ${host}:${port} как ${username}`);

  try {
    const mcClient = createClient({
      host,
      port: port || 25565,
      username,
      version: '1.20.1'
    });

    mcClient.on('login', () => {
      console.log('✅ Успешно подключено к серверу');
      const client = clients.get(clientId);
      if (client) {
        client.mcClient = mcClient;
      }

      ws.send(JSON.stringify({
        type: 'connected',
        message: `Подключено к ${host}:${port}`
      }));
    });

    mcClient.on('chat', (packet) => {
      ws.send(JSON.stringify({
        type: 'chat',
        message: packet.message
      }));
    });

    mcClient.on('position', (packet) => {
      ws.send(JSON.stringify({
        type: 'position',
        x: packet.x,
        y: packet.y,
        z: packet.z
      }));
    });

    mcClient.on('health', (packet) => {
      ws.send(JSON.stringify({
        type: 'health',
        health: packet.health,
        food: packet.food
      }));
    });

    mcClient.on('chunk', (packet) => {
      ws.send(JSON.stringify({
        type: 'chunk',
        x: packet.x,
        z: packet.z
      }));
    });

    mcClient.on('error', (error) => {
      console.error('Ошибка Minecraft:', error.message);
      ws.send(JSON.stringify({
        type: 'error',
        message: error.message
      }));
    });

    mcClient.on('end', (reason) => {
      console.log('Отключено от сервера:', reason);
      ws.send(JSON.stringify({
        type: 'disconnected',
        reason
      }));
    });

  } catch (error) {
    console.error('Ошибка подключения:', error);
    ws.send(JSON.stringify({
      type: 'error',
      message: error.message
    }));
  }
}

function handleDisconnect(clientId) {
  const client = clients.get(clientId);
  if (client && client.mcClient) {
    client.mcClient.end();
  }
  clients.delete(clientId);
}

function handleMove(message, clientId) {
  const client = clients.get(clientId);
  if (client && client.mcClient) {
    client.mcClient.write('player', {
      x: message.x,
      y: message.y,
      z: message.z,
      onGround: message.onGround
    });
  }
}

function handleChat(message, clientId) {
  const client = clients.get(clientId);
  if (client && client.mcClient) {
    client.mcClient.write('chat', { message: message.text });
  }
}

function handleBlockBreak(message, clientId) {
  const client = clients.get(clientId);
  if (client && client.mcClient) {
    client.mcClient.write('block_dig', {
      status: 0,
      location: { x: message.x, y: message.y, z: message.z },
      face: message.face
    });
  }
}

function handleBlockPlace(message, clientId) {
  const client = clients.get(clientId);
  if (client && client.mcClient) {
    client.mcClient.write('block_place', {
      hand: 0,
      location: { x: message.x, y: message.y, z: message.z },
      direction: message.face
    });
  }
}

server.listen(PORT, () => {
  console.log(`\n🚀 Сервер запущен на http://localhost:${PORT}`);
  console.log(`🎮 Откройте браузер и начните играть!\n`);
});
