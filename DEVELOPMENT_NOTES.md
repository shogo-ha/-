# SurveyApp_Electron 開発メモ

## 2025/01/31 更新内容

### 1. セキュリティ修正

#### 1.1 パストラバーサル脆弱性対策 (CRITICAL)
- **ファイル**: `src/main/ipc-handlers.js`
- **内容**: `sanitizeFilename()` と `isPathWithinDirectory()` 関数を追加
- CSVファイル名に `../` などのパス文字が含まれていても、configDir内に限定

#### 1.2 CSVインジェクション対策 (CRITICAL)
- **ファイル**: `src/renderer/js/storage.js`
- **内容**: `_escapeCSVValue()` メソッドを修正
- `=`, `+`, `-`, `@`, `\t`, `\r` で始まる値を自動的にクォート

#### 1.3 入力検証の追加 (HIGH)
- **ファイル**: `src/renderer/js/survey-form.js`
- **内容**: `InputValidator` オブジェクトを追加
- 制御文字の除去、ID・文字列・数値の検証

#### 1.4 XSS対策 (HIGH)
- **ファイル**: `src/renderer/js/app.js`
- **内容**: `escapeHtml()` 関数を追加し、デバッグ出力をエスケープ

#### 1.5 Content Security Policy (MEDIUM)
- **ファイル**: `src/renderer/index.html`
- **内容**: CSPメタタグを追加
```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;">
```

---

### 2. コード構造の改善

#### 2.1 インラインスクリプトの外部化
- `index.html` のインラインJavaScriptを `src/renderer/js/app.js` に分離
- 関数: `init()`, `loadSurvey()`, `detectSurveyConfigElectron()`, `detectSurveyConfigBrowser()`, `escapeHtml()`

#### 2.2 IPCハンドラーのモジュール分割
- `main.js` から IPC ハンドラーを `src/main/ipc-handlers.js` に分離
- `main.js` はアプリケーションライフサイクル管理のみに集中

---

### 3. 機能改修

#### 3.1 二桁入力の即時確定機能
- **ファイル**: `src/renderer/js/survey-form.js`
- **内容**: `flushDigitBuffer()` メソッドを `AnswerHandler` に追加
- Tabキーまたはクリック時に待機中の入力を即時確定
- 待機時間を700msから500msに短縮

#### 3.2 条件分岐UIの改修
- **ファイル**: `src/renderer/js/survey-form.js`, `src/renderer/index.html`
- **内容**:
  - 条件分岐先の展開アイコンを設問タイトル横に配置（`+`/`−`）
  - キーボードショートカット追加:
    - `+` キー: 現在の設問の条件分岐先を開く
    - `-` キー: 条件分岐先を閉じる（条件判定に戻す）
  - 設定モーダルに「条件分岐先を常に表示」トグルを追加
  - `ConditionEvaluator.setShowAll()` メソッドで常時表示モード切り替え
  - `ConditionEvaluator.openBranchesForParent()` / `closeBranchesForParent()` メソッド追加

---

### 4. ファイル構成

```
src/
├── main/
│   ├── main.js           # Electronメインプロセス（ライフサイクル管理）
│   ├── ipc-handlers.js   # IPCハンドラー（ファイル操作）
│   └── preload.js        # プリロードスクリプト
└── renderer/
    ├── index.html        # メイン画面
    ├── css/
    │   └── common.css    # スタイル
    └── js/
        ├── app.js           # アプリ初期化
        ├── survey-form.js   # フォーム制御（メイン）
        ├── survey-generator.js # アンケートHTML生成
        └── storage.js       # データ保存・CSV出力
```

---

### 5. 主要クラス構成（survey-form.js）

| クラス | 責務 |
|--------|------|
| `FormState` | 状態管理（現在位置、設定、イベント発火） |
| `ConditionEvaluator` | 条件分岐の評価と表示制御 |
| `Navigator` | 設問間移動 |
| `AnswerHandler` | 回答入力処理（キーボード/クリック） |
| `InputRouter` | イベントのルーティング |
| `ModalController` | モーダル表示制御 |
| `UIUpdater` | UI更新（ハイライト、スクロール） |
| `SurveyApp` | 統合クラス（公開API） |

---

### 6. 設定ファイル形式

`config/survey_config.json` の形式:
```json
{
  "title": "アンケート名",
  "storageKey": "survey_data_xxx",
  "questions": [...],
  "conditionMap": {...}
}
```

---

### 7. ビルドと配布

```bash
# 開発時
npm start

# ビルド（未設定）
# electron-builder等を使用してexeをビルド
```

配布時は以下を同梱:
- ビルド済みexe
- `config/` フォルダ（survey_config.json）
- `data/` フォルダ（空、CSV出力先）

---

### 8. 今後の課題

- [ ] electron-builderによるビルド設定
- [ ] 自動更新機能の検討
- [ ] 複数アンケート切り替え機能の強化
