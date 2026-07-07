// ===== 設定 =====
// 画像認識+画像編集ができる Gemini モデル（通称 Nano Banana）。
// もし利用不可の場合は "gemini-2.5-flash-image-preview" を試してください。
const MODEL = "gemini-2.5-flash-image";
const ENDPOINT = (model, key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;

const COLOR_PRESETS = [
  // --- 物の色を変える ---
  { label: "物→赤", color: "#e23b3b", prompt: "対象の主役となる物の色を鮮やかな赤に変えてください。" },
  { label: "物→青", color: "#3b7de2", prompt: "対象の主役となる物の色を鮮やかな青に変えてください。" },
  { label: "物→緑", color: "#3bbf5a", prompt: "対象の主役となる物の色を鮮やかな緑に変えてください。" },
  { label: "物→黄", color: "#e8c93b", prompt: "対象の主役となる物の色を明るい黄色に変えてください。" },
  // --- 服の色を変える（人物向け）---
  { label: "服→赤", color: "#e23b3b", prompt: "写っている人物が着ている服（衣服）の色だけを鮮やかな赤に変えてください。" },
  { label: "服→青", color: "#3b7de2", prompt: "写っている人物が着ている服（衣服）の色だけを鮮やかな青に変えてください。" },
  { label: "服→緑", color: "#3bbf5a", prompt: "写っている人物が着ている服（衣服）の色だけを深い緑に変えてください。" },
  { label: "服→黒", color: "#333333", prompt: "写っている人物が着ている服（衣服）の色だけを黒に変えてください。" },
  { label: "服→白", color: "#dddddd", prompt: "写っている人物が着ている服（衣服）の色だけを白に変えてください。" },
  { label: "服→ピンク", color: "#e23b9b", prompt: "写っている人物が着ている服（衣服）の色だけをパステルピンクに変えてください。" },
  // --- その他 ---
  { label: "モノクロ", color: "#888888", prompt: "画像全体をモノクロ（白黒）にしてください。" },
];

// ===== 状態 =====
let selectedFile = null;   // { mimeType, base64, dataUrl }

// ===== 要素 =====
const $ = (id) => document.getElementById(id);
const apiKeyInput = $("apiKey");
const promptInput = $("prompt");
const convertBtn = $("convert");
const beforeImg = $("beforeImg");
const afterImg = $("afterImg");
const afterPlaceholder = $("afterPlaceholder");
const resultCard = $("result");
const downloadLink = $("download");
const statusEl = $("status");

// ===== 初期化 =====
init();

function init() {
  // キーの読み込み優先順位: localStorage（保存済み） > config.js（window.GEMINI_API_KEY）
  const savedKey = localStorage.getItem("gemini_api_key");
  const fileKey = (typeof window !== "undefined" && window.GEMINI_API_KEY) || "";
  const placeholder = fileKey === "ここにAPIキーを貼り付け" || fileKey === "あなたのAPIキー";

  if (savedKey) {
    apiKeyInput.value = savedKey;
  } else if (fileKey && !placeholder) {
    apiKeyInput.value = fileKey; // config.js のキーを自動セット
  }

  // プリセット生成
  const presetWrap = $("presets");
  COLOR_PRESETS.forEach((p) => {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.innerHTML = `<span class="dot" style="background:${p.color}"></span>${p.label}`;
    chip.addEventListener("click", () => {
      document.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      promptInput.value = p.prompt;
    });
    presetWrap.appendChild(chip);
  });

  $("saveKey").addEventListener("click", () => {
    localStorage.setItem("gemini_api_key", apiKeyInput.value.trim());
    showStatus("info", "APIキーを保存しました。");
  });

  $("cameraInput").addEventListener("change", onFileSelected);
  $("galleryInput").addEventListener("change", onFileSelected);
  convertBtn.addEventListener("click", convert);
}

// ===== 画像選択 =====
function onFileSelected(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const originalUrl = reader.result;
    // 送信前に最大1280pxへ縮小（大きな写真での失敗・遅延を防ぐ）
    downscale(originalUrl, 1280, (jpegDataUrl) => {
      const base64 = jpegDataUrl.split(",")[1];
      selectedFile = { mimeType: "image/jpeg", base64, dataUrl: jpegDataUrl };

      beforeImg.src = jpegDataUrl;
      resultCard.hidden = false;
      afterImg.hidden = true;
      afterPlaceholder.hidden = false;
      downloadLink.hidden = true;
      convertBtn.disabled = false;
      hideStatus();
    });
  };
  reader.readAsDataURL(file);
}

// 画像を長辺 maxPx 以内に縮小して JPEG(dataURL) を返す
function downscale(srcDataUrl, maxPx, cb) {
  const img = new Image();
  img.onload = () => {
    let { width, height } = img;
    const scale = Math.min(1, maxPx / Math.max(width, height));
    width = Math.round(width * scale);
    height = Math.round(height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(img, 0, 0, width, height);
    cb(canvas.toDataURL("image/jpeg", 0.9));
  };
  img.onerror = () => cb(srcDataUrl); // 失敗時は元画像のまま
  img.src = srcDataUrl;
}

// ===== 変換 =====
async function convert() {
  const key = apiKeyInput.value.trim();
  if (!key) return showStatus("error", "先に Gemini API キーを入力してください。");
  if (!selectedFile) return showStatus("error", "先に写真を撮る/選んでください。");

  const userPrompt = promptInput.value.trim() ||
    "対象の主役となる物の色を別の鮮やかな色に変えてください。";

  const instruction =
    `${userPrompt} ` +
    "形・構図・背景・質感は保ったまま、指定された対象の色だけを自然に変更した画像を生成してください。" +
    "人物が写っている場合は、顔・肌の色・髪・体型・ポーズ・アクセサリー・背景は一切変えず、本人だと分かるように保ってください。" +
    "服のシワや陰影も自然に残してください。";

  convertBtn.disabled = true;
  showStatus("loading", "Gemini が変換中…（数秒〜十数秒）", true);

  const body = {
    contents: [{
      parts: [
        { text: instruction },
        { inline_data: { mime_type: selectedFile.mimeType, data: selectedFile.base64 } },
      ],
    }],
    generationConfig: { responseModalities: ["IMAGE"] },
    // 正当な服の色替え等が過剰にブロックされるのを緩和（調整可能なカテゴリのみ）
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
    ],
  };

  try {
    // 安全フィルタのブロックは確率的なので、画像が返るまで最大2回試行
    const MAX_TRIES = 2;
    let outImage = null;
    let lastData = null;

    for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
      if (attempt > 1) showStatus("loading", `もう一度試しています…（${attempt}/${MAX_TRIES}）`, true);

      const res = await fetch(ENDPOINT(MODEL, key), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      lastData = data;

      if (!res.ok) {
        const msg = (data && data.error && data.error.message) || `HTTP ${res.status}`;
        throw new Error(msg); // キー/課金/リクエスト不正はリトライしても無意味
      }

      outImage = extractImage(data);
      if (outImage) break;
    }

    if (!outImage) {
      throw new Error("画像が返りませんでした。" + diagnose(lastData));
    }

    const outUrl = `data:${outImage.mimeType};base64,${outImage.data}`;
    afterImg.src = outUrl;
    afterImg.hidden = false;
    afterPlaceholder.hidden = true;
    downloadLink.href = outUrl;
    downloadLink.hidden = false;
    hideStatus();
  } catch (err) {
    showStatus("error", "エラー: " + err.message);
  } finally {
    convertBtn.disabled = false;
  }
}

// ===== レスポンス解析 =====
function extractImage(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    const inline = part.inline_data || part.inlineData;
    if (inline && inline.data) {
      return { mimeType: inline.mime_type || inline.mimeType || "image/png", data: inline.data };
    }
  }
  return null;
}

function extractText(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text).filter(Boolean).join(" ");
}

// 画像が返らなかった理由を人間向けに説明する
function diagnose(data) {
  const cand = data?.candidates?.[0];
  const finish = cand?.finishReason;
  const block = data?.promptFeedback?.blockReason;
  const textOut = extractText(data);

  // 安全フィルタ系のブロック
  const safety = ["SAFETY", "IMAGE_SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "RECITATION"];
  if (block || (finish && safety.includes(finish))) {
    return (
      "安全フィルタでブロックされた可能性があります（理由: " + (block || finish) + "）。" +
      "人物・顔・実在の人などが写っていると弾かれることがあります。別の写真（物・風景など）でお試しください。"
    );
  }
  if (textOut) return "モデルの応答: " + textOut;
  if (finish) return "終了理由: " + finish + "。別の写真やプロンプトでお試しください。";
  if (!cand) return "応答に候補がありませんでした。別の写真でお試しください。";
  return "別の写真やプロンプトでお試しください。";
}

// ===== ステータス表示 =====
function showStatus(type, msg, loading) {
  statusEl.hidden = false;
  statusEl.className = "status " + type;
  statusEl.replaceChildren(); // クリア
  if (loading) {
    const sp = document.createElement("span");
    sp.className = "spinner";
    statusEl.appendChild(sp);
  }
  // msg は API 応答由来の文字列を含みうるため textContent で安全に挿入
  statusEl.appendChild(document.createTextNode(msg));
}
function hideStatus() {
  statusEl.hidden = true;
}
