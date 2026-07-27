import { createServer } from "node:http";
import net from "node:net";
import { URL } from "node:url";
import { WebSocketServer, createWebSocketStream } from "ws";

const UUID = process.env.UUID || "10889da6-14ea-4cc8-97fa-6c0bc410f121";
const DOMAIN = process.env.DOMAIN || "example.com";
const REMARKS = process.env.REMARKS || "vercel-ws";
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

function subscriptionBase64() {
  return Buffer.from(`${vlessUrl()}\n`, "utf-8").toString("base64");
}

const server = createServer((req, res) => {
  const parsedUrl = new URL(req.url, "http://localhost");

  if (parsedUrl.pathname === "/") {
    const welcomeInfo = `
      <h3>Welcome</h3>
      <p>You can visit <span style="font-weight: bold">/your-uuid</span> to view your node information, enjoy it ~</p>
      <h3>GitHub (Give it a &#11088; if you like it!)</h3>
      <a href="https://github.com/vevc/nodejs-vless" target="_blank" style="color: blue">https://github.com/vevc/nodejs-vless</a>
    `;
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(welcomeInfo);
    return;
  }

  if (parsedUrl.pathname === `/${UUID}`) {
    res.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(subscriptionBase64());
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
