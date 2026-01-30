/**
 * アンケートフォーム生成クラス
 * JSONからHTMLフォームを動的に生成
 * 
 * 改良版:
 * - 表形式設問の行ナビゲーション用情報を生成
 * - scale設問にdata-type="scale"属性を追加
 * - テキスト入力系の共通処理を統合
 */
class SurveyGenerator {
    constructor(config) {
        this.config = config;
        this.questionsConfig = {};  // CSV出力用
        this.questionsMetadata = {}; // CSV出力用メタデータ
        this.fieldOrder = ['ID'];
        this.otherFieldMap = {};
        this.conditionMap = {}; // 条件分岐マップ
        this.tableConfigs = {}; // 表形式設問の設定
        this.textFieldConfigs = {}; // テキスト入力フィールドの設定（共通化用）
    }

    // =========================================
    // 共通処理：条件分岐
    // =========================================

    /**
     * 条件分岐をconditionMapに登録（設問・セクション共通）
     * @param {object} target - 設問またはセクション（id, showWhenを持つ）
     * @param {boolean} isSection - セクションの場合true
     */
    _registerCondition(target, isSection = false) {
        if (!target.showWhen) return;
        
        for (const [parentId, values] of Object.entries(target.showWhen)) {
            if (!this.conditionMap[parentId]) {
                this.conditionMap[parentId] = [];
            }
            this.conditionMap[parentId].push({
                targetId: target.id,
                showValues: values,
                ...(isSection && { isSection: true })
            });
        }
    }

    // =========================================
    // 共通処理：テキスト入力系
    // =========================================

    /**
     * テキスト入力フィールドを登録（共通処理）
     * @param {string} id - フィールドID
     * @param {string} type - フィールドタイプ ('text' | 'textarea' | 'other')
     * @param {object} options - オプション設定
     */
    _registerTextField(id, type, options = {}) {
        this.fieldOrder.push(id);
        
        if (options.csvMeta) {
            this.questionsMetadata[id] = options.csvMeta;
        }
        
        // テキストフィールド設定を記録（survey-form.js側で利用）
        this.textFieldConfigs[id] = {
            type: type,
            maxLength: options.maxLength || null,
            placeholder: options.placeholder || null
        };
    }

    /**
     * テキスト入力のHTML属性を生成（共通処理）
     * @param {object} q - 設問オブジェクト
     * @param {object} defaults - デフォルト値
     * @returns {object} 生成された属性群
     */
    _buildTextAttrs(q, defaults = {}) {
        const placeholder = q.placeholder ?? defaults.placeholder ?? '';
        const maxLength = q.maxLength ? `maxlength="${q.maxLength}"` : '';
        const width = q.width ? `style="width: ${q.width}"` : '';
        
        return {
            placeholder: this._escape(placeholder),
            maxLengthAttr: maxLength,
            widthAttr: width,
            maxLengthValue: q.maxLength || null
        };
    }

    /**
     * 「その他」入力欄のHTMLを生成（共通処理）
     * @param {string} questionId - 親設問のID
     * @param {string|number} value - 選択肢の値
     * @param {object} options - オプション（placeholder等）
     * @returns {string} HTML文字列
     */
    _generateOtherInput(questionId, value, options = {}) {
        const placeholder = options.placeholder || '具体的に';
        const maxLength = options.maxLength ? `maxlength="${options.maxLength}"` : '';
        const otherId = `${questionId}_other_${value}`;
        
        // その他フィールドを登録
        this._registerTextField(otherId, 'other', {
            placeholder: placeholder,
            maxLength: options.maxLength
        });
        
        return `
            <div class="other-input text-field-wrapper" id="other_${questionId}_${value}">
                <input type="text" id="${otherId}" 
                    class="text-field" 
                    placeholder="${this._escape(placeholder)}" ${maxLength}>
            </div>
        `;
    }

    /**
     * 文字数カウンターHTMLを生成（共通処理）
     * @param {string} id - フィールドID
     * @param {number} maxLength - 最大文字数
     * @returns {string} HTML文字列
     */
    _generateCharCounter(id, maxLength) {
        if (!maxLength) return '';
        return `<div class="char-count"><span id="${id}_count">0</span>/${maxLength}文字</div>`;
    }

    // =========================================
    // フォーム生成
    // =========================================

    /**
     * フォーム全体を生成
     */
    generate(container) {
        const html = [];
        
        // セクションごとに生成
        for (const section of this.config.sections) {
            html.push(this._generateSection(section));
        }
        
        container.innerHTML = html.join('');
        
        // 条件分岐の初期状態を設定
        this._initializeConditions();
    }

    /**
     * セクションを生成
     * セクションレベルの showWhen にも対応（A票・B票の切り替え等）
     */
    _generateSection(section) {
        const questions = section.questions.map(q => this._generateQuestion(q)).join('');
        
        // セクションレベルの条件分岐
        const conditionalClass = section.showWhen ? 'conditional' : '';
        const dataCondition = section.showWhen 
            ? `data-show-when='${JSON.stringify(section.showWhen)}'` 
            : '';
        
        // セクションレベルの条件分岐を登録（共通関数を使用）
        this._registerCondition(section, true);
        
        // セクション用のスタイルクラス（オプション）
        const sectionStyle = section.style ? `section-${section.style}` : '';
        
        return `
            <section class="survey-section ${conditionalClass} ${sectionStyle}" id="${section.id}" ${dataCondition}>
                <h2 class="section-title">${this._escape(section.title)}</h2>
                ${questions}
            </section>
        `;
    }

    /**
     * 設問を生成
     */
    _generateQuestion(q, isSubQuestion = false) {
        // 条件分岐を登録（全タイプ共通・1箇所で管理）
        this._registerCondition(q);
        
        let html = '';
        let dataType = '';
        let extraAttrs = '';
        const conditionalClass = q.showWhen ? 'conditional' : '';
        const dataCondition = q.showWhen ? `data-show-when='${JSON.stringify(q.showWhen)}'` : '';
        
        switch (q.type) {
            case 'radio':
                html = this._generateRadio(q);
                break;
            case 'checkbox':
                html = this._generateCheckbox(q);
                break;
            case 'number':
                html = this._generateNumber(q);
                break;
            case 'number_pair':
                html = this._generateNumberPair(q);
                break;
            case 'table':
                html = this._generateTable(q);
                dataType = 'table';
                break;
            case 'table_checkbox':
                html = this._generateTableCheckbox(q);
                dataType = 'table';
                break;
            case 'scale':
                html = this._generateScale(q);
                dataType = 'scale';
                extraAttrs = `data-scale-max="${q.max || 10}"`;
                break;
            case 'text':
                html = this._generateText(q);
                break;
            case 'textarea':
                html = this._generateTextarea(q);
                break;
            case 'select':
                html = this._generateSelect(q);
                break;
            case 'year_month':
                html = this._generateYearMonth(q);
                break;
            case 'date':
                html = this._generateDate(q);
                break;
            case 'date_wareki':
                html = this._generateDateWareki(q);
                break;
            default:
                html = this._generateRadio(q);
        }

        // サブ設問を再帰的に生成
        let subHtml = '';
        if (q.subQuestions) {
            for (const sub of q.subQuestions) {
                subHtml += this._generateQuestion(sub, true);
            }
        }

        const wrapperClass = isSubQuestion ? 'sub-question' : '';
        const dataTypeAttr = dataType ? `data-type="${dataType}"` : '';
        const titleId = `${q.id}_title`;
        
        // アクセシビリティ: role="group"とaria-labelledbyを追加
        return `
            <div class="question ${wrapperClass} ${conditionalClass}" id="q_${q.id}" data-name="${q.id}" ${dataTypeAttr} ${extraAttrs} ${dataCondition} role="group" aria-labelledby="${titleId}">
                <div class="question-title" id="${titleId}">
                    ${q.num ? `<span class="num">${q.num}</span>` : ''} ${this._escape(q.title)}
                </div>
                <div class="options-container">
                    ${html}
                </div>
                ${subHtml}
            </div>
        `;
    }

    /**
     * ラジオボタンを生成
     */
    _generateRadio(q) {
        // CSV出力用設定を記録
        this._registerQuestion(q, 'radio');
        
        const options = q.options.map((opt, idx) => {
            let otherInput = '';
            if (opt.hasOther) {
                // 配列として追加（複数のhasOther対応）
                if (!this.otherFieldMap[q.id]) {
                    this.otherFieldMap[q.id] = [];
                }
                this.otherFieldMap[q.id].push(String(opt.value));
                otherInput = this._generateOtherInput(q.id, opt.value, opt.otherOptions || {});
            }
            
            return `
                <label class="option-label" data-value="${opt.value}" role="radio" aria-checked="false" tabindex="0">
                    <span class="option-key">${idx + 1}</span>
                    <span>${this._escape(opt.label)}</span>
                    <input type="radio" name="${q.id}" value="${opt.value}" aria-hidden="true">
                </label>
                ${otherInput}
            `;
        }).join('');
        
        return `<div class="options" role="radiogroup" aria-label="${this._escape(q.title)}">${options}</div>`;
    }

    /**
     * チェックボックスを生成
     */
    _generateCheckbox(q) {
        // CSV出力用設定を記録
        this._registerQuestion(q, 'checkbox');
        
        // maxSelect属性（選択数上限）
        const maxSelectAttr = q.maxSelect ? `data-max-select="${q.maxSelect}"` : '';
        const maxSelectNote = q.maxSelect ? `<span class="max-select-note">（${q.maxSelect}つまで）</span>` : '';
        
        const options = q.options.map((opt, idx) => {
            let otherInput = '';
            if (opt.hasOther) {
                // 配列として追加（複数のhasOther対応）
                if (!this.otherFieldMap[q.id]) {
                    this.otherFieldMap[q.id] = [];
                }
                this.otherFieldMap[q.id].push(String(opt.value));
                otherInput = this._generateOtherInput(q.id, opt.value, opt.otherOptions || {});
            }
            
            return `
                <label class="option-label" data-value="${opt.value}" role="checkbox" aria-checked="false" tabindex="0">
                    <span class="option-key">${idx + 1}</span>
                    <span>${this._escape(opt.label)}</span>
                    <input type="checkbox" name="${q.id}" value="${opt.value}" aria-hidden="true">
                </label>
                ${otherInput}
            `;
        }).join('');
        
        return `${maxSelectNote}<div class="options" data-type="checkbox" ${maxSelectAttr} role="group" aria-label="${this._escape(q.title)}">${options}</div>`;
    }

    /**
     * 数値入力を生成
     */
    _generateNumber(q) {
        this.fieldOrder.push(q.id);
        if (q.csvMeta) {
            this.questionsMetadata[q.id] = q.csvMeta;
        }
        
        return `
            <div class="number-input">
                <input type="number" id="${q.id}" name="${q.id}" min="${q.min || 0}" max="${q.max || 999}">
                ${q.unit ? `<span class="unit">${q.unit}</span>` : ''}
            </div>
        `;
    }

    /**
     * 数値ペア入力を生成（身長・体重など）
     */
    _generateNumberPair(q) {
        const fields = q.fields.map(f => {
            this.fieldOrder.push(f.id);
            if (f.csvMeta) {
                this.questionsMetadata[f.id] = f.csvMeta;
            }
            
            return `
                <div class="number-field">
                    <label>${f.label}</label>
                    <input type="number" id="${f.id}" name="${f.id}" min="${f.min || 0}" max="${f.max || 999}">
                    <span class="unit">${f.unit || ''}</span>
                </div>
            `;
        }).join('');
        
        return `<div class="number-pair">${fields}</div>`;
    }

    /**
     * 表形式設問を生成
     */
    _generateTable(q) {
        const headerCells = q.columns.map(col => `<th scope="col">${this._escape(col.label)}</th>`).join('');
        
        // 行名とラベルを収集
        const rowNames = [];
        const rowLabels = [];
        
        const rows = q.rows.map(row => {
            const rowId = `${q.id}_${row.id}`;
            rowNames.push(rowId);
            rowLabels.push(row.label);
            
            this._registerQuestion({
                id: rowId,
                options: q.columns,
                csvMeta: row.csvMeta || {section: q.csvMeta?.section, title: row.label}
            }, 'radio');
            
            const cells = q.columns.map((col, idx) => `
                <td>
                    <label class="table-option" role="radio" aria-checked="false" aria-label="${this._escape(row.label)} - ${this._escape(col.label)}">
                        <span class="option-key">${idx + 1}</span>
                        <input type="radio" name="${rowId}" value="${col.value}" aria-hidden="true">
                    </label>
                </td>
            `).join('');
            
            return `<tr><th scope="row" class="row-label">${this._escape(row.label)}</th>${cells}</tr>`;
        }).join('');
        
        // 表形式設問の設定を保存
        this.tableConfigs[q.id] = {
            rowNames: rowNames,
            rowLabels: rowLabels,
            columnCount: q.columns.length
        };
        
        return `
            <div class="table-question">
                <table role="grid" aria-label="${this._escape(q.title)}">
                    <thead><tr><th scope="col"></th>${headerCells}</tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    }

    /**
     * スケール設問を生成
     */
    _generateScale(q) {
        // scaleは単一の数値を出力するため、展開用のvaluesは登録しない
        // _registerQuestionではなく個別に登録
        this.fieldOrder.push(q.id);
        // questionsConfigには登録しない（展開しない）
        if (q.csvMeta) {
            this.questionsMetadata[q.id] = q.csvMeta;
        }
        
        const min = q.min || 0;
        const max = q.max || 10;
        const options = [];
        
        for (let i = min; i <= max; i++) {
            options.push(`
                <label class="scale-option">
                    <input type="radio" name="${q.id}" value="${i}">
                    <span class="scale-value">${i}</span>
                </label>
            `);
        }
        
        return `
            <div class="scale-input">
                <div class="scale-labels">
                    <span>${this._escape(q.minLabel || '')}</span>
                    <span>${this._escape(q.maxLabel || '')}</span>
                </div>
                <div class="scale-options">${options.join('')}</div>
            </div>
        `;
    }

    /**
     * テキスト入力を生成（短文）
     * 共通処理を使用
     */
    _generateText(q) {
        // 共通処理でフィールド登録
        this._registerTextField(q.id, 'text', {
            csvMeta: q.csvMeta,
            maxLength: q.maxLength,
            placeholder: q.placeholder
        });
        
        // 共通処理で属性生成
        const attrs = this._buildTextAttrs(q, { placeholder: '' });
        
        return `
            <div class="text-input text-field-wrapper">
                <input type="text" id="${q.id}" name="${q.id}" 
                    class="text-field"
                    placeholder="${attrs.placeholder}" ${attrs.maxLengthAttr} ${attrs.widthAttr}>
                ${q.unit ? `<span class="unit">${this._escape(q.unit)}</span>` : ''}
                ${this._generateCharCounter(q.id, attrs.maxLengthValue)}
            </div>
        `;
    }

    /**
     * テキストエリアを生成（長文・自由記述）
     * 共通処理を使用
     */
    _generateTextarea(q) {
        // 共通処理でフィールド登録
        this._registerTextField(q.id, 'textarea', {
            csvMeta: q.csvMeta,
            maxLength: q.maxLength,
            placeholder: q.placeholder
        });
        
        // 共通処理で属性生成
        const attrs = this._buildTextAttrs(q, { placeholder: 'ご自由にお書きください' });
        const rows = q.rows || 4;
        
        return `
            <div class="textarea-input text-field-wrapper">
                <textarea id="${q.id}" name="${q.id}" 
                    class="text-field"
                    rows="${rows}" 
                    placeholder="${attrs.placeholder}" ${attrs.maxLengthAttr}></textarea>
                ${this._generateCharCounter(q.id, attrs.maxLengthValue)}
            </div>
        `;
    }

    /**
     * セレクトボックス（ドロップダウン）を生成
     */
    _generateSelect(q) {
        this._registerQuestion(q, 'select');
        
        const options = q.options.map(opt => 
            `<option value="${opt.value}">${this._escape(opt.label)}</option>`
        ).join('');
        
        const placeholder = q.placeholder || '選択してください';
        
        return `
            <div class="select-input">
                <select id="${q.id}" name="${q.id}">
                    <option value="">${this._escape(placeholder)}</option>
                    ${options}
                </select>
            </div>
        `;
    }

    /**
     * 年月入力を生成
     */
    _generateYearMonth(q) {
        const yearId = `${q.id}_year`;
        const monthId = `${q.id}_month`;
        
        this.fieldOrder.push(yearId);
        this.fieldOrder.push(monthId);
        
        if (q.csvMeta) {
            this.questionsMetadata[yearId] = { ...q.csvMeta, title: q.csvMeta.title + '_年' };
            this.questionsMetadata[monthId] = { ...q.csvMeta, title: q.csvMeta.title + '_月' };
        }
        
        // 年の選択肢を生成（現在年から過去100年）
        const currentYear = new Date().getFullYear();
        const startYear = q.startYear || (currentYear - 100);
        const endYear = q.endYear || currentYear;
        
        let yearOptions = '<option value="">--</option>';
        for (let y = endYear; y >= startYear; y--) {
            yearOptions += `<option value="${y}">${y}</option>`;
        }
        
        // 月の選択肢
        let monthOptions = '<option value="">--</option>';
        for (let m = 1; m <= 12; m++) {
            monthOptions += `<option value="${m}">${m}</option>`;
        }
        
        return `
            <div class="year-month-input">
                <select id="${yearId}" name="${yearId}">${yearOptions}</select>
                <span class="unit">年</span>
                <select id="${monthId}" name="${monthId}">${monthOptions}</select>
                <span class="unit">月</span>
            </div>
        `;
    }

    /**
     * 日付入力を生成
     */
    _generateDate(q) {
        this.fieldOrder.push(q.id);
        if (q.csvMeta) {
            this.questionsMetadata[q.id] = q.csvMeta;
        }
        
        return `
            <div class="date-input">
                <input type="date" id="${q.id}" name="${q.id}">
            </div>
        `;
    }

    /**
     * 和暦日付入力を生成（令和__年__月__日）
     */
    _generateDateWareki(q) {
        const eraId = `${q.id}_era`;
        const yearId = `${q.id}_year`;
        const monthId = `${q.id}_month`;
        const dayId = `${q.id}_day`;
        
        this.fieldOrder.push(eraId);
        this.fieldOrder.push(yearId);
        this.fieldOrder.push(monthId);
        this.fieldOrder.push(dayId);
        
        if (q.csvMeta) {
            this.questionsMetadata[eraId] = {section: q.csvMeta.section, title: `${q.csvMeta.title}_元号`};
            this.questionsMetadata[yearId] = {section: q.csvMeta.section, title: `${q.csvMeta.title}_年`};
            this.questionsMetadata[monthId] = {section: q.csvMeta.section, title: `${q.csvMeta.title}_月`};
            this.questionsMetadata[dayId] = {section: q.csvMeta.section, title: `${q.csvMeta.title}_日`};
        }
        
        return `
            <div class="date-wareki-input">
                <select id="${eraId}" name="${eraId}" class="era-select">
                    <option value="">元号</option>
                    <option value="令和">令和</option>
                    <option value="平成">平成</option>
                    <option value="昭和">昭和</option>
                </select>
                <input type="number" id="${yearId}" name="${yearId}" min="1" max="99" class="wareki-year" placeholder="">
                <span class="unit">年</span>
                <input type="number" id="${monthId}" name="${monthId}" min="1" max="12" class="wareki-month" placeholder="">
                <span class="unit">月</span>
                <input type="number" id="${dayId}" name="${dayId}" min="1" max="31" class="wareki-day" placeholder="">
                <span class="unit">日</span>
            </div>
        `;
    }

    /**
     * 表形式設問（チェックボックス版・複数選択可）を生成
     */
    _generateTableCheckbox(q) {
        const headerCells = q.columns.map(col => `<th>${this._escape(col.label)}</th>`).join('');
        
        // 行名とラベルを収集
        const rowNames = [];
        const rowLabels = [];
        
        const rows = q.rows.map(row => {
            const rowId = `${q.id}_${row.id}`;
            rowNames.push(rowId);
            rowLabels.push(row.label);
            
            // 各行を登録（チェックボックスとして）
            this._registerQuestion({
                id: rowId,
                options: q.columns,
                csvMeta: row.csvMeta || {section: q.csvMeta?.section, title: row.label}
            }, 'checkbox');
            
            const cells = q.columns.map((col, idx) => `
                <td>
                    <label class="table-option">
                        <input type="checkbox" name="${rowId}" value="${col.value}">
                        <span class="checkbox-mark"></span>
                    </label>
                </td>
            `).join('');
            
            return `<tr><td class="row-label">${this._escape(row.label)}</td>${cells}</tr>`;
        }).join('');
        
        // 表形式設問の設定を保存
        this.tableConfigs[q.id] = {
            rowNames: rowNames,
            rowLabels: rowLabels,
            columnCount: q.columns.length
        };
        
        return `
            <div class="table-question">
                <table>
                    <thead><tr><th></th>${headerCells}</tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    }

    /**
     * 設問をCSV出力用に登録
     */
    _registerQuestion(q, type) {
        const values = q.options ? q.options.map(o => o.value) : [];
        
        this.questionsConfig[q.id] = { values: values };
        this.fieldOrder.push(q.id);
        
        // その他入力がある場合（_generateOtherInputで登録済みなのでスキップ）
        // ※ 従来はここで fieldOrder.push していたが、共通処理に移動
        
        if (q.csvMeta) {
            this.questionsMetadata[q.id] = q.csvMeta;
        }
        // 条件分岐の登録は_generateQuestionで一元化済み
    }

    /**
     * 条件分岐の初期化
     * CSSで.conditionalはデフォルト非表示のため、showクラスを確実に除去
     */
    _initializeConditions() {
        document.querySelectorAll('.conditional').forEach(el => {
            el.classList.remove('show');
        });
    }

    /**
     * SurveyForm用の設定オブジェクトを取得
     */
    getFormConfig() {
        this.fieldOrder.push('入力日時');
        this.fieldOrder.push('入力者');
        
        return {
            storageKey: this.config.storageKey,
            surveyName: this.config.surveyName,
            questionsConfig: this.questionsConfig,
            questionsMetadata: this.questionsMetadata,
            fieldOrder: this.fieldOrder,
            otherFieldMap: this.otherFieldMap,
            conditionMap: this.conditionMap,
            tableConfigs: this.tableConfigs,
            textFieldConfigs: this.textFieldConfigs, // テキストフィールド設定を追加
            lastQuestionId: this.config.lastQuestionId
        };
    }

    /**
     * HTMLエスケープ
     */
    _escape(str) {
        if (!str) return '';
        return str.replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }
}
