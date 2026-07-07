// ===== 設定 =====
// 画像認識+画像編集ができる Gemini モデル（通称 Nano Banana）。
// もし利用不可の場合は "gemini-2.5-flash-image-preview" を試してください。
const MODEL = "gemini-2.5-flash-image";
const ENDPOINT = (model, key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;

const COLOR_PRESETS = [
  { label: "赤", color: "#e23b3b", prompt: "対象の主役となる物の色を鮮やかな赤に変えてください。" },
  { label: "青", color: "#3b7de2", prompt: "対象の主役となる物の色を鮮やかな青に変えてください。" },
  { label: "緑", color: "#3bbf5a", prompt: "対象の主役となる物の色を鮮やかな緑に変えてください。" },
  { label: "黄", color: "#e8c93b", prompt: "対象の主役となる物の色を明るい黄色に変えてください。" },
  { label: "紫", color: "#9b3be2", prompt: "対象の主役となる物の色を紫に変えてください。" },
  { label: "ピンク", color: "#e23b9b", prompt: "対象の主役となる物の色をピンクに変えてください。" },
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
  // 保存済みキー
  const savedKey = localStorage.getItem("gemini_api_key");
  if (savedKey) apiKeyInput.value = savedKey;

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
    const dataUrl = reader.result;
    const base64 = String(dataUrl).split(",")[1];
    selectedFile = { mimeType: file.type || "image/jpeg", base64, dataUrl };

    beforeImg.src = dataUrl;
    resultCard.hidden = false;
    afterImg.hidden = true;
    afterPlaceholder.hidden = false;
    downloadLink.hidden = true;
    convertBtn.disabled = false;
    hideStatus();
  };
  reader.readAsDataURL(file);
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
    "形・構図・背景・質感は保ったまま、色だけを自然に変更した画像を生成してください。";

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
  };

  try {
    const res = await fetch(ENDPOINT(MODEL, key), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      const msg = (data && data.error && data.error.message) || `HTTP ${res.status}`;
      throw new Error(msg);
    }

    const outImage = extractImage(data);
    if (!outImage) {
      const textOut = extractText(data);
      throw new Error(
        "画像が返りませんでした。" + (textOut ? `モデルの応答: ${textOut}` : "モデル名や課金設定を確認してください。")
      );
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
