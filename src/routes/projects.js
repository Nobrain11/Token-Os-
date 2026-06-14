const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { getTokenHolders, getTokenMetadata, getTokenPrice, registerWebhook } = require('../helius');

router.post('/register', async (req, res) => {
  const { name, mintAddress, ownerWallet } = req.body;
  if (!name || !mintAddress || !ownerWallet) {
    return res.status(400).json({ error: 'name, mintAddress, ownerWallet required' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO projects (name, mint_address, owner_wallet)
       VALUES ($1, $2, $3)
       ON CONFLICT (mint_address) DO UPDATE SET name = $1
       RETURNING *`,
      [name, mintAddress, ownerWallet]
    );
    const project = result.rows[0];
    if (process.env.WEBHOOK_BASE_URL) {
      await registerWebhook(mintAddress, `${process.env.WEBHOOK_BASE_URL}/webhooks/helius`);
    }
    res.json(project);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/by-wallet/:wallet', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM projects WHERE owner_wallet = $1 ORDER BY created_at DESC',
      [req.params.wallet]
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id/overview', async (req, res) => {
  try {
    const proj = await pool.query('SELECT * FROM projects WHERE id = $1', [req.params.id]);
    if (!proj.rows.length) return res.status(404).json({ error: 'Not found' });
    const { mint_address } = proj.rows[0];
    const [metadata, price, holders] = await Promise.all([
      getTokenMetadata(mint_address),
      getTokenPrice(mint_address),
      getTokenHolders(mint_address)
    ]);
    await pool.query(
      `INSERT INTO holders_snapshots (project_id, holder_count, top_holders)
       VALUES ($1, $2, $3)`,
      [req.params.id, holders.length, JSON.stringify(holders.slice(0, 10))]
    );
    res.json({ metadata, price, holderCount: holders.length, topHolders: holders.slice(0, 10) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id/holders', async (req, res) => {
  try {
    const proj = await pool.query('SELECT * FROM projects WHERE id = $1', [req.params.id]);
    if (!proj.rows.length) return res.status(404).json({ error: 'Not found' });
    const holders = await getTokenHolders(proj.rows[0].mint_address);
    res.json({ totalHolders: holders.length, topHolders: holders.slice(0, 50) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id/holders/history', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT holder_count, snapshot_at FROM holders_snapshots
       WHERE project_id = $1 ORDER BY snapshot_at ASC LIMIT 30`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id/milestones', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM milestones WHERE project_id = $1 ORDER BY created_at DESC',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/milestones', async (req, res) => {
  const { type, targetValue } = req.body;
  if (!type || !targetValue) return res.status(400).json({ error: 'type and targetValue required' });
  try {
    const result = await pool.query(
      `INSERT INTO milestones (project_id, type, target_value)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.params.id, type, targetValue]
    );
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/telegram', async (req, res) => {
  const { telegramBotToken, telegramGroupId } = req.body;
  if (!telegramBotToken || !telegramGroupId) {
    return res.status(400).json({ error: 'telegramBotToken and telegramGroupId required' });
  }
  try {
    await pool.query(
      `UPDATE projects SET telegram_bot_token = $1, telegram_group_id = $2 WHERE id = $3`,
      [telegramBotToken, telegramGroupId, req.params.id]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
