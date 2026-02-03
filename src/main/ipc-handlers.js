/**
 * IPC ハンドラーモジュール
 * レンダラープロセスからの呼び出しに応答するハンドラーを定義
 */

const { ipcMain, app } = require('electron');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');

/**
 * ファイル名をサニタイズ（パストラバーサル対策）
 * @param {string} filename - サニタイズするファイル名
 * @returns {string} サニタイズされたファイル名
 */
function sanitizeFilename(filename) {
    if (!filename || typeof filename !== 'string') return '';
    const basename = path.basename(filename);
    return basename.replace(/[\x00-\x1f]/g, '');
}

/**
 * パスが指定ディレクトリ内に収まっているか検証
 * @param {string} filePath - 検証するファイルパス
 * @param {string} allowedDir - 許可されたディレクトリ
 * @returns {boolean} パスが許可範囲内ならtrue
 */
function isPathWithinDirectory(filePath, allowedDir) {
    const resolvedPath = path.resolve(filePath);
    const resolvedDir = path.resolve(allowedDir);
    return resolvedPath.startsWith(resolvedDir + path.sep);
}

/**
 * IPCハンドラーを登録
 * @param {Function} getConfigBasePath - 設定読み込み用ベースパスを取得する関数
 * @param {Function} getDataBasePath - データ書き込み用ベースパスを取得する関数
 * @param {Function} getOperatorName - 入力者名を取得する関数
 * @param {boolean} isDev - 開発モードかどうか
 */
function registerHandlers(getConfigBasePath, getDataBasePath, getOperatorName, isDev) {

    /**
     * CSVファイルを保存（データ書き込み用パスを使用）
     */
    ipcMain.handle('save-csv', async (event, { filename, content }) => {
        try {
            const basePath = getDataBasePath();
            const csvDir = path.join(basePath, 'data', 'csv');
            const safeFilename = sanitizeFilename(filename);

            if (!safeFilename) {
                return { success: false, error: '無効なファイル名です' };
            }

            if (!fs.existsSync(csvDir)) {
                fs.mkdirSync(csvDir, { recursive: true });
            }

            const filePath = path.join(csvDir, safeFilename);

            if (!isPathWithinDirectory(filePath, csvDir)) {
                return { success: false, error: '不正なファイルパスです' };
            }

            fs.writeFileSync(filePath, content, 'utf8');
            return { success: true, path: filePath };
        } catch (error) {
            console.error('CSV保存エラー:', error);
            return { success: false, error: error.message };
        }
    });

    /**
     * 設定ファイル（JSON）を読み込み（設定用パスを使用）
     */
    ipcMain.handle('load-config', async (event, filename) => {
        try {
            const basePath = getConfigBasePath();
            const configDir = path.join(basePath, 'config');

            const safeFilename = sanitizeFilename(filename);
            if (!safeFilename) {
                return { success: false, error: '無効なファイル名です' };
            }

            const configPath = path.join(configDir, safeFilename);

            if (!isPathWithinDirectory(configPath, configDir)) {
                return { success: false, error: '不正なファイルパスです' };
            }

            if (!fs.existsSync(configPath)) {
                return { success: false, error: 'ファイルが見つかりません: ' + safeFilename };
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
        return getConfigBasePath();
    });

    /**
     * CSVフォルダ内のファイル一覧を取得（データ用パスを使用）
     */
    ipcMain.handle('list-csv-files', async () => {
        try {
            const basePath = getDataBasePath();
            const csvDir = path.join(basePath, 'data', 'csv');

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
     * configフォルダ内のJSONファイル一覧を取得（設定用パスを使用）
     */
    ipcMain.handle('list-config-files', async () => {
        try {
            const basePath = getConfigBasePath();
            const configDir = path.join(basePath, 'config');

            // デバッグ用: パスを表示（開発モード時のみ）
            if (isDev) {
                console.log('=== DEBUG INFO ===');
                console.log('isDev:', isDev);
                console.log('basePath:', basePath);
                console.log('configDir:', configDir);
                console.log('PORTABLE_EXECUTABLE_DIR:', process.env.PORTABLE_EXECUTABLE_DIR);
                console.log('app.getPath("exe"):', app.getPath('exe'));
                console.log('__dirname:', __dirname);
                console.log('configDir exists:', fs.existsSync(configDir));
            }

            if (!fs.existsSync(configDir)) {
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

    /**
     * Excelファイルを保存（手動展開セルのハイライト付き）
     * @param {string} surveyId - 調査ID（サブフォルダ名として使用）
     */
    ipcMain.handle('save-excel', async (event, { filename, headerRows, dataRows, manualOverrideCells, surveyId }) => {
        try {
            const basePath = getDataBasePath();
            // 調査IDごとにサブフォルダを作成
            const safeSurveyId = surveyId ? sanitizeFilename(surveyId) : '';
            const excelDir = safeSurveyId
                ? path.join(basePath, 'data', 'excel', safeSurveyId)
                : path.join(basePath, 'data', 'excel');
            const safeFilename = sanitizeFilename(filename);
            if (!safeFilename) {
                return { success: false, error: '無効なファイル名です' };
            }

            if (!fs.existsSync(excelDir)) {
                fs.mkdirSync(excelDir, { recursive: true });
            }

            const filePath = path.join(excelDir, safeFilename);

            // パス検証は親ディレクトリ（data/excel）を基準に
            const baseExcelDir = path.join(basePath, 'data', 'excel');
            if (!isPathWithinDirectory(filePath, baseExcelDir)) {
                return { success: false, error: '不正なファイルパスです' };
            }

            // Excelワークブックを作成
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('データ');

            // ヘッダー行を追加（4行）
            for (const headerRow of headerRows) {
                worksheet.addRow(headerRow);
            }

            // ヘッダー行のスタイル設定
            for (let i = 1; i <= headerRows.length; i++) {
                const row = worksheet.getRow(i);
                row.font = { bold: true };
                row.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF5F5F5' }
                };
            }

            // 手動展開セルのマップを作成 { dataRowIndex: Set(colIndices) }
            const overrideCellsMap = new Map();
            if (manualOverrideCells && Array.isArray(manualOverrideCells)) {
                for (const item of manualOverrideCells) {
                    overrideCellsMap.set(item.row, new Set(item.cols));
                }
            }

            // データ行を追加
            const dataStartRow = headerRows.length + 1;
            for (let i = 0; i < dataRows.length; i++) {
                const row = worksheet.addRow(dataRows[i]);
                const excelRowNum = dataStartRow + i;

                // この行に手動展開セルがある場合
                if (overrideCellsMap.has(i)) {
                    const highlightCols = overrideCellsMap.get(i);
                    for (const colIndex of highlightCols) {
                        // ExcelJSは1-indexedなので+1
                        const cell = worksheet.getCell(excelRowNum, colIndex + 1);
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFE8F5E9' }  // 薄緑
                        };
                    }
                }
            }

            // 列幅を自動調整（最初の列は少し広めに）
            worksheet.columns.forEach((column, index) => {
                column.width = index === 0 ? 12 : 8;
            });

            // ファイルを保存
            await workbook.xlsx.writeFile(filePath);
            return { success: true, path: filePath };
        } catch (error) {
            console.error('Excel保存エラー:', error);
            return { success: false, error: error.message };
        }
    });
}

module.exports = { registerHandlers };
