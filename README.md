# OW POV Switcher

Overwatchの1試合を想定し、11視点を1つのYouTubeプレイヤーで切り替える小さなMVPです。共有データはマッチごとのJSONに分け、カタログ一覧JSONはそこから生成します。

視点を切り替えると、現在の再生位置を保ったまま、同じiframeへ別の動画を読み込みます。再生バーの長さはカタログへ別途入力せず、読み込んだYouTube動画の実時間を使います。表示されている視点だけを再生するため、複数の動画を同時に再生・同期する構成よりも、まずは個人開発で扱いやすい方式に絞っています。

## 起動

`file://`で直接開かず、HTTPサーバー経由で起動してください。静的JSONの読み込み、YouTube IFrame Player API、`Referer`の扱いが安定します。`file://`で開いた場合は、ページ上に起動方法が表示されます。

PowerShellでプロジェクトディレクトリから次を実行します。

```powershell
python -m http.server 4173
```

ブラウザで <http://localhost:4173/> を開きます。

## GitHub Pagesで公開

このMVPはHTML・CSS・JavaScript・静的JSONだけで動作するため、GitHub Pagesで公開できます。`.github/workflows/pages.yml` はマッチJSONからカタログ一覧JSONを生成して公開用の `dist` を組み立て、プレイヤーとカタログに必要なファイルだけをGitHub Pagesへデプロイします。

GitHubのリポジトリ設定で `Settings` → `Pages` → `Build and deployment` → `Source: GitHub Actions` を選択してください。`master` ブランチへ変更をpushすると、ワークフローが公開用ファイルをデプロイします。

公開対象に含めるのはプレイヤー（`index.html`）とカタログ（`catalog.html`）、それらが利用するJavaScript・CSS・`data/matches/*.json`です。カタログJSON生成ツール（`tools/`）は公開成果物に含めません。

GitHub Pagesの公開設定は、リポジトリのファイルをそのまま公開するのではなく、Actionsで公開用成果物を作る構成にしています。公開用成果物にはプレイヤー・カタログ・静的JSONだけを含めます。

## ローカルでカタログJSONを生成

試合の追加は、公開ページとは分離したローカル専用ツールで行えます。HTTPサーバーを起動した状態で、次のページを開いてください。

<http://localhost:4173/tools/catalog-builder.html>

このツールでは次の操作ができます。

- 既存の `index.json` を最初に1ファイルだけ読み込む
- 読み込んだIndexを基準に、新しい試合を追加する
- 試合タイトル、マップ、パッチバージョン、MATCH ID、リプレイコード、11視点ごとのYouTube URL / IDを入力する
- 動画URLが未入力の視点を残したまま保存する
- 「試合JSONをダウンロード」で、入力中の試合の `{matchId}.json` だけをダウンロードする
- 「更新したindex.jsonをダウンロード」で、今回追加した試合を反映した `index.json` だけをダウンロードする

このツールはサーバーやローカルフォルダへ直接書き込みません。最初に読み込んだIndexはページ内で保持され、試合を保存するとブラウザの通常のファイルダウンロードが1回だけ発生します。複数の試合を追加したあとにIndexをダウンロードし、ダウンロードした `{matchId}.json` と `index.json` を手動で `data/matches/` へ配置して確認し、commitしてpushしてください。既存のマッチJSONを自動取得・再出力したり、物理ファイルを削除したりはしません。既存データを編集する場合は、対象JSONを手動で編集するか、将来、個別JSONの読み込み機能を追加します。`tools/` はGitHub Pagesのワークフローでコピーしないため、公開サイトからはアクセスできません。

## 使い方

1. `catalog.html` で試合を選ぶ
2. プレイヤーが動画時間を取得するまで待つ
3. 動画を再生し、`1`〜`9`と`0`、または左側の視点一覧を使って切り替える
4. 動画を一時停止し、「この時間にメモ」から内容を保存する
5. 保存したメモをクリックして、その再生位置へ移動する
6. 「メモをバックアップ」で試合設定とメモをファイルに保存する
7. 別のバックアップファイルを「メモを復元」して、設定とメモをまとめて復元する

## カタログと試合データの管理

- `catalog.html` はカタログ一覧JSONを読み込み、登録されている試合を一覧表示します。試合を選ぶと、対応するマッチJSONをプレイヤーが読み込みます。
- 試合の追加は、ローカルの `tools/catalog-builder.html` で既存の `index.json` を読み込み、マッチJSONと更新済みIndexを別々にダウンロードして行います。GitHub Actionsでも `data/matches/*.json` から公開用の一覧JSONを再生成して、一覧の更新漏れを防ぎます。
- `data/matches/index.json` は生成物としてcommitしても構いませんが、公開時にはGitHub ActionsがマッチJSONから再生成したものを使います。
- 公開用JSONに含めた試合がカタログに表示されます。準備中の試合は公開用JSONへ追加せず、ローカルや別ブランチで管理します。
- 共有用の試合マニフェストには個人メモを含めません。個人メモはプレイヤー側でmatchIdごとにブラウザへ保存されます。

共有用カタログの基本形式は、Supabaseへ移行しやすいように次のフィールドを使います。

カタログ一覧JSONには`scope: "shared-catalog-index"`、マッチJSONには`scope: "shared-match"`を付け、個人バックアップ（`scope: "personal-backup"`）と区別します。

```text
data/matches/index.json                 カタログ一覧（生成物）
  matches[].id                          UUID / matchId
  matches[].title                       試合タイトル
  matches[].mapKey                      マップの安定した識別子
  matches[].patchVersion                パッチ日（YYYY-MM-DD）
  matches[].sourceReplayCode             任意の検索用リプレイコード（一意キーではない）
  matches[].createdAt                    登録日時
  matches[].updatedAt                    更新日時
  matches[].manifestFile                 対応するマッチJSONのファイル名
  matches[].perspectiveCount             視点数
  matches[].videoCount                   動画登録数

data/matches/{matchId}.json             1試合分の共有マニフェスト
  match.id                               UUID / matchId
  match.title                            試合タイトル
  match.mapKey                            マップの安定した識別子
  match.patchVersion                      パッチ日（YYYY-MM-DD）
  match.sourceReplayCode                  任意の検索用リプレイコード
  match.createdAt                         登録日時
  match.updatedAt                         更新日時
  match.perspectives                      11視点の配列

match.perspectives[]
  slot                                   0〜10
  key                                    map / p01 ...
  name                                   表示名
  role                                   MAP / TANK / DPS / SUPPORT
  team                                   WORLD / ALLY / ENEMY
  youtubeVideoId                         YouTube動画ID（未登録の場合は空文字）
```

`mapKey` は `midtown` や `kings-row` のような機械向けの値で、マップ名と公式画像は `map-data.js` の共有マップ定義から解決します。これにより、同じマップ情報を各試合JSONへ重複して保存せず、画像URLの変更も1か所で管理できます。公式画像が未登録のマップは、カタログ上でマップ名だけを表示します。

`patchVersion` は、公式パッチノートの日付を `YYYY-MM-DD` 形式で保存するパッチ識別値です。カタログは `patch-data.js` の `currentVersion` と比較し、現行パッチなら通常の表示、異なるパッチなら「現行パッチと異なります」、未入力なら「パッチ未確認」をカードに表示します。静的サイトなので、公式パッチが更新されたときは `patch-data.js` の基準値を更新してcommitします。この注意表示はJSONに記録されたメタデータの比較であり、動画の再生可否やリプレイコードの有効性を検証するものではありません。

`data/matches/{matchId}.json` を管理上の正本とし、`index.json` はローカル生成ツールまたはGitHub ActionsがマッチJSONから生成する一覧ファイルとして扱います。Supabaseへ移行する段階では、マッチJSONの `match` が `matches`、`match.perspectives` が `match_perspectives` に対応します。

動画の再生時間はカタログやバックアップに保存しません。プレイヤーが現在のYouTube動画から実時間を取得し、再生バーの上限とメモの基準時間に反映します。動画の長さが異なる場合は、現在選択している動画の実時間に合わせます。

ローカル生成ツールの出力には、動画時間・公開ステータス・個人メモ・視点オフセットを含めません。過去の1ファイル形式や、JSONに `offsetSeconds` が残っている場合は、既存プレイヤーと生成ツールの後方互換処理で読み込めますが、新しいマッチJSONを書き出す際には整理されます。

動画URL / IDが未入力の視点は `youtubeVideoId: ""` として保持できます。準備中の試合を公開したくない場合は、公開用JSONへ追加する前のローカルファイルや別ブランチで管理します。アーカイブ状態も現MVPでは設けません。

デフォルトでは、YouTube IFrame Player APIのサンプル動画IDを11視点すべてに設定しています。実際の試合動画で試す場合は置き換えてください。

## 実装上の注意

- iframeの初期化完了と、動画が現在の試合位置までバッファされていることは別です。
- カタログ一覧とマッチJSONは別ファイルです。カタログ一覧だけでは11視点の動画情報を持たず、プレイヤーが選択された試合のマッチJSONを追加で読み込みます。
- マッチJSONやIndexを削除・置き換えたい場合は、`data/matches/` のファイルを手動で整理してください。ローカル生成ツールは既存ファイルを自動削除・上書きしません。
- 視点切替では`loadVideoById`を使い、同じプレイヤーで対象動画を読み込みます。再生中はそのまま再生し、停止中は映像フレームが表示された直後に自動停止します。
- YouTube純正の操作UIは非表示にし、字幕は初期表示しない設定にしています。動画タイトルや再生終了後の関連動画はYouTubeの仕様上、完全には非表示にできません。
- メモは動画の再生位置を基準に記録され、クリックすると現在の視点を維持したままその位置へ移動します。
- 旧形式の視点ごとの開始位置補正が残っている場合は、切り替え前の再生位置へ復元する互換処理が働きます。新しく生成するカタログでは、録画時点で視点を揃える前提のため補正値を使いません。
- 試合ID、リプレイコード、試合タイトル、11視点の動画ID、メモ、音量設定は同じ設定データとして`localStorage`に保存されます。動画時間は保存しません。旧形式のバックアップに含まれる視点オフセットは後方互換のため読み込めます。
- 「メモをバックアップ」は、試合IDと試合設定のスナップショットに個人メモを紐づけて1ファイルに保存します。ファイル形式は内部的にはJSONですが、画面では用途を示す表現にしています。
- 「メモを復元」は、内容を検証してから試合設定と個人メモを現在の画面へ復元します。旧形式（version 1 / 2）のJSONも読み込めます。version 1は試合IDが含まれないため新しいIDを発行します。
- 試合IDはリプレイコードそのものではなく、将来サービス側で試合データを識別するための一意な値です。共有用の試合データには個人メモを含めない想定です。
- YouTubeの埋め込み要件では、自動再生やプレイヤーの重ね合わせなどに制限があります。本番の設計では、[Required Minimum Functionality](https://developers.google.com/youtube/terms/required-minimum-functionality) と [IFrame Player API](https://developers.google.com/youtube/iframe_api_reference) を確認してください。

## 将来の戻し方

複数iframe方式は今回の製品画面から外しています。比較検証が必要になった場合は、1プレイヤー方式を基準にした別の実験画面として再追加できます。
