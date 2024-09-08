# LINE 名刺管理ボット

このプロジェクトは、LINEのMessaging APIを利用してユーザーがLINEを通じて画像を送信すると、Google Driveに保存し、OCR処理を実行した後、その結果をGPT-4o-miniを使ってテキスト分類し、名刺データとしてGoogleスプレッドシートに保存するボットです。

## 機能

- **画像の受信**: LINE経由でユーザーから画像を受信。
- **Google Driveに保存**: 受信した画像をGoogle Driveに自動的に保存。
- **OCR処理**: Google Cloud Vision APIを利用して、画像からテキストを抽出。
- **テキスト分類**: GPT-4o-miniを使用して、抽出したテキストを名刺情報（名前、会社名、住所、電話番号、メールアドレス）に分類。
- **データ保存**: 分類された情報をGoogleスプレッドシートに保存し、URLをLINEユーザーに返信。

## 使用技術

- **LINE Messaging API**: LINEとのメッセージや画像のやり取りを処理。
- **Google Apps Script**: ボットのバックエンドロジックに使用されています。
- **Google Drive API**: 画像をGoogle Driveに保存。
- **Google Cloud Vision API**: 画像からテキストを抽出するために使用。
- **GPT-4o-mini**: 抽出したテキストを名刺情報に分類。
- **Googleスプレッドシート**: 分類された名刺情報を保存。

## インストール手順

### 前提条件

- LINE DeveloperアカウントとMessaging APIのチャネルが必要です。
- Google Cloud Vision APIのAPIキーが必要です。
- GPT-4o-miniのAPIキー（OpenAIのAPIキー）が必要です。
- Google Driveに保存先フォルダのIDを取得しておく必要があります。
- Googleスプレッドシートに名刺情報を保存するためのスプレッドシートを準備してください。

### セットアップ手順

1. **LINE Developerでの設定**  
   LINE Developer Consoleで新しいチャネルを作成し、`LINE_CHANNEL_ACCESS_TOKEN`と`LINE_CHANNEL_SECRET`を取得します。

2. **Google Apps Scriptの設定**  
   Google Apps Scriptで新しいプロジェクトを作成し、コードを貼り付けます。

3. **APIキーとスクリプトプロパティの設定**  
   Google Apps Scriptの`PropertiesService`を使用して、以下のAPIキーとフォルダIDをスクリプトプロパティに保存します。

   - `LINE_CHANNEL_ACCESS_TOKEN`
   - `VISION_API_KEY`
   - `OPENAI_API_KEY`
   - Google DriveのフォルダID

4. **Google Cloud Vision APIの有効化**  
   [Google Cloud Console](https://console.cloud.google.com/)にアクセスし、Vision APIを有効にします。

5. **Googleスプレッドシートの作成**  
   名刺情報を保存するためのスプレッドシートを作成し、スプレッドシートIDを取得して、スクリプトに反映させます。

6. **ウェブアプリとしてデプロイ**  
   Google Apps Scriptの「デプロイ」メニューからウェブアプリとしてデプロイし、LINEのWebhook URLに設定します。

### 動作手順

1. LINEユーザーが画像をボットに送信します。
2. 画像がGoogle Driveに保存され、Google Cloud Vision APIを通じてOCR処理が行われます。
3. 抽出されたテキストはGPT-4o-miniを使用して名刺情報に分類されます。
4. 分類された名刺データはGoogleスプレッドシートに保存され、ユーザーに結果が通知されます。

### エラーハンドリング

- 画像取得やAPIリクエストに失敗した場合、エラーメッセージをLINEユーザーに送信します。
- リトライ機能を実装しており、APIリクエストが失敗した際に最大3回の再試行を行います。

## ライセンス

このプロジェクトはMITライセンスの下でライセンスされています。詳細は[LICENSE](LICENSE)ファイルをご覧ください。
