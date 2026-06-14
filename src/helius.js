const axios = require('axios');

const HELIUS_KEY = process.env.HELIUS_API_KEY;
const HELIUS_BASE = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`;
const HELIUS_API = `https://api.helius.xyz/v0`;

async function getTokenHolders(mintAddress) {
  let page = 1;
  let allHolders = [];

  while (true) {
    const res = await axios.post(HELIUS_BASE, {
      jsonrpc: '2.0',
      id: 'token-os',
      method: 'getTokenAccounts',
      params: { mint: mintAddress, limit: 1000, page }
    });

    const accounts = res.data?.result?.token_accounts || [];
    if (!accounts.length) break;
    allHolders = allHolders.concat(accounts);
    if (accounts.length < 1000) break;
    page++;
  }

  allHolders.sort((a, b) => Number(b.amount) - Number(a.amount));

  return allHolders.map((h, i) => ({
    rank: i + 1,
    wallet: h.owner,
    amount: h.amount,
    uiAmount: h.amount / 1e6
  }));
}

async function getTokenMetadata(mintAddress) {
  try {
    const res = await axios.post(HELIUS_BASE, {
      jsonrpc: '2.0',
      id: 'token-os',
      method: 'getAsset',
      params: { id: mintAddress }
    });
    const asset = res.data?.result;
    return {
      name: asset?.content?.metadata?.name || 'Unknown',
      symbol: asset?.content?.metadata?.symbol || '???',
      image: asset?.content?.links?.image || null,
      supply: asset?.token_info?.supply || 0,
      decimals: asset?.token_info?.decimals || 6
    };
  } catch {
    return { name: 'Unknown', symbol: '???', image: null, supply: 0, decimals: 6 };
  }
}

async function getTokenPrice(mintAddress) {
  try {
    const res = await axios.get(
      `https://api.jup.ag/price/v2?ids=${mintAddress}`
    );
    return res.data?.data?.[mintAddress]?.price || null;
  } catch {
    return null;
  }
}

async function registerWebhook(mintAddress, webhookUrl) {
  try {
    const res = await axios.post(
      `${HELIUS_API}/webhooks?api-key=${HELIUS_KEY}`,
      {
        webhookURL: webhookUrl,
        transactionTypes: ['TRANSFER'],
        accountAddresses: [mintAddress],
        webhookType: 'enhanced'
      }
    );
    return res.data;
  } catch (e) {
    console.error('[helius] Webhook registration failed:', e.message);
    return null;
  }
}

module.exports = { getTokenHolders, getTokenMetadata, getTokenPrice, registerWebhook };
