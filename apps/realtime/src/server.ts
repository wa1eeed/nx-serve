import { createServer, type Server as HttpServer } from 'node:http';
import { Server, type DefaultEventsMap } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { EVENTS_CHANNEL, type EventEnvelope } from '@nxserve/contracts';
import { type SocketIdentity, verifyToken } from './auth.js';
import { roomsForIdentity } from './rooms.js';

interface SocketData {
  identity: SocketIdentity;
}

interface EventMessage {
  envelope: EventEnvelope;
  rooms: string[];
}

export interface RealtimeServer {
  httpServer: HttpServer;
  close(): Promise<void>;
}

/**
 * Socket.IO gateway (docs/14). Authenticated by the access JWT at the handshake,
 * tenant bound at connection, scaled out via the Redis adapter. An event bridge
 * subscribes to the worker's Redis channel and fans events out to rooms.
 */
export function createRealtimeServer(options: {
  redisUrl: string;
  jwtSecret: string;
}): RealtimeServer {
  const httpServer = createServer();
  const io = new Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>(
    httpServer,
    { transports: ['websocket', 'polling'] },
  );

  const pubClient = new Redis(options.redisUrl, { maxRetriesPerRequest: null });
  const subClient = pubClient.duplicate();
  io.adapter(createAdapter(pubClient, subClient));

  const secret = new TextEncoder().encode(options.jwtSecret);
  io.use((socket, next) => {
    const token = socket.handshake.auth?.['token'];
    verifyToken(typeof token === 'string' ? token : '', secret)
      .then((identity) => {
        socket.data.identity = identity;
        next();
      })
      .catch(() => next(new Error('unauthorized')));
  });

  io.on('connection', (socket) => {
    for (const room of roomsForIdentity(socket.data.identity)) {
      void socket.join(room);
    }
  });

  // Event bridge: fan worker-published events out to their rooms.
  const eventSub = new Redis(options.redisUrl, { maxRetriesPerRequest: null });
  void eventSub.subscribe(EVENTS_CHANNEL);
  eventSub.on('message', (_channel: string, message: string) => {
    try {
      const parsed = JSON.parse(message) as EventMessage;
      for (const room of parsed.rooms) {
        io.to(room).emit(parsed.envelope.type, parsed.envelope);
      }
    } catch {
      // Malformed message: ignore.
    }
  });

  return {
    httpServer,
    async close(): Promise<void> {
      await io.close();
      eventSub.disconnect();
      pubClient.disconnect();
      subClient.disconnect();
    },
  };
}
