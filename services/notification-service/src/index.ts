/**
 * notification-service — mock email/SMS sender. Logs the would-be notification
 * and returns a synthetic message id. Healthcheck has a delay knob to add
 * variety to the dashboard.
 */
import './tracing.js';
import Fastify from 'fastify';
import pino from 'pino';

const log = pino({ name: 'notification-service' });
const app = Fastify({ loggerInstance: log });

app.get('/healthz', async () => ({ status: 'ok' }));
app.get('/readyz',  async () => {
  const delay = Number(process.env.READY_DELAY_MS ?? 0);
  if (delay > 0) await new Promise((r) => setTimeout(r, delay));
  return { status: 'ready' };
});

interface NotifyBody {
  channel: 'email' | 'sms';
  to: string;
  subject?: string;
  body: string;
}

app.post<{ Body: NotifyBody }>('/notify', async (req, reply) => {
  const { channel, to, body } = req.body ?? {} as NotifyBody;
  if (!channel || !to || !body) {
    reply.status(400);
    return { error: 'channel, to, body required' };
  }
  const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  log.info({ id, channel, to_redacted: redact(to), bytes: body.length }, 'notification queued');
  return { id, status: 'queued' };
});

function redact(s: string): string {
  if (s.includes('@')) {
    const [u, d] = s.split('@');
    return `${u.slice(0, 2)}***@${d}`;
  }
  return s.length > 4 ? '***' + s.slice(-4) : '***';
}

const port = Number(process.env.PORT ?? 8080);
app.listen({ host: '0.0.0.0', port }).then(() => log.info({ port }, 'notification-service up'));
