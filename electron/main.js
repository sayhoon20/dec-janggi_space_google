const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let engineProcess = null;

// 엔진 파일명 설정
const ENGINE_FILENAME = 'fairy-stockfish-largeboard_x86-64-bmi2.exe';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    backgroundColor: '#0d1117',
    icon: path.join(__dirname, '../public/favicon.ico') // 아이콘 경로
  });

  const startUrl = process.env.ELECTRON_START_URL || `file://${path.join(__dirname, '../build/index.html')}`;
  mainWindow.loadURL(startUrl);

  // mainWindow.webContents.openDevTools(); // 디버깅용
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (engineProcess) engineProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

// --- 엔진 통신 로직 ---

ipcMain.on('engine-start', (event) => {
  if (engineProcess) return;

  // 개발 환경과 배포 환경의 경로 처리
  const enginePath = app.isPackaged 
    ? path.join(process.resourcesPath, ENGINE_FILENAME)
    : path.join(__dirname, '..', ENGINE_FILENAME);

  try {
    console.log(`Attempting to spawn engine at: ${enginePath}`);
    engineProcess = spawn(enginePath);

    engineProcess.stdout.on('data', (data) => {
      const output = data.toString();
      // console.log(`Engine: ${output}`);
      if (mainWindow) mainWindow.webContents.send('engine-output', output);
    });

    engineProcess.stderr.on('data', (data) => {
      console.error(`Engine Error: ${data}`);
    });

    engineProcess.on('close', (code) => {
      console.log(`Engine process exited with code ${code}`);
      engineProcess = null;
    });

    // 장기 모드 설정 (Fairy Stockfish)
    engineProcess.stdin.write('uci\n');
    engineProcess.stdin.write('setoption name Variant value janggi\n');
    engineProcess.stdin.write('isready\n');

  } catch (error) {
    console.error("Failed to start engine:", error);
  }
});

ipcMain.on('engine-command', (event, command) => {
  if (engineProcess) {
    console.log(`Command to Engine: ${command}`);
    engineProcess.stdin.write(command + '\n');
  }
});

ipcMain.on('engine-stop', () => {
  if (engineProcess) {
    engineProcess.kill();
    engineProcess = null;
  }
});
