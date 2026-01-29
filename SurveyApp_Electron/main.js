/**
 * Electron メインプロセス
 * アプリケーションのライフサイクル管理とウィンドウ制御
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// 開発モードかどうか（パッケージ化されていない場合）
const isDev = !app.isPackaged;

// コマンドライン引数から入力者名を取得
function getOperatorName() {
    const args = process.argv;
    for (const arg of args) {
        if (arg.startsWith('--operator=')) {
            return arg.split('=')[1];
        }
    }
    return '';
}

// アプリケーションのベースパスを取得
function getBasePath() {
    if (isDev) {
        return __dirname;
    } else {
        // portable版の場合、PORTABLE_EXECUTABLE_DIRを使用
        if (process.env.PORTABLE_EXECUTABLE_DIR) {
            return process.env.PORTABLE_EXECUTABLE_DIR;
        }
        // それ以外はexeの場所
        return path.dirname(app.getPath('exe'));
    }
}

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1024,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
        icon: path.join(__dirname, '_systems', 'icon.ico')
    });

    // index.htmlを読み込み
    mainWindow.loadFile(path.join(__dirname, '_systems', 'index.html'));

    // 開発時はDevToolsを開く
    if (isDev) {
        mainWindow.webContents.openDevTools();
    }

    // メニューバーを非表示
    mainWindow.setMenuBarVisibility(false);
}

// アプリ起動時
app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// 全ウィンドウが閉じられた時
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// ===== IPC ハンドラー（レンダラープロセスからの呼び出しに応答）=====

/**
 * CSVファイルを保存
 */
ipcMain.handle('save-csv', async (event, { filename, content }) => {
    try {
        const basePath = getBasePath();
        const csvDir = path.join(basePath, 'data', '_csv');
        
        // ディレクトリが存在しない場合は作成
        if (!fs.existsSync(csvDir)) {
            fs.mkdirSync(csvDir, { recursive: true });
        }
        
        const filePath = path.join(csvDir, filename);
        
        // BOM付きUTF-8で保存
        fs.writeFileSync(filePath, content, 'utf8');
        
        return { success: true, path: filePath };
    } catch (error) {
        console.error('CSV保存エラー:', error);
        return { success: false, error: error.message };
    }
});

/**
 * 設定ファイル（JSON）を読み込み
 */
ipcMain.handle('load-config', async (event, filename) => {
    try {
        const basePath = getBasePath();
        const configPath = path.join(basePath, 'config', filename);
        
        if (!fs.existsSync(configPath)) {
            return { success: false, error: 'ファイルが見つかりません: ' + filename };
        }
        
        const content = fs.readFileSync(configPath, 'utf8');
        return { success: true, data: JSON.parse(content) };
    } catch (error) {
        console.error('設定読み込みエラー:', error);
        return { success: false, error: error.message };
    }
});

/**
 * アプリのベースパスを取得
 */
ipcMain.handle('get-base-path', async () => {
    return getBasePath();
});

/**
 * CSVフォルダ内のファイル一覧を取得
 */
ipcMain.handle('list-csv-files', async () => {
    try {
        const basePath = getBasePath();
        const csvDir = path.join(basePath, 'data', '_csv');
        
        if (!fs.existsSync(csvDir)) {
            return { success: true, files: [] };
        }
        
        const files = fs.readdirSync(csvDir)
            .filter(f => f.endsWith('.csv'))
            .map(f => ({
                name: f,
                path: path.join(csvDir, f),
                stat: fs.statSync(path.join(csvDir, f))
            }));
        
        return { success: true, files };
    } catch (error) {
        console.error('ファイル一覧取得エラー:', error);
        return { success: false, error: error.message };
    }
});

/**
 * 入力者名を取得（コマンドライン引数から）
 */
ipcMain.handle('get-operator-name', async () => {
    return getOperatorName();
});

/**
 * configフォルダ内のJSONファイル一覧を取得
 */
ipcMain.handle('list-config-files', async () => {
    try {
        const basePath = getBasePath();
        const configDir = path.join(basePath, 'config');
        
        // デバッグ用: パスを表示
        console.log('=== DEBUG INFO ===');
        console.log('isDev:', isDev);
        console.log('basePath:', basePath);
        console.log('configDir:', configDir);
        console.log('PORTABLE_EXECUTABLE_DIR:', process.env.PORTABLE_EXECUTABLE_DIR);
        console.log('app.getPath("exe"):', app.getPath('exe'));
        console.log('__dirname:', __dirname);
        console.log('configDir exists:', fs.existsSync(configDir));
        
        if (!fs.existsSync(configDir)) {
            // デバッグ: 存在しない場合、詳細を返す
            return { 
                success: false, 
                error: `configフォルダが見つかりません。\n検索パス: ${configDir}\nbasePath: ${basePath}`,
                debug: {
                    basePath,
                    configDir,
                    portableDir: process.env.PORTABLE_EXECUTABLE_DIR,
                    exePath: app.getPath('exe')
                }
            };
        }
        
        const files = fs.readdirSync(configDir)
            .filter(f => f.endsWith('.json') && f !== 'index.json')
            .map(f => f.replace('.json', ''));
        
        return { success: true, files };
    } catch (error) {
        console.error('configファイル一覧取得エラー:', error);
        return { success: false, error: error.message };
    }
});
