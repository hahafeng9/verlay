import server from "../api/index.js";

const port = Number(process.env.PORT) || 3000;

server.listen(port, () => {
  console.log(`Local server: http://localhost:${port}`);
  console.log(`WebSocket path: ${process.env.WS_PATH || "/"}`);
});
