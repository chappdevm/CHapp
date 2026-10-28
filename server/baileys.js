const path = require('path');
const fs = require('fs');
const os = require('os');
const QRCode = require('qrcode');
const pino = require('pino');
const {
  saveWhatsAppSession,
  loadWhatsAppSession,
  deleteWhatsAppSession
} = require('./supabase');

let makeWASocket, DisconnectReason, useMultiFileAuthState, Browsers;
let baileysLoadError = null;

async function loadBaileys() {
  if (makeWASocket && useMultiFileAuthState) {
    return true;
  }
  try {
    const baileys = await import('@whiskeysockets/baileys');
    makeWASocket = baileys.default || baileys.makeWASocket;
    DisconnectReason = baileys.DisconnectReason;
    useMultiFileAuthState = baileys.useMultiFileAuthState;
    Browsers = baileys.Browsers;
    baileysLoadError = null;
    return true;
  } catch (err1) {
    try {
      const baileys = require('@whiskeysockets/baileys');
      makeWASocket = baileys.default || baileys.makeWASocket;
      DisconnectReason = baileys.DisconnectReason;
      useMultiFileAuthState = baileys.useMultiFileAuthState;
      Browsers = baileys.Browsers;
      baileysLoadError = null;
      return true;
    } catch (err2) {
      baileysLoadError = err1 || err2;
      console.warn('[Baileys] Error cargando @whiskeysockets/baileys:', (err1 && err1.message) || (err2 && err2.message));
      return false;
    }
  }
}

// Intentar carga síncrona inmediata si el entorno lo soporta
try {
  const baileys = require('@whiskeysockets/baileys');
  makeWASocket = baileys.default || baileys.makeWASocket;
  DisconnectReason = baileys.DisconnectReason;
  useMultiFileAuthState = baileys.useMultiFileAuthState;
  Browsers = baileys.Browsers;
} catch (e) {
  // ESM en Node requiere dynamic import(), se resuelve con loadBaileys()
}

loadBaileys().catch(() => {});

function parsePdfBuffer(pdfInput) {
  if (Buffer.isBuffer(pdfInput)) {
    return pdfInput;
  }
  if (typeof pdfInput === 'string') {
    let clean = pdfInput.trim();
    // jsPDF output('datauristring') format: "data:application/pdf;filename=...;base64,JVBER..."
    // Standard data URI format: "data:application/pdf;base64,JVBER..."
    if (clean.includes(';base64,')) {
      clean = clean.split(';base64,').pop();
    } else if (clean.startsWith('data:')) {
      clean = clean.replace(/^data:[^,]+,/, '');
    }
    clean = clean.replace(/\s+/g, '');
    const buf = Buffer.from(clean, 'base64');
    return buf;
  }
  throw new Error('Formato de PDF inválido para enviar.');
}

class BaileysManager {
  constructor() {
    this.socket = null;
    this.status = 'DESCONECTADO'; // 'DESCONECTADO' | 'ESPERANDO_QR' | 'CONECTANDO' | 'CONECTADO'
    this.qrRaw = null;
    this.qrDataUrl = null;
    this.connectedNumber = null;
    this.isStarting = false;
    this.reconnectTimeout = null;
    this.saveDebounceTimeout = null;
    this.authDir = this.resolveAuthDir();
  }

  resolveAuthDir() {
    const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);
    const baseDir = isServerless ? os.tmpdir() : process.cwd();
    let authDir = path.join(baseDir, 'baileys_auth_info');
    try {
      if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
      }
    } catch (e) {
      authDir = path.join(os.tmpdir(), 'baileys_auth_info');
      try {
        if (!fs.existsSync(authDir)) {
          fs.mkdirSync(authDir, { recursive: true });
        }
      } catch (e2) {}
    }
    return authDir;
  }

  backupAuthFiles() {
    try {
      if (!fs.existsSync(this.authDir)) return null;
      const entries = fs.readdirSync(this.authDir);
      const files = {};
      for (const file of entries) {
        if (file.endsWith('.json')) {
          const fullPath = path.join(this.authDir, file);
          try {
            files[file] = fs.readFileSync(fullPath, 'utf8');
          } catch (e) {}
        }
      }
      if (!files['creds.json']) return null;
      return files;
    } catch (err) {
      console.warn('[Baileys] Error leyendo authDir para backup:', err.message);
      return null;
    }
  }

  restoreAuthFiles(files) {
    try {
      if (!files || typeof files !== 'object' || !files['creds.json']) return false;
      if (!fs.existsSync(this.authDir)) {
        fs.mkdirSync(this.authDir, { recursive: true });
      }
      for (const [file, content] of Object.entries(files)) {
        if (typeof content === 'string' && file.endsWith('.json')) {
          const fullPath = path.join(this.authDir, file);
          fs.writeFileSync(fullPath, content, 'utf8');
        }
      }
      return true;
    } catch (err) {
      console.warn('[Baileys] Error restaurando authDir desde backup:', err.message);
      return false;
    }
  }

  async persistSession() {
    const files = this.backupAuthFiles();
    if (!files || !files['creds.json']) return false;
    try {
      const ok = await saveWhatsAppSession({
        connectedNumber: this.connectedNumber,
        files,
        savedAt: new Date().toISOString()
      });
      if (ok) {
        console.log(`[Baileys] 💾 Sesión guardada de forma persistente (+${this.connectedNumber || 'OK'}).`);
      }
      return ok;
    } catch (err) {
      console.warn('[Baileys] Error persistiendo sesión en Supabase:', err.message);
      return false;
    }
  }

  async restoreSessionFromRemote() {
    const localCreds = path.join(this.authDir, 'creds.json');
    if (fs.existsSync(localCreds)) {
      try {
        const raw = fs.readFileSync(localCreds, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed?.me?.id) {
          this.connectedNumber = parsed.me.id.split(':')[0].replace(/\D/g, '');
        }
        return true;
      } catch (e) {}
    }

    try {
      const remoteSession = await loadWhatsAppSession();
      if (remoteSession && remoteSession.files && remoteSession.files['creds.json']) {
        const restored = this.restoreAuthFiles(remoteSession.files);
        if (restored) {
          if (remoteSession.connectedNumber) {
            this.connectedNumber = remoteSession.connectedNumber;
          }
          console.log(`[Baileys] 🔄 Sesión restaurada de la base de datos (+${this.connectedNumber || ''}).`);
          return true;
        }
      }
    } catch (err) {
      console.warn('[Baileys] Error cargando sesión remota:', err.message);
    }
    return false;
  }

  async clearSavedSession() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.saveDebounceTimeout) {
      clearTimeout(this.saveDebounceTimeout);
      this.saveDebounceTimeout = null;
    }
    if (this.socket) {
      try {
        this.socket.ev.removeAllListeners('connection.update');
        this.socket.ev.removeAllListeners('creds.update');
        this.socket.end(undefined);
      } catch (e) {}
      this.socket = null;
    }

    // 1. Limpiar directorio local
    try {
      if (fs.existsSync(this.authDir)) {
        fs.rmSync(this.authDir, { recursive: true, force: true });
      }
    } catch (e) {}

    // 2. Limpiar sesión en Supabase
    try {
      await deleteWhatsAppSession();
    } catch (e) {}

    // 3. Resetear memoria
    this.status = 'DESCONECTADO';
    this.connectedNumber = null;
    this.qrRaw = null;
    this.qrDataUrl = null;
    this.isStarting = false;
    console.log('[Baileys] 🗑️ Sesión desvinculada y limpiada tanto local como remotamente.');
  }

  getStatus() {
    return {
      status: this.status,
      connectedNumber: this.connectedNumber,
      tieneQr: Boolean(this.qrDataUrl),
      qrDataUrl: this.qrDataUrl,
      baileysAvailable: Boolean(makeWASocket && useMultiFileAuthState),
      loadError: baileysLoadError ? baileysLoadError.message : null
    };
  }

  async init(waitForQrMs = 8000) {
    await loadBaileys();
    if (!makeWASocket || !useMultiFileAuthState) {
      const detail = baileysLoadError ? `: ${baileysLoadError.message}` : '';
      throw new Error(`La librería Baileys no está disponible en este servidor${detail}.`);
    }

    if (this.status === 'CONECTADO' && this.socket) {
      return this.getStatus();
    }
    if (this.status === 'ESPERANDO_QR' && this.qrDataUrl && this.socket) {
      return this.getStatus();
    }

    this.authDir = this.resolveAuthDir();

    // Intentar restaurar sesión de Supabase si en este contenedor aún no existe
    await this.restoreSessionFromRemote();

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.socket) {
      try {
        this.socket.ev.removeAllListeners('connection.update');
        this.socket.ev.removeAllListeners('creds.update');
        this.socket.end(undefined);
      } catch (e) {}
      this.socket = null;
    }

    this.isStarting = true;
    this.status = 'CONECTANDO';

    return new Promise(async (resolve) => {
      let settled = false;
      const finish = () => {
        if (!settled) {
          settled = true;
          this.isStarting = false;
          resolve(this.getStatus());
        }
      };

      const timer = setTimeout(() => {
        finish();
      }, waitForQrMs);

      try {
        const { state, saveCreds } = await useMultiFileAuthState(this.authDir);

        const sock = makeWASocket({
          auth: state,
          logger: pino({ level: 'silent' }),
          browser: Browsers ? Browsers.windows('Desktop') : ['CHapp ERP', 'Desktop', '1.0.0'],
          syncFullHistory: false,
          shouldSyncHistoryMessage: () => false,
          markOnlineOnConnect: false,
          generateHighQualityLinkPreview: false,
          defaultQueryTimeoutMs: 60000,
          keepAliveIntervalMs: 25000,
          emitOwnEvents: false,
          retryRequestDelayMs: 250
        });

        this.socket = sock;

        sock.ev.on('creds.update', async () => {
          try {
            await saveCreds();
            // Guardar credenciales de forma persistente con debounce
            if (this.saveDebounceTimeout) clearTimeout(this.saveDebounceTimeout);
            this.saveDebounceTimeout = setTimeout(() => {
              this.persistSession().catch(() => {});
            }, 1500);
          } catch (err) {
            console.error('[Baileys] Error guardando credenciales:', err.message);
          }
        });

        sock.ev.on('connection.update', async (update) => {
          const { connection, lastDisconnect, qr } = update;

          if (qr) {
            this.qrRaw = qr;
            try {
              this.qrDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 6 });
              this.status = 'ESPERANDO_QR';
              console.log('[Baileys] 📱 Nuevo código QR generado para vinculación.');
              clearTimeout(timer);
              finish();
            } catch (qrErr) {
              console.error('[Baileys] Error renderizando QR en base64:', qrErr);
            }
          }

          if (connection === 'open') {
            this.status = 'CONECTADO';
            this.qrRaw = null;
            this.qrDataUrl = null;
            const userJid = sock.user?.id || '';
            this.connectedNumber = userJid.split(':')[0].replace(/\D/g, '');
            console.log(`[Baileys] ✅ WhatsApp conectado exitosamente como: +${this.connectedNumber}`);
            clearTimeout(timer);
            await this.persistSession();
            finish();
          }

          if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const isLoggedOut = statusCode === DisconnectReason?.loggedOut || statusCode === 401 || statusCode === 403;
            const shouldReconnect = statusCode !== DisconnectReason?.loggedOut && !isLoggedOut;
            console.log(`[Baileys] 🔌 Conexión cerrada (código: ${statusCode}). Reintentar: ${shouldReconnect}`);

            this.socket = null;
            this.qrRaw = null;
            this.qrDataUrl = null;

            if (shouldReconnect) {
              this.status = 'CONECTANDO';
              this.reconnectTimeout = setTimeout(() => {
                this.isStarting = false;
                this.init(5000).catch((e) => console.error('[Baileys] Error reintentando conexión:', e));
              }, 3500);
            } else {
              // Si se desvinculó (logout / teléfono anterior), limpiar local y remoto
              await this.clearSavedSession();
            }
          }
        });
      } catch (err) {
        clearTimeout(timer);
        this.status = 'DESCONECTADO';
        console.error('[Baileys] Error inicializando socket:', err);
        finish();
      }
    });
  }

  async disconnect() {
    await this.clearSavedSession();
    return { ok: true, status: 'DESCONECTADO' };
  }

  async sendPdf(phone, pdfInput, filename = 'documento.pdf', caption = '') {
    await loadBaileys();
    if (!this.socket || this.status !== 'CONECTADO') {
      throw new Error('WhatsApp de la compañía no está conectado. Por favor vincule el dispositivo escaneando el código QR.');
    }

    let clean = String(phone || '').replace(/\D/g, '');
    if (!clean) {
      throw new Error('El contacto no tiene un número celular válido.');
    }

    // Formateo celular Colombia: 10 dígitos iniciando en 3 -> 573XXXXXXXXX
    if (clean.length === 10 && clean.startsWith('3')) {
      clean = '57' + clean;
    }

    const jid = `${clean}@s.whatsapp.net`;
    const buffer = parsePdfBuffer(pdfInput);

    let finalFilename = filename || 'documento.pdf';
    if (!finalFilename.toLowerCase().endsWith('.pdf')) {
      finalFilename += '.pdf';
    }

    try {
      try {
        await this.socket.sendPresenceUpdate('composing', jid);
      } catch (e) {}

      const msg = await this.socket.sendMessage(jid, {
        document: buffer,
        mimetype: 'application/pdf',
        fileName: finalFilename,
        caption: caption || ''
      });

      try {
        await this.socket.sendPresenceUpdate('paused', jid);
      } catch (e) {}

      return {
        ok: true,
        to: clean,
        messageId: msg?.key?.id,
        filename: finalFilename
      };
    } catch (err) {
      console.error('[Baileys] Error enviando PDF a ' + jid + ':', err);
      throw new Error('Error enviando documento por WhatsApp: ' + (err.message || String(err)));
    }
  }
}

const baileysManager = new BaileysManager();

// Intentar restaurar sesión guardada de forma asíncrona al iniciar
baileysManager.restoreSessionFromRemote().catch(() => {});

module.exports = {
  baileysManager,
  BaileysManager,
  parsePdfBuffer
};
