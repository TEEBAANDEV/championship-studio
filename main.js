const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

const IMAGES_ROOT = path.join(__dirname, 'imagenes');
const DRIVERS_IMG_DIR = path.join(IMAGES_ROOT, 'pilotos');
const TEAMS_IMG_DIR = path.join(IMAGES_ROOT, 'equipos');

function ensureImageDirectories() {
  try {
    fs.mkdirSync(DRIVERS_IMG_DIR, { recursive: true });
    fs.mkdirSync(TEAMS_IMG_DIR, { recursive: true });
    const readmePath = path.join(IMAGES_ROOT, 'LEEME-IMAGENES.txt');
    if (!fs.existsSync(readmePath)) {
      fs.writeFileSync(
        readmePath,
        [
          '=== CARPETA DE IMÁGENES DE PILOTOS Y ESCUDERÍAS ===',
          '',
          '1. Carpeta "pilotos/":',
          '   Puedes guardar aquí las fotos o cascos de tus pilotos (.png, .jpg, .webp, .svg).',
          '   Si les pones la sigla del piloto (ej: VER.png, LAW.png, ANT.png, COL.png) o su número (ej: 3.png, 30.png),',
          '   el botón "Sincronizar Carpeta de Imágenes" dentro de la app las asignará automáticamente.',
          '',
          '2. Carpeta "equipos/":',
          '   Puedes guardar aquí los logos de las escuderías (.png, .jpg, .webp, .svg).',
          '   Si les pones la sigla del equipo (ej: RBR.png, VRB.png, FER.png, MER.png, MCL.png),',
          '   se vincularán automáticamente al sincronizar, o podrás elegirlas desde la galería dentro de la app.'
        ].join('\r\n'),
        'utf-8'
      );
    }
  } catch (err) {
    console.warn('No se pudieron crear las carpetas de imágenes:', err);
  }
}

function readImagesFromDir(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  const allowedExts = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml'
  };
  const files = fs.readdirSync(dirPath);
  const results = [];
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const mime = allowedExts[ext];
    if (!mime) continue;
    const fullPath = path.join(dirPath, file);
    try {
      const stat = fs.statSync(fullPath);
      if (!stat.isFile()) continue;
      let dataUri = '';
      if (ext === '.svg') {
        const svgText = fs.readFileSync(fullPath, 'utf-8');
        dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svgText)}`;
      } else {
        const buf = fs.readFileSync(fullPath);
        dataUri = `data:${mime};base64,${buf.toString('base64')}`;
      }
      results.push({
        fileName: file,
        baseName: path.basename(file, ext),
        dataUri
      });
    } catch (_e) {
      // Ignorar archivo ilegible
    }
  }
  return results;
}

function createWindow() {
  ensureImageDirectories();

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    title: 'F1 Championship Studio — Calculadora & Simulador de Campeonato',
    backgroundColor: '#0b0d13',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
}

// IPC handlers para guardar y cargar archivos de campeonato (.json) nativamente desde el escritorio
ipcMain.handle('championship:export', async (_event, jsonString, defaultName) => {
  try {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Guardar Campeonato F1',
      defaultPath: defaultName || 'campeonato-f1.json',
      filters: [{ name: 'Archivo de Campeonato JSON', extensions: ['json'] }]
    });
    if (canceled || !filePath) return { ok: false, canceled: true };
    fs.writeFileSync(filePath, jsonString, 'utf-8');
    return { ok: true, filePath };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('championship:import', async () => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Cargar Campeonato F1',
      properties: ['openFile'],
      filters: [{ name: 'Archivo de Campeonato JSON', extensions: ['json'] }]
    });
    if (canceled || !filePaths || filePaths.length === 0) return { ok: false, canceled: true };
    const content = fs.readFileSync(filePaths[0], 'utf-8');
    return { ok: true, content, filePath: filePaths[0] };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// IPC handlers para la carpeta local de imágenes de pilotos y equipos
ipcMain.handle('images:openFolder', async (_event, subFolder) => {
  ensureImageDirectories();
  let target = IMAGES_ROOT;
  if (subFolder === 'drivers') target = DRIVERS_IMG_DIR;
  else if (subFolder === 'teams') target = TEAMS_IMG_DIR;
  await shell.openPath(target);
  return { ok: true, path: target };
});

ipcMain.handle('images:listLocal', async () => {
  ensureImageDirectories();
  return {
    ok: true,
    folderPath: IMAGES_ROOT,
    drivers: readImagesFromDir(DRIVERS_IMG_DIR),
    teams: readImagesFromDir(TEAMS_IMG_DIR)
  };
});

ipcMain.handle('images:saveToLocal', async (_event, category, safeBaseName, dataUri) => {
  try {
    ensureImageDirectories();
    const targetDir = category === 'teams' ? TEAMS_IMG_DIR : DRIVERS_IMG_DIR;
    const cleanName = String(safeBaseName || 'img').replace(/[^a-zA-Z0-9_-]/g, '_');

    if (dataUri.startsWith('data:image/svg+xml;utf8,')) {
      const svgContent = decodeURIComponent(dataUri.replace('data:image/svg+xml;utf8,', ''));
      const filePath = path.join(targetDir, `${cleanName}.svg`);
      fs.writeFileSync(filePath, svgContent, 'utf-8');
      return { ok: true, filePath };
    }

    const match = dataUri.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (match) {
      let ext = match[1].toLowerCase();
      if (ext === 'jpeg') ext = 'jpg';
      const buf = Buffer.from(match[2], 'base64');
      const filePath = path.join(targetDir, `${cleanName}.${ext}`);
      fs.writeFileSync(filePath, buf);
      return { ok: true, filePath };
    }
    return { ok: false };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
