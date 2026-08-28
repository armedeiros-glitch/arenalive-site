import assert from 'node:assert/strict';
import fs from 'node:fs';
import { summarizeNotifications } from '../functions/_lib/planet-notifications.js';

const now = Date.now();
const isoAgo = (ms) => new Date(now - ms).toISOString();

const document = {
  revision: 'test',
  updatedAt: isoAgo(60 * 60 * 1000),
  data: [
    {
      id: 'recent-unread',
      type: 'lead.new',
      priority: 'high',
      leadName: 'Lead recente',
      summary: 'Lead recente · Joinville/SC · lead-form',
      createdAt: isoAgo(60 * 60 * 1000),
      updatedAt: isoAgo(60 * 60 * 1000),
      readAt: '',
      resolvedAt: '',
    },
    {
      id: 'old-unread',
      type: 'lead.new',
      priority: 'high',
      leadName: 'Lead antigo',
      summary: 'Lead antigo · Curitiba/PR · lead-form',
      createdAt: isoAgo(72 * 60 * 60 * 1000),
      updatedAt: isoAgo(72 * 60 * 60 * 1000),
      readAt: '',
      resolvedAt: '',
    },
    {
      id: 'recent-read',
      type: 'lead.new',
      priority: 'high',
      leadName: 'Lead lido',
      summary: 'Lead lido · São Paulo/SP · lead-form',
      createdAt: isoAgo(2 * 60 * 60 * 1000),
      updatedAt: isoAgo(2 * 60 * 60 * 1000),
      readAt: isoAgo(30 * 60 * 1000),
      resolvedAt: '',
    },
    {
      id: 'low-signal',
      type: 'lead.updated',
      priority: 'medium',
      leadName: 'Ruído',
      summary: 'Ruído · nome, origem',
      changes: ['nome', 'origem'],
      createdAt: isoAgo(10 * 60 * 1000),
      updatedAt: isoAgo(10 * 60 * 1000),
      readAt: '',
      resolvedAt: '',
    },
  ],
};

const summary = summarizeNotifications(document);
assert.equal(summary.data.length, 3, 'movimentação de baixo sinal deve ficar fora da visão pública');
assert.equal(summary.unread, 2, 'backlog total não deve ser perdido');
assert.equal(summary.unreadRecent, 1, 'badge deve contar apenas não lidas das últimas 24h');

const ui = fs.readFileSync(new URL('../planet-hub/assets/planet-notifications-v1.js', import.meta.url), 'utf8');
assert.match(ui, /state\.unreadRecent/);
assert.match(ui, /badge\.hidden = state\.unreadRecent <= 0/);
assert.match(ui, /Ler todas \(\$\{state\.unread\}\)/);
assert.match(ui, /novas nas últimas 24h/);

console.log('Centro de notificações: backlog total separado do badge recente.');
