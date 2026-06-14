const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { getTokenHolders } = require('../helius');

const FEE_RATE = 0.01;

router.post('/:id/preview', async (req, res) => {
  const { totalAmount, topN, minHolding } = req.body;
  if (!totalAmount) return res.status(400).json({ error: 'totalAmount required' });
  try {
    const proj = await pool.query('SELECT * FROM projects WHERE id = $1', [req.params.id]);
    if (!proj.rows.length) return res.status(404).json({ error: 'Not found' });
    let holders = await getTokenHolders(proj.rows[0].mint_address);
    if (minHolding) holders = holders.filter(h => Number(h.uiAmount) >= minHolding);
    if (topN) holders = holders.slice(0, topN);
    const feeAmount = totalAmount * FEE_RATE;
    const netAmount = totalAmount - feeAmount;
    const perWallet = holders.length > 0 ? netAmount / holders.length : 0;
    res.json({
      recipientCount: holders.length,
      totalAmount,
      feeAmount,
      netAmount,
      perWallet,
      topRecipients: holders.slice(0, 5).map(h => ({ wallet: h.wallet, amount: perWallet }))
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/record', async (req, res) => {
  const { totalAmount, recipientCount, txSignature } = req.body;
  if (!totalAmount || !recipientCount) {
    return res.status(400).json({ error: 'totalAmount and recipientCount required' });
  }
  try {
    const feeAmount = totalAmount * FEE_RATE;
    const result = await pool.query(
      `INSERT INTO airdrops (project_id, total_amount, fee_amount, recipient_count, status, tx_signature)
       VALUES ($1, $2, $3, $4, 'complete', $5) RETURNING *`,
      [req.params.id, totalAmount, feeAmount, recipientCount, txSignature || null]
    );
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id/history', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM airdrops WHERE project_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
