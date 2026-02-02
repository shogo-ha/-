/**
 * 汎用アンケートフォーム v3.2
 *
 * 設計原則:
 * - 各クラスは単一責務
 * - 状態は FormState に集約
 * - イベント駆動で疎結合
 *
 * v3.2 変更点（画面酔い対策）:
 * - ScrollHelper: スクロール競合防止（_isScrollingフラグ）
 * - ScrollHelper: 設問表示位置を常に上端基準に統一
 * - UIUpdater: _scrollToTableRowにスクロール中チェック追加
 */

// ============================================
// InputValidator: 入力値の検証・サニタイズ
// ============================================
const InputValidator = {
    /**
     * 文字列から制御文字を除去
     * @param {string} value - 検証する値
     * @returns {string} サニタイズされた値
     */
    sanitizeString(value) {
        if (value === null || value === undefined) return '';
        // 制御文字（タブ、改行は許可）を除去
        return String(value).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    },

    /**
     * IDを検証・サニタイズ
     * @param {string} id - 検証するID
     * @returns {string} サニタイズされたID
     */
    sanitizeId(id) {
        if (!id || typeof id !== 'string') return '';
        // 制御文字を除去し、前後の空白をトリム
        return id.replace(/[\x00-\x1F\x7F]/g, '').trim();
    },

    /**
     * 数値入力を検証
     * @param {string} value - 検証する値
     * @param {Object} options - オプション（min, max）
     * @returns {string} 検証済みの値
     */
    sanitizeNumber(value, options = {}) {
        if (value === null || value === undefined || value === '') return '';
        const num = parseFloat(value);
        if (isNaN(num)) return '';
        if (options.min !== undefined && num < options.min) return String(options.min);
        if (options.max !== undefined && num > options.max) return String(options.max);
        return String(num);
    }
};

// ============================================
// ScrollHelper: スクロール処理の共通ユーティリティ
// 【v3.2】画面酔い対策: 表示位置統一 & 滑らかなスクロール
// ============================================
const ScrollHelper = {
    // CSS変数から値を取得（フォールバック値付き）
    // ※ CSS変数と連動することで、スタイル変更時にJS側の修正が不要になる
    get HEADER_OFFSET() {
        return this._getCSSVar('--header-offset', 80);
    },
    get BOTTOM_MARGIN() {
        return this._getCSSVar('--bottom-margin', 40);
    },
    get TOP_PADDING() {
        return this._getCSSVar('--top-padding', 20);
    },
    get SCROLL_DURATION() {
        return this._getCSSVar('--scroll-duration', 400);
    },

    /**
     * CSS変数から数値を取得
     * @param {string} varName - CSS変数名（例: '--header-offset'）
     * @param {number} fallback - フォールバック値
     * @returns {number}
     */
    _getCSSVar(varName, fallback) {
        const value = getComputedStyle(document.documentElement).getPropertyValue(varName);
        if (!value) return fallback;
        // 'px' や 'ms' を除去して数値に変換
        return parseInt(value.replace(/[^0-9.-]/g, ''), 10) || fallback;
    },

    // 最後にスクロールした目標位置（重複スクロール防止用）
    _lastTargetPosition: null,
    _animationId: null,

    /**
     * 要素が画面内に表示されるようスクロール（必要な場合のみ）
     * 選択肢や表の行など、部分的なスクロール用
     * @param {Element} element - スクロール対象の要素
     * @param {Object} options - オプション
     * @param {number} options.extraPadding - 追加の余白（デフォルト: 0）
     */
    scrollIntoViewIfNeeded(element, options = {}) {
        if (!element) return;
        
        const rect = element.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const extraPadding = options.extraPadding || 0;
        
        const isAboveViewport = rect.top < this.HEADER_OFFSET;
        const isBelowViewport = rect.bottom > viewportHeight - this.BOTTOM_MARGIN;
        
        if (isAboveViewport) {
            const targetPosition = window.pageYOffset + rect.top - this.HEADER_OFFSET - extraPadding;
            this._doScroll(targetPosition);
        } else if (isBelowViewport) {
            const targetPosition = window.pageYOffset + rect.bottom - viewportHeight + this.BOTTOM_MARGIN + extraPadding;
            this._doScroll(targetPosition);
        }
    },

    /**
     * 設問を上部に固定表示
     * 【v3.2】常に上部へスクロール（視線位置の完全統一）
     * @param {Element} element - スクロール対象の要素
     */
    scrollLargeElementIntoView(element) {
        if (!element) return;
        
        const rect = element.getBoundingClientRect();
        
        // 目標位置を計算（設問の上端をヘッダー直下 + TOP_PADDING に配置）
        const targetPosition = Math.round(window.pageYOffset + rect.top - this.HEADER_OFFSET - this.TOP_PADDING);
        
        // 同じ位置へのスクロールは不要（誤差10px許容）
        if (this._lastTargetPosition !== null && 
            Math.abs(targetPosition - this._lastTargetPosition) < 10) {
            return;
        }
        
        this._doScroll(targetPosition);
    },

    /**
     * スクロール実行（カスタムアニメーション）
     * @param {number} targetPosition - スクロール先の位置
     */
    _doScroll(targetPosition) {
        // 現在位置との差が小さければスキップ（既にほぼ同じ位置）
        const startPosition = window.pageYOffset;
        const distance = targetPosition - startPosition;
        
        if (Math.abs(distance) < 10) {
            return;
        }
        
        this._lastTargetPosition = targetPosition;
        
        // 進行中のアニメーションをキャンセル
        if (this._animationId) {
            cancelAnimationFrame(this._animationId);
        }
        
        const startTime = performance.now();
        const duration = this.SCROLL_DURATION;
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // イージング関数（easeOutCubic: 減速しながら停止）
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            
            const currentPosition = startPosition + (distance * easeProgress);
            window.scrollTo(0, currentPosition);
            
            if (progress < 1) {
                this._animationId = requestAnimationFrame(animate);
            } else {
                this._animationId = null;
            }
        };
        
        this._animationId = requestAnimationFrame(animate);
    },

    /**
     * 状態をリセット（フォームクリア時などに呼び出し）
     */
    reset() {
        this._lastTargetPosition = null;
        if (this._animationId) {
            cancelAnimationFrame(this._animationId);
            this._animationId = null;
        }
    }
};


// ============================================
// FormState: 状態の一元管理 + イベント発行
// ============================================
class FormState {
    constructor() {
        // ナビゲーション状態
        this.questionIndex = -1;      // -1 = ID入力、0以上 = 設問インデックス
        this.tableRowIndex = 0;       // 表形式の現在行
        
        // 編集状態
        this.editingIndex = -1;       // -1 = 新規、0以上 = 編集中レコードのインデックス
        this.deleteTargetIndex = -1;  // 削除対象インデックス
        
        // 2桁入力状態
        this.digitBuffer = '';        // 入力中の数字バッファ
        this.digitTimer = null;       // タイムアウト用タイマー
        
        // キャッシュ
        this.questionList = [];       // 設問要素のリスト
        this.elements = {};           // DOM要素キャッシュ
        
        // 設定（外部から注入）
        this.config = null;
        this.operatorName = '';
        
        // イベントリスナー
        this._listeners = {};
    }

    // --- イベント発行/購読 ---
    on(event, callback) {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push(callback);
    }

    emit(event, data = {}) {
        const listeners = this._listeners[event] || [];
        listeners.forEach(cb => cb(data));
    }

    // --- 状態変更メソッド（変更時にイベント発行）---
    setQuestionIndex(index, options = {}) {
        const oldIndex = this.questionIndex;
        if (index < -1 || index >= this.questionList.length) return false;
        
        this.questionIndex = index;
        
        // 表形式の場合、行インデックスをリセット
        const question = this.getCurrentQuestion();
        if (question?.dataset.type === 'table') {
            this.tableRowIndex = options.tableRow ?? 0;
        } else {
            this.tableRowIndex = 0;
        }
        
        this.emit('questionChange', { 
            oldIndex, 
            newIndex: index, 
            tableRow: this.tableRowIndex,
            skipScroll: options.skipScroll,
            skipFocus: options.skipFocus
        });
        return true;
    }

    setTableRowIndex(index) {
        const question = this.getCurrentQuestion();
        const tableConfig = this.getTableConfig();
        if (!tableConfig) return false;
        
        const maxRow = (tableConfig.rowNames?.length || 1) - 1;
        if (index < 0 || index > maxRow) return false;
        
        this.tableRowIndex = index;
        this.emit('tableRowChange', { rowIndex: index, question });
        return true;
    }

    // --- ゲッター ---
    getCurrentQuestion() {
        return this.questionList[this.questionIndex] || null;
    }

    getTableConfig() {
        const question = this.getCurrentQuestion();
        if (!question || question.dataset.type !== 'table') return null;
        return this.config?.tableConfigs?.[question.dataset.name] || null;
    }

    isAtIdSection() {
        return this.questionIndex === -1;
    }

    hasValidId() {
        return !!this.elements.respondentId?.value.trim();
    }

    // --- 2桁入力バッファ管理 ---
    setDigitBuffer(digit) {
        this.clearDigitTimer();
        this.digitBuffer = digit;
        this.emit('digitBufferChange', { buffer: digit });
    }

    appendDigitBuffer(digit) {
        const combined = this.digitBuffer + digit;
        this.clearDigitTimer();
        this.digitBuffer = '';
        this.emit('digitBufferChange', { buffer: '' });
        return combined;
    }

    clearDigitBuffer() {
        this.clearDigitTimer();
        this.digitBuffer = '';
        this.emit('digitBufferChange', { buffer: '' });
    }

    setDigitTimer(callback, delay) {
        this.clearDigitTimer();
        this.digitTimer = setTimeout(callback, delay);
    }

    clearDigitTimer() {
        if (this.digitTimer) {
            clearTimeout(this.digitTimer);
            this.digitTimer = null;
        }
    }

    // --- 初期化 ---
    init(config, elements) {
        this.config = config;
        this.elements = elements;
        // 全ての設問をリストに含める（子設問含む）
        // 表示/非表示はナビゲーション時に ConditionEvaluator.isVisible で判定
        this.questionList = Array.from(
            document.querySelectorAll('.question[data-name]')
        );
        
        // operatorNameはsetOperatorNameで別途設定
    }

    // 入力者名を設定
    setOperatorName(name) {
        this.operatorName = name || '';
    }
}


// ============================================
// ConditionEvaluator: 条件分岐の判定
// ============================================
class ConditionEvaluator {
    constructor(state) {
        this.state = state;
        // 現在の表示状態キャッシュ（targetId → boolean）
        this._visibilityCache = new Map();
        // 手動オーバーライド状態（targetId → 'open' | null）
        this._manualOverrides = new Map();
        // 展開アイコン要素のキャッシュ（targetId → icon element）
        this._toggleButtons = new Map();
        // 全条件分岐先を常に表示するモード
        this._showAll = false;
    }

    /**
     * 全条件分岐先の常時表示モードを切り替え
     * @param {boolean} showAll - trueで常に表示
     */
    setShowAll(showAll) {
        this._showAll = showAll;

        // 全ての条件分岐先を取得して表示/非表示を切り替え
        for (const conditions of Object.values(this.conditionMap)) {
            for (const cond of conditions) {
                const targetEl = cond.isSection
                    ? document.getElementById(cond.targetId)
                    : document.getElementById(`q_${cond.targetId}`);
                if (!targetEl) continue;

                if (showAll) {
                    targetEl.classList.add('show');
                    this._updateToggleIcon(cond.targetId, true, false);
                } else {
                    // 条件を再評価
                    this._visibilityCache.delete(cond.targetId);
                }
            }
        }

        // showAllがfalseの場合、全ての条件を再評価
        if (!showAll) {
            this._manualOverrides.clear();
            for (const parentId of Object.keys(this.conditionMap)) {
                const fieldType = document.querySelector(`input[type="checkbox"][name="${parentId}"]`)
                    ? 'checkbox' : 'radio';
                this.evaluate(parentId, fieldType);
            }
        }
    }

    get conditionMap() {
        return this.state.config?.conditionMap || {};
    }

    /**
     * 設問が表示されているか判定
     */
    isVisible(questionEl) {
        if (!questionEl) return false;
        
        // 自身が条件付きで非表示
        if (questionEl.classList.contains('conditional') && 
            !questionEl.classList.contains('show')) {
            return false;
        }
        
        // 親が条件付きで非表示
        const conditionalParent = questionEl.parentElement?.closest('.conditional');
        if (conditionalParent && !conditionalParent.classList.contains('show')) {
            return false;
        }
        
        return true;
    }

    /**
     * 条件分岐を評価して表示/非表示を切り替え
     */
    evaluate(fieldName, fieldType) {
        const conditions = this.conditionMap[fieldName];
        if (!conditions) return;

        if (fieldType === 'checkbox') {
            this._evaluateCheckbox(fieldName, conditions);
        } else {
            this._evaluateRadio(fieldName, conditions);
        }
    }

    _evaluateRadio(name, conditions) {
        const checked = document.querySelector(`input[name="${name}"]:checked`);
        const value = checked?.value || '';
        const valueNum = parseInt(value, 10);

        for (const cond of conditions) {
            const targetId = cond.targetId;

            // 常時表示モードまたは手動オーバーライドがある場合はスキップ
            if (this._showAll || this._manualOverrides.get(targetId)) {
                continue;
            }

            const shouldShow = value !== '' && cond.showValues.includes(valueNum);
            
            // 状態が変わらない場合はスキップ
            const wasVisible = this._visibilityCache.get(targetId);
            if (wasVisible === shouldShow) continue;
            
            // セクションか設問かで要素を取得（セクションはq_プレフィックスなし）
            const targetEl = cond.isSection 
                ? document.getElementById(targetId)
                : document.getElementById(`q_${targetId}`);
            if (!targetEl) continue;

            this._visibilityCache.set(targetId, shouldShow);
            targetEl.classList.toggle('show', shouldShow);
            
            // ボタンの状態を更新
            this._updateToggleButton(targetId, shouldShow, false);
            
            // 非表示になったときだけクリア
            if (!shouldShow) this._clearInputs(targetEl);
        }
    }

    _evaluateCheckbox(name, conditions) {
        const checkedInputs = document.querySelectorAll(`input[name="${name}"]:checked`);
        const checkedValues = Array.from(checkedInputs).map(inp => parseInt(inp.value, 10));

        for (const cond of conditions) {
            const targetId = cond.targetId;

            // 常時表示モードまたは手動オーバーライドがある場合はスキップ
            if (this._showAll || this._manualOverrides.get(targetId)) {
                continue;
            }

            const shouldShow = checkedValues.some(v => cond.showValues.includes(v));
            
            // 状態が変わらない場合はスキップ
            const wasVisible = this._visibilityCache.get(targetId);
            if (wasVisible === shouldShow) continue;
            
            // セクションか設問かで要素を取得（セクションはq_プレフィックスなし）
            const targetEl = cond.isSection 
                ? document.getElementById(targetId)
                : document.getElementById(`q_${targetId}`);
            if (!targetEl) continue;

            this._visibilityCache.set(targetId, shouldShow);
            targetEl.classList.toggle('show', shouldShow);
            
            // ボタンの状態を更新
            this._updateToggleButton(targetId, shouldShow, false);
            
            if (!shouldShow) this._clearInputs(targetEl);
        }
    }

    /**
     * 手動で条件分岐先を開く/閉じる
     * @param {string} targetId - 対象の設問ID
     */
    toggleManual(targetId) {
        // 対象要素を取得
        let targetEl = document.getElementById(`q_${targetId}`);
        if (!targetEl) {
            targetEl = document.getElementById(targetId); // セクションの場合
        }
        if (!targetEl) return;
        
        const isManuallyOpen = this._manualOverrides.get(targetId);
        
        if (isManuallyOpen) {
            // 手動オーバーライドを解除して条件判定に戻す
            this._manualOverrides.delete(targetId);
            this._visibilityCache.delete(targetId);

            // 親設問の条件を再評価
            this._reevaluateForTarget(targetId);

            const isNowOpen = targetEl.classList.contains('show');
            this._updateToggleButton(targetId, isNowOpen, false);
        } else {
            // 手動で開く
            this._manualOverrides.set(targetId, 'open');
            targetEl.classList.add('show');
            this._updateToggleButton(targetId, true, true);
        }
    }

    /**
     * 指定した親設問の条件分岐先をすべて開く
     * @param {string} parentId - 親設問のID
     * @returns {boolean} 開いた分岐があればtrue
     */
    openBranchesForParent(parentId) {
        const conditions = this.conditionMap[parentId];
        if (!conditions || conditions.length === 0) return false;

        let opened = false;
        for (const cond of conditions) {
            const targetEl = cond.isSection
                ? document.getElementById(cond.targetId)
                : document.getElementById(`q_${cond.targetId}`);

            if (!targetEl || !targetEl.classList.contains('conditional')) continue;

            // 既に開いていなければ開く
            if (!targetEl.classList.contains('show')) {
                this._manualOverrides.set(cond.targetId, 'open');
                targetEl.classList.add('show');
                this._updateToggleIcon(cond.targetId, true, true);
                opened = true;
            }
        }
        return opened;
    }

    /**
     * 指定した親設問の条件分岐先をすべて閉じる（条件判定に戻す）
     * @param {string} parentId - 親設問のID
     * @returns {boolean} 閉じた分岐があればtrue
     */
    closeBranchesForParent(parentId) {
        const conditions = this.conditionMap[parentId];
        if (!conditions || conditions.length === 0) return false;

        let closed = false;
        for (const cond of conditions) {
            // 手動オーバーライドがあれば解除
            if (this._manualOverrides.has(cond.targetId)) {
                this._manualOverrides.delete(cond.targetId);
                this._visibilityCache.delete(cond.targetId);
                closed = true;
            }
        }

        // 条件を再評価
        if (closed) {
            const fieldType = document.querySelector(`input[type="checkbox"][name="${parentId}"]`)
                ? 'checkbox' : 'radio';
            this.evaluate(parentId, fieldType);
        }
        return closed;
    }

    /**
     * 特定の条件分岐先に対する条件を再評価
     */
    _reevaluateForTarget(targetId) {
        for (const [parentId, conditions] of Object.entries(this.conditionMap)) {
            for (const cond of conditions) {
                if (cond.targetId === targetId) {
                    const fieldType = document.querySelector(`input[type="checkbox"][name="${parentId}"]`) 
                        ? 'checkbox' : 'radio';
                    this.evaluate(parentId, fieldType);
                    return;
                }
            }
        }
    }

    /**
     * 展開アイコンの状態を更新
     */
    _updateToggleIcon(targetId, isOpen, isManual) {
        const icon = this._toggleButtons.get(targetId);
        if (!icon) return;

        if (isOpen) {
            icon.textContent = '−';
            icon.title = isManual ? '手動展開中（-キーまたはクリックで戻す）' : '展開中';
            icon.classList.add('expanded');
            icon.classList.toggle('manual-override', isManual);
        } else {
            icon.textContent = '+';
            icon.title = '分岐先を開く (+キー)';
            icon.classList.remove('expanded', 'manual-override');
        }
    }

    // 後方互換: _updateToggleButtonを_updateToggleIconにマッピング
    _updateToggleButton(targetId, isOpen, isManual) {
        this._updateToggleIcon(targetId, isOpen, isManual);
    }

    /**
     * 条件分岐先の展開アイコンを生成・設置（設問タイトル横に配置）
     */
    setupToggleButtons() {
        // conditionMapから全ての条件分岐先の親設問を取得
        const parentToTargets = new Map(); // parentId → [{targetId, isSection}]

        for (const [parentId, conditions] of Object.entries(this.conditionMap)) {
            for (const cond of conditions) {
                if (!parentToTargets.has(parentId)) {
                    parentToTargets.set(parentId, []);
                }
                parentToTargets.get(parentId).push({
                    targetId: cond.targetId,
                    isSection: cond.isSection
                });
            }
        }

        // 各親設問のタイトル横にアイコンを追加
        for (const [parentId, targets] of parentToTargets) {
            const parentEl = document.getElementById(`q_${parentId}`);
            if (!parentEl) continue;

            const titleEl = parentEl.querySelector('.question-title');
            if (!titleEl) continue;

            // 既にアイコンがあればスキップ
            if (titleEl.querySelector('.conditional-icon')) continue;

            // 各ターゲットに対してアイコンを作成
            for (const target of targets) {
                const targetEl = target.isSection
                    ? document.getElementById(target.targetId)
                    : document.getElementById(`q_${target.targetId}`);

                if (!targetEl || !targetEl.classList.contains('conditional')) continue;

                // アイコンを作成
                const icon = document.createElement('span');
                icon.className = 'conditional-icon';
                icon.textContent = '+';
                icon.title = '分岐先を開く (+キー)';
                icon.dataset.targetId = target.targetId;

                // クリックイベント
                icon.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.toggleManual(target.targetId);
                });

                // タイトルの末尾に追加
                titleEl.appendChild(icon);

                // キャッシュに保存
                this._toggleButtons.set(target.targetId, icon);
            }
        }
    }

    _clearInputs(container) {
        // チェック状態のみクリア（軽量化）
        const checkedInputs = container.querySelectorAll('input:checked');
        checkedInputs.forEach(inp => {
            inp.checked = false;
            inp.closest('.option-label, .scale-option, .table-option')?.classList.remove('selected');
        });
        
        // テキスト系は値があるものだけ
        container.querySelectorAll('input[type="text"], input[type="number"]').forEach(inp => {
            if (inp.value) inp.value = '';
        });
        container.querySelectorAll('textarea').forEach(ta => {
            if (ta.value) ta.value = '';
        });
        container.querySelectorAll('select').forEach(sel => {
            if (sel.selectedIndex !== 0) sel.selectedIndex = 0;
        });
        
        // その他入力欄を非表示に
        container.querySelectorAll('.other-input').forEach(el => {
            el.classList.remove('show');
        });
    }

    /**
     * キャッシュをクリア（フォームリセット時に呼ぶ）
     */
    clearCache() {
        this._visibilityCache.clear();
        this._manualOverrides.clear();

        // 全アイコンをリセット
        for (const [targetId, icon] of this._toggleButtons) {
            icon.textContent = '+';
            icon.title = '分岐先を開く (+キー)';
            icon.classList.remove('expanded', 'manual-override');
        }
    }

    /**
     * 現在手動オーバーライドされている設問IDの一覧を取得
     * @returns {Array<string>} 手動オーバーライド中の設問ID配列
     */
    getManualOverrideIds() {
        return Array.from(this._manualOverrides.keys());
    }

    /**
     * 指定した設問が手動オーバーライド状態かどうかを判定
     * @param {string} questionId - 設問ID
     * @returns {boolean}
     */
    isManuallyOverridden(questionId) {
        return this._manualOverrides.has(questionId);
    }

    /**
     * 指定した条件分岐先の条件が実際に満たされているかを判定
     * @param {string} targetId - 条件分岐先の設問ID
     * @returns {boolean} 条件が満たされていればtrue
     */
    isConditionMet(targetId) {
        // conditionMapから、このtargetIdを制御する親設問を探す
        for (const [parentId, conditions] of Object.entries(this.conditionMap)) {
            for (const cond of conditions) {
                if (cond.targetId === targetId) {
                    // 親設問の現在の値を取得
                    const isCheckbox = !!document.querySelector(`input[type="checkbox"][name="${parentId}"]`);

                    if (isCheckbox) {
                        const checkedInputs = document.querySelectorAll(`input[name="${parentId}"]:checked`);
                        const checkedValues = Array.from(checkedInputs).map(inp => parseInt(inp.value, 10));
                        // いずれかの選択値がshowValuesに含まれていれば条件満たす
                        if (checkedValues.some(v => cond.showValues.includes(v))) {
                            return true;
                        }
                    } else {
                        const checked = document.querySelector(`input[name="${parentId}"]:checked`);
                        const value = checked ? parseInt(checked.value, 10) : null;
                        // 選択値がshowValuesに含まれていれば条件満たす
                        if (value !== null && cond.showValues.includes(value)) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    /**
     * 手動オーバーライドされているが、条件は満たされていない設問IDの一覧を取得
     * （本当に「強制的に開いた」設問のみ）
     * @returns {Array<string>}
     */
    getForcedOverrideIds() {
        const result = [];
        for (const targetId of this._manualOverrides.keys()) {
            if (!this.isConditionMet(targetId)) {
                result.push(targetId);
            }
        }
        return result;
    }
}


// ============================================
// Navigator: 設問間移動
// ============================================
class Navigator {
    constructor(state, conditionEvaluator) {
        this.state = state;
        this.condition = conditionEvaluator;
    }

    /**
     * 次の設問へ移動
     */
    moveNext() {
        const question = this.state.getCurrentQuestion();
        
        // 表形式の場合、まず行を進める
        if (question?.dataset.type === 'table') {
            const tableConfig = this.state.getTableConfig();
            const maxRow = (tableConfig?.rowNames?.length || 1) - 1;
            if (this.state.tableRowIndex < maxRow) {
                return this.state.setTableRowIndex(this.state.tableRowIndex + 1);
            }
        }

        // 次の表示設問を探す
        let nextIndex = this.state.questionIndex + 1;
        while (nextIndex < this.state.questionList.length) {
            const q = this.state.questionList[nextIndex];
            if (this.condition.isVisible(q)) {
                return this.state.setQuestionIndex(nextIndex);
            }
            nextIndex++;
        }

        // 末尾到達
        this.state.emit('reachEnd');
        return false;
    }

    /**
     * 前の設問へ移動
     */
    movePrev() {
        const question = this.state.getCurrentQuestion();
        
        // 表形式の場合、まず行を戻す
        if (question?.dataset.type === 'table') {
            if (this.state.tableRowIndex > 0) {
                return this.state.setTableRowIndex(this.state.tableRowIndex - 1);
            }
        }

        // 前の表示設問を探す
        let prevIndex = this.state.questionIndex - 1;
        while (prevIndex >= 0) {
            const q = this.state.questionList[prevIndex];
            if (this.condition.isVisible(q)) {
                // 表形式なら最終行へ
                if (q.dataset.type === 'table') {
                    const tableConfig = this.state.config?.tableConfigs?.[q.dataset.name];
                    const maxRow = (tableConfig?.rowNames?.length || 1) - 1;
                    return this.state.setQuestionIndex(prevIndex, { tableRow: maxRow });
                }
                return this.state.setQuestionIndex(prevIndex);
            }
            prevIndex--;
        }

        // ID入力へ
        return this.state.setQuestionIndex(-1);
    }

    /**
     * ID入力へ移動
     */
    focusId() {
        return this.state.setQuestionIndex(-1);
    }

    /**
     * 特定の設問へ移動（クリック時など）
     */
    focusQuestion(questionEl, options = {}) {
        const index = this.state.questionList.indexOf(questionEl);
        if (index >= 0) {
            this.state.setQuestionIndex(index, options);
        }
    }
}


// ============================================
// AnswerHandler: 回答の選択・解除・ハイライト
// ============================================
class AnswerHandler {
    constructor(state, conditionEvaluator) {
        this.state = state;
        this.condition = conditionEvaluator;

        // 2桁入力の待機時間（ミリ秒）
        this.DIGIT_WAIT_MS = 500;

        // 選択肢キャッシュ（設問名 → { inputs: NodeList, count: number }）
        this._optionCache = new Map();

        // 待機中の選択コールバック（Tab/クリック時の即時確定用）
        this._pendingSelect = null;
    }

    /**
     * 待機中の2桁入力バッファを即座に確定
     * Tab進行や他設問クリック時に呼び出す
     */
    flushDigitBuffer() {
        if (this.state.digitBuffer !== '' && this._pendingSelect) {
            const num = parseInt(this.state.digitBuffer, 10);
            this.state.clearDigitBuffer();
            this._pendingSelect(num);
            this._pendingSelect = null;
        }
    }

    get otherFieldMap() {
        return this.state.config?.otherFieldMap || {};
    }

    /**
     * 設問の選択肢情報をキャッシュから取得（なければ作成）
     * ※ネストされた子設問の選択肢は除外
     */
    _getOptionCache(question) {
        const name = question.dataset.name;
        if (!this._optionCache.has(name)) {
            // 全ての選択肢入力を取得
            const allInputs = question.querySelectorAll('.options input[type="radio"], .options input[type="checkbox"]');
            // この設問に直接属する入力のみフィルタ（子設問に属するものは除外）
            const inputs = Array.from(allInputs).filter(input => {
                const closestQuestion = input.closest('.question[data-name]');
                return closestQuestion === question;
            });
            this._optionCache.set(name, {
                inputs: inputs,
                count: inputs.length
            });
        }
        return this._optionCache.get(name);
    }

    /**
     * 数字キー入力を処理
     * - 選択肢が10個以上の場合: 0のみ待機、1-9は即時
     * - 0→0〜9で10〜19として解釈
     */
    handleDigitInput(digit) {
        const question = this.state.getCurrentQuestion();
        if (!question) return;

        const qType = question.dataset.type;

        if (qType === 'table') {
            this._handleTableDigit(digit, question);
        } else if (qType === 'scale') {
            this._handleScaleDigit(digit, question);
        } else {
            this._handleNormalDigit(digit, question);
        }
    }

    _handleNormalDigit(digit, question) {
        const cache = this._getOptionCache(question);
        this._handleTwoDigitInput(digit, cache.count, num => {
            this._selectOptionCached(question, num, cache);
        });
    }

    _handleScaleDigit(digit, question) {
        const scaleMax = parseInt(question.dataset.scaleMax || '10', 10);
        this._handleTwoDigitInput(digit, scaleMax, num => {
            this._selectScaleValue(question, num);
        });
    }

    /**
     * 2桁入力の共通処理
     * @param {string} digit - 押された数字キー
     * @param {number} maxValue - 選択肢の最大値
     * @param {Function} onSelect - 選択時のコールバック(num)
     */
    _handleTwoDigitInput(digit, maxValue, onSelect) {
        const pressedDigit = parseInt(digit, 10);
        const maxFirstDigit = Math.floor(maxValue / 10);

        if (this.state.digitBuffer !== '') {
            // 2桁目入力 → 結合して選択
            const combined = this.state.appendDigitBuffer(digit);
            this._pendingSelect = null;
            onSelect(parseInt(combined, 10));
        } else if (pressedDigit >= 1 && pressedDigit <= maxFirstDigit) {
            // 待機が必要な数字（1〜maxFirstDigit）
            this.state.setDigitBuffer(digit);
            // コールバックを保存（Tab/クリック時の即時確定用）
            this._pendingSelect = onSelect;
            this.state.setDigitTimer(() => {
                const num = parseInt(this.state.digitBuffer, 10);
                this.state.clearDigitBuffer();
                this._pendingSelect = null;
                onSelect(num);
            }, this.DIGIT_WAIT_MS);
        } else {
            // 即時選択（0、または待機不要な数字）
            this._pendingSelect = null;
            onSelect(pressedDigit);
        }
    }

    _handleTableDigit(digit, question) {
        const tableConfig = this.state.getTableConfig();
        if (!tableConfig) return;

        const rowName = tableConfig.rowNames?.[this.state.tableRowIndex];
        if (!rowName) return;

        // 表形式もキャッシュ（行名をキーに）
        const cacheKey = `${question.dataset.name}_${rowName}`;
        if (!this._optionCache.has(cacheKey)) {
            this._optionCache.set(cacheKey, {
                inputs: question.querySelectorAll(`input[name="${rowName}"]`)
            });
        }
        const radios = this._optionCache.get(cacheKey).inputs;

        this._handleTwoDigitInput(digit, radios.length, num => {
            if (num >= 1 && num <= radios.length) {
                this._selectTableRadio(question, rowName, radios[num - 1]);
            }
        });
    }

    /**
     * 通常選択肢を選択/解除（キャッシュ使用）
     */
    _selectOptionCached(question, num, cache) {
        const inputs = cache.inputs;
        if (num < 1 || num > inputs.length) return;

        const input = inputs[num - 1];
        const label = input.closest('.option-label');

        if (input.type === 'checkbox') {
            input.checked = !input.checked;
            label?.classList.toggle('selected', input.checked);
            this._handleCheckboxChange(input);
            // チェックを付けた時のみスクロール
            if (input.checked) {
                ScrollHelper.scrollIntoViewIfNeeded(label, { extraPadding: 10 });
            }
        } else {
            const wasChecked = input.checked;
            const parent = input.closest('.options');
            parent?.querySelectorAll('.option-label').forEach(l => l.classList.remove('selected'));
            
            if (wasChecked) {
                input.checked = false;
            } else {
                input.checked = true;
                label?.classList.add('selected');
                // 選択時のみスクロール
                ScrollHelper.scrollIntoViewIfNeeded(label, { extraPadding: 10 });
            }
            this._handleRadioChange(input);
        }
    }

    /**
     * 通常選択肢を選択/解除（クリック用・キャッシュなし）
     */
    _selectOption(question, num) {
        const cache = this._getOptionCache(question);
        this._selectOptionCached(question, num, cache);
    }

    /**
     * スケール選択肢を選択/解除
     */
    _selectScaleValue(question, value) {
        const scaleMax = parseInt(question.dataset.scaleMax || '10', 10);
        if (value < 0 || value > scaleMax) return;

        // スケール用キャッシュ
        const cacheKey = `scale_${question.dataset.name}`;
        if (!this._optionCache.has(cacheKey)) {
            this._optionCache.set(cacheKey, {
                inputs: question.querySelectorAll('.scale-option input'),
                labels: question.querySelectorAll('.scale-option')
            });
        }
        const cache = this._optionCache.get(cacheKey);

        const input = Array.from(cache.inputs).find(inp => parseInt(inp.value, 10) === value);
        if (!input) return;

        const label = input.closest('.scale-option');
        const wasChecked = input.checked;

        cache.labels.forEach(l => l.classList.remove('selected'));

        if (wasChecked) {
            input.checked = false;
        } else {
            input.checked = true;
            label?.classList.add('selected');
            // 選択時のみスクロール
            ScrollHelper.scrollIntoViewIfNeeded(label, { extraPadding: 10 });
        }
        this._handleRadioChange(input);
    }

    /**
     * 表形式のラジオ選択/解除
     * ※スクロールはUIUpdater._scrollToTableRowに任せる（行単位で管理）
     */
    _selectTableRadio(question, rowName, radio) {
        const wasChecked = radio.checked;
        const radios = question.querySelectorAll(`input[name="${rowName}"]`);

        radios.forEach(r => {
            r.checked = false;
            r.closest('.table-option')?.classList.remove('selected');
        });

        if (!wasChecked) {
            radio.checked = true;
            radio.closest('.table-option')?.classList.add('selected');
        }
    }

    /**
     * クリックによる選択処理
     */
    handleOptionClick(label, isScale = false) {
        const input = label.querySelector('input');
        if (!input) return;

        if (input.type === 'checkbox') {
            input.checked = !input.checked;
            label.classList.toggle('selected', input.checked);
            this._handleCheckboxChange(input);
        } else {
            const parentSelector = isScale ? '.scale-options' : '.options';
            const optionSelector = isScale ? '.scale-option' : '.option-label';
            const parent = label.closest(parentSelector);
            
            const wasChecked = input.checked;
            parent?.querySelectorAll(optionSelector).forEach(l => l.classList.remove('selected'));

            if (wasChecked) {
                input.checked = false;
            } else {
                input.checked = true;
                label.classList.add('selected');
            }
            this._handleRadioChange(input);
        }
    }

    /**
     * 表のラジオクリック処理
     */
    handleTableRadioClick(radio) {
        const name = radio.name;
        const wasChecked = radio.dataset.wasChecked === 'true';

        if (wasChecked) {
            radio.checked = false;
            radio.dataset.wasChecked = 'false';
            radio.closest('.table-option')?.classList.remove('selected');
        } else {
            document.querySelectorAll(`input[name="${name}"]`).forEach(r => {
                r.dataset.wasChecked = 'false';
                r.closest('.table-option')?.classList.remove('selected');
            });
            radio.dataset.wasChecked = 'true';
            radio.closest('.table-option')?.classList.add('selected');
        }
    }

    // --- 内部: 変更後処理 ---
    _handleRadioChange(input) {
        const name = input.name;
        const value = input.checked ? input.value : '';
        
        this.condition.evaluate(name, 'radio');
        this._handleOtherField(name, value);
    }

    _handleCheckboxChange(input) {
        const name = input.name;
        const value = input.value;
        const container = input.closest('.options');

        // 最大選択数チェック
        if (container) {
            const maxSelect = parseInt(container.dataset.maxSelect, 10);
            if (maxSelect) this._enforceMaxSelect(container, maxSelect);
        }

        // その他フィールド（配列対応）
        const otherValues = this.otherFieldMap[name];
        if (otherValues && Array.isArray(otherValues) && otherValues.includes(value)) {
            if (input.checked) {
                this._showOtherInput(name, value);
            } else {
                this._hideOtherInput(name, value);
            }
        }

        this.condition.evaluate(name, 'checkbox');
    }

    _handleOtherField(name, value) {
        const otherValues = this.otherFieldMap[name];
        if (!otherValues || !Array.isArray(otherValues)) return;

        // 配列内の各other値に対して表示/非表示を制御
        for (const otherValue of otherValues) {
            if (value === otherValue) {
                this._showOtherInput(name, otherValue);
            } else {
                this._hideOtherInput(name, otherValue);
            }
        }
    }

    _showOtherInput(questionId, value) {
        const otherInput = document.getElementById(`other_${questionId}_${value}`);
        if (otherInput) {
            otherInput.classList.add('show');
            otherInput.querySelector('input, textarea')?.focus({ preventScroll: true });
        }
    }

    _hideOtherInput(questionId, value) {
        const otherInput = document.getElementById(`other_${questionId}_${value}`);
        if (otherInput) {
            otherInput.classList.remove('show');
            // テキストボックスの値もクリア
            const input = otherInput.querySelector('input, textarea');
            if (input) input.value = '';
        }
    }

    _enforceMaxSelect(container, maxSelect) {
        const checkboxes = container.querySelectorAll('input[type="checkbox"]');
        const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;

        checkboxes.forEach(cb => {
            const label = cb.closest('.option-label');
            if (checkedCount >= maxSelect && !cb.checked) {
                label?.classList.add('disabled');
            } else {
                label?.classList.remove('disabled');
            }
        });
    }
}


// ============================================
// InputRouter: キー/クリックの振り分け
// ============================================
class InputRouter {
    constructor(state, navigator, answerHandler, conditionEvaluator) {
        this.state = state;
        this.navigator = navigator;
        this.answerHandler = answerHandler;
        this.condition = conditionEvaluator;

        this.onModalKeydown = null;  // モーダル用コールバック
        this.onEnterAtEnd = null;    // 最終設問でEnter時のコールバック
        this.onIdRequired = null;    // ID未入力時のコールバック
    }

    setup() {
        document.addEventListener('keydown', e => this._handleKeydown(e));
        
        // 通常選択肢のクリック
        document.querySelectorAll('.option-label').forEach(label => {
            label.addEventListener('click', e => this._handleOptionClick(e, label, false));
        });
        
        // 選択肢内のinputクリックは伝播停止
        document.querySelectorAll('.option-label input').forEach(input => {
            input.addEventListener('click', e => e.stopPropagation());
        });
        
        // スケール選択肢のクリック
        document.querySelectorAll('.scale-option').forEach(label => {
            label.addEventListener('click', e => this._handleOptionClick(e, label, true));
        });

        // 表形式ラジオのクリック
        document.querySelectorAll('.table-question input[type="radio"]').forEach(radio => {
            radio.dataset.wasChecked = radio.checked ? 'true' : 'false';
            radio.addEventListener('mousedown', function() {
                this.dataset.wasChecked = this.checked ? 'true' : 'false';
            });
            radio.addEventListener('click', e => this._handleTableRadioClick(e, radio));
        });
    }

    _handleKeydown(e) {
        // モーダルが開いている場合
        if (this.onModalKeydown?.(e)) return;

        const activeEl = document.activeElement;
        const isTextInput = activeEl.tagName === 'INPUT' && 
                           (activeEl.type === 'text' || activeEl.type === 'number');
        const isTextarea = activeEl.tagName === 'TEXTAREA';
        const isSelect = activeEl.tagName === 'SELECT';
        const isButton = activeEl.tagName === 'BUTTON';

        // Tab/Shift+Tab: 設問間移動
        if (e.key === 'Tab') {
            e.preventDefault();
            this._handleTab(activeEl, e.shiftKey);
            return;
        }

        // Enter: 次へ進む or 保存確認
        if (e.key === 'Enter') {
            if (isButton) return;
            if (isTextInput || isSelect) {
                e.preventDefault();
                this._handleEnterInInput(activeEl);
            } else if (!isTextarea) {
                e.preventDefault();
                this.onEnterAtEnd?.();
            }
            return;
        }

        // テキスト入力中は数字キー無効
        if (isTextInput || isSelect || isTextarea) return;

        // 数字キー: 選択肢を選択
        if (/^[0-9]$/.test(e.key) && this.state.questionIndex >= 0) {
            if (!this.state.hasValidId()) {
                e.preventDefault();
                this.onIdRequired?.('先にIDを入力してください');
                this.navigator.focusId();
                return;
            }
            e.preventDefault();
            this.answerHandler.handleDigitInput(e.key);
            return;
        }

        // +キー: 現在の設問の条件分岐先を開く
        if (e.key === '+' && this.state.questionIndex >= 0) {
            const question = this.state.getCurrentQuestion();
            if (question) {
                const questionId = question.id?.replace('q_', '') || question.dataset.questionId;
                if (questionId && this.condition.openBranchesForParent(questionId)) {
                    e.preventDefault();
                }
            }
            return;
        }

        // -キー: 現在の設問の条件分岐先を閉じる
        if (e.key === '-' && this.state.questionIndex >= 0) {
            const question = this.state.getCurrentQuestion();
            if (question) {
                const questionId = question.id?.replace('q_', '') || question.dataset.questionId;
                if (questionId && this.condition.closeBranchesForParent(questionId)) {
                    e.preventDefault();
                }
            }
            return;
        }
    }

    _handleTab(activeEl, isShiftTab) {
        // 複数フィールド内での移動を試みる
        const question = this.state.getCurrentQuestion();
        if (question) {
            const moved = this._handleMultiFieldNav(activeEl, question, isShiftTab);
            if (moved) return;
        }

        // 待機中の2桁入力バッファを即座に確定
        this.answerHandler.flushDigitBuffer();

        // 現在位置を同期（blur前に実行）
        this._syncFocusPosition(activeEl);

        // フォーカスを確実に外す
        if (document.activeElement && document.activeElement !== document.body) {
            document.activeElement.blur();
        }

        if (isShiftTab) {
            this.navigator.movePrev();
        } else {
            if (this.state.isAtIdSection() && !this.state.hasValidId()) {
                this.onIdRequired?.('IDを入力してください');
                return;
            }
            this.navigator.moveNext();
        }
    }

    _handleMultiFieldNav(activeEl, question, isShiftTab) {
        // 数値入力フィールドの複数入力
        const numberFields = question.querySelectorAll('.number-field input');
        if (numberFields.length > 1) {
            const idx = Array.from(numberFields).indexOf(activeEl);
            if (idx >= 0) {
                if (isShiftTab && idx > 0) {
                    numberFields[idx - 1].focus();
                    return true;
                }
                if (!isShiftTab && idx < numberFields.length - 1) {
                    numberFields[idx + 1].focus();
                    return true;
                }
            }
        }

        // 和暦入力フィールド
        const warekiContainer = question.querySelector('.date-wareki-input');
        if (warekiContainer) {
            const warekiFields = warekiContainer.querySelectorAll('select, input');
            const idx = Array.from(warekiFields).indexOf(activeEl);
            if (idx >= 0) {
                if (isShiftTab && idx > 0) {
                    warekiFields[idx - 1].focus();
                    return true;
                }
                if (!isShiftTab && idx < warekiFields.length - 1) {
                    warekiFields[idx + 1].focus();
                    return true;
                }
            }
        }

        return false;
    }

    _syncFocusPosition(activeEl) {
        const question = activeEl.closest('.question[data-name]');
        if (!question) return;

        const index = this.state.questionList.indexOf(question);
        if (index >= 0 && index !== this.state.questionIndex) {
            this.state.setQuestionIndex(index, { skipScroll: true });
        }
    }

    _handleEnterInInput(activeEl) {
        const question = this.state.getCurrentQuestion();
        if (question) {
            const moved = this._handleMultiFieldNav(activeEl, question, false);
            if (moved) return;
        }
        this.navigator.moveNext();
    }

    _handleOptionClick(e, label, isScale) {
        e.preventDefault();

        if (!this.state.hasValidId()) {
            this.onIdRequired?.('先にIDを入力してください');
            this.navigator.focusId();
            return;
        }

        // 待機中の2桁入力バッファを即座に確定
        this.answerHandler.flushDigitBuffer();

        // 選択肢からフォーカスを外す（枠線を消す）
        if (document.activeElement && document.activeElement !== document.body) {
            document.activeElement.blur();
        }

        this.answerHandler.handleOptionClick(label, isScale);

        // クリックした設問が現在位置より後ろの場合のみ移動（前に戻る訂正では移動しない）
        const question = label.closest('.question[data-name]');
        if (question) {
            const clickedIndex = this.state.questionList.indexOf(question);
            if (clickedIndex > this.state.questionIndex) {
                this.navigator.focusQuestion(question, { skipScroll: true, skipFocus: true });
            }
        }
    }

    _handleTableRadioClick(e, radio) {
        if (!this.state.hasValidId()) {
            e.preventDefault();
            this.onIdRequired?.('先にIDを入力してください');
            this.navigator.focusId();
            return;
        }

        // 待機中の2桁入力バッファを即座に確定
        this.answerHandler.flushDigitBuffer();

        // 選択肢からフォーカスを外す（枠線を消す）
        if (document.activeElement && document.activeElement !== document.body) {
            document.activeElement.blur();
        }

        this.answerHandler.handleTableRadioClick(radio);

        // クリックした設問が現在位置より後ろの場合のみ移動
        const question = radio.closest('.question[data-name]');
        if (question) {
            const clickedIndex = this.state.questionList.indexOf(question);
            if (clickedIndex > this.state.questionIndex) {
                this.navigator.focusQuestion(question, { skipScroll: true, skipFocus: true });
            }
        }
    }
}


// ============================================
// ModalController: モーダル表示制御
// ============================================
class ModalController {
    constructor(state) {
        this.state = state;
    }

    get elements() {
        return this.state.elements;
    }

    // 確認モーダル
    showConfirm() {
        try {
            const id = this.state.elements.respondentId?.value?.trim() || '（未入力）';
            if (this.elements.confirmId) this.elements.confirmId.textContent = id;
            this.elements.confirmModal?.classList.add('show');
        } catch (e) {
            console.error('showConfirm error:', e);
        }
    }

    closeConfirm() {
        this.elements.confirmModal?.classList.remove('show');
    }

    // 成功モーダル
    showSuccess() {
        const id = this.state.elements.respondentId?.value.trim() || '';
        if (this.elements.savedId) this.elements.savedId.textContent = id;
        this.elements.successModal?.classList.add('show');
    }

    closeSuccess() {
        this.elements.successModal?.classList.remove('show');
    }

    // データ一覧モーダル
    showDataList(records, onEdit, onDelete) {
        const tbody = this.elements.dataListBody;
        if (!tbody) return;

        // 手動展開回答があるレコードが存在するかチェック
        const hasAnyManualOverride = records.some(r => r['_manualOverrideFields']);
        const legend = document.querySelector('.data-list-legend');
        if (legend) {
            legend.style.display = hasAnyManualOverride ? 'block' : 'none';
        }

        tbody.innerHTML = '';
        records.forEach((record, index) => {
            const tr = document.createElement('tr');
            const hasManualOverride = !!record['_manualOverrideFields'];

            // 条件を満たさず手動展開された回答がある場合はハイライト
            if (hasManualOverride) {
                tr.classList.add('manual-override-row');
                tr.title = `条件外の手動展開回答: ${record['_manualOverrideFields']}`;
            }

            tr.innerHTML = `
                <td>${this._escape(record.ID || '')}${hasManualOverride ? ' <span class="manual-override-badge" title="条件を満たさない設問に回答あり">⚠</span>' : ''}</td>
                <td>${this._escape(record['入力日時'] || '')}</td>
                <td>${this._escape(record['入力者'] || '')}</td>
                <td>
                    <button class="btn-small btn-edit" data-index="${index}">編集</button>
                    <button class="btn-small btn-delete" data-index="${index}">削除</button>
                </td>
            `;
            tr.querySelector('.btn-edit').addEventListener('click', () => onEdit(index));
            tr.querySelector('.btn-delete').addEventListener('click', () => onDelete(index));
            tbody.appendChild(tr);
        });

        this.elements.dataListModal?.classList.add('show');
    }

    closeDataList() {
        this.elements.dataListModal?.classList.remove('show');
    }

    // 削除確認モーダル
    showDeleteConfirm(id) {
        if (this.elements.deleteTargetId) {
            this.elements.deleteTargetId.textContent = id || '（ID未設定）';
        }
        this.elements.deleteConfirmModal?.classList.add('show');
    }

    closeDeleteConfirm() {
        this.elements.deleteConfirmModal?.classList.remove('show');
    }

    // 現在開いているモーダルに対するキー処理
    handleKeydown(e) {
        if (this.elements.successModal?.classList.contains('show')) {
            if (e.key === 'Enter' || e.key === 'Escape') {
                this.closeSuccess();
                return true;
            }
        }
        if (this.elements.confirmModal?.classList.contains('show')) {
            if (e.key === 'Escape') {
                e.preventDefault();
                this.closeConfirm();
                return true;
            }
            // Enter は外部で処理（保存実行）
            if (e.key === 'Enter') {
                e.preventDefault();
                return 'confirm';
            }
        }
        if (this.elements.dataListModal?.classList.contains('show')) {
            if (e.key === 'Escape') {
                e.preventDefault();
                this.closeDataList();
                return true;
            }
        }
        if (this.elements.deleteConfirmModal?.classList.contains('show')) {
            if (e.key === 'Escape') {
                e.preventDefault();
                this.closeDeleteConfirm();
                return true;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                return 'delete';
            }
        }
        return false;
    }

    _escape(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}


// ============================================
// UIUpdater: UI表示更新
// ============================================
class UIUpdater {
    constructor(state) {
        this.state = state;
        this._setupListeners();
    }

    _setupListeners() {
        // 設問変更時
        this.state.on('questionChange', data => {
            this._updateHighlight(data.newIndex);
            this._updateIndicator();
            if (!data.skipScroll) {
                this._scrollToQuestion(data.newIndex);
            }
            if (!data.skipFocus) {
                this._focusElement(data.newIndex);
            }
            // 表形式の場合、行ハイライトも更新
            const question = this.state.questionList[data.newIndex];
            if (question?.dataset.type === 'table') {
                this._highlightTableRow(question, this.state.tableRowIndex);
                // 行へのスクロールも実行（設問スクロール後）
                if (!data.skipScroll) {
                    setTimeout(() => {
                        this._scrollToTableRow(question, this.state.tableRowIndex);
                    }, 100);
                }
            }
        });

        // 表の行変更時
        this.state.on('tableRowChange', data => {
            this._updateIndicator();
            this._highlightTableRow(data.question, data.rowIndex);
            this._scrollToTableRow(data.question, data.rowIndex);
        });

        // 末尾到達時
        this.state.on('reachEnd', () => {
            this._updateHighlight(-2); // 全解除
            this._clearAllTableRowHighlights();
            this._updateIndicatorText('入力完了');
            this.state.elements.saveBtn?.focus();
            this.state.elements.saveBtn?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });

        // 数字バッファ変更時
        this.state.on('digitBufferChange', data => {
            const indicator = document.getElementById('digitIndicator');
            if (indicator) {
                indicator.textContent = data.buffer;
                indicator.style.display = data.buffer ? 'block' : 'none';
            }
        });
    }

    /**
     * 回答中設問のハイライト表示
     */
    _updateHighlight(index) {
        // 全設問のハイライト解除
        this.state.questionList.forEach(q => q.classList.remove('active'));
        this.state.elements.idSection?.classList.remove('active');
        
        // 前の表形式設問の行ハイライトをクリア
        this._clearAllTableRowHighlights();

        if (index === -1) {
            // ID入力セクション
            this.state.elements.idSection?.classList.add('active');
        } else if (index >= 0 && index < this.state.questionList.length) {
            // 設問
            this.state.questionList[index].classList.add('active');
        }
        // index === -2 の場合は全解除のみ
    }

    /**
     * 表形式設問の行ハイライト
     */
    _highlightTableRow(question, rowIndex) {
        if (!question) return;
        const rows = question.querySelectorAll('tbody tr');
        rows.forEach((row, i) => {
            row.style.background = i === rowIndex ? 'rgba(46, 125, 50, 0.08)' : 'Canvas';
        });
    }

    /**
     * 全ての表形式設問の行ハイライトをクリア
     */
    _clearAllTableRowHighlights() {
        document.querySelectorAll('.table-question tbody tr').forEach(row => {
            row.style.background = '';
        });
    }

    /**
     * 表形式設問の行にスクロール（必要な場合のみ）
     */
    _scrollToTableRow(question, rowIndex) {
        if (!question) return;
        
        const rows = question.querySelectorAll('tbody tr');
        const row = rows[rowIndex];
        if (!row) return;

        // ScrollHelperの共通メソッドを使用
        ScrollHelper.scrollIntoViewIfNeeded(row);
    }

    _updateIndicator() {
        const index = this.state.questionIndex;
        
        if (index === -1) {
            this._updateIndicatorText('ID入力');
            return;
        }

        const question = this.state.getCurrentQuestion();
        if (!question) return;

        if (question.dataset.type === 'table') {
            const tableConfig = this.state.getTableConfig();
            const rowLabels = tableConfig?.rowLabels || [];
            const label = rowLabels[this.state.tableRowIndex] || `行${this.state.tableRowIndex + 1}`;
            const num = question.querySelector('.num')?.textContent || question.dataset.name;
            this._updateIndicatorText(`${num} ${label}`);
        } else {
            const num = question.querySelector('.num');
            this._updateIndicatorText(num ? num.textContent : question.dataset.name);
        }
    }

    _updateIndicatorText(text) {
        if (this.state.elements.currentIndicator) {
            this.state.elements.currentIndicator.textContent = text;
        }
    }

    _scrollToQuestion(index) {
        if (index === -1) {
            this.state.elements.idSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }

        const question = this.state.questionList[index];
        if (!question) return;

        // DOMレイアウト完了を待ってからスクロール
        // （条件分岐で表示された直後は位置計算が不正確なため）
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                ScrollHelper.scrollLargeElementIntoView(question);
            });
        });
    }

    _focusElement(index) {
        if (index === -1) {
            this.state.elements.respondentId?.focus({ preventScroll: true });
            return;
        }

        const question = this.state.questionList[index];
        if (!question) return;

        // テキスト入力がある場合はそこにフォーカス
        const firstInput = question.querySelector('input[type="text"], input[type="number"], textarea, select');
        if (firstInput) {
            firstInput.focus({ preventScroll: true });
            return;
        }
        
        // ラジオ/チェックボックスのみの設問は、設問要素自体にフォーカス（枠線なしで）
        question.setAttribute('tabindex', '-1');
        question.style.outline = 'none';
        question.focus({ preventScroll: true });
    }
}


// ============================================
// SurveyApp: エントリーポイント・統合
// ============================================
class SurveyApp {
    constructor(config) {
        // 状態管理
        this.state = new FormState();
        
        // 各モジュール
        this.condition = new ConditionEvaluator(this.state);
        this.navigator = new Navigator(this.state, this.condition);
        this.answerHandler = new AnswerHandler(this.state, this.condition);
        this.inputRouter = new InputRouter(this.state, this.navigator, this.answerHandler, this.condition);
        this.modal = new ModalController(this.state);
        this.uiUpdater = new UIUpdater(this.state);
        
        // ストレージ（外部クラス）
        this.storage = new SurveyStorage(config.storageKey);
        
        // 設定保存
        this._config = config;
    }

    init() {
        // DOM要素キャッシュ
        const elements = {
            respondentId: document.getElementById('respondentId'),
            idSection: document.getElementById('idSection'),
            idError: document.getElementById('idError'),
            saveBtn: document.getElementById('saveBtn'),
            recordCount: document.getElementById('recordCount'),
            confirmModal: document.getElementById('confirmModal'),
            confirmId: document.getElementById('confirmId'),
            successModal: document.getElementById('successModal'),
            savedId: document.getElementById('savedId'),
            dataListModal: document.getElementById('dataListModal'),
            dataListBody: document.getElementById('dataListBody'),
            deleteConfirmModal: document.getElementById('deleteConfirmModal'),
            deleteTargetId: document.getElementById('deleteTargetId'),
            currentIndicator: document.getElementById('currentIndicator'),
            editingId: document.getElementById('editingId'),
            container: document.querySelector('.container'),
            settingsModal: document.getElementById('settingsModal'),
            showAllConditional: document.getElementById('showAllConditional')
        };

        // 状態初期化
        this.state.init(this._config, elements);

        // 入力者名を設定（Electron環境では非同期で取得）
        this._initOperatorName();

        // InputRouterのコールバック設定
        this.inputRouter.onModalKeydown = e => this._handleModalKeydown(e);
        this.inputRouter.onEnterAtEnd = () => this._handleEnterAtEnd();
        this.inputRouter.onIdRequired = msg => this._showIdError(msg);

        // イベントリスナー設定
        this.inputRouter.setup();
        this._setupIdInput();
        this._setupTextCounters();
        this._setupMaxSelect();

        // 条件分岐の展開ボタンをセットアップ
        this.condition.setupToggleButtons();

        // 初期表示
        this.updateRecordCount();
        this.navigator.focusId();
    }

    // --- 公開API（HTML側から呼び出される）---
    
    showConfirmModal() {
        try {
            if (!this.validateId()) {
                this.navigator.focusId();
                return;
            }
            this.modal.showConfirm();
        } catch (e) {
            console.error('確認モーダル表示エラー:', e);
            alert('エラーが発生しました: ' + e.message);
        }
    }

    confirmAndSave() {
        this._confirmAndSave();
    }

    closeConfirmModal() {
        this.modal.closeConfirm();
    }

    closeSuccessModal() {
        this.modal.closeSuccess();
        this.navigator.focusId();
    }

    closeDataListModal() {
        this.modal.closeDataList();
    }

    confirmDelete() {
        this._confirmDelete();
    }

    closeDeleteConfirmModal() {
        this.modal.closeDeleteConfirm();
    }

    showDataList() {
        const data = this.storage.getData();
        this.modal.showDataList(
            data,
            index => this.editRecord(index),
            index => this.showDeleteConfirm(index)
        );
    }

    async exportCSV() {
        const data = this.storage.getData();
        if (data.length === 0) {
            this._showToast('エクスポートするデータがありません', 'error');
            return;
        }

        // 条件を満たさず手動展開された回答があるデータをチェック
        const manualOverrideRecords = data.filter(d => d['_manualOverrideFields']);
        if (manualOverrideRecords.length > 0) {
            const ids = manualOverrideRecords.map(d => d.ID).join(', ');
            const proceed = confirm(
                `以下のデータに、条件を満たさず手動展開された設問への回答が含まれています:\n\n` +
                `ID: ${ids}\n\n` +
                `（本来は表示されない設問に強制的に入力された回答です）\n\n` +
                `このまま出力しますか？`
            );
            if (!proceed) return;
        }

        // CSV出力用にデータをコピーし、メタデータフィールドを除外
        const exportData = data.map(record => {
            const cleaned = { ...record };
            delete cleaned['_manualOverrideFields'];
            return cleaned;
        });

        // ファイル名生成: {storageKey}_{日付}_{出力者}_{件数}件.xlsx
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');  // YYYYMMDD
        const operator = this.state.operatorName || '未設定';
        const count = exportData.length;
        const filename = `${this._config.storageKey}_${dateStr}_${operator}_${count}件.xlsx`;

        const result = await DataExporter.exportWithHeaders(
            data, filename,  // 元データを渡す（_manualOverrideFieldsを含む）
            this._config.questionsConfig,
            this._config.questionsMetadata,
            this._config.fieldOrder
        );

        if (result && result.success) {
            // 完了IDを保存
            this._saveCompletedIds(data.map(d => d.ID));
            // 出力成功後、保存済みデータをクリア
            this.storage.clearAll();
            this.updateRecordCount();

            // Electron環境では保存先パスを表示
            if (window.electronAPI && window.electronAPI.isElectron && result.path) {
                this._showToast(`保存しました: ${result.path}（${data.length}件のデータをクリア）`);
            } else {
                this._showToast(`Excelをエクスポートしました（${data.length}件のデータをクリア）`);
            }
        }
    }

    /**
     * 完了IDをlocalStorageに保存（追記）
     */
    _saveCompletedIds(ids) {
        const key = `${this._config.storageKey}_completed`;
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        const merged = [...new Set([...existing, ...ids])]; // 重複除去
        localStorage.setItem(key, JSON.stringify(merged));
    }

    /**
     * 完了ID一覧を取得
     */
    getCompletedIds() {
        const key = `${this._config.storageKey}_completed`;
        return JSON.parse(localStorage.getItem(key) || '[]');
    }

    /**
     * 完了ID一覧を表示
     */
    showCompletedIds() {
        const ids = this.getCompletedIds();
        if (ids.length === 0) {
            this._showToast('完了IDはありません', 'error');
            return;
        }
        alert(`完了ID一覧（${ids.length}件）:\n\n${ids.join('\n')}`);
    }

    /**
     * 完了ID一覧をクリア
     */
    clearCompletedIds() {
        if (confirm('完了ID一覧をクリアしますか？')) {
            const key = `${this._config.storageKey}_completed`;
            localStorage.removeItem(key);
            this._showToast('完了ID一覧をクリアしました');
        }
    }

    clearAllData() {
        if (confirm('保存済みの全データを削除しますか？この操作は取り消せません。')) {
            this.storage.clearAll();
            this.updateRecordCount();
            this._showToast('全データを削除しました');
        }
    }

    editRecord(index) {
        const data = this.storage.getData();
        if (index < 0 || index >= data.length) return;

        this.modal.closeDataList();
        this.clearForm();
        
        this.state.editingIndex = index;
        this.state.elements.container?.classList.add('edit-mode');
        
        const record = data[index];
        if (this.state.elements.editingId) {
            this.state.elements.editingId.textContent = record.ID || '';
        }
        
        this._restoreFormData(record);
        this.navigator.focusId();
        this._showToast('編集モードです');
    }

    cancelEdit() {
        if (confirm('編集をキャンセルしますか？変更は保存されません。')) {
            this.clearForm();
        }
    }

    showDeleteConfirm(index) {
        const data = this.storage.getData();
        if (index < 0 || index >= data.length) return;

        this.state.deleteTargetIndex = index;
        this.modal.showDeleteConfirm(data[index].ID);
    }

    // --- 内部メソッド ---

    _handleModalKeydown(e) {
        const result = this.modal.handleKeydown(e);
        if (result === 'confirm') {
            this._confirmAndSave();
            return true;
        }
        if (result === 'delete') {
            this._confirmDelete();
            return true;
        }
        return result;
    }

    _handleEnterAtEnd() {
        if (this._isLastQuestionAnswered()) {
            this.showConfirmModal();
        }
    }

    _confirmAndSave() {
        this.modal.closeConfirm();
        this._saveData();
    }

    _confirmDelete() {
        if (this.state.deleteTargetIndex >= 0) {
            this.storage.deleteRecord(this.state.deleteTargetIndex);
            this.updateRecordCount();
            this._showToast('データを削除しました');
            this.showDataList();
        }
        this.modal.closeDeleteConfirm();
    }

    _saveData() {
        if (!this.validateId()) {
            this.navigator.focusId();
            return;
        }

        const formData = this._collectFormData();

        if (this.state.editingIndex >= 0) {
            this.storage.updateRecord(this.state.editingIndex, formData);
            this._showToast('データを更新しました');
        } else {
            this.storage.addRecord(formData);
            this._showToast('データを保存しました');
        }

        this.updateRecordCount();
        this.clearForm();
        this.modal.showSuccess();
    }

    _collectFormData() {
        // IDをサニタイズ
        const rawId = this.state.elements.respondentId?.value || '';
        const data = { ID: InputValidator.sanitizeId(rawId) };

        // 手動オーバーライドされた設問で回答があるものを追跡
        // ※条件を満たしている場合は除外（本当に強制的に開いた場合のみ追跡）
        const manualOverrideAnswers = [];
        const manualOverrideIds = this.condition.getForcedOverrideIds();

        for (const fieldId of this._config.fieldOrder) {
            if (['ID', '入力日時', '入力者'].includes(fieldId)) continue;

            // 表形式
            const tableConfig = this._config.tableConfigs?.[fieldId];
            if (tableConfig?.rowNames) {
                // 表形式の親設問が手動オーバーライドされているかチェック
                const isTableOverridden = manualOverrideIds.includes(fieldId);
                for (const rowName of tableConfig.rowNames) {
                    const rowValue = this._getRadioValue(rowName);
                    data[rowName] = rowValue;
                    if (rowValue && isTableOverridden) {
                        manualOverrideAnswers.push(rowName);
                    }
                }
                continue;
            }

            const fieldType = this._getFieldType(fieldId);
            let value = '';
            if (fieldType === 'checkbox') {
                value = this._getCheckboxValues(fieldId);
                data[fieldId] = value;
            } else if (fieldType === 'radio') {
                value = this._getRadioValue(fieldId);
                data[fieldId] = value;
            } else {
                const el = document.getElementById(fieldId);
                // テキスト入力はサニタイズ
                const rawValue = el?.value || '';
                value = InputValidator.sanitizeString(rawValue);
                data[fieldId] = value;
            }

            // 手動オーバーライドされた設問に回答がある場合は記録
            // fieldId自体がオーバーライドされているか、または親設問がオーバーライドされているかチェック
            if (value && this._isFieldInManualOverride(fieldId, manualOverrideIds)) {
                manualOverrideAnswers.push(fieldId);
            }
        }

        data['入力日時'] = new Date().toLocaleString('ja-JP');
        // 入力者名もサニタイズ
        data['入力者'] = InputValidator.sanitizeString(this.state.operatorName);

        // 手動オーバーライド回答があれば記録（メタデータとして保存）
        if (manualOverrideAnswers.length > 0) {
            data['_manualOverrideFields'] = manualOverrideAnswers.join(',');
        }

        return data;
    }

    /**
     * フィールドが手動オーバーライドされた設問内にあるかチェック
     * @param {string} fieldId - フィールドID
     * @param {Array<string>} manualOverrideIds - 手動オーバーライドされた設問ID一覧
     * @returns {boolean}
     */
    _isFieldInManualOverride(fieldId, manualOverrideIds) {
        // 直接一致
        if (manualOverrideIds.includes(fieldId)) {
            return true;
        }

        // フィールドのDOM要素から親の条件付き設問を探す
        const fieldEl = document.getElementById(fieldId) ||
                       document.querySelector(`input[name="${fieldId}"]`);
        if (!fieldEl) return false;

        // 親の.conditional要素を探して、そのIDがオーバーライドされているかチェック
        const conditionalParent = fieldEl.closest('.conditional.show');
        if (conditionalParent) {
            // 設問要素のID（q_プレフィックスを除去）
            const parentQuestionEl = conditionalParent.closest('.question[data-name]');
            if (parentQuestionEl) {
                const parentId = parentQuestionEl.dataset.name;
                if (manualOverrideIds.includes(parentId)) {
                    return true;
                }
            }
            // セクションの場合
            if (conditionalParent.classList.contains('survey-section')) {
                const sectionId = conditionalParent.id;
                if (manualOverrideIds.includes(sectionId)) {
                    return true;
                }
            }
        }

        return false;
    }

    _getFieldType(fieldId) {
        if (document.querySelector(`input[type="radio"][name="${fieldId}"]`)) return 'radio';
        if (document.querySelector(`input[type="checkbox"][name="${fieldId}"]`)) return 'checkbox';
        return 'other';
    }

    _getRadioValue(name) {
        return document.querySelector(`input[name="${name}"]:checked`)?.value || '';
    }

    _getCheckboxValues(name) {
        return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`))
            .map(c => c.value)
            .join(',');
    }

    _restoreFormData(record) {
        this.state.elements.respondentId.value = record.ID || '';

        for (const [field, value] of Object.entries(record)) {
            if (['ID', '入力日時', '入力者'].includes(field) || !value) continue;

            const fieldType = this._getFieldType(field);
            if (fieldType === 'checkbox') {
                this._restoreCheckbox(field, value);
            } else if (fieldType === 'radio') {
                this._restoreRadio(field, value);
            } else {
                const el = document.getElementById(field);
                if (el) el.value = value;
            }
        }

        // 条件分岐を再評価
        for (const parentId of Object.keys(this._config.conditionMap || {})) {
            this.condition.evaluate(parentId, this._getFieldType(parentId));
        }

        // その他入力欄の表示を復元
        for (const [questionId, otherValues] of Object.entries(this._config.otherFieldMap || {})) {
            if (!Array.isArray(otherValues)) continue;
            const selectedValue = this._getRadioValue(questionId);
            for (const otherValue of otherValues) {
                if (selectedValue === otherValue) {
                    const otherInput = document.getElementById(`other_${questionId}_${otherValue}`);
                    otherInput?.classList.add('show');
                }
            }
            // チェックボックスの場合
            const checkedValues = this._getCheckboxValues(questionId).split(',');
            for (const otherValue of otherValues) {
                if (checkedValues.includes(otherValue)) {
                    const otherInput = document.getElementById(`other_${questionId}_${otherValue}`);
                    otherInput?.classList.add('show');
                }
            }
        }
    }

    _restoreRadio(name, value) {
        const radio = Array.from(document.querySelectorAll(`input[name="${name}"]`))
            .find(r => r.value === String(value));
        if (radio) {
            radio.checked = true;
            const label = radio.closest('.option-label') || radio.closest('.scale-option');
            label?.classList.add('selected');
        }
    }

    _restoreCheckbox(name, values) {
        values.split(',').forEach(v => {
            const cb = Array.from(document.querySelectorAll(`input[name="${name}"]`))
                .find(c => c.value === v.trim());
            if (cb) {
                cb.checked = true;
                cb.closest('.option-label')?.classList.add('selected');
            }
        });
    }

    clearForm() {
        document.querySelectorAll('input[type="radio"], input[type="checkbox"]')
            .forEach(inp => inp.checked = false);
        document.querySelectorAll('input[type="text"], input[type="number"], textarea')
            .forEach(inp => inp.value = '');
        document.querySelectorAll('select')
            .forEach(sel => sel.selectedIndex = 0);
        document.querySelectorAll('.option-label, .scale-option, .table-option')
            .forEach(l => l.classList.remove('selected'));
        document.querySelectorAll('.conditional')
            .forEach(el => el.classList.remove('show'));
        document.querySelectorAll('.other-input')
            .forEach(el => el.classList.remove('show'));
        document.querySelectorAll('.table-question tbody tr')
            .forEach(row => row.style.background = '');

        this.state.elements.respondentId.value = '';
        this.state.editingIndex = -1;
        this.state.elements.container?.classList.remove('edit-mode');

        // 選択肢キャッシュをクリア（メモリリーク防止）
        this.answerHandler._optionCache.clear();

        // 条件分岐のキャッシュをクリア
        this.condition.clearCache();

        // スクロール状態をリセット（画面酔い防止）
        ScrollHelper.reset();

        this.navigator.focusId();
    }

    validateId() {
        try {
            const respondentIdEl = this.state.elements.respondentId;
            if (!respondentIdEl) {
                this._showIdError('フォームの初期化エラー');
                return false;
            }
            const rawId = respondentIdEl.value || '';
            const id = InputValidator.sanitizeId(rawId);
            if (!id) {
                this._showIdError('IDを入力してください');
                return false;
            }
            // サニタイズ後の値をフィールドに反映
            respondentIdEl.value = id;
            if (this.storage.isDuplicateId(id, this.state.editingIndex)) {
                this._showIdError('このIDは既に使用されています');
                return false;
            }
            this._clearIdError();
            return true;
        } catch (e) {
            console.error('ID検証エラー:', e);
            this._showIdError('検証エラー: ' + e.message);
            return false;
        }
    }

    updateRecordCount() {
        const count = this.storage.getData().length;
        if (this.state.elements.recordCount) {
            this.state.elements.recordCount.textContent = count;
        }
    }

    _isLastQuestionAnswered() {
        const lastQId = this._config.lastQuestionId;
        if (!lastQId) return false;

        const fieldType = this._getFieldType(lastQId);
        if (fieldType === 'checkbox') return !!this._getCheckboxValues(lastQId);
        if (fieldType === 'radio') return !!this._getRadioValue(lastQId);

        const el = document.getElementById(lastQId);
        return !!el?.value;
    }

    _setupIdInput() {
        const idInput = this.state.elements.respondentId;
        if (!idInput) return;

        idInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (this.validateId()) {
                    this.navigator.moveNext();
                }
            }
        });

        idInput.addEventListener('input', () => this._clearIdError());
    }

    _setupTextCounters() {
        document.querySelectorAll('.char-counter').forEach(counter => {
            const fieldId = counter.dataset.for;
            const field = document.getElementById(fieldId);
            if (field) {
                field.addEventListener('input', () => {
                    counter.textContent = `${field.value.length}/${field.maxLength || counter.dataset.max}`;
                });
            }
        });
    }

    _setupMaxSelect() {
        document.querySelectorAll('.options[data-max-select]').forEach(container => {
            const maxSelect = parseInt(container.dataset.maxSelect, 10);
            if (maxSelect) {
                this.answerHandler._enforceMaxSelect(container, maxSelect);
            }
        });
    }

    _showIdError(msg) {
        const idError = this.state.elements.idError;
        if (idError) {
            idError.textContent = msg;
            idError.style.display = 'block';
        }
        this.state.elements.respondentId?.classList.add('error');
    }

    _clearIdError() {
        const idError = this.state.elements.idError;
        if (idError) idError.style.display = 'none';
        this.state.elements.respondentId?.classList.remove('error');
    }

    _showToast(message, type = '') {
        const toast = document.getElementById('toast');
        if (toast) {
            toast.textContent = message;
            toast.className = 'toast show' + (type ? ` ${type}` : '');
            setTimeout(() => toast.classList.remove('show'), 3000);
        }
    }

    // --- 設定モーダル ---

    showSettings() {
        const modal = this.state.elements.settingsModal;
        if (modal) modal.classList.add('show');
    }

    closeSettings() {
        const modal = this.state.elements.settingsModal;
        if (modal) modal.classList.remove('show');
    }

    toggleShowAllConditional(checked) {
        this.condition.setShowAll(checked);
    }

    /**
     * 入力者名を初期化
     * Electron環境ではコマンドライン引数から、ブラウザ環境ではURLパラメータから取得
     */
    async _initOperatorName() {
        let operatorName = '';
        
        if (window.electronAPI && window.electronAPI.isElectron) {
            // Electron環境: コマンドライン引数から取得
            operatorName = await window.electronAPI.getOperatorName();
        } else {
            // ブラウザ環境: URLパラメータから取得
            const urlParams = new URLSearchParams(window.location.search);
            operatorName = urlParams.get('operator') || '';
        }
        
        this.state.setOperatorName(operatorName);
        
        // ヘッダーに表示（もし要素があれば）
        const operatorDisplay = document.getElementById('operatorName');
        if (operatorDisplay) {
            operatorDisplay.textContent = operatorName || '未設定';
        }
    }
}


// ============================================
// 後方互換: SurveyForm エイリアス
// ============================================
const SurveyForm = SurveyApp;
