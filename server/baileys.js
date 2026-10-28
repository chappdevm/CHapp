const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const pino = require('pino');

let makeWASocket, DisconnectReason, useMultiFileAuthState, Browsers;
try {
  const baileys = require('@whiskeysockets/baileys');
  makeWASocket = baileys.default || baileys.makeWASocket;
  DisconnectReason = baileys.DisconnectReason;
  useMultiFileAuthState = baileys.useMultiFileAuthState;
  Browsers = baileys.Browsers;
} catch (err) {
  console.warn('[Baileys] Módulo @whiskeysockets/baileys no disponible:', err.message);
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
    this.authDir = path.join(process.cwd(), 'baileys_auth_info');
  }

  getStatus() {
    return {
      status: this.status,
      connectedNumber: this.connectedNumber,
      tieneQr: Boolean(this.qrDataUrl),
      qrDataUrl: this.qrDataUrl
    };
  }

  async init() {
    if (!makeWASocket || !useMultiFileAuthState) {
      throw new Error('La librería Baileys no está instalada.');
    }

    if (this.isStarting) {
      return this.getStatus();
    }
    if (this.status === 'CONECTADO' && this.socket) {
      return this.getStatus();
    }

    this.isStarting = true;
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

    try {
      if (!fs.existsSync(this.authDir)) {
        fs.mkdirSync(this.authDir, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);

      this.status = 'CONECTANDO';

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
          } catch (qrErr) {
            console.error('[Baileys] Error renderizando QR en base64:', qrErr);
          }
        }

        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason?.loggedOut;
          console.log(`[Baileys] 🔌 Conexión cerrada (código: ${statusCode}). Reintentar: ${shouldReconnect}`);

          this.socket = null;
          this.qrRaw = null;
          this.qrDataUrl = null;

          if (shouldReconnect) {
            this.status = 'CONECTANDO';
            this.reconnectTimeout = setTimeout(() => {
              this.isStarting = false;
              this.init().catch((e) => console.error('[Baileys] Error reintentando conexión:', e));
            }, 3500);
          } else {
            this.status = 'DESCONECTADO';
            this.connectedNumber = null;
            try {
              fs.rmSync(this.authDir, { recursive: true, force: true });
            } catch (rmErr) {}
          }
        } else if (connection === 'open') {
          this.status = 'CONECTADO';
          this.qrRaw = null;
          this.qrDataUrl = null;
          const userJid = sock.user?.id || '';
          this.connectedNumber = userJid.split(':')[0].replace(/\D/g, '');
          console.log(`[Baileys] ✅ WhatsApp conectado exitosamente como: +${this.connectedNumber}`);
        }
      });

      this.isStarting = false;
      return this.getStatus();
    } catch (err) {
      this.isStarting = false;
      this.status = 'DESCONECTADO';
      console.error('[Baileys] Error inicializando socket:', err);
      throw err;
    }
  }

  async disconnect() {
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
    this.status = 'DESCONECTADO';
    this.qrRaw = null;
    this.qrDataUrl = null;
    this.connectedNumber = null;
    try {
      fs.rmSync(this.authDir, { recursive: true, force: true });
    } catch (e) {}
    return { ok: true, status: 'DESCONECTADO' };
  }

  async sendPdf(phone, pdfInput, filename = 'documento.pdf', caption = '') {
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

    let buffer;
    if (Buffer.isBuffer(pdfInput)) {
      buffer = pdfInput;
    } else if (typeof pdfInput === 'string') {
      const base64Data = pdfInput.replace(/^data:application\/pdf;base64,/, '');
      buffer = Buffer.from(base64Data, 'base64');
    } else {
      throw new Error('Formato de PDF inválido para enviar.');
    }

    try {
      // Simular breve presencia de envío
      try {
        await this.socket.sendPresenceUpdate('composing', jid);
      } catch (e) {}

      const msg = await this.socket.sendMessage(jid, {
        document: buffer,
        mimetype: 'application/pdf',
        fileName: filename,
        caption: caption || ''
      });

      try {
        await this.socket.sendPresenceUpdate('paused', jid);
      } catch (e) {}

      return {
        ok: true,
        to: clean,
        messageId: msg?.key?.id,
        filename
      };
    } catch (err) {
      console.error('[Baileys] Error enviando PDF a ' + jid + ':', err);
      throw new Error('Error enviando documento por WhatsApp: ' + (err.message || String(err)));
    }
  }
}

const baileysManager = new BaileysManager();

module.exports = {
  baileysManager,
  BaileysManager
};
