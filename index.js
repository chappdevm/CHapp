const http = require('http');
const fs = require('fs');
const path = require('path');
const { ERPStore } = require('./server/store');
const { isSupabaseConfigured } = require('./server/supabase');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'object') return Promise.resolve(req.body);
    if (typeof req.body === 'string') {
      if (!req.body.trim()) return Promise.resolve({});
      try {
        return Promise.resolve(JSON.parse(req.body));
      } catch (e) {
        return Promise.reject(new Error('JSON malformado'));
      }
    }
  }

  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 2 * 1024 * 1024) {
        reject(new Error('Payload demasiado grande'));
      }
    });
    req.on('end', () => {
      if (!raw.trim()) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error('JSON malformado'));
      }
    });
    req.on('error', reject);
  });
}

function createHandler(store = new ERPStore(undefined, { useSupabase: isSupabaseConfigured() })) {
  return async function handler(req, res) {
    const rawUrl = req.originalUrl || req.url;
    const parsedUrl = new URL(rawUrl, 'http://localhost');
    let pathname = decodeURI(parsedUrl.pathname);
    if (pathname === '/api/index.js' && req.headers && req.headers['x-matched-path']) {
      pathname = decodeURI(new URL(req.headers['x-matched-path'], 'http://localhost').pathname);
    }
    const method = req.method.toUpperCase();

    if (pathname.startsWith('/api/')) {
      try {
        if (store.ensureSynced) {
          await store.ensureSynced();
        }

        if (method === 'GET' && pathname === '/api/bootstrap') {
          if (store.syncFromSupabaseIfAvailable) {
            await store.syncFromSupabaseIfAvailable();
          }
          return sendJson(res, 200, { ok: true, data: store.getBootstrapState() });
        }

        if (method === 'POST' && pathname === '/api/reset') {
          const data = await store.reset();
          return sendJson(res, 200, { ok: true, data });
        }

        // Contacts
        if (method === 'POST' && pathname === '/api/contacts') {
          const body = await readJsonBody(req);
          const contact = await store.saveContact(body);
          return sendJson(res, 200, { ok: true, contact, state: store.getBootstrapState() });
        }

        const contactDelMatch = pathname.match(/^\/api\/contacts\/(\d+)$/);
        if (method === 'DELETE' && contactDelMatch) {
          const removed = await store.deleteContact(Number(contactDelMatch[1]));
          return sendJson(res, 200, { ok: true, removed, state: store.getBootstrapState() });
        }

        // Products
        if (method === 'POST' && pathname === '/api/products') {
          const body = await readJsonBody(req);
          const product = await store.saveProduct(body);
          return sendJson(res, 200, { ok: true, product, state: store.getBootstrapState() });
        }

        // Expenses
        if (method === 'POST' && pathname === '/api/expenses') {
          const body = await readJsonBody(req);
          const expense = await store.saveExpense(body);
          return sendJson(res, 200, { ok: true, expense, state: store.getBootstrapState() });
        }

        const expActionMatch = pathname.match(/^\/api\/expenses\/(\d+)\/action$/);
        if (method === 'POST' && expActionMatch) {
          const body = await readJsonBody(req);
          const expense = await store.transitionExpense(Number(expActionMatch[1]), body.action, body);
          return sendJson(res, 200, { ok: true, expense, state: store.getBootstrapState() });
        }

        // Sales
        if (method === 'POST' && pathname === '/api/sales') {
          const body = await readJsonBody(req);
          const order = await store.saveSaleOrder(body);
          return sendJson(res, 200, { ok: true, order, state: store.getBootstrapState() });
        }

        const saleActionMatch = pathname.match(/^\/api\/sales\/(\d+)\/action$/);
        if (method === 'POST' && saleActionMatch) {
          const body = await readJsonBody(req);
          const result = await store.transitionSaleOrder(Number(saleActionMatch[1]), body.action);
          return sendJson(res, 200, { ok: true, ...result, state: store.getBootstrapState() });
        }

        // Accounting Moves
        if (method === 'POST' && pathname === '/api/accounting/moves') {
          const body = await readJsonBody(req);
          const move = await store.saveAccountMove(body);
          return sendJson(res, 200, { ok: true, move, state: store.getBootstrapState() });
        }

        const moveActionMatch = pathname.match(/^\/api\/accounting\/moves\/(\d+)\/action$/);
        if (method === 'POST' && moveActionMatch) {
          const body = await readJsonBody(req);
          const move = await store.transitionAccountMove(Number(moveActionMatch[1]), body.action, body);
          return sendJson(res, 200, { ok: true, move, state: store.getBootstrapState() });
        }

        // Accounting Accounts
        if (method === 'POST' && pathname === '/api/accounting/accounts') {
          const body = await readJsonBody(req);
          const account = await store.saveAccount(body);
          return sendJson(res, 200, { ok: true, account, state: store.getBootstrapState() });
        }

        // Settings
        if (method === 'POST' && pathname === '/api/settings') {
          const body = await readJsonBody(req);
          const settings = await store.saveSettings(body);
          return sendJson(res, 200, { ok: true, settings, state: store.getBootstrapState() });
        }

        // Chatter notes
        if (method === 'POST' && pathname === '/api/chatter') {
          const body = await readJsonBody(req);
          const record = await store.addChatterNote(body.model, body.id, body.text);
          return sendJson(res, 200, { ok: true, record, state: store.getBootstrapState() });
        }

        return sendJson(res, 404, { ok: false, error: 'Endpoint API no encontrado: ' + pathname });
      } catch (err) {
        console.error(`[API Error] ${method} ${pathname}:`, err.message || err);
        return sendJson(res, 400, { ok: false, error: err.message || 'Error en la operación' });
      }
    }

    // Static files
    let reqPath = pathname === '/' || !pathname ? '/index.html' : pathname;
    const normalizedPath = path.normalize(path.join(ROOT_DIR, reqPath));
    if (!normalizedPath.startsWith(ROOT_DIR)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('403 - Forbidden');
      return;
    }

    const ext = path.extname(normalizedPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(normalizedPath, (err, content) => {
      if (err) {
        if (err.code === 'ENOENT' && !reqPath.startsWith('/assets/')) {
          fs.readFile(path.join(ROOT_DIR, 'index.html'), (err2, indexContent) => {
            if (!err2) {
              res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
              res.end(indexContent);
              return;
            }
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404 - Not Found');
          });
          return;
        }
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 - Not Found: ' + reqPath);
      } else {
        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': 'no-cache'
        });
        res.end(content);
      }
    });
  };
}

function createAppServer(dbPath, options) {
  const isTestPath = typeof dbPath === 'string' && dbPath.includes('chapp_erp_test_');
  const defaultOpts = isTestPath ? {} : { useSupabase: isSupabaseConfigured() };
  const store = new ERPStore(dbPath, options || defaultOpts);
  const handler = createHandler(store);
  return http.createServer(handler);
}

if (require.main === module) {
  const server = createAppServer(undefined, { useSupabase: isSupabaseConfigured() });
  server.listen(PORT, () => {
    const { getSupabaseConfig } = require('./server/supabase');
    const supa = getSupabaseConfig();
    console.log('====================================================');
    console.log('  CHapp ERP — Basado en Odoo 20 Enterprise');
    console.log(`  URL: http://localhost:${PORT}`);
    console.log(`  Supabase: ${supa.enabled ? 'CONECTADO (' + (supa.isServiceRole ? 'service_role' : 'anon/público') + ')' : 'DESACTIVADO (almacenamiento local)'}`);
    if (supa.enabled && !supa.isServiceRole) {
      console.warn('  [AVISO] Supabase configurado con clave anon. Para evitar restricciones RLS, configure SUPABASE_SERVICE_ROLE_KEY.');
    }
    console.log('====================================================');
  });
}

module.exports = { createAppServer, createHandler, readJsonBody };
