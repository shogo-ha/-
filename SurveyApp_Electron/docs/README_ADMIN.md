# 集計処理（管理者向け）

CSV出力データをExcelに統合するためのツールです。

---

## 基本的な使い方

### 1. CSVを配置

各入力者が出力したCSVファイルを `data/_csv/` フォルダに格納します。

```
data/
└── _csv/
    ├── hashikami_needs_2025_20250129_山田_10件.csv
    ├── hashikami_needs_2025_20250129_佐藤_8件.csv
    └── hashikami_needs_2025_20250130_鈴木_12件.csv
```

### 2. 集計処理を実行

`集計処理.bat` をダブルクリック

### 3. 出力を確認

```
_admin/output/
├── template/
│   └── template_survey_xxx.xlsx    ← 空テンプレート（初回のみ生成）
└── survey_xxx_統合.xlsx            ← 統合結果
```

---

## 出力ファイルの仕様

### Excel構造

| 行 | 内容 | 例 |
|----|------|-----|
| 1行目 | 大問（セクション） | 問1、問2、... |
| 2行目 | 小問（設問タイトル） | 家族構成、介護状況、... |
| 3行目 | 選択肢番号 | ①②③④... / その他 |
| 4行目〜 | データ | 〇 または 空白 |

### 列の並び順

1. **ID**（NO）
2. **設問** × 選択肢数（JSONのsections順）
   - 選択肢に「その他」がある場合、該当選択肢の直後にテキスト列
3. **入力日時**
4. **入力者**

### 罫線ルール

| 位置 | 罫線 |
|------|------|
| 設問の区切り（左辺） | 太線 |
| 選択肢の区切り（左辺） | 破線 |
| 最終列（右辺） | 太線 |
| 各行（下辺） | 細線 |

### 背景色

| 条件 | 色 |
|------|-----|
| 奇数行 | 白 |
| 偶数行 | 薄グレー |
| 重複ID | 黄色 |

---

## テンプレートの再生成

JSONを修正した場合など、テンプレートを作り直したい場合：

1. `_admin/output/template/` 内のExcelファイルを削除
2. `集計処理.bat` を再実行

> **注意:** テンプレートが存在する場合はスキップされます。

---

## よくある操作

### CSVを追加統合したい

1. 新しいCSVを `data/_csv/` に追加
2. `集計処理.bat` を再実行

※ 統合ファイルは毎回テンプレートから新規作成されます（追記ではなくリセット方式）

### 特定のCSVだけ統合したい

1. 不要なCSVを `data/_csv/` から別フォルダに移動
2. `集計処理.bat` を実行
3. 完了後、CSVを元に戻す

### 統合結果をリセットしたい

`_admin/output/survey_xxx_統合.xlsx` を削除して再実行

---

## エラー対処

### 「config/ にJSONファイルがありません」

- `config/` フォルダにJSONが配置されているか確認
- ファイル名に日本語や空白が含まれていないか確認

### 「data/_csv/ にCSVファイルがありません」

- `data/_csv/` フォルダにCSVファイルがあるか確認
- 拡張子が `.csv` になっているか確認

### 「openpyxl がない」

```
pip install openpyxl
```

### 「MergedCell object attribute 'value' is read-only」

テンプレートのセル結合と新データの列数が合っていない可能性があります。
1. `_admin/output/template/` 内のExcelを削除
2. 再実行

---

## スクリプトのカスタマイズ

`scripts/aggregate_survey.py` の主要な設定：

### フォント

```python
font_normal = Font(name='游ゴシック', size=10)
```

### 罫線スタイル

```python
BORDER_MEDIUM = Side(style='medium')  # 太線
BORDER_THIN = Side(style='thin')      # 細線
BORDER_DASHED = Side(style='dashed')  # 破線
```

### 背景色

```python
FILL_DUPLICATE = PatternFill('solid', fgColor='FFFF00')  # 重複: 黄
FILL_ODD = PatternFill('solid', fgColor='FFFFFF')        # 奇数行: 白
FILL_EVEN = PatternFill('solid', fgColor='F2F2F2')       # 偶数行: グレー
```

### 丸数字

```python
CIRCLE_NUMBERS = ['⓪', '①', '②', ... '㊿']  # 0〜50対応
```

---

## ファイル構成

```
_admin/
├── 集計処理.bat           ← 実行用バッチ
├── README.md              ← このファイル
├── output/
│   ├── template/          ← テンプレートExcel格納先
│   └── (統合Excel)        ← 統合結果の出力先
└── scripts/
    └── aggregate_survey.py  ← 集計処理本体
```
