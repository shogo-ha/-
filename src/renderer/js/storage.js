/**
 * 汎用アンケートフォーム ストレージ管理モジュール
 * 
 * 機能:
 * - localStorage への安全なアクセス（例外処理付き）
 * - CSV出力（適切なエスケープ処理）
 * - データのバックアップ/復元
 */

class SurveyStorage {
    /**
     * @param {string} storageKey - localStorage のキー
     */
    constructor(storageKey) {
        this.storageKey = storageKey;
        this.isAvailable = this._checkAvailability();
    }

    /**
     * localStorageが利用可能か確認
     */
    _checkAvailability() {
        try {
            const testKey = '__storage_test__';
            localStorage.setItem(testKey, testKey);
            localStorage.removeItem(testKey);
            return true;
        } catch (e) {
            console.warn('localStorage is not available:', e);
            return false;
        }
    }

    /**
     * データを取得
     * @returns {Array} 保存されているレコード配列
     */
    getData() {
        if (!this.isAvailable) return [];
        try {
            const data = localStorage.getItem(this.storageKey);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Failed to read data:', e);
            this._showError('データの読み込みに失敗しました');
            return [];
        }
    }

    /**
     * データを保存
     * @param {Array} data - 保存するレコード配列
     * @returns {boolean} 成功したかどうか
     */
    saveData(data) {
        if (!this.isAvailable) {
            this._showError('ストレージが利用できません。プライベートモードではありませんか？');
            return false;
        }
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('Failed to save data:', e);
            if (e.name === 'QuotaExceededError') {
                this._showError('ストレージ容量が不足しています。古いデータを出力して削除してください。');
            } else {
                this._showError('データの保存に失敗しました');
            }
            return false;
        }
    }

    /**
     * 新規レコードを追加
     * @param {Object} record - 追加するレコード
     * @returns {boolean} 成功したかどうか
     */
    addRecord(record) {
        const data = this.getData();
        data.push(record);
        return this.saveData(data);
    }

    /**
     * レコードを更新
     * @param {number} index - 更新するレコードのインデックス
     * @param {Object} record - 新しいレコードデータ
     * @returns {boolean} 成功したかどうか
     */
    updateRecord(index, record) {
        const data = this.getData();
        if (index < 0 || index >= data.length) return false;
        data[index] = record;
        return this.saveData(data);
    }

    /**
     * レコードを削除
     * @param {number} index - 削除するレコードのインデックス
     * @returns {boolean} 成功したかどうか
     */
    deleteRecord(index) {
        const data = this.getData();
        if (index < 0 || index >= data.length) return false;
        data.splice(index, 1);
        return this.saveData(data);
    }

    /**
     * 全データを削除
     * @returns {boolean} 成功したかどうか
     */
    clearAll() {
        if (!this.isAvailable) return false;
        try {
            localStorage.removeItem(this.storageKey);
            return true;
        } catch (e) {
            console.error('Failed to clear data:', e);
            return false;
        }
    }

    /**
     * IDの重複チェック
     * @param {string} id - チェックするID
     * @param {number} excludeIndex - 除外するインデックス（編集時の自分自身）
     * @returns {boolean} 重複している場合true
     */
    isDuplicateId(id, excludeIndex = -1) {
        const data = this.getData();
        return data.some((record, idx) => record.ID === id && idx !== excludeIndex);
    }

    /**
     * レコード数を取得
     * @returns {number}
     */
    getCount() {
        return this.getData().length;
    }

    /**
     * エラー通知を表示
     * @param {string} message
     */
    _showError(message) {
        // toastまたはerrorToastを探す（互換性のため両方対応）
        const toast = document.getElementById('toast') || document.getElementById('errorToast');
        if (toast) {
            toast.textContent = message;
            toast.className = 'toast show error';
            setTimeout(() => {
                toast.classList.remove('show', 'error');
            }, 3000);
        } else {
            alert(message);
        }
    }
}

/**
 * CSV出力クラス
 */
class DataExporter {
    /**
     * 丸数字変換テーブル（0〜50対応）
     */
    static CIRCLE_NUMBERS = [
        '⓪', '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩',
        '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳',
        '㉑', '㉒', '㉓', '㉔', '㉕', '㉖', '㉗', '㉘', '㉙', '㉚',
        '㉛', '㉜', '㉝', '㉞', '㉟', '㊱', '㊲', '㊳', '㊴', '㊵',
        '㊶', '㊷', '㊸', '㊹', '㊺', '㊻', '㊼', '㊽', '㊾', '㊿'
    ];

    /**
     * 数字を丸数字に変換
     * @param {number} num - 変換する数字
     * @returns {string} 丸数字
     */
    static toCircleNumber(num) {
        if (num >= 0 && num < this.CIRCLE_NUMBERS.length) {
            return this.CIRCLE_NUMBERS[num];
        }
        return `(${num})`; // 範囲外は括弧付き数字
    }

    /**
     * データをCSVファイルとしてダウンロード（従来形式）
     * @param {Array} data - エクスポートするデータ
     * @param {string} filename - ファイル名
     * @returns {boolean} 成功したかどうか
     */
    static export(data, filename) {
        if (!data || !data.length) {
            alert('データがありません');
            return false;
        }

        try {
            const headers = Object.keys(data[0]);
            const csvRows = [headers.join(',')];

            for (const row of data) {
                const values = headers.map(header => {
                    let value = row[header];
                    if (value === null || value === undefined) {
                        value = '';
                    } else {
                        value = String(value);
                    }
                    // エスケープ処理
                    return this._escapeCSVValue(value);
                });
                csvRows.push(values.join(','));
            }

            // BOM付きUTF-8
            const csv = '\uFEFF' + csvRows.join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
            
            // ダウンロード
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);

            return true;
        } catch (e) {
            console.error('CSV export failed:', e);
            alert('データ出力に失敗しました');
            return false;
        }
    }

    /**
     * データを〇形式でCSVファイルとしてダウンロード
     * @param {Array} data - エクスポートするデータ
     * @param {string} filename - ファイル名
     * @param {Object} questionsConfig - 設問定義
     *   例: {
     *     Q1_1: { values: [1,2,3,4,5] },
     *     Q1_2_1: { values: [1,2,3,4,5,6,7,8,9,10,11,12,13,14] },
     *     ...
     *   }
     * @param {Array} fieldOrder - フィールドの出力順序（オプション）
     * @returns {boolean} 成功したかどうか
     */
    static exportExpanded(data, filename, questionsConfig, fieldOrder = null) {
        if (!data || !data.length) {
            alert('データがありません');
            return false;
        }

        try {
            // ヘッダー構築
            const { headers, headerRow } = this._buildExpandedHeaders(data[0], questionsConfig, fieldOrder);
            const csvRows = [headerRow.join(',')];

            // データ行を変換
            for (const row of data) {
                const expandedRow = this._expandRecord(row, headers, questionsConfig);
                const values = expandedRow.map(v => this._escapeCSVValue(v));
                csvRows.push(values.join(','));
            }

            // BOM付きUTF-8
            const csv = '\uFEFF' + csvRows.join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
            
            // ダウンロード
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);

            return true;
        } catch (e) {
            console.error('CSV export failed:', e);
            alert('データ出力に失敗しました');
            return false;
        }
    }

    /**
     * 展開形式のヘッダーを構築
     * @param {Object} sampleRecord - サンプルレコード（フィールド一覧取得用）
     * @param {Object} questionsConfig - 設問定義
     * @param {Array} fieldOrder - フィールド順序（オプション）
     * @returns {Object} { headers: [{field, value?}], headerRow: [string] }
     */
    static _buildExpandedHeaders(sampleRecord, questionsConfig, fieldOrder) {
        const headers = [];  // 内部用: { field: 'Q1_1', value: 1 } or { field: 'ID' }
        const headerRow = []; // CSV出力用

        // フィールド順序を決定
        const fields = fieldOrder || Object.keys(sampleRecord);
        const fieldsSet = new Set(fields);

        for (const field of fields) {
            // otherフィールドはスキップ（選択肢展開時に挿入するため）
            if (field.includes('_other_')) continue;

            if (questionsConfig && questionsConfig[field]) {
                // 展開対象の設問
                const config = questionsConfig[field];
                const values = config.values || [];
                
                for (const v of values) {
                    headers.push({ field: field, value: v });
                    headerRow.push(`${field}_${this.toCircleNumber(v)}`);
                    
                    // この選択肢にotherがあれば直後に追加
                    const otherId = `${field}_other_${v}`;
                    if (fieldsSet.has(otherId)) {
                        headers.push({ field: otherId });
                        headerRow.push(`${field}_その他`);
                    }
                }
            } else {
                // 展開しないフィールド（ID、数値入力など）
                headers.push({ field: field });
                headerRow.push(field);
            }
        }

        return { headers, headerRow };
    }

    /**
     * 1レコードを展開形式に変換
     * @param {Object} record - 元のレコード
     * @param {Array} headers - ヘッダー定義
     * @param {Object} questionsConfig - 設問定義
     * @returns {Array} 展開後の値配列
     */
    static _expandRecord(record, headers, questionsConfig) {
        const row = [];

        for (const header of headers) {
            const field = header.field;
            const rawValue = record[field];

            if (header.value !== undefined) {
                // 展開対象フィールド: 該当する値なら〇
                const selectedValues = this._parseSelectedValues(rawValue);
                row.push(selectedValues.includes(header.value) ? '〇' : '');
            } else {
                // 展開しないフィールド: そのまま出力
                row.push(rawValue !== null && rawValue !== undefined ? String(rawValue) : '');
            }
        }

        return row;
    }

    /**
     * 選択値を配列にパース
     * @param {string|number} value - "1,3,5" や "2" など
     * @returns {Array<number>} 選択された値の配列
     */
    static _parseSelectedValues(value) {
        if (value === null || value === undefined || value === '') {
            return [];
        }
        const str = String(value);
        if (str.includes(',')) {
            // カンマ区切り（複数選択）
            return str.split(',').map(v => parseInt(v.trim(), 10)).filter(v => !isNaN(v));
        } else {
            // 単一値
            const num = parseInt(str, 10);
            return isNaN(num) ? [] : [num];
        }
    }

    /**
     * CSVの値をエスケープ（CSVインジェクション対策含む）
     * @param {string} value
     * @returns {string}
     */
    static _escapeCSVValue(value) {
        if (value === null || value === undefined) return '';
        value = String(value);

        // 数式インジェクション対策: 危険な先頭文字をチェック
        const formulaChars = /^[=+\-@\t\r]/;
        const needsQuoting = value.includes('"') ||
                             value.includes(',') ||
                             value.includes('\n') ||
                             formulaChars.test(value);

        if (needsQuoting) {
            // ダブルクォートを二重にエスケープ
            value = value.replace(/"/g, '""');
            return `"${value}"`;
        }
        return value;
    }

    /**
     * 日付文字列を生成
     * @returns {string} YYYY-MM-DD形式
     */
    static getDateString() {
        return new Date().toISOString().slice(0, 10);
    }

    /**
     * データを4行ヘッダー形式でExcelファイルとして保存
     * @param {Array} data - エクスポートするデータ
     * @param {string} filename - ファイル名（.xlsxに変換される）
     * @param {Object} questionsConfig - 設問定義（選択肢値）
     * @param {Object} questionsMetadata - 設問メタデータ（大問・小問名）
     *   例: {
     *     Q1_1: { section: '問1', title: '家族構成' },
     *     Q1_2: { section: '問1', title: '介護が必要な方' },
     *     ...
     *   }
     * @param {Array} fieldOrder - フィールドの出力順序
     * @returns {Promise<{success: boolean, path?: string}>} 結果
     */
    static async exportWithHeaders(data, filename, questionsConfig, questionsMetadata, fieldOrder) {
        if (!data || !data.length) {
            alert('データがありません');
            return { success: false };
        }

        try {
            // 4行ヘッダーを構築
            const headerInfo = this._buildMultiRowHeaders(data[0], questionsConfig, questionsMetadata, fieldOrder);
            const headerRows = [
                headerInfo.row1,  // 大問
                headerInfo.row2,  // （空白/補助）
                headerInfo.row3,  // 小問
                headerInfo.row4   // 回答番号
            ];

            // データ行を変換し、手動展開セルの位置を記録
            const dataRows = [];
            const manualOverrideCells = [];  // [{row: number, cols: number[]}]

            // フィールドIDから列インデックスへのマッピングを作成
            const fieldToColIndices = this._buildFieldToColumnMap(headerInfo.headers);

            for (let i = 0; i < data.length; i++) {
                const row = data[i];
                const expandedRow = this._expandRecord(row, headerInfo.headers, questionsConfig);
                dataRows.push(expandedRow);

                // 手動展開フィールドがある場合、該当列を特定
                if (row['_manualOverrideFields']) {
                    const overrideFields = row['_manualOverrideFields'].split(',');
                    const cols = [];
                    for (const fieldId of overrideFields) {
                        const colIndices = fieldToColIndices[fieldId.trim()];
                        if (colIndices) {
                            cols.push(...colIndices);
                        }
                    }
                    if (cols.length > 0) {
                        manualOverrideCells.push({ row: i, cols: [...new Set(cols)] });
                    }
                }
            }

            // Electron環境かどうかで分岐
            if (window.electronAPI && window.electronAPI.isElectron && window.electronAPI.saveExcel) {
                // ファイル名を.xlsxに変更
                const excelFilename = filename.replace(/\.csv$/, '.xlsx');
                // Electron: Excelファイルとして保存
                return await window.electronAPI.saveExcel(excelFilename, headerRows, dataRows, manualOverrideCells);
            } else {
                // ブラウザ: CSVとしてダウンロード（フォールバック）
                const csvRows = [
                    headerInfo.row1.join(','),
                    headerInfo.row2.join(','),
                    headerInfo.row3.join(','),
                    headerInfo.row4.join(',')
                ];
                for (const row of dataRows) {
                    csvRows.push(row.map(v => this._escapeCSVValue(v)).join(','));
                }
                const csv = '\uFEFF' + csvRows.join('\n');
                this._downloadFile(filename, csv);
                return { success: true };
            }
        } catch (e) {
            console.error('Excel export failed:', e);
            alert('Excel出力に失敗しました: ' + e.message);
            return { success: false };
        }
    }

    /**
     * Electron環境でローカルファイルに保存
     * @param {string} filename - ファイル名
     * @param {string} content - CSV内容
     * @returns {Promise<{success: boolean, path?: string}>}
     */
    static async _saveToLocal(filename, content) {
        try {
            const result = await window.electronAPI.saveCSV(filename, content);
            if (result.success) {
                return { success: true, path: result.path };
            } else {
                alert('CSV保存に失敗しました: ' + result.error);
                return { success: false };
            }
        } catch (e) {
            console.error('CSV保存エラー:', e);
            alert('CSV保存に失敗しました: ' + e.message);
            return { success: false };
        }
    }

    /**
     * ブラウザ環境でダウンロード
     * @param {string} filename - ファイル名
     * @param {string} content - CSV内容
     * @returns {boolean}
     */
    static _downloadFile(filename, content) {
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        return true;
    }

    /**
     * 4行ヘッダーを構築
     * @returns {Object} { headers, row1, row2, row3, row4 }
     */
    static _buildMultiRowHeaders(sampleRecord, questionsConfig, questionsMetadata, fieldOrder) {
        const headers = [];  // 内部用
        const row1 = [];     // 大問
        const row2 = [];     // 補助行（空白）
        const row3 = [];     // 小問
        const row4 = [];     // 回答番号

        const fields = fieldOrder || Object.keys(sampleRecord);
        const fieldsSet = new Set(fields);
        let lastSection = '';

        for (const field of fields) {
            // otherフィールドはスキップ（選択肢展開時に挿入するため）
            if (field.includes('_other_')) continue;

            const meta = questionsMetadata ? questionsMetadata[field] : null;
            const config = questionsConfig ? questionsConfig[field] : null;

            if (config && config.values) {
                // 展開対象の設問
                const values = config.values;
                
                for (let i = 0; i < values.length; i++) {
                    const v = values[i];
                    headers.push({ field: field, value: v });
                    
                    // 1行目: 大問（設問の最初の列のみ、セクションが変わったときのみ）
                    if (i === 0 && meta && meta.section && meta.section !== lastSection) {
                        row1.push(meta.section);
                        lastSection = meta.section;
                    } else {
                        row1.push('');
                    }
                    
                    // 2行目: 空白
                    row2.push('');
                    
                    // 3行目: 小問（設問の最初の列のみ）
                    if (i === 0 && meta && meta.title) {
                        row3.push(meta.title);
                    } else {
                        row3.push('');
                    }
                    
                    // 4行目: 回答番号
                    row4.push(this.toCircleNumber(v));
                    
                    // この選択肢にotherがあれば直後に追加
                    const otherId = `${field}_other_${v}`;
                    if (fieldsSet.has(otherId)) {
                        headers.push({ field: otherId });
                        row1.push('');
                        row2.push('');
                        row3.push('');
                        row4.push('その他');
                    }
                }
            } else {
                // 展開しないフィールド
                headers.push({ field: field });
                
                // IDの場合
                if (field === 'ID') {
                    row1.push('NO');
                    row2.push('');
                    row3.push('');
                    row4.push('');
                } 
                // 入力日時の場合
                else if (field === '入力日時') {
                    row1.push('');
                    row2.push('');
                    row3.push('入力日時');
                    row4.push('');
                }
                // その他（数値入力、テキスト等すべてメタデータで判定）
                else {
                    const meta2 = questionsMetadata ? questionsMetadata[field] : null;
                    if (meta2) {
                        if (meta2.section && meta2.section !== lastSection) {
                            row1.push(meta2.section);
                            lastSection = meta2.section;
                        } else {
                            row1.push('');
                        }
                        row2.push('');
                        row3.push(meta2.title || field);
                        row4.push('');
                    } else {
                        row1.push('');
                        row2.push('');
                        row3.push(field);
                        row4.push('');
                    }
                }
            }
        }

        return { headers, row1, row2, row3, row4 };
    }

    /**
     * フィールドIDから列インデックスへのマッピングを構築
     * @param {Array} headers - ヘッダー配列 [{field, value?}, ...]
     * @returns {Object} { fieldId: [colIndex1, colIndex2, ...], ... }
     */
    static _buildFieldToColumnMap(headers) {
        const map = {};
        for (let i = 0; i < headers.length; i++) {
            const header = headers[i];
            const fieldId = header.field;
            if (!map[fieldId]) {
                map[fieldId] = [];
            }
            map[fieldId].push(i);
        }
        return map;
    }
}

/**
 * HTMLエスケープユーティリティ（XSS対策）
 */
class HTMLUtils {
    /**
     * HTMLをエスケープ
     * @param {string} str
     * @returns {string}
     */
    static escape(str) {
        if (str === null || str === undefined) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * 安全なテーブル行を生成
     * @param {Array} cells - セルの内容配列
     * @returns {string} tr要素のHTML
     */
    static createTableRow(cells) {
        const tds = cells.map(cell => `<td>${this.escape(cell)}</td>`).join('');
        return `<tr>${tds}</tr>`;
    }
}
