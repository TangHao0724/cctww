const API_BASE = "";
const USE_MOCK = true;

// ====== DOM ======
const listEl    = document.getElementById("rankingList");
const stateEl   = document.getElementById("rankingState");
const refreshBtn = document.getElementById("refreshBtn");

// ====== 事件 ======
refreshBtn.addEventListener("click", loadRanking);
loadRanking();

// ====== 主流程 ======
async function loadRanking() {
    setState("載入中…");
    try {
        const data = await fetchRanking();
        if (data.error) throw new Error(data.msg || "取得排行榜失敗");
        render(data.ranking_list || []);
    } catch (err) {
        setState(`載入失敗：${err.message}`);
    }
}

function render(list) {
    listEl.innerHTML = "";

    if (!list.length) {
        setState("目前還沒有人上榜");
        return;
    }
    hideState();

    // 依 score 由高到低、同分則 time 少者優先排序（保險用，Server 通常已排好）
    const sorted = [...list].sort((a, b) => b.score - a.score || a.time - b.time);

    sorted.forEach((row, i) => {
        const rank = i + 1;
        const li = document.createElement("li");
        li.className = "rank-row";
        li.dataset.rank = rank;

        li.innerHTML = `
            <span class="rank-badge">${rankMark(rank)}</span>
            <span class="rank-name" title="${escapeHtml(row.name)}">${escapeHtml(row.name)}</span>
            <span class="rank-score">${row.score}</span>
            <span class="rank-time">${formatTime(row.time)}</span>
        `;
        listEl.appendChild(li);
    });
}

// ====== API ======
async function fetchRanking() {
    if (USE_MOCK) {
        await delay(400);
        return MOCK_RANKING;
    }
    const res = await fetch(`${API_BASE}/api/ranking`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

// ====== 假資料（符合規格書格式）======
const MOCK_RANKING = {
    ranking_list: [
        { ID: 1, name: "夜路觀察員", score: 20, time: 120 },
        { ID: 2, name: "Player B",   score: 18, time: 135 },
        { ID: 3, name: "國道之王",   score: 18, time: 150 },
        { ID: 4, name: "彎道情人",   score: 12, time: 98  },
        { ID: 5, name: "Player E",   score: 9,  time: 210 },
    ],
};

// ====== 小工具 ======
function rankMark(rank) {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return rank;
}
function formatTime(sec) {
    const s = Number(sec) || 0;
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m > 0 ? `${m}:${String(r).padStart(2, "0")}` : `${r}s`;
}
function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function setState(text) { stateEl.hidden = false; stateEl.textContent = text; }
function hideState() { stateEl.hidden = true; }
function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }