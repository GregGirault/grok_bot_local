const path = require('path');
const { app, BrowserWindow, Tray, Menu, nativeImage } = require('electron');

const isDev = !app.isPackaged && process.env.GROK_BOT_DESKTOP_PROD !== '1';
const DEV_URL = process.env.GROK_BOT_DEV_URL || 'http://127.0.0.1:48731';
const PROD_URL = process.env.GROK_BOT_PROD_URL || 'http://127.0.0.1:48732';

let mainWindow = null;
let tray = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Grok Bot',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  const url = isDev ? DEV_URL : PROD_URL;
  mainWindow.loadURL(url).catch(() => {
    mainWindow.loadURL(
      'data:text/html,<h1>Grok Bot</h1><p>Lance d’abord <code>npm run dev</code>.</p>'
    );
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  try {
    tray = new Tray(nativeImage.createEmpty());
    tray.setToolTip('Grok Bot');
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: 'Afficher', click: () => (mainWindow ? mainWindow.show() : createWindow()) },
        { type: 'separator' },
        { label: 'Quitter', click: () => app.quit() },
      ])
    );
  } catch {
    /* pas de plateau */
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
