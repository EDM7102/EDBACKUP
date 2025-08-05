// server.js (Finale Version mit moderner 'import'-Syntax)

import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch'; // Import von node-fetch
import bodyParser from 'body-parser';
import axios from 'axios';

const app = express();
const PORT = process.env.PORT || 3000;

// === HIER DEIN TELEGRAM BOT TOKEN UND CHAT ID EINTRAGEN ===
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Notwendiger Workaround, um __dirname in ES-Modulen zu erhalten
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Security headers
app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' https://images.steamusercontent.com https://formspree.io; connect-src 'self' https://formspree.io https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com;");
    next();
});

app.use(bodyParser.urlencoded({ extended: false }));

// Statische Dateien aus dem 'public'-Ordner bereitstellen
app.use(express.static(path.join(__dirname, 'public')));

// === BESUCHERZÄHLER-LOGIK ===
const COUNTER_FILE = path.join(__dirname, "counter.txt");
const countedIPs = new Set();
// ... (Die Counter-Funktionen bleiben hier gleich)
function anonymizeIP(ip) {
    if (!ip) return null;
    if (ip.includes('.')) return ip.split('.').slice(0, 3).join('.') + '.0';
    if (ip.includes(':')) return ip.split(':').slice(0, 4).join(':') + '::';
    return ip;
}
function readCounter() {
  try {
    return parseInt(fs.readFileSync(COUNTER_FILE, "utf8"), 10) || 0;
  } catch (e) {
    return 0;
  }
}
function writeCounter(count) {
  fs.writeFileSync(COUNTER_FILE, String(count), "utf8");
}
app.get("/counter", (req, res) => {
  const rawIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.connection.remoteAddress || req.ip;
  const anonymizedIP = anonymizeIP(rawIP);
  if (!anonymizedIP) {
    let count = readCounter();
    res.json({ count });
    return;
  }
  if (countedIPs.has(anonymizedIP)) {
    let count = readCounter();
    res.json({ count });
    return;
  }
  countedIPs.add(anonymizedIP);
  let count = readCounter();
  count++;
  writeCounter(count);
  console.log(`Visitor counted: ${anonymizedIP} (Total: ${count})`);
  res.json({ count });
});
app.get("/get-count", (req, res) => {
    let count = readCounter();
    res.json({ count });
});


// === TELEGRAM-BENACHRICHTIGUNGS-LOGIK ===
app.get('/api/notify', async (req, res) => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!botToken || !chatId) {
        return res.status(500).json({ error: 'Server-Konfigurationsfehler' });
    }
    const message = '🚀 Ein neuer Besucher ist auf der F1 Webseite gelandet!';
    const apiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const params = new URLSearchParams({ chat_id: chatId, text: message });
    try {
        await fetch(apiUrl, { method: 'POST', body: params });
        res.status(200).json({ status: 'Nachricht gesendet' });
    } catch (error) {
        console.error('Telegram API Error (notify):', error);
        res.status(500).json({ status: 'Fehler beim Senden' });
    }
});

app.get('/api/order-click', async (req, res) => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!botToken || !chatId) {
        return res.status(500).json({ error: 'Server-Konfigurationsfehler' });
    }
    const message = '💰 Jemand hat auf "Order Now" geklickt! Potenzieller Verkauf!';
    const apiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const params = new URLSearchParams({ chat_id: chatId, text: message, parse_mode: 'HTML' });
    try {
        await fetch(apiUrl, { method: 'POST', body: params });
        res.status(200).json({ status: 'Order-Klick-Nachricht gesendet' });
    } catch (error) {
        console.error('Telegram API Error (Order-Klick):', error);
        res.status(500).json({ status: 'Fehler beim Senden des Order-Klicks' });
    }
});

app.get('/api/track-click', async (req, res) => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const type = req.query.type || 'unbekannt';
    if (!botToken || !chatId) {
        return res.status(500).json({ error: 'Server-Konfigurationsfehler' });
    }
    let message = '';
    switch(type) {
        case 'Download PDF':
            message = '📄 Jemand hat den PDF-Download genutzt!';
            break;
        case 'Order Now':
            message = '💰 Jemand hat auf "Order Now" (PayPal) geklickt!';
            break;
        case 'Contact Form':
            message = '✉️ Jemand hat das Kontaktformular abgeschickt!';
            break;
        case 'Community Form':
            message = '🗳️ Jemand hat das Community-Formular abgeschickt!';
            break;
        case 'Wishlist Form':
            message = '⭐️ Jemand hat das Wishlist-Formular abgeschickt!';
            break;
        case 'BoardGameGeek Button':
            message = '🌐 Jemand hat auf den BoardGameGeek-Button geklickt!';
            break;
        default:
            if(type.startsWith('Gallery Image')) {
                message = `🖼️ Jemand hat auf ein Galerie-Bild geklickt (${type.replace('Gallery Image', 'Bild')})!`;
            } else if (type.startsWith('FAQ:')) {
                message = `❓ Jemand hat auf eine FAQ-Frage geklickt: "${type.substring(5)}"`;
            } else {
                message = `🚀 Ein neuer Besucher ist auf der F1 Webseite gelandet!: ${type}`;
            }
    }
    const apiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const params = new URLSearchParams({ chat_id: chatId, text: message });
    try {
        await fetch(apiUrl, { method: 'POST', body: params });
        res.status(200).json({ status: 'Klick-Nachricht gesendet' });
    } catch (error) {
        res.status(500).json({ status: 'Fehler beim Senden' });
    }
});

app.post('/vote', async (req, res) => {
  const { decade, year } = req.body;
  const message = `Neue Abstimmung:\nDecade: ${decade}\nYear: ${year}`;
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
    });
    res.status(200).send('OK');
  } catch (err) {
    res.status(500).send('Telegram error');
  }
});

// Server starten
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
