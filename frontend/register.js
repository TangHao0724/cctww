const API_BASE = "";
const USE_MOCK = true;

const backdrop   = document.getElementById("registerBackdrop");
const openBtn    = document.getElementById("openRegister");
const closeBtn   = document.getElementById("closeRegister");
const form       = document.getElementById("registerForm");
const nickname   = document.getElementById("nickname");
const email      = document.getElementById("email");
const nickHint   = document.getElementById("nicknameHint");
const emailHint  = document.getElementById("emailHint");
const submitBtn  = document.getElementById("submitBtn");
const statusBox  = document.getElementById("statusBox");
const statusText = document.getElementById("statusText");

openBtn.addEventListener("click", () => { backdrop.hidden = false; nickname.focus(); });
closeBtn.addEventListener("click", closeDialog);
backdrop.addEventListener("click", (e) => { if (e.target === backdrop) closeDialog(); });
function closeDialog() { backdrop.hidden = true; resetStatus(); }

nickname.addEventListener("input", () => {
    if (nickname.value.trim()) {
        nickHint.textContent = "";
        nickHint.classList.remove("warn");
    } else {
        nickHint.textContent = "";
        nickHint.classList.remove("warn");
    }
});

email.addEventListener("input", () => {
    const v = email.value.trim();
    if (v && !isValidEmail(v)) {
        email.classList.add("invalid");
        emailHint.textContent = "Incorrect Email";
        emailHint.classList.add("warn");
    } else {
        email.classList.remove("invalid");
        emailHint.textContent = "";
        emailHint.classList.remove("warn");
    }
});

function isValidEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const emailVal = email.value.trim();
    if (emailVal && !isValidEmail(emailVal)) {
        setStatus("error", "Incorrect Email");
        return;
    }

    const payload = {
        nickname: nickname.value.trim() || null,
        email: emailVal || null,
    };

    setLoading(true);
    setStatus("loading", "loading...");

    try {
        const data = await signIn(payload);
        if (data.error) throw new Error(data.msg || "fail");
        const shownName = payload.nickname || "（）";
        setStatus("success", `${shownName} 已建立帳戶，gameID：${data.gameID}`);
    }
    catch (err) {
        setStatus("error", `error：${err.message}`);
    }
    finally {
        setLoading(false);
    }
});

async function signIn(payload) {
    if (USE_MOCK) {
        await delay(700);
        return { OK: true, gameID: "MOCK-" + Math.random().toString(36).slice(2, 10).toUpperCase() };
    }

    const res = await fetch(`${API_BASE}/api/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

function setLoading(on) {
    submitBtn.disabled = on;
    submitBtn.classList.toggle("loading", on);
}
function setStatus(state, text) {
    statusBox.hidden = false;
    statusBox.dataset.state = state;
    statusText.textContent = text;
}
function resetStatus() {
    statusBox.hidden = true;
    statusBox.dataset.state = "idle";
}
function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }