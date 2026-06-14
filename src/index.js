require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');

const { pool, initDB } = require('./db');
const projectsRouter = require('./routes/projects');
const airdropsRouter = require('./routes/airdrops');
const webhooksRouter = require('./routes/webhooks');
const { snapshotAllProjects, checkMilestones } = require('./jobs/snapshots');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

app.use('/api/projects', projectsRouter);
app.use('/api/airdrops', airdropsRouter);
app.use('/webhooks', webhooksRouter);

cron.schedule('0 * * * *', async () => {
  console.log('[cron] Running holder snapshot...');
  await snapshotAllProjects();
  await checkMilestones();
});

async function start() {
  await initDB();
  app.listen(PORT, () => {
    console.log(`TOKEN OS backend running on port ${PORT}`);
  });
}

start().catch(console.error);
