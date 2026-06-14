const express = require('express');
const router = express.Router();
const axios = require('axios');
const { pool } = require('../db');

router.post('/helius', async (req, res) => {
  res.sendStatus(200);
  const events = Array.isArray(req.body) ? req.body : [req.body];
  for (const event of events) {
    try {
      await processHeliusEvent(event);
    } catch (e) {
      console.error('[webhook] Error:', e.message);
    }
  }
});

async function processHeliusEvent(event) {
  const { tokenTransfers } = event;
  if (!tokenTransfers?.length) return;
  for (const transfer of tokenTransfers) {
    const { mint, toUserAccount, tokenAmount } = transfer;
    if (!mint) continue;
    const proj = await pool.query(
      'SELECT * FROM projects WHERE mint_address = $1', [mint]
    );
    if (!proj.rows.length) continue;
    const project = proj.rows[0];
    if (Number(tokenAmount) > 1_000_000 && project.telegram_bot_token && project.telegram_group_id) {
      const msg = `🐋 *Whale Alert* — ${project.name}\n\n` +
        `${(tokenAmount / 1e6).toLocaleString()} tokens transferred\n` +
        `To: \`${toUserAccount?.slice(0, 8)}...${toUserAccount?.slice(-4)}\``;
      await sendTelegramMessage(project.telegram_bot_token, project.telegram_group_id, msg);
    }
  }
}

async function sendTelegramMessage(botToken, chatId, text) {
  try {
    await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown'
    });
  } catch (e) {
    console.error('[telegram] Send failed:', e.message);
  }
}

module.exports = router;
module.exports.sendTelegramMessage = sendTelegramMessage;
