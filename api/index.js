import { createServer } from "node:http";
import net from "node:net";
import { URL } from "node:url";
import { WebSocketServer, createWebSocketStream } from "ws";

const UUID = process.env.UUID || "10889da6-14ea-4cc8-97fa-6c0bc410f121";
const DOMAIN = process.env.DOMAIN || "example.com";
const REMARKS = process.env.REMARKS || "verlay";
const WS_PATH = process.env.WS_PATH || "/";

const uuidBytes = Buffer.from(UUID.replace(/-/g, ""), "hex");

/**
 * VLESS handshake parser
 * @see https://xtls.github.io/development/protocols/vless.html
 */
function parseHandshake(buf) {
  let offset = 0;
  const version = buf.readUInt8(offset);
  offset += 1;

  const id = buf.subarray(offset, offset + 16);
  offset += 16;

  const optLen = buf.readUInt8(offset);
  offset += 1 + optLen;

  const command = buf.readUInt8(offset);
  offset += 1;

  const port = buf.readUInt16BE(offset);
  offset += 2;

  const addressType = buf.readUInt8(offset);
  offset += 1;

  let host;
  if (addressType === 1) {
    host = Array.from(buf.subarray(offset, offset + 4)).join(".");
    offset += 4;
  } else if (addressType === 2) {
    const len = buf.readUInt8(offset++);
    host = buf.subarray(offset, offset + len).toString();
    offset += len;
  } else if (addressType === 3) {
    const segments = [];
    for (let i = 0; i < 8; i++) {
      segments.push(buf.readUInt16BE(offset).toString(16));
      offset += 2;
    }
    host = segments.join(":");
  } else {
    throw new Error(`Unsupported address type: ${addressType}`);
  }

  return { version, id, command, host, port, offset };
}

function vlessUrl() {
  const path = encodeURIComponent(WS_PATH);
  return `vless://${UUID}@${DOMAIN}:443?encryption=none&security=tls&sni=${DOMAIN}&fp=chrome&type=ws&host=${DOMAIN}&path=${path}#${REMARKS}`;
}

const server = createServer((req, res) => {
  const parsedUrl = new URL(req.url, "http://localhost");

  if (parsedUrl.pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`
      <h3>Verlay</h3>
      <p>访问 <strong>/${UUID}</strong> 查看节点信息</p>
    `);
    return;
  }

  if (parsedUrl.pathname === `/${UUID}`) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`
      <h3>VLESS URL</h3>
      <p style="word-wrap:break-word">${vlessUrl()}</p>
      <h3>WebSocket Path</h3>
      <p>${WS_PATH}</p>
    `);
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not Found");
});

const wss = new WebSocketServer({ server, path: WS_PATH });

wss.on("connection", (ws) => {
  ws.once("message", (msg) => {
    try {
      const buffer = Buffer.isBuffer(msg) ? msg : Buffer.from(msg);
      const { version, id, host, port, offset } = parseHandshake(buffer);

      if (!id.equals(uuidBytes)) {
        ws.close();
        return;
      }

      ws.send(Buffer.from([version, 0]));

      const duplex = createWebSocketStream(ws);
      const socket = net.connect({ host, port }, () => {
        socket.write(buffer.subarray(offset));
        duplex.pipe(socket).pipe(duplex);
      });

      duplex.on("error", () => {});
      socket.on("error", () => {});
      socket.on("close", () => ws.terminate());
      duplex.on("close", () => socket.destroy());
    } catch {
      ws.close();
    }
  });
});

export default server;
