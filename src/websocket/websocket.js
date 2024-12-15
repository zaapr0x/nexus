const WebSocket = require("ws");
const { saveMinecraftData, verifyToken } = require("../models/matscraft");
/**
 * Function to initialize the WebSocket server
 * @param {http.Server} server - HTTP server instance
 */
function initializeWebSocket(server) {
  // Create a WebSocket server and bind it to the HTTP server
  const wss = new WebSocket.Server({ server });

  // Event triggered when a client connects
  wss.on("connection", async (ws) => {
    console.log("New WebSocket client connected!");

    // Handle messages received from the client
    ws.on("message", async (message) => {
      try {
        const parsed = JSON.parse(message);

        // Check the event type
        if (parsed.event === "linkAccount") {
          const linkAccount = parsed.data;
          console.log("Received linkAccount data:", linkAccount);
          const response = await verifyToken(linkAccount);
          ws.send(response);
          return;
        }
        if (parsed.event === "BlockBreak") {
          const BlockBreakEvent = JSON.parse(parsed.data);
          console.log("Received BlockBreak data:", BlockBreakEvent.uuid);
          const response = await saveMinecraftData(BlockBreakEvent);
          ws.send(response);
          return;
        }
      } catch (err) {
        console.error("Error parsing message:", err);
      }
      await saveMinecraftData(JSON.parse(message));

      // Example: Respond back to the client
      ws.send(JSON.stringify({ message: `Server received: ${message}` }));
    });

    // Handle client disconnection
    ws.on("close", () => {
      console.log("WebSocket client disconnected.");
    });

    // Handle WebSocket errors
    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
    });
  });

  console.log("WebSocket server initialized");
}

module.exports = { initializeWebSocket };
