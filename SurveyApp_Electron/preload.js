/**
 * Electron Preload スクリプト
 * レンダラープロセスとメインプロセスの橋渡し
 * セキュアなAPIのみを公開
 */

const { contextBridge, ipcRenderer } = require('electron');

// レンダラープロセスに公開するAPI
contextBridge.exposeInMainWorld('electronAPI', {
    /**
     * CSVファイルを保存
     * @param {string} filename - ファイル名
     * @param {string} content - CSV内容
     * @returns {Promise<{success: boolean, path?: string, error?: string}>}
     */
    saveCSV: (filename, content) => {
        return ipcRenderer.invoke('save-csv', { filename, content });
    },

    /**
     * 設定ファイルを読み込み
     * @param {string} filename - ファイル名
     * @returns {Promise<{success: boolean, data?: object, error?: string}>}
     */
    loadConfig: (filename) => {
        return ipcRenderer.invoke('load-config', filename);
    },

    /**
     * アプリのベースパスを取得
     * @returns {Promise<string>}
     */
    getBasePath: () => {
        return ipcRenderer.invoke('get-base-path');
    },

    /**
     * CSVファイル一覧を取得
     * @returns {Promise<{success: boolean, files?: array, error?: string}>}
     */
    listCSVFiles: () => {
        return ipcRenderer.invoke('list-csv-files');
    },

    /**
     * 入力者名を取得（コマンドライン引数から）
     * @returns {Promise<string>}
     */
    getOperatorName: () => {
        return ipcRenderer.invoke('get-operator-name');
    },

    /**
     * configフォルダ内のJSONファイル一覧を取得
     * @returns {Promise<{success: boolean, files?: array, error?: string}>}
     */
    listConfigFiles: () => {
        return ipcRenderer.invoke('list-config-files');
    },

    /**
     * Electron環境かどうかを判定
     */
    isElectron: true
});
