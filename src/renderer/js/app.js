/**
 * アプリケーション初期化モジュール
 * index.htmlから分離したエントリーポイント
 */

// XSS対策: HTML文字列をエスケープ
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

// グローバル変数
let surveyForm = null;

// Electron環境かどうか
const isElectron = window.electronAPI && window.electronAPI.isElectron;

/**
 * アプリケーション初期化
 */
async function init() {
    let surveyId = null;

    if (isElectron) {
        // Electron環境: configフォルダを直接スキャン
        surveyId = await detectSurveyConfigElectron();
    } else {
        // ブラウザ環境: URLパラメータまたはfetch
        const params = new URLSearchParams(window.location.search);
        surveyId = params.get('survey');

        if (!surveyId) {
            surveyId = await detectSurveyConfigBrowser();
        }
    }

    if (surveyId) {
        await loadSurvey(surveyId);
    }
}

/**
 * Electron環境でのconfig検出
 */
async function detectSurveyConfigElectron() {
    const container = document.getElementById('formContainer');

    try {
        const result = await window.electronAPI.listConfigFiles();

        if (!result.success || result.files.length === 0) {
            // デバッグ情報を表示（XSS対策でエスケープ）
            let debugInfo = '';
            if (result.debug) {
                debugInfo = `
                    <p style="font-size:12px; color:#666; margin-top:20px;">
                        <strong>デバッグ情報:</strong><br>
                        basePath: ${escapeHtml(result.debug.basePath)}<br>
                        configDir: ${escapeHtml(result.debug.configDir)}<br>
                        PORTABLE_EXECUTABLE_DIR: ${escapeHtml(result.debug.portableDir || '(未設定)')}<br>
                        exePath: ${escapeHtml(result.debug.exePath)}
                    </p>
                `;
            }
            if (result.error) {
                debugInfo += `<p style="color:red;">${escapeHtml(result.error)}</p>`;
            }

            container.innerHTML = `
                <div class="error-message">
                    <h3>設定ファイルが見つかりません</h3>
                    <p>configフォルダにJSONファイルを配置してください。</p>
                    ${debugInfo}
                </div>
            `;
            return null;
        }

        if (result.files.length === 1) {
            return result.files[0];
        } else {
            // 複数ファイルがある場合は選択画面を表示
            const surveys = result.files.map(id => ({ id: id, name: id }));
            showSurveySelector(surveys);
            return null;
        }
    } catch (e) {
        console.error('Config detection error:', e);
        container.innerHTML = `
            <div class="error-message">
                <h3>設定読み込みエラー</h3>
                <p>${escapeHtml(e.message)}</p>
            </div>
        `;
        return null;
    }
}

/**
 * ブラウザ環境でのconfig検出
 */
async function detectSurveyConfigBrowser() {
    const container = document.getElementById('formContainer');

    try {
        // config/index.jsonからファイル一覧を取得（存在する場合）
        const indexResponse = await fetch('../config/index.json');
        if (indexResponse.ok) {
            const indexData = await indexResponse.json();
            if (indexData.surveys && indexData.surveys.length > 0) {
                if (indexData.surveys.length === 1) {
                    return indexData.surveys[0].id;
                } else {
                    showSurveySelector(indexData.surveys);
                    return null;
                }
            }
        }
    } catch (e) {
        // index.jsonがない場合は個別ファイルを試行
    }

    // 一般的なファイル名パターンを試行
    const patterns = await scanConfigFolder();

    if (patterns.length === 0) {
        container.innerHTML = `
            <div class="error-message">
                <h3>設定ファイルが見つかりません</h3>
                <p>configフォルダにJSONファイルを配置してください。</p>
                <p>または config/index.json でファイル一覧を指定してください。</p>
            </div>
        `;
        return null;
    } else if (patterns.length === 1) {
        return patterns[0];
    } else {
        // 複数ファイルがある場合は選択画面を表示
        const surveys = patterns.map(id => ({ id: id, name: id }));
        showSurveySelector(surveys);
        return null;
    }
}

/**
 * configフォルダ内のJSONファイルをスキャン（ブラウザ環境用）
 */
async function scanConfigFolder() {
    const found = [];

    // よくあるファイル名パターンを試行
    const commonPatterns = [
        'survey_needs',
        'survey_kaigoyobo',
        'survey_config',
        'survey',
        'config'
    ];

    // まず一般的なパターンを試す
    for (const pattern of commonPatterns) {
        try {
            const response = await fetch(`../config/${pattern}.json`, { method: 'HEAD' });
            if (response.ok) {
                found.push(pattern);
            }
        } catch (e) {
            // 無視
        }
    }

    // 見つからない場合、ディレクトリリストを試みる（一部サーバーで動作）
    if (found.length === 0) {
        try {
            const response = await fetch('../config/');
            if (response.ok) {
                const text = await response.text();
                // HTMLからJSONファイル名を抽出
                const matches = text.match(/href="([^"]+\.json)"/g);
                if (matches) {
                    for (const match of matches) {
                        const filename = match.match(/href="([^"]+\.json)"/)[1];
                        const id = filename.replace('.json', '');
                        if (!found.includes(id)) {
                            found.push(id);
                        }
                    }
                }
            }
        } catch (e) {
            // 無視
        }
    }

    return found;
}

/**
 * 調査選択UIを表示
 */
function showSurveySelector(surveys) {
    const selector = document.getElementById('configSelector');
    const select = document.getElementById('surveySelect');
    const container = document.getElementById('formContainer');

    // オプションを追加
    select.innerHTML = '<option value="">-- 選択してください --</option>';
    for (const survey of surveys) {
        const option = document.createElement('option');
        option.value = survey.id;
        option.textContent = survey.name || survey.id;
        select.appendChild(option);
    }

    selector.style.display = 'block';
    container.innerHTML = '<div class="loading">上のドロップダウンから調査を選択してください</div>';
}

/**
 * 調査を読み込み
 */
async function loadSurvey(surveyId) {
    if (!surveyId) return;

    const container = document.getElementById('formContainer');
    container.innerHTML = '<div class="loading">読み込み中...</div>';

    try {
        let config;

        if (isElectron) {
            // Electron環境: IPCで読み込み
            const result = await window.electronAPI.loadConfig(surveyId + '.json');
            if (!result.success) {
                throw new Error(result.error || '設定ファイルが見つかりません');
            }
            config = result.data;
        } else {
            // ブラウザ環境: fetchで読み込み
            const response = await fetch(`../config/${surveyId}.json`);
            if (!response.ok) {
                throw new Error('設定ファイルが見つかりません');
            }
            config = await response.json();
        }

        // タイトル更新
        document.getElementById('surveyTitle').textContent = config.surveyName;
        document.title = config.surveyName + ' 入力フォーム';

        // フォーム生成
        const generator = new SurveyGenerator(config);
        generator.generate(container);

        // フォーム初期化
        const formConfig = generator.getFormConfig();
        surveyForm = new SurveyForm(formConfig);
        surveyForm.init();

    } catch (error) {
        console.error('Failed to load survey:', error);
        container.innerHTML = `
            <div class="error-message">
                <h3>読み込みエラー</h3>
                <p>${escapeHtml(error.message)}</p>
                <p>設定ファイル: config/${escapeHtml(surveyId)}.json</p>
            </div>
        `;
    }
}

// ページ読み込み時に初期化
document.addEventListener('DOMContentLoaded', init);
