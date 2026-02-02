# SurveyApp 引き継ぎメモ

## プロジェクト概要

自治体向けアンケート（介護予防・ニーズ調査等）の紙回答をPC入力・CSV出力するためのデスクトップアプリケーション。

### 特徴
- JSON設問定義を差し替えるだけで様々なアンケートに対応
- キーボード操作に最適化（高速入力向け）
- Electron化によりスタンドアロン動作（サーバー不要）
- CSV出力先を `data/_csv/` に直接保存

---

## 技術スタック

| 項目 | 技術 |
|------|------|
| フレームワーク | Electron 28.x |
| フロントエンド | Vanilla JS（フレームワークなし） |
| ビルド | electron-builder |
| データ保存 | localStorage |
| CSV出力 | Node.js fs（Electron経由） |

---

## フォルダ構成

### ビルド環境（開発用）

```
SurveyApp_Electron/
├─ package.json         # Electron/ビルド設定
├─ main.js              # Electronメインプロセス
├─ preload.js           # IPC橋渡し（セキュア）
├─ setup.bat            # npm install 実行
├─ build.bat            # exe作成
├─ start_dev.bat        # 開発モード起動
├─ _systems/            # アプリ本体
│   ├─ index.html       # 画面構成・初期化処理
│   ├─ css/
│   │   └─ common.css   # スタイル定義
│   └─ js/
│       ├─ survey-form.js       # メイン処理（入力・保存・ナビゲーション）
│       ├─ survey-generator.js  # JSONからHTMLフォーム生成
│       └─ storage.js           # localStorage管理・CSV出力
├─ _admin/              # 集計ツール
│   ├─ 集計処理.bat
│   └─ scripts/
│       └─ aggregate_survey.py  # CSV→Excel統合
├─ _docs/               # ドキュメント
├─ config/              # 設問定義JSON（空）
├─ data/_csv/           # CSV出力先（空）
├─ node_modules/        # 依存パッケージ（巨大・共有不要）
└─ dist/                # ビルド出力（共有不要）
    └─ SurveyApp.exe
```

### 配布用（入力担当者向け）

```
配布フォルダ/
├─ SurveyApp.exe        # dist/からコピー
├─ config/
│   └─ survey_xxx.json  # 自治体用設問定義
└─ data/
    └─ _csv/            # CSV出力先
```

---

## 主要ファイルの役割

### main.js（Electronメインプロセス）
- ウィンドウ作成・管理
- IPCハンドラー（CSV保存、JSON読み込み等）
- パス解決（開発/パッケージ化で分岐）

### preload.js（IPC橋渡し）
- `window.electronAPI` として公開
- saveCSV, loadConfig, listConfigFiles 等

### index.html
- 画面構成（ヘッダー、フォーム、モーダル）
- 初期化処理（Electron/ブラウザ分岐）
- JSON読み込み → SurveyGenerator → SurveyApp.init()

### survey-form.js
- `SurveyApp` クラス: アプリ全体の制御
- `FormState`: 状態管理
- `ConditionEvaluator`: 条件分岐・手動展開ボタン
- `InputRouter`: キーボード入力処理
- `FormNavigator`: フォーカス移動

### survey-generator.js
- `SurveyGenerator` クラス
- JSONからHTMLフォームを動的生成
- questionsConfig/questionsMetadata 生成（CSV出力用）

### storage.js
- `SurveyStorage`: localStorage管理
- `CSVExporter`: CSV生成・出力
  - Electron環境: `electronAPI.saveCSV()` で直接保存
  - ブラウザ環境: ダウンロードリンク

---

## Electron対応での主な変更点

### 1. CSV出力先の変更
```javascript
// storage.js - CSVExporter.exportWithHeaders()
if (window.electronAPI && window.electronAPI.isElectron) {
    return this._saveToLocal(filename, csv);  // data/_csv/ に保存
} else {
    return this._downloadFile(filename, csv); // ダウンロードフォルダ
}
```

### 2. JSON読み込みの分岐
```javascript
// index.html - loadSurvey()
if (isElectron) {
    const result = await window.electronAPI.loadConfig(surveyId + '.json');
    config = result.data;
} else {
    const response = await fetch(`../config/${surveyId}.json`);
    config = await response.json();
}
```

### 3. 入力者名の取得
```javascript
// survey-form.js - _initOperatorName()
if (window.electronAPI && window.electronAPI.isElectron) {
    operatorName = await window.electronAPI.getOperatorName(); // --operator=xxx
} else {
    operatorName = urlParams.get('operator'); // ?operator=xxx
}
```

---

## ビルド方法

```bash
# 1. セットアップ（初回のみ）
setup.bat  # または npm install

# 2. 開発モードで確認
start_dev.bat  # または npm start

# 3. exe作成
build.bat  # または npm run build
# → dist/SurveyApp.exe が生成される
```

### ビルドエラー対策

**シンボリックリンクエラー:**
- 管理者権限でビルド
- または package.json に `"signAndEditExecutable": false` を追加

---

## 運用フロー

### 配布
1. `dist/SurveyApp.exe` を新フォルダにコピー
2. `config/` フォルダ作成、JSONを配置
3. `data/_csv/` フォルダ作成
4. フォルダ一式を担当者に渡す

### 入力作業
1. `SurveyApp.exe` ダブルクリック
2. ID入力 → 設問回答 → 保存
3. 「CSV出力」→ `data/_csv/` に保存

### 集計
1. 各担当者の `_csv/` 内ファイルを回収
2. `_admin/集計処理.bat` でExcel統合

---

## 更新方法

| 対象 | 方法 |
|------|------|
| 設問定義（JSON） | 差し替えるだけ |
| レイアウト・動作（_systems/） | 修正 → build.bat → exe配布 |

---

## 実装済み機能

- [x] 基本入力（radio/checkbox/number/text/textarea/scale/table等）
- [x] 条件分岐（showWhen）
- [x] 手動展開ボタン（条件分岐を強制表示）
- [x] 2桁入力対応（10個以上の選択肢）
- [x] 4行ヘッダーCSV出力
- [x] Electron化（スタンドアロン動作）
- [x] CSV直接保存（data/_csv/）

---

## Claudeへの共有方法

### 共有すべきファイル（軽量）
```
_systems/
├─ index.html
├─ css/common.css
└─ js/
    ├─ survey-form.js
    ├─ survey-generator.js
    └─ storage.js
main.js
preload.js
package.json
config/survey_xxx.json（必要に応じて）
```

### 共有不要（巨大）
- `node_modules/` → npm installで再生成
- `dist/` → build.batで再生成

### 相談時のテンプレート
```
【現状】
- 添付ファイル: ○○
- 問題/要望: △△

【やりたいこと】
- □□

【環境】
- Electron版SurveyApp
- Node.js v24
```

---

## 注意事項

- Node.js v24使用（LTSではない最新版）
- Electronは28.x
- バッチファイルは英語のみ（日本語だと文字化け）
- ビルド時は管理者権限推奨

---

## 関連ドキュメント

- `_docs/README.md` - 基本的な使い方
- `_docs/README_ADMIN.md` - 集計処理
- `_docs/README_ELECTRON.md` - Electron版セットアップ
- `_docs/AI_PROMPT_TEMPLATE.md` - JSON生成プロンプト
