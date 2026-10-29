/* =========================================================
   ROOT ALERT 浮根警報 · 互動原型（PWA）
   流程：假桌面（通知 / App 圖示）→ App 主頁＝拍照回報
         → 送出 → 感謝頁 → 超級感謝 / 回報地圖 / 叉叉回主頁
   App 內用底部分頁切換：地圖｜拍照回報｜我的
   ========================================================= */
(() => {
  "use strict";

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const phone = $("#phone");
  const pad3 = (n) => String(n).padStart(3, "0");
  const buzz = (ms = 12) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

  // ---------- 狀態（存在瀏覽器裡，關掉 App 再開也還在） ----------
  const BASE_REPORTS = 33;
  const KEY = "rootalert-demo-v2";
  const state = {
    reports: BASE_REPORTS,
    myReports: [],   // { photo, reasons, n, loc, t }
    metooGiven: 0,
    thanksGot: 0,
    screen: "desk",
    view: "camera",
    photo: null,
    cameraOK: null,
  };
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY) || "null");
      if (d) Object.assign(state, { reports: d.reports, myReports: d.myReports || [], metooGiven: d.metooGiven || 0, thanksGot: d.thanksGot || 0 });
    } catch (e) {}
  }
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ reports: state.reports, myReports: state.myReports.slice(-8), metooGiven: state.metooGiven, thanksGot: state.thanksGot }));
    } catch (e) {}
  }
  function mulberry32(a) {
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function timeAgo(t) {
    const m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return "剛剛";
    if (m < 60) return `${m} 分鐘前`;
    const h = Math.round(m / 60);
    return h < 24 ? `${h} 小時前` : `${Math.round(h / 24)} 天前`;
  }

  let toastT;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("is-on");
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove("is-on"), 1800);
  }
  function restartAnim(node, cls) { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); }

  // =========================================================
  // 畫面切換（大畫面） & App 分頁切換
  // =========================================================
  const enter = {}, leave = {};
  function go(name, { back = false, view } = {}) {
    if (name === state.screen) { if (name === "app" && view) setView(view); return; }
    const from = $(`#s-${state.screen}`), to = $(`#s-${name}`);
    leave[state.screen] && leave[state.screen]();
    if (view) state.view = view;
    from.classList.remove("is-active");
    if (back) { from.classList.add("is-leaving-back"); setTimeout(() => from.classList.remove("is-leaving-back"), 460); }
    to.classList.add("is-active");
    phone.dataset.theme = to.dataset.theme;
    state.screen = name;
    enter[name] && enter[name]();
  }

  const viewEnter = {}, viewLeave = {};
  function setView(name, force = false) {
    if (name === state.view && !force && $(`#v-${name}`).classList.contains("is-on")) return;
    if (state.view !== name) viewLeave[state.view] && viewLeave[state.view]();
    $$(".view").forEach((v) => v.classList.toggle("is-on", v.id === `v-${name}`));
    $$(".tab").forEach((t) => t.classList.toggle("is-on", t.dataset.view === name));
    state.view = name;
    viewEnter[name] && viewEnter[name]();
  }
  $$(".tab").forEach((t) => t.addEventListener("click", () => { buzz(8); setView(t.dataset.view); }));

  enter.app = () => setView(state.view, true);
  leave.app = () => { viewLeave[state.view] && viewLeave[state.view](); };

  // =========================================================
  // A. 假的手機桌面 + 通知
  // =========================================================
  const NOTIS = [
    { icon: "img/icon1.webp", title: () => "不看看腳下嗎？你上次踢到我的腳耶～", body: () => "幫我的腳拍個照片回報當作賠罪吧！" },
    { icon: "img/icon2.webp", title: () => `前面的路有${state.reports}人回報浮根！小心腳下！`, body: () => "你也來拍照回報加入浮根吹哨者吧～" },
  ];
  const SHOW_MS = 5000; // 通知停留 5 秒
  const GAP_MS = 700;   // 收回去後 0.7 秒再換下一則
  const noti = $("#noti");
  let notiIdx = 0, notiTimer = null, hintTimer = null;

  function notiShow(i) {
    const n = NOTIS[i];
    $("#noti-icon").src = n.icon;
    $("#noti-title").textContent = n.title();
    $("#noti-body").textContent = n.body();
    noti.style.transform = "";
    noti.classList.add("is-in");
    buzz(20);
    clearTimeout(notiTimer);
    notiTimer = setTimeout(notiNext, SHOW_MS);
  }
  function notiNext() {
    noti.classList.remove("is-in");
    clearTimeout(notiTimer);
    notiTimer = setTimeout(() => { notiIdx = (notiIdx + 1) % NOTIS.length; notiShow(notiIdx); }, GAP_MS);
  }
  enter.desk = () => {
    notiIdx = 0;
    $("#desk-badge").classList.remove("is-off");
    notiTimer = setTimeout(() => notiShow(0), 1200);
    hintTimer = setTimeout(() => $("#desk-hint").classList.add("is-on"), 7000);
  };
  leave.desk = () => {
    clearTimeout(notiTimer); clearTimeout(hintTimer);
    noti.classList.remove("is-in", "is-open");
    $("#desk-hint").classList.remove("is-on");
  };

  // 點通知 → 進 App 主頁（拍照）；往上滑 → 收掉
  (() => {
    let y0 = null, dy = 0, moved = false;
    noti.addEventListener("pointerdown", (e) => {
      y0 = e.clientY; dy = 0; moved = false;
      noti.classList.add("is-dragging");
      try { noti.setPointerCapture(e.pointerId); } catch (err) {}
      clearTimeout(notiTimer);
    });
    noti.addEventListener("pointermove", (e) => {
      if (y0 === null) return;
      dy = e.clientY - y0;
      if (Math.abs(dy) > 6) moved = true;
      noti.style.transform = `translateY(${dy < 0 ? dy : dy * 0.25}px)`;
    });
    const end = () => {
      if (y0 === null) return;
      y0 = null;
      noti.classList.remove("is-dragging");
      noti.style.transform = "";
      if (dy < -40) return notiNext();
      if (!moved) openApp();
      else notiTimer = setTimeout(notiNext, SHOW_MS);
    };
    noti.addEventListener("pointerup", end);
    noti.addEventListener("pointercancel", end);
  })();
  $("#desk-app").addEventListener("click", () => openApp());

  async function openApp() {
    buzz(15);
    noti.classList.add("is-open");
    $("#desk-badge").classList.add("is-off");
    await wait(140);
    go("app", { view: "camera" });
  }

  // =========================================================
  // B1. 拍照回報（App 主頁）
  // =========================================================
  const vf = $("#viewfinder");
  const video = $("#cam-video");
  const canvas = $("#cam-canvas");
  const ctx = canvas.getContext("2d");
  const actions = $("#cam-actions");
  const otherInput = $("#other-input");
  const shutterBtn = $("#btn-shutter");
  let stream = null, fallbackSeed = 7, camToken = 0;
  const LOCS = ["中山北路二段 · 雙連站附近", "中山北路二段 · 民生東路口", "中山北路一段 · 南京東路口"];

  viewEnter.camera = () => {
    resetForm();
    resetCapture();
    $("#cam-loc").textContent = "定位中…";
    setTimeout(() => { $("#cam-loc").textContent = LOCS[state.myReports.length % LOCS.length]; }, 900);
    if (state.cameraOK === "fallback") useFallback(); else startCamera();
  };
  viewLeave.camera = () => { stopCamera(); otherInput.blur(); };

  function resetForm() {
    $$(".chip").forEach((c) => c.classList.remove("is-on"));
    otherInput.classList.remove("is-on");
    otherInput.value = "";
    $("#peek").classList.remove("is-talk");
  }

  function sizeCanvas() {
    const r = vf.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
  }

  function showPerm(title, desc, btn = "開啟相機") {
    $("#perm-title").textContent = title;
    $("#perm-desc").textContent = desc;
    $("#perm-btn").lastChild.textContent = btn;
    vf.classList.add("needs-perm");
    shutterBtn.disabled = true;
  }

  async function startCamera() {
    const token = ++camToken;
    vf.classList.remove("is-fallback", "needs-perm");
    shutterBtn.disabled = false;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return showPerm("這個網址不能開相機", "相機只能在 https 網址使用。請用 GitHub Pages 的網址，在 Safari 開啟或從主畫面的 App 開啟。", "再試一次");
    }
    try {
      if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
      if (token !== camToken || state.screen !== "app" || state.view !== "camera") { s.getTracks().forEach((t) => t.stop()); return; }
      stream = s;
      video.srcObject = s;
      await video.play().catch(() => {});
      state.cameraOK = true;
    } catch (err) {
      if (token !== camToken) return;
      console.warn("camera:", err && err.name);
      if (err && err.name === "NotAllowedError") showPerm("相機權限被拒絕了", "到「設定 › Safari › 相機」改成「允許」，或按下面再試一次。", "再試一次");
      else if (err && (err.name === "NotFoundError" || err.name === "OverconstrainedError")) showPerm("找不到相機", "這台裝置好像沒有可以用的相機。", "再試一次");
      else showPerm("要打開相機才能拍照喔", "按下面的按鈕，然後在跳出的視窗選「允許」。");
    }
  }
  function stopCamera() {
    camToken++;
    if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
    video.srcObject = null;
  }
  function useFallback() {
    stopCamera();
    state.cameraOK = "fallback";
    vf.classList.remove("needs-perm");
    vf.classList.add("is-fallback");
    shutterBtn.disabled = false;
    sizeCanvas();
    fallbackSeed = 7 + state.myReports.length;
    drawPavement(ctx, canvas.width, canvas.height, fallbackSeed);
  }
  $("#perm-btn").addEventListener("click", () => { buzz(10); state.cameraOK = null; startCamera(); });
  $("#perm-alt").addEventListener("click", () => { buzz(10); useFallback(); });

  function resetCapture() {
    vf.classList.remove("is-frozen");
    actions.dataset.state = "live";
    state.photo = null;
    if (vf.classList.contains("is-fallback")) { sizeCanvas(); drawPavement(ctx, canvas.width, canvas.height, fallbackSeed); }
  }

  function capture() {
    sizeCanvas();
    const cw = canvas.width, ch = canvas.height;
    if (!vf.classList.contains("is-fallback") && video.videoWidth) {
      const vw = video.videoWidth, vh = video.videoHeight;
      const s = Math.max(cw / vw, ch / vh);
      const sw = cw / s, sh = ch / s;
      ctx.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, cw, ch);
    } else if (vf.classList.contains("is-fallback")) {
      drawPavement(ctx, cw, ch, fallbackSeed);
    } else {
      return toast("相機還在開，等一下下");
    }
    const t = document.createElement("canvas");
    const side = Math.min(cw, ch);
    t.width = t.height = 320;
    t.getContext("2d").drawImage(canvas, (cw - side) / 2, (ch - side) / 2, side, side, 0, 0, 320, 320);
    state.photo = t.toDataURL("image/jpeg", 0.78);

    vf.classList.add("is-frozen");
    restartAnim($("#vf-flash"), "go");
    restartAnim($("#vf-wow"), "go");
    actions.dataset.state = "captured";
    buzz(30);
    stopCamera();
  }
  shutterBtn.addEventListener("click", capture);
  $("#btn-retake").addEventListener("click", () => {
    resetCapture();
    if (state.cameraOK !== "fallback") startCamera();
  });

  $$(".chip").forEach((c) =>
    c.addEventListener("click", () => {
      c.classList.toggle("is-on");
      buzz(8);
      if (c.id === "chip-other") {
        const on = c.classList.contains("is-on");
        otherInput.classList.toggle("is-on", on);
        if (on) setTimeout(() => otherInput.focus(), 250); else otherInput.blur();
      }
      $("#peek").classList.remove("is-talk");
    })
  );

  let peekT;
  function peekSay(msg) {
    $("#peek-bubble").textContent = msg;
    $("#peek").classList.add("is-talk");
    clearTimeout(peekT);
    peekT = setTimeout(() => $("#peek").classList.remove("is-talk"), 2200);
  }

  $("#btn-send").addEventListener("click", () => {
    const reasons = $$(".chip.is-on").map((c) => c.dataset.r).filter((r) => r !== "其他");
    const other = otherInput.value.trim();
    const otherOn = $("#chip-other").classList.contains("is-on");
    if (otherOn && other) reasons.push(other);
    if (!reasons.length) {
      restartAnim($("#chips"), "shake");
      peekSay(otherOn ? "其他要寫一下喔～" : "選一下原因嘛～");
      buzz(40);
      return;
    }
    state.reports += 1;
    state.myReports.push({ photo: state.photo, reasons, n: state.reports, loc: $("#cam-loc").textContent, t: Date.now() });
    save();
    otherInput.blur();
    go("thanks");
  });

  // =========================================================
  // B3. 我的
  // =========================================================
  viewEnter.me = renderMe;
  function renderMe() {
    const n = state.myReports.length;
    $$(".js-my-count").forEach((e) => (e.textContent = n));
    $("#me-thanks").textContent = state.thanksGot;
    $("#me-metoo").textContent = state.metooGiven;
    $("#me-rank").textContent = n ? `你是中山北路第 ${state.myReports[0].n} 位浮根吹哨者！` : "還沒有回報，去拍第一張吧！";
    const list = $("#me-list");
    list.innerHTML = "";
    if (!n) {
      list.innerHTML = `<div class="me-empty">還沒有回報紀錄<br>低頭看看路面，拍下第一個浮根吧！<br><button type="button" id="me-go-cam"><svg class="ic"><use href="#i-camera"/></svg>去拍照回報</button></div>`;
      $("#me-go-cam").addEventListener("click", () => setView("camera"));
      return;
    }
    state.myReports.slice().reverse().forEach((r, ri) => {
      const i = n - 1 - ri;
      const b = document.createElement("button");
      b.type = "button"; b.className = "me-item";
      b.innerHTML = `${r.photo ? `<img src="${r.photo}" alt="">` : `<canvas width="116" height="116"></canvas>`}
        <span><b>第 ${r.n} 號 · ${r.reasons.join("、")}</b><small>${r.loc} · ${timeAgo(r.t)}</small></span>
        <svg class="ic"><use href="#i-back"/></svg>`;
      if (!r.photo) drawPavement(b.querySelector("canvas").getContext("2d"), 116, 116, 7 + i);
      b.addEventListener("click", () => { setView("map"); setTimeout(() => myPins[i] && myPins[i].dispatchEvent(new Event("click")), 450); });
      list.appendChild(b);
    });
  }
  $("#me-restart").addEventListener("click", () => { buzz(15); go("desk", { back: true, view: "camera" }); });
  $("#me-clear").addEventListener("click", () => {
    state.reports = BASE_REPORTS; state.myReports = []; state.metooGiven = 0; state.thanksGot = 0;
    save(); renderMe(); toast("展示資料已清除");
  });

  // =========================================================
  // C. 感謝頁
  // =========================================================
  "THANK YOUUUUUU!".split("").forEach((ch, i) => {
    const s = document.createElement("span");
    s.textContent = ch === " " ? " " : ch;
    s.style.animationDelay = `${0.15 + i * 0.045}s`;
    $("#ty").appendChild(s);
  });

  let heartLoop = null;
  enter.thanks = () => {
    const num = $("#count-num");
    num.textContent = pad3(state.reports - 1);
    setTimeout(() => {
      num.textContent = pad3(state.reports);
      restartAnim(num, "pop");
      restartAnim($(".plus1"), "go");
      buzz(25);
    }, 1100);
    clearInterval(heartLoop);
    heartLoop = setInterval(() => spawnHeartsAround($("#bow-wrap"), 1), 900);
    // 模擬：送出後陸續收到別人的感謝
    setTimeout(() => { state.thanksGot += 3; save(); }, 1500);
  };
  leave.thanks = () => clearInterval(heartLoop);

  $("#bow").addEventListener("click", () => { restartAnim($("#bow"), "wiggle"); spawnHeartsAround($("#bow-wrap"), 5); buzz(15); });
  $("#thanks-close").addEventListener("click", () => go("app", { back: true, view: "camera" }));
  $("#go-cheer").addEventListener("click", () => go("cheer"));
  $("#go-map").addEventListener("click", () => go("app", { view: "map" }));

  function spawnHeartsAround(el, n) {
    const layer = el.closest(".screen");
    const pr = layer.getBoundingClientRect(), r = el.getBoundingClientRect();
    for (let i = 0; i < n; i++) {
      const x = r.left - pr.left + r.width * (0.15 + Math.random() * 0.7);
      const y = r.top - pr.top + r.height * (0.25 + Math.random() * 0.4);
      flyHeart(layer, x, y, { dy: -90 - Math.random() * 80, dx: (Math.random() - 0.5) * 80, size: 18 + Math.random() * 18, dur: 1600 + Math.random() * 800 });
    }
  }
  function flyHeart(layer, x, y, { dx = 0, dy = -120, size = 30, dur = 1400 } = {}) {
    const h = document.createElement("img");
    h.src = "img/heart.webp";
    h.className = "float-heart";
    h.style.cssText = `width:${size}px;left:${x - size / 2}px;top:${y - size / 2}px`;
    layer.appendChild(h);
    const rot = (Math.random() - 0.5) * 50;
    const a = h.animate(
      [
        { transform: "translate(0,0) scale(.2) rotate(0deg)", opacity: 0 },
        { transform: `translate(${dx * 0.2}px,${dy * 0.15}px) scale(1.1) rotate(${rot * 0.3}deg)`, opacity: 1, offset: 0.15 },
        { transform: `translate(${dx}px,${dy}px) scale(.9) rotate(${rot}deg)`, opacity: 0 },
      ],
      { duration: dur, easing: "cubic-bezier(.2,.7,.3,1)", fill: "both" }
    );
    a.onfinish = () => h.remove();
    return a;
  }

  // =========================================================
  // D. 超級感謝
  // =========================================================
  const AV = [["林", "#f1d9a7"], ["陳", "#f3c6bb"], ["王", "#cfe0b7"], ["張", "#e9d3c0"], ["李", "#c9dedb"]];
  let cheerN = 0;
  enter.cheer = () => {
    const others = state.reports - 1;
    $("#cheer-people").textContent = others;
    const box = $("#avatars");
    box.innerHTML = "";
    AV.forEach(([t, c]) => { const d = document.createElement("span"); d.className = "avatar"; d.textContent = t; d.style.background = c; box.appendChild(d); });
    const more = document.createElement("span");
    more.className = "avatar avatar--more"; more.textContent = `+${others - AV.length}`;
    box.appendChild(more);
    cheerN = 0;
    $("#cheer-n").textContent = "0";
    $("#cheer-msg").textContent = "連點看看！";
    $("#cheer-msg").classList.remove("is-max");
    $("#cheer-next").classList.remove("is-on");
  };
  const CHEER_MSGS = { 1: "收到！再多送一點～", 5: "吹哨者們感受到你的心意了", 10: "小樹好感度 MAX！謝謝你", 20: "愛心多到要溢出來啦 (*´∀`)", 50: "你是中山北路的愛心大使！" };
  $("#hug").addEventListener("pointerdown", (e) => {
    const layer = $("#s-cheer");
    const pr = layer.getBoundingClientRect();
    const x = e.clientX - pr.left, y = e.clientY - pr.top;
    const hug = $("#hug");
    hug.classList.add("squish");
    setTimeout(() => hug.classList.remove("squish"), 110);
    const avs = $$(".avatar");
    const target = avs[cheerN % avs.length];
    const tr = target.getBoundingClientRect();
    const tx = tr.left - pr.left + tr.width / 2, ty = tr.top - pr.top + tr.height / 2;
    const a = flyHeart(layer, x, y, { dx: tx - x, dy: ty - y, size: 40, dur: 900 });
    a.onfinish = () => { a.effect.target.remove(); restartAnim(target, "got"); };
    for (let i = 0; i < 2; i++) flyHeart(layer, x, y, { dx: (Math.random() - 0.5) * 120, dy: -60 - Math.random() * 80, size: 16 + Math.random() * 10, dur: 900 });
    cheerN++;
    $("#cheer-n").textContent = cheerN;
    restartAnim($(".cheer-count"), "pop");
    if (CHEER_MSGS[cheerN]) { $("#cheer-msg").textContent = CHEER_MSGS[cheerN]; $("#cheer-msg").classList.toggle("is-max", cheerN >= 10); }
    if (cheerN === 3) $("#cheer-next").classList.add("is-on");
    buzz(10);
  });
  $("#cheer-back").addEventListener("click", () => go("thanks", { back: true }));
  $("#cheer-done").addEventListener("click", () => go("app", { back: true, view: "camera" }));
  $("#cheer-next").addEventListener("click", () => go("app", { view: "map" }));

  // =========================================================
  // B2. 回報地圖
  // =========================================================
  const map = $("#map");
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    parent && parent.appendChild(n);
    return n;
  };
  const ROAD_X = 196;               // 中山北路
  const MY_SPOT = { x: 210, y: 452 }; // 你的回報位置（民生東路口附近）
  const REASONS = ["摔倒", "卡到", "不美觀", "輪椅過不去", "嬰兒車卡住", "晚上看不清楚"];
  const AGO = ["10 分鐘前", "1 小時前", "今天早上", "昨天", "2 天前", "3 天前", "上週"];
  let others = [];
  let selected = null;
  let myPins = [];

  function buildMap() {
    map.innerHTML = "";
    myPins = [];
    const W = 390, H = 940;
    const defs = el("defs", {}, map);
    const pat = el("pattern", { id: "dots", width: 8, height: 8, patternUnits: "userSpaceOnUse" }, defs);
    el("circle", { cx: 2, cy: 2, r: 1, fill: "#d9dcc9" }, pat);
    const sh = el("filter", { id: "pinShadow", x: "-50%", y: "-50%", width: "200%", height: "200%" }, defs);
    el("feDropShadow", { dx: 0, dy: 2, stdDeviation: 1.5, "flood-color": "#2b3519", "flood-opacity": 0.3 }, sh);

    el("rect", { width: W, height: H, fill: "#e9ebdd" }, map);
    el("rect", { width: W, height: H, fill: "url(#dots)" }, map);

    // 街廓
    const blocks = el("g", { fill: "#f4f3ea", stroke: "#e0e2d2", "stroke-width": 1 }, map);
    const xs = [[-10, 52], [72, 180], [212, 318], [338, 400]];
    const ys = [[-10, 136], [158, 416], [438, 578], [592, 746], [768, 868], [890, 950]];
    xs.forEach(([x0, x1]) => ys.forEach(([y0, y1]) => el("rect", { x: x0, y: y0, width: x1 - x0, height: y1 - y0, rx: 10 }, blocks)));

    // 公園
    el("rect", { x: 224, y: 604, width: 84, height: 130, rx: 14, fill: "#cfdcae" }, map);
    const park = el("g", { fill: "#a6bb74" }, map);
    [[244, 628], [280, 640], [258, 668], [290, 700], [240, 708]].forEach(([x, y]) => el("circle", { cx: x, cy: y, r: 10 }, park));
    label(266, 726, "林森公園", 10, "#6c7d45");

    // 河堤示意（北邊）
    el("path", { d: "M-10 40 C 80 20, 160 62, 260 34 S 380 18, 400 26 L400 -10 L-10 -10Z", fill: "#cfe0dd" }, map);

    // 一般道路
    const roads = el("g", { stroke: "#ffffff", "stroke-linecap": "round" }, map);
    [[147, 12], [427, 12], [757, 14], [879, 12]].forEach(([y, w]) => el("line", { x1: -10, y1: y, x2: 400, y2: y, "stroke-width": w }, roads));
    el("line", { x1: -10, y1: 585, x2: 400, y2: 585, "stroke-width": 7 }, roads);
    [[62, 12], [328, 12]].forEach(([x, w]) => el("line", { x1: x, y1: -10, x2: x, y2: 950, "stroke-width": w }, roads));
    el("line", { x1: 120, y1: 147, x2: 120, y2: 757, "stroke-width": 6, stroke: "#fbfbf6" }, roads);

    // 中山北路（主角）
    el("rect", { x: ROAD_X - 16, y: -10, width: 32, height: 960, fill: "#ffffff" }, map);
    el("line", { x1: ROAD_X, y1: -10, x2: ROAD_X, y2: 950, stroke: "#e6e3d3", "stroke-width": 2, "stroke-dasharray": "10 10" }, map);
    // 人行道 + 行道樹
    el("rect", { x: ROAD_X - 24, y: -10, width: 8, height: 960, fill: "#efe6d4" }, map);
    el("rect", { x: ROAD_X + 16, y: -10, width: 8, height: 960, fill: "#efe6d4" }, map);
    const trees = el("g", {}, map);
    for (let y = 8; y < 940; y += 21) {
      if ([147, 427, 757, 879, 585].some((ry) => Math.abs(ry - y) < 12)) continue;
      [ROAD_X - 20, ROAD_X + 20].forEach((x) => {
        el("circle", { cx: x, cy: y, r: 6.5, fill: "#8fa35c" }, trees);
        el("circle", { cx: x - 1.5, cy: y - 1.5, r: 3, fill: "#a6bb74" }, trees);
      });
    }

    // 路名
    label(ROAD_X + 0.5, 300, "中 山 北 路 二 段", 11, "#9aa087", true);
    label(ROAD_X + 0.5, 660, "中 山 北 路 二 段", 11, "#9aa087", true);
    label(ROAD_X + 0.5, 905, "一 段", 11, "#9aa087", true);
    label(ROAD_X + 0.5, 90, "三 段", 11, "#9aa087", true);
    [[147, "民權東路"], [427, "民生東路"], [757, "南京東路"], [879, "長安東路"], [585, "錦州街"]].forEach(([y, t]) => label(290, y + 4, t, 10, "#9aa087"));
    label(62, 520, "承德路", 10, "#9aa087", true);
    label(328, 520, "林森北路", 10, "#9aa087", true);

    // 捷運站
    [[92, 262, "民權西路站"], [92, 470, "雙連站"], [92, 800, "中山站"]].forEach(([x, y, t]) => {
      el("rect", { x: x - 10, y: y - 10, width: 20, height: 20, rx: 6, fill: "#d1453b" }, map);
      el("path", { d: `M${x - 5} ${y + 4} L${x - 5} ${y - 4} L${x} ${y + 1} L${x + 5} ${y - 4} L${x + 5} ${y + 4}`, fill: "none", stroke: "#fff", "stroke-width": 2, "stroke-linejoin": "round" }, map);
      label(x, y + 24, t, 10, "#7b8272");
    });

    // 熱區
    const hotG = el("g", {}, map);
    [[ROAD_X, 300, 46], [ROAD_X, 545, 36], [ROAD_X, 705, 40]].forEach(([x, y, r]) => {
      el("circle", { class: "hot", cx: x, cy: y, r, fill: "rgba(214,120,101,.16)", stroke: "rgba(214,120,101,.55)", "stroke-width": 1.5, "stroke-dasharray": "4 4" }, hotG);
    });

    // 我的生活軌跡
    const trail = el("g", { class: "trail" }, map);
    const pts = [[62, 840], [62, 757], [ROAD_X - 20, 757], [ROAD_X - 20, 585], [ROAD_X + 20, 560], [ROAD_X + 20, MY_SPOT.y + 4], [ROAD_X + 20, 427], [328, 427], [328, 300], [ROAD_X + 20, 300], [ROAD_X + 20, 147], [120, 147], [120, 210]];
    const d = "M" + pts.map((p) => p.join(" ")).join(" L");
    const tl = el("path", { d, fill: "none", stroke: "#435429", "stroke-width": 5, "stroke-linecap": "round", "stroke-linejoin": "round", "stroke-dasharray": "1 9", opacity: 0.85 }, trail);
    const len = Math.ceil(tl.getTotalLength ? tl.getTotalLength() : 1500);
    tl.style.setProperty("--len", len);
    tl.setAttribute("stroke-dasharray", `1 9`);
    // 用遮罩做「一路畫出來」的效果
    const mask = el("mask", { id: "trailMask", maskUnits: "userSpaceOnUse", x: 0, y: 0, width: 390, height: 940 }, defs);
    const ml = el("path", { class: "trail-line", d, fill: "none", stroke: "#fff", "stroke-width": 9, "stroke-linecap": "round", "stroke-linejoin": "round", "stroke-dasharray": `${len} ${len}` }, mask);
    ml.style.setProperty("--len", len);
    tl.setAttribute("mask", "url(#trailMask)");
    el("circle", { cx: 62, cy: 840, r: 7, fill: "#fff", stroke: "#435429", "stroke-width": 3 }, trail);
    label(62, 862, "家", 11, "#435429");
    el("circle", { cx: 120, cy: 210, r: 7, fill: "#435429" }, trail);
    label(120, 232, "學校", 11, "#435429");

    // 其他人的回報
    const rnd = mulberry32(20261029);
    const hot = [[300, 46, 9], [545, 36, 6], [705, 40, 7]];
    others = [];
    hot.forEach(([cy, r, n]) => { for (let i = 0; i < n; i++) others.push([ROAD_X + (rnd() < 0.5 ? -20 : 20) + (rnd() - 0.5) * 6, cy + (rnd() - 0.5) * r * 1.5]); });
    while (others.length < state.reports - state.myReports.length) others.push([ROAD_X + (rnd() < 0.5 ? -20 : 20) + (rnd() - 0.5) * 6, 20 + rnd() * 900]);
    others = others.map(([x, y], i) => ({
      x, y, id: i + 1,
      reasons: [REASONS[Math.floor(rnd() * 3)], ...(rnd() < 0.35 ? [REASONS[3 + Math.floor(rnd() * 3)]] : [])],
      ago: AGO[Math.floor(rnd() * AGO.length)],
      metoo: 1 + Math.floor(rnd() * 18),
      seed: 100 + i,
      sec: y > 868 ? "中山北路一段" : y < 147 ? "中山北路三段" : "中山北路二段",
    }));

    const pinsG = el("g", {}, map);
    others.sort((a, b) => a.y - b.y).forEach((o, i) => {
      const g = pin(pinsG, o.x, o.y, "#d67865", 1, "pin pin--other");
      g.querySelector(".pin-drop").style.animationDelay = `${0.2 + i * 0.025}s`;
      g.addEventListener("click", () => openSheet(o, g));
    });

    // 你的回報
    state.myReports.forEach((r, i) => {
      const k = state.myReports.length - 1 - i;
      const x = MY_SPOT.x, y = MY_SPOT.y - k * 46;
      el("circle", { class: "me-ring", cx: x, cy: y - 12, r: 10, fill: "none", stroke: "#435429", "stroke-width": 2.5 }, pinsG);
      const g = pin(pinsG, x, y, "#435429", 1.35, "pin pin--me");
      g.querySelector(".pin-drop").style.animationDelay = "1s";
      const lg = el("g", { class: "pin-drop", style: "animation-delay:1.1s" }, g);
      el("rect", { x: x + 14, y: y - 34, width: 92, height: 24, rx: 12, fill: "#435429" }, lg);
      label(x + 60, y - 18, i === state.myReports.length - 1 ? "你剛剛的回報" : "你的回報", 11.5, "#fff", false, 900, lg);
      myPins[i] = g;
      g.addEventListener("click", () => openSheet({ me: true, ...r, x, y }, g));
    });
    $("#stat-total").textContent = state.reports;
  }

  function pin(parent, x, y, color, s = 1, cls = "pin") {
    const g = el("g", { class: cls }, parent);
    const inner = el("g", { class: "pin-drop", filter: "url(#pinShadow)" }, g);
    el("path", {
      d: `M${x} ${y} c ${-2 * s} ${-6 * s}, ${-9 * s} ${-9 * s}, ${-9 * s} ${-16 * s} a ${9 * s} ${9 * s} 0 1 1 ${18 * s} 0 c 0 ${7 * s}, ${-7 * s} ${10 * s}, ${-9 * s} ${16 * s} z`,
      fill: color, stroke: "#fff", "stroke-width": 2,
    }, inner);
    el("circle", { cx: x, cy: y - 16 * s, r: 3.4 * s, fill: "#fff" }, inner);
    // 放大點擊範圍
    el("circle", { cx: x, cy: y - 14, r: 16, fill: "transparent" }, g);
    return g;
  }
  function label(x, y, t, size, fill, vertical = false, weight = 700, parent = map) {
    const n = el("text", { x, y, "font-size": size, fill, "font-weight": weight, "text-anchor": "middle", "font-family": "RA Sans, PingFang TC, sans-serif" }, parent);
    if (vertical) n.setAttribute("transform", `rotate(90 ${x} ${y})`);
    n.textContent = t;
    return n;
  }


  // 底部資訊卡
  const sheet = $("#sheet");
  const sheetCtx = $("#sheet-photo").getContext("2d");
  function openSheet(o, g) {
    selected && selected.classList.remove("is-sel");
    selected = g; g.classList.add("is-sel");
    buzz(10);
    $("#sheet-kicker").textContent = o.me ? `你的回報 · 第 ${o.n} 號` : `第 ${o.id} 號回報`;
    $("#sheet-title").textContent = o.me ? o.loc.split(" · ")[0] : o.sec;
    $("#sheet-time").textContent = o.me ? `${timeAgo(o.t)} · 你（浮根吹哨者）` : `${o.ago} · 浮根吹哨者`;
    $("#sheet-tags").innerHTML = "";
    o.reasons.forEach((r) => { const s = document.createElement("span"); s.className = "tag"; s.textContent = r; $("#sheet-tags").appendChild(s); });
    const mt = $("#metoo");
    mt.classList.remove("is-on");
    mt.dataset.n = o.me ? 0 : o.metoo;
    mt.style.display = o.me ? "none" : "";
    $("#metoo-n").textContent = mt.dataset.n;
    sheetCtx.clearRect(0, 0, 240, 240);
    if (o.me && o.photo) { const img = new Image(); img.onload = () => sheetCtx.drawImage(img, 0, 0, 240, 240); img.src = o.photo; }
    else drawPavement(sheetCtx, 240, 240, o.seed || 3);
    sheet.classList.add("is-on");
  }
  function closeSheet() {
    sheet.classList.remove("is-on");
    selected && selected.classList.remove("is-sel");
    selected = null;
  }
  $("#metoo").addEventListener("click", () => {
    const mt = $("#metoo");
    const on = mt.classList.toggle("is-on");
    $("#metoo-n").textContent = +mt.dataset.n + (on ? 1 : 0);
    state.metooGiven += on ? 1 : -1; save();
    if (on) toast("已經 +1，謝謝你一起提醒！");
    buzz(12);
  });
  map.addEventListener("click", (e) => { if (!e.target.closest(".pin")) closeSheet(); });
  (() => {
    let y0 = null;
    sheet.addEventListener("pointerdown", (e) => { y0 = e.clientY; });
    sheet.addEventListener("pointerup", (e) => { if (y0 !== null && e.clientY - y0 > 30) closeSheet(); y0 = null; });
  })();

  function setTab(tab) {
    $("#seg").dataset.tab = tab;
    $$(".seg-btn").forEach((b) => b.classList.toggle("is-on", b.dataset.tab === tab));
    map.dataset.tab = tab;
    $("#v-map").dataset.tab = tab;
    closeSheet();
    if (tab === "me") {
      $$(".trail-line", map).forEach((p) => { p.style.animation = "none"; void p.getBoundingClientRect(); p.style.animation = ""; });
      scrollMapTo(500);
    }
  }
  $$(".seg-btn").forEach((b) => b.addEventListener("click", () => { buzz(8); setTab(b.dataset.tab); }));
  function scrollMapTo(svgY) {
    const sc = $("#map-scroll");
    const scale = map.getBoundingClientRect().width / 390;
    sc.scrollTo({ top: Math.max(0, svgY * scale - sc.clientHeight / 2), behavior: "smooth" });
  }
  viewEnter.map = () => {
    buildMap();
    $$(".js-my-count").forEach((e) => (e.textContent = state.myReports.length));
    setTab("all");
    $("#map-scroll").scrollTop = 0;
    requestAnimationFrame(() => scrollMapTo(MY_SPOT.y));
  };
  viewLeave.map = closeSheet;


  // =========================================================
  // 示意照片：被樹根頂起來的人行道（程式畫的，不用網路）
  // =========================================================
  function drawPavement(c, w, h, seed) {
    const r = mulberry32(seed * 9973);
    c.save();
    c.fillStyle = "#8f8a7e";
    c.fillRect(0, 0, w, h);
    const T = Math.max(w, h) / 5.2; // 地磚大小
    const ox = r() * T, oy = r() * T;
    // 樹根的路徑（從角落的樹穴長出來）
    const sx = r() < 0.5 ? -T * 0.2 : w + T * 0.2;
    const sy = h * (0.15 + r() * 0.2);
    const roots = [];
    for (let i = 0; i < 3; i++) {
      const ex = w * (0.2 + r() * 0.6), ey = h * (0.75 + r() * 0.35);
      roots.push([sx, sy, sx + (ex - sx) * 0.3 + (r() - 0.5) * w * 0.4, sy + (ey - sy) * 0.3, ex + (r() - 0.5) * w * 0.3, ey - h * 0.2, ex, ey, (0.09 - i * 0.022) * w]);
    }
    const nearRoot = (x, y) => {
      let best = 1e9;
      roots.forEach(([x0, y0, x1, y1, x2, y2, x3, y3]) => {
        for (let t = 0; t <= 1; t += 0.05) {
          const u = 1 - t;
          const px = u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3;
          const py = u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3;
          best = Math.min(best, Math.hypot(px - x, py - y));
        }
      });
      return best;
    };
    // 地磚
    for (let gx = -1; gx < w / T + 1; gx++) {
      for (let gy = -1; gy < h / T + 1; gy++) {
        const x = gx * T + ox - T * 0.5, y = gy * T + oy - T * 0.5;
        const d = nearRoot(x + T / 2, y + T / 2);
        const lift = Math.max(0, 1 - d / (T * 1.1));
        c.save();
        c.translate(x + T / 2, y + T / 2);
        c.rotate((r() - 0.5) * 0.25 * lift);
        c.translate(lift * (r() - 0.5) * T * 0.15, lift * (r() - 0.5) * T * 0.15);
        const g = 196 + Math.floor(r() * 22) - lift * 18;
        c.fillStyle = `rgb(${g},${g - 6},${g - 16})`;
        if (lift > 0.25) { c.shadowColor = "rgba(0,0,0,.45)"; c.shadowBlur = T * 0.12 * lift; c.shadowOffsetY = T * 0.05 * lift; }
        c.fillRect(-T / 2 + 3, -T / 2 + 3, T - 6, T - 6);
        c.shadowColor = "transparent";
        // 裂痕
        if (lift > 0.35) {
          c.strokeStyle = "rgba(60,52,40,.65)"; c.lineWidth = Math.max(1.5, T * 0.018);
          c.beginPath();
          let px = (r() - 0.5) * T * 0.8, py = -T / 2 + 3;
          c.moveTo(px, py);
          for (let k = 0; k < 4; k++) { px += (r() - 0.5) * T * 0.35; py += T * 0.25; c.lineTo(px, py); }
          c.stroke();
        }
        // 顆粒
        for (let k = 0; k < 26; k++) { c.fillStyle = `rgba(${r() < 0.5 ? "255,255,255" : "70,60,50"},${0.08 + r() * 0.1})`; c.fillRect((r() - 0.5) * (T - 8), (r() - 0.5) * (T - 8), 2, 2); }
        c.restore();
      }
    }
    // 樹根
    c.lineCap = "round";
    roots.forEach(([x0, y0, x1, y1, x2, y2, x3, y3, lw]) => {
      [[lw * 1.25, "rgba(40,30,18,.55)"], [lw, "#6e5136"], [lw * 0.5, "#86664a"], [lw * 0.18, "rgba(255,230,200,.25)"]].forEach(([wdt, col], k) => {
        c.strokeStyle = col; c.lineWidth = wdt;
        c.beginPath(); c.moveTo(x0, y0 + (k === 0 ? lw * 0.25 : 0)); c.bezierCurveTo(x1, y1, x2, y2, x3, y3); c.stroke();
      });
    });
    // 樹穴
    c.fillStyle = "#4b3a28";
    c.beginPath(); c.arc(sx, sy, T * 0.9, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#5d6b33";
    for (let k = 0; k < 14; k++) { c.beginPath(); c.arc(sx + (r() - 0.5) * T * 1.4, sy + (r() - 0.5) * T * 1.4, T * 0.08, 0, Math.PI * 2); c.fill(); }
    // 暗角
    const v = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
    v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,.35)");
    c.fillStyle = v; c.fillRect(0, 0, w, h);
    c.restore();
  }


  // =========================================================
  // 啟動
  // =========================================================
  load();
  const tick = () => { const d = new Date(); $("#fs-time").textContent = `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`; };
  tick(); setInterval(tick, 15000);
  enter.desk();

  // App 切到背景時關相機，回來再開
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopCamera();
    else if (state.screen === "app" && state.view === "camera" && actions.dataset.state === "live" && state.cameraOK !== "fallback") startCamera();
  });

  // PWA：註冊離線快取
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
