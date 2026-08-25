const jwt = require('jsonwebtoken');

// Drop this on any future route that should only work for logged-in users, e.g.:
//   router.post('/some-protected-thing', requireAuth, (req, res) => { ... req.userId ... });
module.exports = function requireAuth(req, res, next) {
  try {
    const token = req.cookies.kestrel_session;
    if (!token) return res.status(401).json({ error: 'Not logged in.' });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.sub;
    req.username = payload.username;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Not logged in.' });
  }
};
