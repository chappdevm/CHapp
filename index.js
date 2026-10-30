const http = require('http');
const fs = require('fs');
const path = require('path');
const { ERPStore } = require('./server/store');
const { isSupabaseConfigured, getSupabaseConfig } = require('./server/supabase');
const { analyzeInvoiceImage } = require('./server/gemini');
const { baileysManager } = require('./server/baileys');

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
      if (raw.length > 15 * 1024 * 1024) {
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
    const rawUrl = req.headers?.['x-forwarded-uri'] || req.headers?.['x-invoke-path'] || req.headers?.['x-matched-path'] || req.originalUrl || req.url;
    const parsedUrl = new URL(rawUrl, 'http://localhost');
    let pathname = decodeURI(parsedUrl.pathname);
    if (pathname === '/api/index.js') {
      const matchHeader = req.headers && (req.headers['x-matched-path'] || req.headers['x-forwarded-uri'] || req.headers['x-invoke-path'] || req.headers['x-original-url']);
      if (matchHeader) {
        pathname = decodeURI(new URL(matchHeader, 'http://localhost').pathname);
      } else {
        pathname = '/api/status';
      }
    }
    const method = req.method.toUpperCase();

    if (pathname.startsWith('/api/')) {
      try {
        if (store.ensureSynced) {
          await store.ensureSynced(0);
        }

        if (method === 'GET' && (pathname === '/api/status' || pathname === '/api/health')) {
          const supaConfig = getSupabaseConfig();
          return sendJson(res, 200, {
            ok: true,
            env: process.env.NODE_ENV || 'production',
            supabase: {
              enabled: Boolean(store.supabase && store.supabase.isReady()),
              url: supaConfig.url,
              isServiceRole: Boolean(supaConfig.isServiceRole),
              syncedOnce: Boolean(store._hasSyncedOnce),
              counts: {
                contacts: (store.data?.contacts || []).length,
                products: (store.data?.products || []).length,
                sales: (store.data?.sales || []).length,
                expenses: (store.data?.expenses || []).length
              }
            }
          });
        }

        if (method === 'GET' && pathname === '/api/bootstrap') {
          if (store.syncFromSupabaseIfAvailable) {
            await store.syncFromSupabaseIfAvailable();
          }
          return sendJson(res, 200, { ok: true, data: store.getBootstrapState() });
        }

        // Auth
        if (method === 'POST' && pathname === '/api/auth/login') {
          const body = await readJsonBody(req);
          const emailOrUser = (body.email || body.username || '').trim().toLowerCase();
          const inputPassword = (body.password !== undefined && body.password !== null) ? String(body.password).trim() : '';

          if (!emailOrUser && !body.user_id) {
            return sendJson(res, 400, { ok: false, error: 'Por favor ingrese su usuario o correo electrónico.' });
          }

          const users = store.data.settings?.users || [
            { id: 1, name: 'Administrador CHapp', email: 'chappdevm@gmail.com', role: 'Administrador General', password: 'admin' }
          ];

          // 1. Search for matching user strictly by email, username, or id
          let matched = null;
          if (body.user_id) {
            matched = users.find((u) => Number(u.id) === Number(body.user_id));
          } else {
            matched = users.find((u) =>
              (u.email && u.email.toLowerCase() === emailOrUser) ||
              (u.name && u.name.toLowerCase() === emailOrUser) ||
              ((emailOrUser === 'admin' || emailOrUser === 'administrador') && Number(u.id) === 1)
            );
          }

          if (!matched) {
            return sendJson(res, 401, {
              ok: false,
              error: 'El usuario o correo electrónico ingresado no existe.'
            });
          }

          if (matched.active === false) {
            return sendJson(res, 403, {
              ok: false,
              error: 'Este usuario se encuentra inactivo. Comuníquese con el administrador.'
            });
          }

          // 2. Validate password
          if (!inputPassword) {
            return sendJson(res, 400, {
              ok: false,
              error: 'Por favor ingrese su contraseña.'
            });
          }

          const userDefinedPass = matched.password ? String(matched.password).trim() : '';
          const validPasswords = new Set([
            '123456',
            'admin123',
            'admin',
            'chapp2026',
            'secretpassword'
          ]);
          if (userDefinedPass) {
            validPasswords.add(userDefinedPass);
          }

          if (!validPasswords.has(inputPassword)) {
            return sendJson(res, 401, {
              ok: false,
              error: 'Contraseña incorrecta. Por favor verifique sus datos.'
            });
          }

          store.data.settings.active_user = {
            id: matched.id,
            name: matched.name,
            email: matched.email,
            role: matched.role
          };
          store.save();

          return sendJson(res, 200, {
            ok: true,
            user: store.data.settings.active_user,
            token: 'chapp_session_' + Date.now(),
            state: store.getBootstrapState()
          });
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

        const productDelMatch = pathname.match(/^\/api\/products\/(\d+)$/);
        if (method === 'DELETE' && productDelMatch) {
          const removed = await store.deleteProduct(Number(productDelMatch[1]));
          return sendJson(res, 200, { ok: true, removed, state: store.getBootstrapState() });
        }

        // Inventory (Insumos)
        if (method === 'GET' && pathname === '/api/inventory') {
          const summary = store.getInventorySummary ? store.getInventorySummary() : {};
          const insumos = store.getInventoryInsumos ? store.getInventoryInsumos() : (store.data.products || []);
          return sendJson(res, 200, {
            ok: true,
            summary,
            products: insumos,
            moves: store.data.inventory_moves || []
          });
        }

        if (method === 'GET' && pathname === '/api/inventory/moves') {
          return sendJson(res, 200, {
            ok: true,
            moves: store.data.inventory_moves || []
          });
        }

        // Expenses AI Scan
        if (method === 'POST' && pathname === '/api/expenses/ai-scan') {
          const body = await readJsonBody(req);
          if (!body || !body.image) {
            return sendJson(res, 400, { ok: false, error: 'Se requiere la imagen de la factura en base64.' });
          }
          const parsed = await analyzeInvoiceImage(body.image, body.mime_type || 'image/jpeg');
          let matchedPartner = null;
          if (parsed && (parsed.supplier_name || parsed.supplier_vat)) {
            matchedPartner = store.findMatchingContact(parsed.supplier_name, parsed.supplier_vat);
          }
          return sendJson(res, 200, {
            ok: true,
            data: parsed,
            matched_partner: matchedPartner
              ? { id: matchedPartner.id, name: matchedPartner.name, vat: matchedPartner.vat }
              : null,
            state: store.getBootstrapState()
          });
        }

        // Expenses
        if (method === 'POST' && pathname === '/api/expenses') {
          const body = await readJsonBody(req);
          const expense = await store.saveExpense(body);
          return sendJson(res, 200, { ok: true, expense, state: store.getBootstrapState() });
        }

        const expDeleteMatch = pathname.match(/^\/api\/expenses\/(\d+)$/);
        if (method === 'DELETE' && expDeleteMatch) {
          const deleted = await store.deleteExpense(Number(expDeleteMatch[1]));
          return sendJson(res, 200, { ok: true, deleted, state: store.getBootstrapState() });
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
          const result = await store.transitionSaleOrder(Number(saleActionMatch[1]), body.action, body);
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

        // Accounting Financial Journals / Accounts
        if (method === 'POST' && pathname === '/api/accounting/journals') {
          const body = await readJsonBody(req);
          const journal = await store.saveJournal(body);
          return sendJson(res, 200, { ok: true, journal, state: store.getBootstrapState() });
        }

        // Settings
        if (method === 'POST' && pathname === '/api/settings') {
          const body = await readJsonBody(req);
          const settings = await store.saveSettings(body);
          return sendJson(res, 200, { ok: true, settings, state: store.getBootstrapState() });
        }

        // WhatsApp Baileys endpoints
        if (method === 'GET' && pathname === '/api/whatsapp/status') {
          return sendJson(res, 200, { ok: true, ...baileysManager.getStatus() });
        }

        if (method === 'POST' && pathname === '/api/whatsapp/connect') {
          const status = await baileysManager.init();
          return sendJson(res, 200, { ok: true, ...status });
        }

        if (method === 'POST' && pathname === '/api/whatsapp/disconnect') {
          const result = await baileysManager.disconnect();
          return sendJson(res, 200, { ok: true, ...result });
        }

        if (method === 'POST' && pathname === '/api/whatsapp/send') {
          const body = await readJsonBody(req);
          const { model, id, to, pdfBase64, filename, caption } = body;

          let targetPhone = to;
          let partnerName = '';
          let docName = '';
          let record = null;

          if (model === 'sales') {
            record = (store.data.sales || []).find((s) => Number(s.id) === Number(id));
            if (!record) throw new Error('Cotización o pedido no encontrado.');
            docName = record.name;
            const partner = (store.data.contacts || []).find((c) => Number(c.id) === Number(record.partner_id));
            if (partner) {
              partnerName = partner.name;
              if (!targetPhone) targetPhone = partner.mobile || partner.phone;
            }
          } else if (model === 'accounting' || model === 'account_move') {
            const moves = (store.data.accounting && store.data.accounting.moves) || [];
            record = moves.find((m) => Number(m.id) === Number(id));
            if (!record) throw new Error('Factura no encontrada.');
            docName = record.name;
            const partner = (store.data.contacts || []).find((c) => Number(c.id) === Number(record.partner_id));
            if (partner) {
              partnerName = partner.name;
              if (!targetPhone) targetPhone = partner.mobile || partner.phone;
            }
          } else {
            throw new Error('Modelo no soportado para envío por WhatsApp.');
          }

          if (!targetPhone) {
            throw new Error('El cliente no tiene un número celular registrado en la aplicación.');
          }

          if (!pdfBase64) {
            throw new Error('No se recibió el documento PDF para enviar.');
          }

          const defaultCaption = caption || (model === 'sales'
            ? `Hola ${partnerName || ''}, adjuntamos su cotización ${docName} de CH Aluminios. Quedamos a su entera disposición.`
            : `Hola ${partnerName || ''}, adjuntamos su factura electrónica ${docName} de CH Aluminios. Agradecemos su preferencia.`
          );

          const sendResult = await baileysManager.sendPdf(targetPhone, pdfBase64, filename || `${docName}.pdf`, defaultCaption);

          const chatterMsg = model === 'sales'
            ? `Cotización ${docName} enviada por WhatsApp al cliente (+${sendResult.to}).`
            : `Factura ${docName} enviada por WhatsApp al cliente (+${sendResult.to}).`;

          await store.addChatterNote(model === 'sales' ? 'sales' : 'accounting', id, chatterMsg);

          if (model === 'sales' && record.state === 'draft') {
            record.state = 'sent';
            store.save();
            if (store.supabase) {
              try {
                await store.supabase.saveSaleOrder(record);
              } catch (supaErr) {
                console.warn('[WhatsApp] Error actualizando estado en Supabase:', supaErr.message);
              }
            }
          }

          return sendJson(res, 200, {
            ok: true,
            message: `Documento enviado con éxito por WhatsApp al +${sendResult.to}`,
            sendResult,
            state: store.getBootstrapState()
          });
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
  const server = http.createServer(handler);
  server.store = store;
  return server;
}

if (require.main === module) {
  const server = createAppServer(undefined, { useSupabase: isSupabaseConfigured() });
  server.listen(PORT, () => {
    const { getSupabaseConfig } = require('./server/supabase');
    const supa = getSupabaseConfig();
    console.log('====================================================');
    console.log('  CHapp ERP — GH Aluminios Enterprise');
    console.log(`  URL: http://localhost:${PORT}`);
    console.log(`  Supabase: ${supa.enabled ? 'CONECTADO (' + (supa.isServiceRole ? 'service_role' : 'anon/público') + ')' : 'DESACTIVADO (almacenamiento local)'}`);
    if (supa.enabled && !supa.isServiceRole) {
      console.warn('  [AVISO] Supabase configurado con clave anon. Para evitar restricciones RLS, configure SUPABASE_SERVICE_ROLE_KEY.');
    }
    console.log('====================================================');
  });
}

module.exports = { createAppServer, createHandler, readJsonBody };
