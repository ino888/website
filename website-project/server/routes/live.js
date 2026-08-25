const express = require('express');
const { subscribe, unsubscribe } = require('../realtime');

const router = express.Router();

// GET /api/live/stream — Server-Sent Events. The page opens one of these on
// load and keeps it open; it's how new chat messages and shared main-stage
// embed changes reach every open tab in real time, including the home page
// preview. No auth required to *receive* updates — anyone watching the site
// should see chat and what's live, same as they could without logging in
// before. Posting a message or changing the shared embed still requires
// being logged in (enforced on those routes, not this one).
router.get('/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no' // in case this ever sits behind an nginx proxy
  });
  res.write('retry: 3000\n\n');

  subscribe(res);

  // Keep idle connections from being silently dropped by proxies/load balancers.
  const heartbeat = setInterval(() => {
    res.write(': ping\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe(res);
  });
});

module.exports = router;
