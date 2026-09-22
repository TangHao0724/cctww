const API_BASE = "";
const USE_MOCK = true;

const STATUS_LABEL = {
    finish:  { badge: "正常完成", note: "" },
    leaved:  { badge: "主動離開", note: "" },
    playing: { badge: "遊戲中",   note: "" },
    timeout: { badge: "逾時結束", note: "" },
};

const backdrop    = document.getElementById("resultBackdrop");
const openBtn     = document.getElementById("openResult");
const closeBtn    = document.getElementById("closeResult");
const statusWrap  = document.getElementById("resultStatus");
const statusBadge = document.getElementById("statusBadge");
const statusNote  = document.getElementById("statusNote");
const pointValue  = document.getElementById("pointValue");
const timeValue   = document.getElementById("timeValue");
const errorsList  = document.getElementById("errorsList");
const errorsCount = document.getElementById("errorsCount");
const errorsEmpty = document.getElementById("errorsEmpty");
const rankBtn     = document.getElementById("rankBtn");
const againBtn    = document.getElementById("againBtn");

// ====== 開關 ======
openBtn.addEventListener("click", () => openResult("MOCK-GAMEID"));
closeBtn.addEventListener("click", () => { backdrop.hidden = true; });
backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.hidden = true; });
rankBtn.addEventListener("click", () => { /* TODO: location.href = "/ranking"; */ });
againBtn.addEventListener("click", () => { /* TODO: location.href = "/index"; */ });

// ====== 主流程 ======
async function openResult(gameID) {
    backdrop.hidden = false;
    try {
        const data = await fetchResult(gameID);
        if (data.error) throw new Error(data.msg || "取得結算失敗");
        render(data);
    } catch (err) {
        statusBadge.textContent = "載入失敗";
        statusNote.textContent = err.message;
    }
}

function render(data) {
    // 狀態徽章
    const label = STATUS_LABEL[data.status] || { badge: data.status, note: "" };
    statusWrap.dataset.status = data.status;
    statusBadge.textContent = label.badge;
    statusNote.textContent = label.note;

    // 分數摘要
    pointValue.textContent = `${data.point} 題`;
    timeValue.textContent  = formatTime(data.total_time);

    // 錯題
    const errors = data.error_question || [];
    errorsCount.textContent = errors.length;
    errorsList.innerHTML = "";
    errorsEmpty.hidden = errors.length > 0;

    errors.forEach((q) => errorsList.appendChild(buildErrorCard(q)));
}

function buildErrorCard(q) {
    const card = document.createElement("div");
    card.className = "error-card";

    const des = q.des || {};
    const options = (q.options || [])
        .map((o) => {
            const cls = o.isAns ? "opt correct" : "opt";
            const tag = o.isAns ? '<span class="opt-tag">正解</span>' : "";
            return `<div class="${cls}">${escapeHtml(o.name)}${tag}</div>`;
        })
        .join("");

    const cctvInner = q.cctvID
        ? (USE_MOCK
            ? `CCTV 畫面（ID: ${escapeHtml(q.cctvID)}）`
            : `<img src="${API_BASE}/api/cctv?ID=${encodeURIComponent(q.cctvID)}" alt="正解 CCTV 畫面" />`)
        : "無 CCTV";

    card.innerHTML = `
        <div class="error-card-head">
            <span class="error-road">${escapeHtml(des.name || "未知路線")}</span>
            <span class="error-meta">${escapeHtml(des.dir || "")} ・ ${escapeHtml(des.mile || "")}</span>
        </div>
        <div class="error-cctv">${cctvInner}</div>
        <div class="error-options">${options}</div>
    `;
    return card;
}

// ====== API ======
async function fetchResult(gameID) {
    if (USE_MOCK) {
        await delay(500);
        return MOCK_RESULT;
    }
    const res = await fetch(`${API_BASE}/api/result?gameID=${encodeURIComponent(gameID)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

// ======
const MOCK_RESULT = {
    status: "finish",
    point: 8,
    total_time: 125,
    error_question: [
        {
            questionID: "Q-1001",
            cctvID: "T62-9K+020",
            des: { dir: "N", class: 1, name: "國道一號", mile: "9K+020" },
            options: [
                { id: 1, cctvID: "T62-9K+020", name: "國道一號", isAns: true },
                { id: 2, cctvID: "T63-3K+100", name: "國道三號", isAns: false },
                { id: 3, cctvID: "T10-5K+300", name: "國道十號", isAns: false },
                { id: 4, cctvID: "T74-2K+000", name: "台74線",  isAns: false },
            ],
        },
        {
            questionID: "Q-1002",
            cctvID: "T74-12K+500",
            des: { dir: "S", class: 2, name: "台74線", mile: "12K+500" },
            options: [
                { id: 1, cctvID: "T01-8K+100", name: "國道一號", isAns: false },
                { id: 2, cctvID: "T74-12K+500", name: "台74線",  isAns: true },
                { id: 3, cctvID: "T03-40K+200", name: "國道三號", isAns: false },
                { id: 4, cctvID: "T61-30K+000", name: "台61線",  isAns: false },
            ],
        },
    ],
};

// ====== 小工具 ======
function formatTime(sec) {
    const s = Number(sec) || 0;
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m > 0 ? `${m} 分 ${r} 秒` : `${r} 秒`;
}
function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }