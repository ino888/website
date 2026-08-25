// Tiny in-memory pub/sub for Server-Sent Events. Every open browser tab
// (home page or Big Screen) holds one connection to GET /api/live/stream
// and gets pushed 'chat' events (new messages) and 'embeds' events (shared
// on-screen-stream changes) the instant they happen — that's what makes
// chat and the main stage embed feel "live" across everyone watching,
// without polling. No extra dependencies, just plain Express `res.write`.
//
// This is intentionally a single in-memory list, which is the right
// tradeoff for a small single-process site like this — it resets on
// restart (fine, clients just reconnect) and won't span multiple server
// processes (fine, this app only ever runs as one).

const clients = new Set();

function subscribe(res) {
  clients.add(res);
}

function unsubscribe(res) {
  clients.delete(res);
}

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    res.write(payload);
  }
}

module.exports = { subscribe, unsubscribe, broadcast };
