require('dotenv').config();
const express = require('express');
const { buildJwksResponse } = require('./jwks');

const app = express();

// Public read-only JWKS endpoint for One Login key discovery.
app.get('/.well-known/jwks.json', async (_req, res) => {
  try {
    const jwks = await buildJwksResponse();
    res
      .status(200)
      .set('Cache-Control', 'public, max-age=3600')
      .json(jwks);
  } catch (err) {
    res.status(500).json({
      error: {
        code: 'JWKS_LOAD_FAILED',
        message: 'Failed to load JWKS keys',
      },
    });
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  // Minimal startup log for local verification.
  console.log(`JWKS server listening on :${port}`);
});
