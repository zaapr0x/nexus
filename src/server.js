const express = require("express");
const http = require("http"); // For creating an HTTP server
const { initializeWebSocket } = require("./websocket/websocket"); // Import WebSocket logic
const routes = require("./router/api");

const port = process.env.PORT || 3000;

// Set up the Express app
const app = express();

// Import and start the Discord bot
const { startDiscordBot } = require("./bot");
startDiscordBot();

app.use(express.json()); // Middleware for parsing JSON bodies
app.use("/", routes); // Attach routes from the router

// Create an HTTP server and bind it with the Express app
const server = http.createServer(app);

// Initialize the WebSocket server
initializeWebSocket(server);

// Start the HTTP server
server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
