const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

let waitingUser = null;

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("find-match", () => {
    if (waitingUser && waitingUser.id !== socket.id) {
      const room = `room-${waitingUser.id}-${socket.id}`;
      socket.join(room);
      waitingUser.join(room);

      io.to(waitingUser.id).emit("matched", { room, initiator: true });
      io.to(socket.id).emit("matched", { room, initiator: false });

      waitingUser = null;
    } else {
      waitingUser = socket;
    }
  });

  socket.on("signal", ({ roomName, signal }) => {
    socket.to(roomName).emit("signal", { signal });
  });

  socket.on("chat-message", ({ roomName, message }) => {
    socket.to(roomName).emit("chat-message", message);
  });

  socket.on("disconnect", () => {
    if (waitingUser && waitingUser.id === socket.id) {
      waitingUser = null;
    }
    socket.broadcast.emit("peer-disconnected");
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
