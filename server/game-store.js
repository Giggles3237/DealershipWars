export class GameStore {
  constructor() {
    this.rooms = new Map();
    this.playerToRoom = new Map();
  }

  saveRoom(room) {
    this.rooms.set(room.code, room);
    room.state.players.forEach((player) => {
      this.playerToRoom.set(player.id, room.code);
    });
  }

  getRoom(code) {
    return this.rooms.get(code.toUpperCase()) ?? null;
  }

  getRoomByPlayerId(playerId) {
    const roomCode = this.playerToRoom.get(playerId);
    return roomCode ? this.getRoom(roomCode) : null;
  }
}
