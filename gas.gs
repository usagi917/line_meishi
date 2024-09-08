// LINE Messaging APIのWebhookエンドポイント
function doPost(e) {
  var json = JSON.parse(e.postData.contents);
  var replyToken = json.events[0].replyToken;

  try {
    var events = json.events;
    for (var i = 0; i < events.length; i++) {
      var event = events[i];

      // 画像メッセージを受信
      if (event.message.type === 'image') {
        var imageId = event.message.id;
        var imageBlob = getImageFromLine(imageId);

        // 画像をGoogle Driveに保存
        var folder = DriveApp.getFolderById('GoogleDrive ID'); //Google drive ID
        var fileName = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd') + '.jpg';
        var file = folder.createFile(imageBlob).setName(fileName);

        // Google Cloud Vision APIでOCRを実行
        var ocrText = extractTextFromImage(file);

        // GPT-4o-miniでテキストを分類
        var classifiedData = classifyTextWithGpt(ocrText);

        // スプレッドシートにデータを保存し、LINEにメッセージを送信
        saveDataToSheet(file.getUrl(), classifiedData, replyToken);
      }
    }
  } catch (error) {
    sendMessageToLine(replyToken, 'エラーが発生しました: ' + error.message);
  }
}


// 画像をLINEから取得
function getImageFromLine(imageId) {
  var url = 'https://api-data.line.me/v2/bot/message/' + imageId + '/content';
  var options = {
    headers: {
      'Authorization': 'Bearer ' + getScriptProperty('LINE_CHANNEL_ACCESS_TOKEN'),
    },
    muteHttpExceptions: true
  };
  var response = UrlFetchApp.fetch(url, options);

  if (response.getResponseCode() === 200) {
    return response.getBlob();
  } else {
    Logger.log('Failed to retrieve image from LINE: ' + response.getContentText());
    throw new Error('Error in retrieving image from LINE');
  }
}

// Google Cloud Vision APIでOCRを実行
function extractTextFromImage(file) {
  return retryRequest(function() {
    if (!file) {
      throw new Error('File object is null or undefined. Failed to save image to Google Drive.');
    }

    var visionApiUrl = 'https://vision.googleapis.com/v1/images:annotate?key=' + getScriptProperty('VISION_API_KEY');
    var imageContent = Utilities.base64Encode(file.getBlob().getBytes());
    var requestPayload = {
      "requests": [
        {
          "image": {
            "content": imageContent
          },
          "features": [
            {
              "type": "TEXT_DETECTION"
            }
          ]
        }
      ]
    };

    Logger.log('Request Payload: ' + JSON.stringify(requestPayload)); // リクエストペイロードをログに記録

    var options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(requestPayload),
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch(visionApiUrl, options);
    var jsonResponse = response.getContentText();
    Logger.log('Response: ' + jsonResponse); // レスポンスをログに記録
    
    var json = JSON.parse(jsonResponse);

    if (json.responses && json.responses[0].textAnnotations) {
      return json.responses[0].textAnnotations[0].description;
    } else {
      Logger.log('OCR Error: ' + JSON.stringify(json.responses));
      throw new Error('Error in extracting text using OCR');
    }
  }, 3);
}

// GPT-4o-miniでテキストを分類
function classifyTextWithGpt(ocrText) {
  return retryRequest(function() {
    var apiUrl = 'https://api.openai.com/v1/chat/completions';
    var data = {
      "model": "gpt-4o-mini",
      "messages": [
        {"role": "system", "content": "You are a highly accurate text classifier that extracts specific information from text."},
        {"role": "user", "content": '以下のテキストを分類して、名前、会社名、住所、電話番号、メールアドレスを抽出してください:\n' + ocrText + '\nテキストが複数行に分かれている場合でも、適切に分類してください。'}
      ],
      "max_tokens": 1000
    };

    var options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(data),
      headers: {
        'Authorization': 'Bearer ' + getScriptProperty('OPENAI_API_KEY'),
      },
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch(apiUrl, options);
    var jsonResponse = response.getContentText();
    var json = JSON.parse(jsonResponse);

    if (json.choices && json.choices.length > 0) {
      return json.choices[0].message.content.trim();
    } else {
      throw new Error('Error in classifying text with GPT-4o-mini');
    }
  }, 3);
}


// スプレッドシートにデータを保存
function saveDataToSheet(imageUrl, classifiedData, replyToken) {
  var sheetId = 'スプシID';  // スプレッドシートIDを指定
  var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('名刺管理');

  if (!sheet) {
    throw new Error('Sheet "名刺管理" not found.');
  }

  // 分類結果を正しくパースして、対応する列に挿入
  var name = '';
  var companyName = '';
  var address = '';
  var phoneNumber = '';
  var email = '';

  // 分類されたデータを行ごとに解析
  var lines = classifiedData.split('\n');
  lines.forEach(function(line) {
    if (line.includes('名前:')) {
      name = line.split('名前:')[1].trim();
    } else if (line.includes('会社名:')) {
      companyName = line.split('会社名:')[1].trim();
    } else if (line.includes('住所:')) {
      address = line.split('住所:')[1].trim();
    } else if (line.includes('電話番号:')) {
      phoneNumber = line.split('電話番号:')[1].trim();
    } else if (line.includes('メールアドレス:')) {
      email = line.split('メールアドレス:')[1].trim();
    }
  });

  // データをスプレッドシートに追加
  sheet.appendRow([
    new Date(),
    name,
    companyName,
    address,
    phoneNumber,
    email,
    imageUrl
  ]);

  // 登録完了メッセージとスプレッドシートのURLをLINEに送信
  var spreadsheetUrl = 'https://docs.google.com/spreadsheets/d/' + sheetId + '/edit';
  var message = '登録が終わりました。\nスプレッドシートはこちらです: ' + spreadsheetUrl;
  sendMessageToLine(replyToken, message);
}

// リクエスト再試行のためのユーティリティ関数
function retryRequest(requestFunc, maxRetries) {
  var attempt = 0;
  while (attempt < maxRetries) {
    try {
      return requestFunc();
    } catch (error) {
      Logger.log('Attempt ' + (attempt + 1) + ' failed: ' + error.message);
      attempt++;
      Utilities.sleep(1000);  // 少し待機してから再試行
    }
  }
  throw new Error('Request failed after ' + maxRetries + ' attempts');
}

// LINEユーザーにエラーメッセージを送信
function sendErrorMessageToLine(replyToken, errorMessage) {
  var url = 'https://api.line.me/v2/bot/message/reply';
  var options = {
    'method': 'post',
    'contentType': 'application/json',
    'headers': {
      'Authorization': 'Bearer ' + getScriptProperty('LINE_CHANNEL_ACCESS_TOKEN')
    },
    'payload': JSON.stringify({
      'replyToken': replyToken,
      'messages': [{
        'type': 'text',
        'text': 'エラーが発生しました: ' + errorMessage
      }]
    })
  };
  UrlFetchApp.fetch(url, options);
}

// スクリプトプロパティから値を取得
function getScriptProperty(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

// LINEユーザーにメッセージを送信
function sendMessageToLine(replyToken, message) {
  var url = 'https://api.line.me/v2/bot/message/reply';
  var options = {
    'method': 'post',
    'contentType': 'application/json',
    'headers': {
      'Authorization': 'Bearer ' + getScriptProperty('LINE_CHANNEL_ACCESS_TOKEN')
    },
    'payload': JSON.stringify({
      'replyToken': replyToken,
      'messages': [{
        'type': 'text',
        'text': message
      }]
    })
  };
  UrlFetchApp.fetch(url, options);
}
