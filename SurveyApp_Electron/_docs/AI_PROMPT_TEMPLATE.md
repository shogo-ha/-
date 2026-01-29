# 設問JSON生成プロンプト

添付したアンケートから、Webフォーム用のJSON設定ファイルを生成してください。

## 必須パラメータ

- surveyId: 英数字のID（例: survey_hashikami_needs_2025）
- surveyName: 表示名（例: 階上町高齢者ニーズ調査）
- storageKey: 保存用キー（例: hashikami_needs_2025）

## 出力形式

```json
{
  "surveyId": "survey_xxx",
  "surveyName": "〇〇調査",
  "storageKey": "xxx_survey",
  "sections": [
    {
      "id": "section1",
      "title": "問1 セクションタイトル",
      "questions": [
        {
          "id": "Q1_1",
          "num": "Q1-1",
          "title": "設問タイトル",
          "type": "radio",
          "options": [
            {"value": 1, "label": "選択肢1"},
            {"value": 2, "label": "選択肢2"},
            {"value": 3, "label": "その他", "hasOther": true}
          ],
          "csvMeta": {"section": "問1", "title": "短縮名"}
        }
      ]
    }
  ],
  "lastQuestionId": "最後の設問ID"
}
```

## 設問タイプ一覧

| type | 用途 | 例 |
|------|------|-----|
| radio | 単一選択 | 性別、はい/いいえ |
| checkbox | 複数選択 | 該当するもの全て |
| number | 数値入力 | 年齢 |
| number_pair | 数値ペア | 身長・体重 |
| scale | スケール | 幸福度0〜10 |
| table | 表形式（単一選択） | 複数項目×同一選択肢 |
| table_checkbox | 表形式（複数選択） | 複数項目×複数選択可 |
| text | 短文入力 | 名前、住所など |
| textarea | 長文入力 | 自由記述、ご意見 |
| select | ドロップダウン | 選択肢が多い場合 |
| year_month | 年月入力 | 発症時期など |
| date | 日付入力 | 生年月日など |

---

## 各設問タイプの詳細

### ラジオボタン（radio）- 単一選択

```json
{
  "id": "Q1_1",
  "num": "Q1-1",
  "title": "性別をお教えください。",
  "type": "radio",
  "options": [
    {"value": 1, "label": "男性"},
    {"value": 2, "label": "女性"}
  ],
  "csvMeta": {"section": "問1", "title": "性別"}
}
```

### チェックボックス（checkbox）- 複数選択

```json
{
  "id": "Q2_1",
  "num": "Q2-1",
  "title": "利用しているサービスは何ですか。（いくつでも）",
  "type": "checkbox",
  "options": [
    {"value": 1, "label": "配食"},
    {"value": 2, "label": "掃除"},
    {"value": 3, "label": "その他", "hasOther": true}
  ],
  "csvMeta": {"section": "問2", "title": "サービス"}
}
```

### チェックボックス＋上限（maxSelect）

「3つまで✓」のような選択数制限がある場合:

```json
{
  "id": "Q3_1",
  "num": "Q3-1",
  "title": "不安に感じることは何ですか。（3つまで）",
  "type": "checkbox",
  "maxSelect": 3,
  "options": [
    {"value": 1, "label": "健康"},
    {"value": 2, "label": "収入"},
    {"value": 3, "label": "介護"}
  ],
  "csvMeta": {"section": "問3", "title": "不安"}
}
```

### 数値入力（number）

```json
{
  "id": "Q4_1",
  "num": "Q4-1",
  "title": "年齢を教えてください。",
  "type": "number",
  "min": 0,
  "max": 120,
  "unit": "歳",
  "csvMeta": {"section": "問4", "title": "年齢"}
}
```

### 数値ペア（number_pair）

```json
{
  "id": "Q5_1",
  "num": "Q5-1",
  "title": "身長・体重を教えてください。",
  "type": "number_pair",
  "fields": [
    {"id": "Q5_1_height", "label": "身長", "min": 100, "max": 200, "unit": "cm", "csvMeta": {"section": "問5", "title": "身長"}},
    {"id": "Q5_1_weight", "label": "体重", "min": 20, "max": 150, "unit": "kg", "csvMeta": {"section": "問5", "title": "体重"}}
  ]
}
```

### スケール（scale）

```json
{
  "id": "Q6_1",
  "num": "Q6-1",
  "title": "あなたは現在、幸せですか。（「とても不幸」を0点、「とても幸せ」を10点として）",
  "type": "scale",
  "min": 0,
  "max": 10,
  "minLabel": "とても不幸",
  "maxLabel": "とても幸せ",
  "csvMeta": {"section": "問6", "title": "幸福度"}
}
```

### 表形式（table）- 単一選択マトリクス

地域活動参加頻度など、複数項目に同じ選択肢を適用する場合:

```json
{
  "id": "Q7_1",
  "num": "Q7-1",
  "title": "表中の会・グループ等に参加している場合は該当する頻度の欄に〇を記入してください",
  "type": "table",
  "columns": [
    {"value": 1, "label": "週4回以上"},
    {"value": 2, "label": "週2～3回"},
    {"value": 3, "label": "週1回"},
    {"value": 4, "label": "月1～3回"},
    {"value": 5, "label": "年に数回"},
    {"value": 6, "label": "参加していない"}
  ],
  "rows": [
    {"id": "1", "label": "①ボランティアグループ", "csvMeta": {"section": "問7", "title": "ボランティア"}},
    {"id": "2", "label": "②スポーツ関係のグループやクラブ", "csvMeta": {"section": "問7", "title": "スポーツ"}},
    {"id": "3", "label": "③趣味関係のグループ", "csvMeta": {"section": "問7", "title": "趣味G"}},
    {"id": "4", "label": "④老人クラブ", "csvMeta": {"section": "問7", "title": "老人C"}}
  ],
  "csvMeta": {"section": "問7", "title": "活動参加"}
}
```

### 表形式チェックボックス（table_checkbox）- 複数選択マトリクス

```json
{
  "id": "Q8_1",
  "num": "Q8-1",
  "title": "参加している活動を全て選んでください。",
  "type": "table_checkbox",
  "columns": [
    {"value": 1, "label": "週1回以上"},
    {"value": 2, "label": "月1〜3回"},
    {"value": 3, "label": "年に数回"}
  ],
  "rows": [
    {"id": "1", "label": "①ボランティア", "csvMeta": {"section": "問8", "title": "ボラ"}},
    {"id": "2", "label": "②趣味の会", "csvMeta": {"section": "問8", "title": "趣味"}}
  ]
}
```

### テキスト入力（text）- 短文

```json
{
  "id": "Q9_1",
  "num": "Q9-1",
  "title": "お名前を教えてください。",
  "type": "text",
  "placeholder": "例：山田太郎",
  "maxLength": 50,
  "width": "300px",
  "csvMeta": {"section": "問9", "title": "氏名"}
}
```

### テキストエリア（textarea）- 長文・自由記述

```json
{
  "id": "Q10_1",
  "num": "Q10-1",
  "title": "ご意見・ご要望がありましたらお書きください。",
  "type": "textarea",
  "placeholder": "ご自由にお書きください",
  "rows": 5,
  "maxLength": 1000,
  "csvMeta": {"section": "問10", "title": "意見"}
}
```

### セレクトボックス（select）- ドロップダウン

```json
{
  "id": "Q11_1",
  "num": "Q11-1",
  "title": "都道府県を選んでください。",
  "type": "select",
  "placeholder": "選択してください",
  "options": [
    {"value": 1, "label": "北海道"},
    {"value": 2, "label": "青森県"},
    {"value": 3, "label": "岩手県"}
  ],
  "csvMeta": {"section": "問11", "title": "都道府県"}
}
```

### 年月入力（year_month）

```json
{
  "id": "Q12_1",
  "num": "Q12-1",
  "title": "発症した時期を教えてください。",
  "type": "year_month",
  "startYear": 1950,
  "endYear": 2025,
  "csvMeta": {"section": "問12", "title": "発症時期"}
}
```

### 日付入力（date）

```json
{
  "id": "Q13_1",
  "num": "Q13-1",
  "title": "生年月日を教えてください。",
  "type": "date",
  "csvMeta": {"section": "問13", "title": "生年月日"}
}
```

---

## 条件分岐（サブ設問）

親設問の回答で表示/非表示を切り替える。`subQuestions`配列内に定義し、`showWhen`で表示条件を指定:

```json
{
  "id": "Q1_2",
  "num": "Q1-2",
  "title": "介護・介助が必要ですか",
  "type": "radio",
  "options": [
    {"value": 1, "label": "介護・介助は必要ない"},
    {"value": 2, "label": "何らかの介護・介助は必要だが、現在は受けていない"},
    {"value": 3, "label": "現在、何らかの介護を受けている"}
  ],
  "csvMeta": {"section": "問1", "title": "介護必要"},
  "subQuestions": [
    {
      "id": "Q1_2_1",
      "num": "①",
      "title": "介護・介助が必要になった主な原因はなんですか（いくつでも）",
      "type": "checkbox",
      "showWhen": {"Q1_2": [2, 3]},
      "options": [
        {"value": 1, "label": "脳卒中"},
        {"value": 2, "label": "心臓病"},
        {"value": 3, "label": "その他", "hasOther": true}
      ],
      "csvMeta": {"section": "問1", "title": "介護原因"}
    },
    {
      "id": "Q1_2_2",
      "num": "②",
      "title": "主にどなたの介護、介助を受けていますか（いくつでも）",
      "type": "checkbox",
      "showWhen": {"Q1_2": [3]},
      "options": [
        {"value": 1, "label": "配偶者"},
        {"value": 2, "label": "息子"},
        {"value": 3, "label": "娘"}
      ],
      "csvMeta": {"section": "問1", "title": "介護者"}
    }
  ]
}
```

### ネストした条件分岐

サブ設問の中にさらにサブ設問を持つことも可能:

```json
{
  "id": "Q6_1",
  "num": "Q6-1",
  "title": "現在のあなたの就労状態はどれですか（いくつでも）",
  "type": "checkbox",
  "options": [
    {"value": 1, "label": "職に就いたことがない"},
    {"value": 2, "label": "引退した"},
    {"value": 3, "label": "常勤（フルタイム）"}
  ],
  "csvMeta": {"section": "問6", "title": "就労状態"},
  "subQuestions": [
    {
      "id": "Q6_1_1",
      "num": "①",
      "title": "あなたは、いつ引退しましたか",
      "type": "radio",
      "showWhen": {"Q6_1": [2]},
      "options": [
        {"value": 1, "label": "昭和"},
        {"value": 2, "label": "平成"},
        {"value": 3, "label": "令和"}
      ],
      "csvMeta": {"section": "問6", "title": "引退元号"},
      "subQuestions": [
        {
          "id": "Q6_1_1_year",
          "title": "年",
          "type": "number",
          "min": 1,
          "max": 65,
          "unit": "年",
          "showWhen": {"Q6_1_1": [1, 2, 3]},
          "csvMeta": {"section": "問6", "title": "引退年"}
        }
      ]
    }
  ]
}
```

---

## 「その他」入力欄の詳細設定

### 基本形（テキスト入力欄付き）

```json
{"value": 3, "label": "その他", "hasOther": true}
```

### カスタムプレースホルダー

「はい」選択時に具体的内容を記入させる場合など:

```json
{
  "id": "Q4_17",
  "num": "Q4-17",
  "title": "趣味はありますか",
  "type": "radio",
  "options": [
    {"value": 1, "label": "はい", "hasOther": true, "otherOptions": {"placeholder": "名称・内容"}},
    {"value": 2, "label": "思いつかない"}
  ],
  "csvMeta": {"section": "問4", "title": "趣味"}
}
```

---

## セクションレベルの条件分岐（A票・B票の切り替え等）

A票の回答によってB票全体を表示/非表示にするなど、**セクション単位で条件分岐**する場合:

```json
{
  "sections": [
    {
      "id": "section_A",
      "title": "A票 ご本人について",
      "questions": [
        {
          "id": "A14",
          "num": "A-14",
          "title": "介護をする上での不安",
          "type": "radio",
          "options": [
            {"value": 1, "label": "ない → B票は省略"},
            {"value": 2, "label": "少しある → B票へ"},
            {"value": 3, "label": "大いにある → B票へ"}
          ],
          "csvMeta": {"section": "A票", "title": "介護不安"}
        }
      ]
    },
    {
      "id": "section_B",
      "title": "B票 主な介護者の方について",
      "showWhen": {"A14": [2, 3]},
      "style": "b-ticket",
      "questions": [
        {
          "id": "B1",
          "num": "B-1",
          "title": "介護を行う上での不安（複数可）",
          "type": "checkbox",
          "options": [...]
        }
      ]
    }
  ]
}
```

### セクションの追加プロパティ

| プロパティ | 説明 | 例 |
|------------|------|-----|
| `showWhen` | 表示条件（設問レベルと同じ書式） | `{"A14": [2, 3]}` |
| `style` | スタイルバリエーション | `"b-ticket"`（赤系ヘッダー） |

**注意**: `showWhen` がないセクションは常に表示されます（従来通り）。

---

## 特殊パターンの対応方法

### 和暦入力（昭和/平成/令和＋年）

専用タイプがないため、radio + number の組み合わせで実装:

```json
{
  "id": "Q6_1_1",
  "title": "いつ引退しましたか",
  "type": "radio",
  "options": [
    {"value": 1, "label": "昭和"},
    {"value": 2, "label": "平成"},
    {"value": 3, "label": "令和"}
  ],
  "csvMeta": {"section": "問6", "title": "引退元号"},
  "subQuestions": [
    {
      "id": "Q6_1_1_year",
      "title": "年",
      "type": "number",
      "min": 1,
      "max": 65,
      "unit": "年",
      "showWhen": {"Q6_1_1": [1, 2, 3]},
      "csvMeta": {"section": "問6", "title": "引退年"}
    }
  ]
}
```

### 同じ選択肢が繰り返される設問群

個別のradioではなくtable形式を検討:

**Before（冗長）:**
```
Q2-1: 階段を昇っていますか → できるし、している / できるけど、していない / できない
Q2-2: 立ち上がっていますか → できるし、している / できるけど、していない / できない
Q2-3: 15分歩いていますか → できるし、している / できるけど、していない / できない
```

**After（table形式）:**
```json
{
  "id": "Q2_1",
  "title": "日常動作についてお教えください",
  "type": "table",
  "columns": [
    {"value": 1, "label": "できるし、している"},
    {"value": 2, "label": "できるけど、していない"},
    {"value": 3, "label": "できない"}
  ],
  "rows": [
    {"id": "1", "label": "階段を昇る", "csvMeta": {"section": "問2", "title": "階段"}},
    {"id": "2", "label": "立ち上がる", "csvMeta": {"section": "問2", "title": "立上り"}},
    {"id": "3", "label": "15分歩く", "csvMeta": {"section": "問2", "title": "歩行"}}
  ]
}
```

※ただし元のアンケートが個別設問形式の場合は、そのまま個別radioで作成すること。

---

## ルール

1. **ID命名**: 英数字とアンダースコアのみ（Q1_1, Q1_2_1, Q6_1_1_year 等）
2. **その他入力**: `"hasOther": true` を付与。カスタムする場合は `"otherOptions": {"placeholder": "..."}`
3. **csvMeta.title**: 10文字以内（CSV出力時のヘッダー用）
4. **選択肢value**: 1から連番（0始まりにしない）
5. **lastQuestionId**: 条件分岐を含む場合、実際に最後に表示される可能性のある設問ID
6. **maxSelect**: 選択数上限がある場合のみ指定
7. **showWhen**: 条件分岐の親設問IDと表示条件値の配列を指定

---

## 生成依頼

添付のアンケートをJSON形式に変換してください。
ファイル名: survey_〇〇.json
