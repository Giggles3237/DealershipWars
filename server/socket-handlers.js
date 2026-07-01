const send = (socket, type, payload) => {
  if (socket.readyState === 1) {
    socket.send(JSON.stringify({ type, payload }));
  }
};

export const broadcastRoom = (roomManager, room) => {
  room.state.players.forEach((player) => {
    const socket = room.sockets.get(player.id);
    if (!socket) {
      return;
    }

    send(socket, "state_sync", roomManager.getPlayerView(room.code, player.id));
  });
};

export const registerSocketHandlers = ({ wsServer, roomManager }) => {
  wsServer.on("connection", (socket) => {
    let session = null;

    const safeHandle = (type, handler) => {
      try {
        const room = handler();
        if (room) {
          broadcastRoom(roomManager, room);
        }
      } catch (error) {
        send(socket, "error", {
          type,
          message: error instanceof Error ? error.message : "Unknown server error."
        });
      }
    };

    socket.on("message", (raw) => {
      let message;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        send(socket, "error", { type: "parse", message: "Malformed JSON message." });
        return;
      }

      const { type, payload = {} } = message;

      if (type === "create_room") {
        safeHandle(type, () => {
          const result = roomManager.createRoom(payload);
          session = { roomCode: result.roomCode, playerId: result.playerId };
          const room = roomManager.attachSocket(result.roomCode, result.playerId, socket);
          send(socket, "session", result);
          return room;
        });
        return;
      }

      if (type === "join_room") {
        safeHandle(type, () => {
          const result = roomManager.joinRoom(payload);
          session = { roomCode: result.roomCode, playerId: result.playerId };
          const room = roomManager.attachSocket(result.roomCode, result.playerId, socket);
          send(socket, "session", result);
          return room;
        });
        return;
      }

      if (!session) {
        send(socket, "error", { type, message: "Join or create a room first." });
        return;
      }

      if (type === "set_ready") {
        safeHandle(type, () => roomManager.setReady(session.roomCode, session.playerId, Boolean(payload.ready)));
        return;
      }

      if (type === "start_game") {
        safeHandle(type, () => roomManager.startGame(session.roomCode, session.playerId));
        return;
      }

      if (type === "play_card") {
        safeHandle(type, () => roomManager.playCard(session.roomCode, session.playerId, payload));
        return;
      }

      if (type === "end_turn") {
        safeHandle(type, () => roomManager.endTurn(session.roomCode, session.playerId));
        return;
      }

      if (type === "ping_state") {
        try {
          send(socket, "state_sync", roomManager.getPlayerView(session.roomCode, session.playerId));
        } catch (error) {
          send(socket, "error", {
            type,
            message: error instanceof Error ? error.message : "Unable to refresh state."
          });
        }
        return;
      }

      send(socket, "error", { type, message: "Unknown message type." });
    });

    socket.on("close", () => {
      if (!session) {
        return;
      }

      const room = roomManager.detachSocket(session.playerId);
      if (room) {
        broadcastRoom(roomManager, room);
      }
    });
  });
};
