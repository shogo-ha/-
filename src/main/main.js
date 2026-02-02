/**
 * Electron メインプロセス
 * アプリケーションのライフサイクル管理とウィンドウ制御
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');
const { registerHandlers } = require('./ipc-handlers');

// 開発モードかどうか（パッケージ化されていない場合）
const isDev = !app.isPackaged;

/**
 * コマンドライン引数から入力者名を取得
 */
function getOperatorName() {
    const args = process.argv;
    for (const arg of args) {
        if (arg.startsWith('--operator=')) {
            return arg.split('=')[1];
        }
    }
    return '';
}

/**
 * 設定ファイル読み込み用のパスを取得（config）
 * ポータブル版では展開先にconfigが含まれる
 */
function getConfigBasePath() {
    if (isDev) {
        return path.join(__dirname, '..', '..');
    } else {
        // 本番: exeの場所（展開先）
        return path.dirname(app.getPath('exe'));
    }
}

/**
 * データ書き込み用のパスを取得（CSV出力先）
 * ポータブル版ではEXEの元の場所に保存
 */
function getDataBasePath() {
    if (isDev) {
        return path.join(__dirname, '..', '..');
    } else {
        // ポータブル版: EXEの元の場所（ユーザーがアクセスしやすい）
        if (process.env.PORTABLE_EXECUTABLE_DIR) {
            console.log('[DataPath] Using PORTABLE_EXECUTABLE_DIR:', process.env.PORTABLE_EXECUTABLE_DIR);
            return process.env.PORTABLE_EXECUTABLE_DIR;
        }
        // 通常版: exeの場所
        const exeDir = path.dirname(app.getPath('exe'));
        console.log('[DataPath] Using exeDir:', exeDir);
        return exeDir;
    }
}

/**
 * アプリケーションのベースパスを取得（後方互換性のため残す）
 */
function getBasePath() {
    return getConfigBasePath();
}

let mainWindow;

/**
 * メインウィンドウを作成
 */
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1024,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
        icon: path.join(__dirname, '..', 'renderer', 'icon.ico')
    });

    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

    if (isDev) {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.setMenuBarVisibility(false);
}

// アプリ起動時
app.whenReady().then(() => {
    // IPCハンドラーを登録
    registerHandlers(getConfigBasePath, getDataBasePath, getOperatorName, isDev);

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
