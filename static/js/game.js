/* Server owns answers and life. UI never changes either optimistically. */
(() => {
  'use strict';
  const el = Object.fromEntries(['life', 'cctv', 'camera-status', 'hint', 'remaining', 'countdown', 'options', 'feedback', 'next', 'leave', 'game-result', 'result-restart', 'result-count'].map(id => [id, document.getElementById(id)]));
  const state = { gameID: null, questionID: null, cctvUUID: null, life: null, correctCount: 0, selectedAnswerID: null, correctAnswerID: null, remainingTime: 10, timerID: null, isSubmitting: false, isShowingFeedback: false };
  let deadline = 0, active = true, loading = false, answered = false;
  let nextAction = null, feedbackTimer = null;
  const stopTimer = () => { clearInterval(state.timerID); state.timerID = null; };
  const disableOptions = () => { el.options.querySelectorAll('button').forEach(button => { button.disabled = true; }); };
  function feedback(message, tone = '') { el.feedback.textContent = message; el.feedback.dataset.tone = tone; }
  function action(label, callback) { el.next.textContent = label; nextAction = callback; el.next.hidden = false; }
  function renderLife() {
    el.life.replaceChildren();
    for (let index = 0; index < 3; index++) {
      const heart = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      heart.setAttribute('viewBox', '0 0 24 24');
      heart.setAttribute('class', 'life-heart');
      heart.setAttribute('aria-hidden', 'true');
      const shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      shape.setAttribute('d', 'M12 21 3.4 12.8C-1.1 8.5 5.1 1.9 10 5.3L12 7l2-1.7c4.9-3.4 11.1 3.2 6.6 7.5Z');
      shape.setAttribute('fill', state.life !== null && index < state.life ? 'currentColor' : 'none');
      shape.setAttribute('stroke', 'currentColor');
      shape.setAttribute('stroke-width', '1.8');
      shape.setAttribute('stroke-linejoin', 'round');
      heart.append(shape); el.life.append(heart);
    }
    el.life.setAttribute('aria-label', `剩餘生命 ${state.life ?? '未知'}，共 3 個`);
  }
  async function request(url, options = {}) {
    const response = await fetch(url, { ...options, signal: AbortSignal.timeout(30000), cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }
  function validLife(value) { return Number.isInteger(value) && value >= 0 && value <= 3; }
  function validCount(value) { return Number.isSafeInteger(value) && value >= 0; }
  function validID(value) { return (typeof value === 'string' && value.length > 0) || (typeof value === 'number' && Number.isFinite(value)); }
  function resetImage() { el.cctv.hidden = true; el.cctv.onload = null; el.cctv.onerror = null; el.cctv.removeAttribute('src'); }
  async function loadCCTV(uuid) {
    resetImage();
    el['camera-status'].hidden = false;
    el['camera-status'].textContent = '正在連接國道即時影像…';
    const data = await request(`/api/game/cctv?${new URLSearchParams({ uuid })}`);
    const url = new URL(data.imageURL);
    if (data.cctvID !== uuid || url.protocol !== 'https:' || !['cctvn.freeway.gov.tw', 'cctvc.freeway.gov.tw', 'cctvs.freeway.gov.tw', 'cctvn5.freeway.gov.tw'].includes(url.hostname)) {
      throw new Error('CCTV 影像網址格式不符');
    }
    url.searchParams.set('t', String(Date.now()));
    await new Promise((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => finish(new Error('影像連線逾時')), 15000);
      const frameCheck = setInterval(() => { if (el.cctv.naturalWidth > 0) finish(); }, 200);
      const finish = error => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        clearInterval(frameCheck);
        el.cctv.onload = null;
        el.cctv.onerror = null;
        error ? reject(error) : resolve();
      };
      el.cctv.onload = () => finish();
      el.cctv.onerror = () => finish(new Error('無法顯示這支監視器'));
      el.cctv.src = url.href;
    });
    if (!active || state.cctvUUID !== uuid) return;
    el.cctv.hidden = false;
    el['camera-status'].hidden = true;
  }
  function showResult() {
    stopTimer(); disableOptions();
    el.next.hidden = true; nextAction = null;
    el['result-count'].textContent = String(state.correctCount);
    if (!el['game-result'].open) el['game-result'].showModal();
  }
  function startTimer() {
    stopTimer();
    deadline = performance.now() + 10000;
    const tick = () => {
      state.remainingTime = Math.max(0, Math.ceil((deadline - performance.now()) / 1000));
      el.remaining.textContent = String(state.remainingTime);
      el.countdown.value = state.remainingTime;
      if (state.remainingTime === 0) void submitAnswer(null);
    };
    state.timerID = setInterval(tick, 100);
    tick();
  }
  async function loadQuestion() {
    if (loading || !active) return;
    loading = true; clearTimeout(feedbackTimer); stopTimer(); disableOptions(); resetImage();
    el.options.replaceChildren(); el.next.hidden = true; nextAction = null;
    state.isShowingFeedback = false; state.questionID = null; state.cctvUUID = null; answered = false;
    state.selectedAnswerID = null; state.correctAnswerID = null;
    el.remaining.textContent = '10'; el.countdown.value = 10;
    el.hint.textContent = '正在準備題目…';
    el['camera-status'].hidden = false; el['camera-status'].textContent = '等待題目載入';
    feedback('正在載入題目…');
    try {
      const data = await request(`/api/game/question?${new URLSearchParams({ gameID: state.gameID })}`);
      if (!active) return;
      if (!validLife(data.life) || !validCount(data.correctCount)) throw new Error('題目狀態格式不符');
      state.life = data.life; state.correctCount = data.correctCount; renderLife();
      if (state.life === 0) { showResult(); return; }
      if (!validID(data.questionID) || typeof data.question_cctvUUID !== 'string' || !data.question_cctvUUID || !Array.isArray(data.options) || data.options.length !== 4 || !data.options.every(o => o && validID(o.id) && typeof o.name === 'string') || new Set(data.options.map(o => String(o.id))).size !== 4) throw new Error('題目資料格式不符');
      state.questionID = data.questionID; state.cctvUUID = data.question_cctvUUID;
      el.hint.textContent = '觀察路牌、地形與車流，選出正確的國道。';
      data.options.forEach((option, index) => {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'option'; button.dataset.answerId = String(option.id);
        button.textContent = `${String.fromCharCode(65 + index)}　${option.name}`; button.disabled = true;
        button.addEventListener('click', () => void submitAnswer(option.id)); el.options.append(button);
      });
      try { await loadCCTV(state.cctvUUID); }
      catch (error) {
        if (!active) return;
        el['camera-status'].textContent = error.message;
        feedback('這支鏡頭暫時無法顯示，作答尚未開始。', 'error');
        action('換一支鏡頭', () => void skipCamera()); return;
      }
      beginAnswering();
    } catch (error) {
      if (active) {
        if (error.message === 'HTTP 404') {
          try { sessionStorage.removeItem('gameID'); } catch {}
          state.gameID = null; loading = false; void startGame();
        } else { feedback(`無法載入題目（${error.message}）。`, 'error'); action('重試載入', () => void loadQuestion()); }
      }
    } finally { loading = false; }
  }
  function beginAnswering() {
    if (!active) return;
    el.next.hidden = true; nextAction = null;
    el.options.querySelectorAll('button').forEach(button => { button.disabled = false; });
    feedback('選擇一個答案，或在時間結束後查看結果。'); startTimer();
  }
  async function skipCamera() {
    if (loading || !active || !state.questionID) return;
    loading = true; el.next.disabled = true;
    try {
      await request('/api/game/skip', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameID: state.gameID, questionID: state.questionID }) });
    } catch (error) {
      feedback(`無法更換鏡頭（${error.message}），請再試一次。`, 'error');
      el.next.disabled = false; loading = false; return;
    }
    loading = false; el.next.disabled = false;
    void loadQuestion();
  }
  async function startGame() {
    if (loading || !active) return;
    loading = true; feedback('正在建立遊戲…');
    try {
      const data = await request('/api/sign', { method: 'POST' });
      if (!data.OK || !validID(data.gameID) || !validLife(data.life) || !validCount(data.correctCount)) throw new Error('遊戲資料格式不符');
      state.gameID = data.gameID; state.life = data.life; state.correctCount = data.correctCount; renderLife();
      try { sessionStorage.setItem('gameID', state.gameID); } catch { /* The current page can still play without storage. */ }
    } catch (error) {
      feedback(`無法開始遊戲（${error.message}）。`, 'error');
      action('重試開始', () => void startGame());
      return;
    } finally { loading = false; }
    void loadQuestion();
  }
  function restartGame() {
    if (loading || state.isSubmitting) return;
    el['game-result'].close();
    clearTimeout(feedbackTimer); stopTimer(); resetImage();
    state.gameID = null; state.questionID = null; state.cctvUUID = null;
    state.life = null; state.correctCount = 0; state.isShowingFeedback = false; answered = false;
    try { sessionStorage.removeItem('gameID'); } catch {}
    renderLife();
    el.options.replaceChildren();
    el.hint.textContent = '正在準備新的一局…';
    el['camera-status'].hidden = false;
    el['camera-status'].textContent = '等待題目載入';
    el.next.hidden = true; nextAction = null;
    void startGame();
  }
  async function submitAnswer(ansID) {
    if (!active || loading || state.questionID === null || answered || state.isSubmitting || state.isShowingFeedback || !state.timerID) return;
    if (performance.now() >= deadline) ansID = null;
    answered = true; state.isSubmitting = true; state.selectedAnswerID = ansID;
    stopTimer(); disableOptions(); feedback('正在確認答案…');
    el.options.querySelectorAll('button').forEach(button => button.classList.toggle('selected', ansID !== null && button.dataset.answerId === String(ansID)));
    try {
      const data = await request('/api/game/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameID: state.gameID, questionID: state.questionID, ansID, timestamp: Math.floor(Date.now() / 1000) }) });
      if (!active) return;
      if (typeof data.isRight !== 'boolean' || !validLife(data.life) || !validCount(data.correctCount) || !validID(data.answer) || !Array.from(el.options.children).some(button => button.dataset.answerId === String(data.answer))) throw new Error('答題回應格式不符');
      state.life = data.life; state.correctCount = data.correctCount; state.correctAnswerID = data.answer; state.isShowingFeedback = true; renderLife();
      el.options.querySelectorAll('button').forEach(button => {
        const correct = button.dataset.answerId === String(data.answer);
        button.classList.toggle('correct', correct);
        button.classList.toggle('wrong', !data.isRight && ansID !== null && button.dataset.answerId === String(ansID));
        if (correct) button.textContent += ' ✓ 正確答案';
      });
      feedback(`${data.isRight ? '答對了！' : ansID === null ? '時間到了！' : '答錯了！'}${state.life === 0 ? ' 挑戰結束，查看本次結果。' : ' 正確答案已標示，即將進入下一題。'}`);
      const advance = () => { clearTimeout(feedbackTimer); if (!active) return; state.life === 0 ? showResult() : void loadQuestion(); };
      action(state.life === 0 ? '查看結算' : '下一題', advance);
      feedbackTimer = setTimeout(advance, 2500);
    } catch (error) {
      if (active) feedback(`無法確認作答結果（${error.message}）。為避免重複紀錄，不會重新送出；請返回首頁重新開始。`, 'error');
    } finally { state.isSubmitting = false; }
  }
  el.next.addEventListener('click', () => nextAction?.());
  el['result-restart'].addEventListener('click', restartGame);
  window.addEventListener('pagehide', () => { active = false; clearTimeout(feedbackTimer); stopTimer(); resetImage(); });
  // A page restored from the back/forward cache needs a fresh round too.
  window.addEventListener('pageshow', event => { if (event.persisted) window.location.reload(); });
  // Reload means the player explicitly starts over, even after reaching zero life.
  const isReload = performance.getEntriesByType('navigation')[0]?.type === 'reload';
  try {
    if (isReload) sessionStorage.removeItem('gameID');
    else state.gameID = sessionStorage.getItem('gameID');
  } catch { state.gameID = null; }
  renderLife();
  if (state.gameID) void loadQuestion();
  else void startGame();
})();
