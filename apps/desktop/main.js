const { app, BrowserWindow, Tray, Menu, nativeImage } = require('electron');

const isDev = !app.isPackaged && process.env.GROK_BOT_DESKTOP_PROD !== '1';
const DEV_URL = process.env.GROK_BOT_DEV_URL || 'http://127.0.0.1:43123';
const PROD_URL = process.env.GROK_BOT_PROD_URL || 'http://127.0.0.1:8787';

let mainWindow = null;
let tray = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'GPT-6-ASTRA',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const url = isDev ? DEV_URL : PROD_URL;
  mainWindow.loadURL(url).catch((err) => {
    console.error('Failed to load', url, err);
    mainWindow.loadURL(
      'data:text/html,<h1>GPT-6-ASTRA</h1><p>Start the server first: <code>npm run dev</code></p>'
    );
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  try {
    const img = nativeImage.createEmpty();
    tray = new Tray(img);
    tray.setToolTip('GPT-6-ASTRA');
    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: 'Show',
          click: () => {
            if (mainWindow) mainWindow.show();
            else createWindow();
          },
        },
        { type: 'separator' },
        { label: 'Quit', click: () => app.quit() },
      ])
    );
  } catch (e) {
    console.warn('Tray unavailable:', e.message);
  }
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
