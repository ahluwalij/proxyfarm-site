(() => {
  "use strict";

  const DISCORD_CLIENT_ID = "827569848086822924";
  const DISCORD_STATE_KEY = "proxyfarm-discord-state";
  const ACCOUNT_KEY = "proxyfarm-demo-account";
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
  const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
  const random = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const routeDetails = {
    isp: ["ISP", "Access your ISP proxies"],
    residential: ["Residential", "Manage your Residential Plan"],
    purchase: ["Purchase", "Choose a ProxyFarm plan"],
  };

  let ispRecords = [];
  let generatedRecords = [];
  let loading = false;
  let planData = 50;
  const usedData = 12.4;

  function randomString(length) {
    const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return [...bytes].map((value) => alphabet[value % alphabet.length]).join("");
  }

  function makeEndpoint(index, type = "isp", country = "US", sessionType = "static") {
    const password = randomString(12);
    const port = type === "residential" ? random(10000, 59999) : 8000 + index;
    const host = type === "residential" ? "resi.proxy-farm.com" : "isp.proxy-farm.com";
    const user = type === "residential"
      ? `pf_country-${country.toLowerCase()}_${sessionType}-${randomString(7).toLowerCase()}`
      : `pf_isp-${randomString(8).toLowerCase()}`;
    return {
      endpoint: `${host}:${port}:${user}:${password}`,
      response: random(90, 680),
    };
  }

  function makeBatch(amount = 25, type = "isp", country = "US", sessionType = "static") {
    return Array.from({ length: amount }, (_, index) => makeEndpoint(index, type, country, sessionType));
  }

  function showToast(message) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    $("#toast-region").append(toast);
    window.setTimeout(() => toast.remove(), 3300);
  }

  async function copyText(value, message = "Copied to clipboard") {
    try {
      await navigator.clipboard.writeText(value);
    } catch (_) {
      const area = document.createElement("textarea");
      area.value = value;
      document.body.append(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    showToast(message);
  }

  function renderIsp() {
    const rows = ispRecords.map((record) => {
      const row = document.createElement("div");
      const endpoint = document.createElement("code");
      const status = document.createElement("span");
      const button = document.createElement("button");
      row.className = "proxy-row";
      endpoint.textContent = record.endpoint;
      status.textContent = `${record.response}ms · ONLINE`;
      button.type = "button";
      button.textContent = "COPY";
      button.addEventListener("click", () => copyText(record.endpoint, "Endpoint copied"));
      row.append(endpoint, status, button);
      return row;
    });
    $("#isp-list").replaceChildren(...rows);
    $("#isp-count").textContent = `${ispRecords.length} endpoints`;
  }

  function renderUsage() {
    const remaining = Math.max(0, planData - usedData);
    $("#plan-data").textContent = `${planData} GB`;
    $("#used-data").textContent = `${usedData.toFixed(1)} GB`;
    $("#usage-progress").style.width = `${Math.min(100, (usedData / planData) * 100)}%`;
    $("#usage-caption").textContent = `${remaining.toFixed(1)} GB remaining in this billing period.`;
  }

  async function runLoading(title, phases) {
    if (loading) return false;
    loading = true;
    const layer = $("#loading-layer");
    const titleNode = $("#loading-title");
    const messageNode = $("#loading-message");
    const progress = $("#loading-progress");
    const timer = $("#loading-time");
    const started = performance.now();
    titleNode.textContent = title;
    progress.style.width = "0%";
    layer.hidden = false;

    for (let index = 0; index < phases.length; index += 1) {
      messageNode.textContent = phases[index];
      progress.style.width = `${Math.round(((index + 1) / phases.length) * 100)}%`;
      timer.textContent = `${((performance.now() - started) / 1000).toFixed(1)}s`;
      await wait(random(180, index === phases.length - 1 ? 520 : 820));
    }

    timer.textContent = `${((performance.now() - started) / 1000).toFixed(1)}s`;
    await wait(120);
    layer.hidden = true;
    loading = false;
    return true;
  }

  function accountAvatarUrl(user) {
    if (!user?.id || !user.avatar) return "assets/proxyfarm-arrow.png";
    return `https://cdn.discordapp.com/avatars/${encodeURIComponent(user.id)}/${encodeURIComponent(user.avatar)}.png?size=96`;
  }

  function setAccount(user) {
    const account = user || { username: "Demo Account", demo: true };
    $("#account-name").textContent = account.global_name || account.username || "ProxyFarm User";
    $("#account-avatar").src = accountAvatarUrl(account);
    $("#account-avatar").alt = account.demo ? "" : `${account.username || "Discord"} avatar`;
    sessionStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
  }

  async function enterDashboard(user, withLoading = true) {
    if (withLoading) {
      const completed = await runLoading("Opening your dashboard", ["Authenticating session…", "Loading proxy allocations…", "Connecting to gateways…"]);
      if (!completed) return;
    }
    setAccount(user);
    $("#login-screen").hidden = true;
    $("#dashboard").hidden = false;
    routeTo("isp");
  }

  function createOauthState() {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function startDiscordLogin() {
    const state = createOauthState();
    const redirectUri = `${location.origin}/auth`;
    sessionStorage.setItem(DISCORD_STATE_KEY, state);
    const params = new URLSearchParams({
      response_type: "token",
      client_id: DISCORD_CLIENT_ID,
      scope: "identify",
      state,
      redirect_uri: redirectUri,
      prompt: "consent",
    });
    location.assign(`https://discord.com/oauth2/authorize?${params.toString()}`);
  }

  async function handleDiscordCallback() {
    const params = new URLSearchParams(location.hash.slice(1));
    const accessToken = params.get("access_token");
    if (!accessToken) return false;

    const expectedState = sessionStorage.getItem(DISCORD_STATE_KEY);
    const returnedState = params.get("state");
    history.replaceState(null, "", "/");
    sessionStorage.removeItem(DISCORD_STATE_KEY);

    if (!expectedState || expectedState !== returnedState) {
      showToast("Discord login could not be verified. Please try again.");
      return true;
    }

    try {
      const response = await fetch("https://discord.com/api/v10/users/@me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) throw new Error("Discord profile request failed");
      const user = await response.json();
      await enterDashboard(user);
      showToast(`Signed in as ${user.global_name || user.username}`);
    } catch (_) {
      showToast("Discord login failed. Please try again.");
    }
    return true;
  }

  function logout() {
    sessionStorage.removeItem(ACCOUNT_KEY);
    $("#dashboard").hidden = true;
    $("#login-screen").hidden = false;
    history.replaceState(null, "", "#home");
    closeDrawer();
    showToast("Signed out");
  }

  function routeTo(route, updateHash = true) {
    if (route === "home") {
      $("#dashboard").hidden = true;
      $("#login-screen").hidden = false;
      if (updateHash) history.replaceState(null, "", "#home");
      closeDrawer();
      return;
    }
    if (!routeDetails[route]) route = "isp";
    $("#login-screen").hidden = true;
    $("#dashboard").hidden = false;
    $$(".dashboard-view").forEach((view) => view.classList.toggle("is-visible", view.dataset.view === route));
    $$(".sidebar-links button").forEach((button) => button.classList.toggle("is-active", button.dataset.route === route));
    $("#page-title").textContent = routeDetails[route][0];
    $("#page-subtitle").textContent = routeDetails[route][1];
    if (updateHash) history.replaceState(null, "", `#${route}`);
    closeDrawer();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openDrawer() {
    $("#mobile-drawer").classList.add("is-open");
    $("#mobile-drawer").setAttribute("aria-hidden", "false");
    $("#hamburger").setAttribute("aria-expanded", "true");
    document.body.classList.add("drawer-open");
  }

  function closeDrawer() {
    $("#mobile-drawer").classList.remove("is-open");
    $("#mobile-drawer").setAttribute("aria-hidden", "true");
    $("#hamburger").setAttribute("aria-expanded", "false");
    document.body.classList.remove("drawer-open");
  }

  async function rotateIsp() {
    const button = $("#refresh-isp");
    button.disabled = true;
    const completed = await runLoading("Rotating credentials", ["Selecting gateway ports…", "Generating account credentials…", "Running latency checks…", "Activating endpoints…"]);
    if (completed) {
      ispRecords = makeBatch(25);
      renderIsp();
      showToast("25 ISP credentials rotated");
    }
    button.disabled = false;
  }

  async function generateResidential(event) {
    event.preventDefault();
    const country = $("#country").value;
    const amount = Math.max(1, Math.min(100, Number($("#amount").value) || 10));
    const sessionType = $("#proxy-type").value;
    const button = $("#generate-button");
    if (!country) {
      showToast("Choose a country first");
      return;
    }
    button.disabled = true;
    const completed = await runLoading("Generating endpoints", ["Applying region settings…", `Preparing ${sessionType} sessions…`, "Creating credentials…", "Writing the output…"]);
    if (completed) {
      generatedRecords = makeBatch(amount, "residential", country, sessionType);
      $("#generated-output").value = generatedRecords.map(({ endpoint }) => endpoint).join("\n");
      $("#copy-generated").disabled = false;
      showToast(`${amount} residential endpoint${amount === 1 ? "" : "s"} generated`);
    }
    button.disabled = false;
  }

  function exportCsv() {
    const rows = ["endpoint,response_ms,status", ...ispRecords.map(({ endpoint, response }) => `${endpoint},${response},online`)];
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "proxyfarm-isp-proxies.csv";
    link.click();
    URL.revokeObjectURL(url);
    showToast("CSV downloaded");
  }

  function addBooster(amount) {
    planData += amount;
    renderUsage();
    showToast(`${amount} GB added to the demo plan`);
  }

  function updatePlanButton(select) {
    const card = select.closest(".plan-card");
    const option = select.selectedOptions[0];
    const planName = option.textContent.split("—")[0].trim();
    const button = card.querySelector(".plan-button");
    button.dataset.plan = planName;
    button.textContent = `ADD TO ACCOUNT · $${select.value}`;
  }

  function cloneSidebarForMobile() {
    const clone = $(".sidebar .sidebar-content").cloneNode(true);
    clone.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
    $("#mobile-drawer .sidebar-inner").append(clone);
  }

  function bindEvents() {
    $("#discord-login").addEventListener("click", startDiscordLogin);
    $("#preview-entry").addEventListener("click", () => enterDashboard({ username: "Demo Account", demo: true }));
    $("#logout-button").addEventListener("click", logout);
    $("#hamburger").addEventListener("click", openDrawer);
    $("#drawer-close").addEventListener("click", closeDrawer);
    $("#refresh-isp").addEventListener("click", rotateIsp);
    $("#copy-isp").addEventListener("click", () => copyText(ispRecords.map(({ endpoint }) => endpoint).join("\n"), "All endpoints copied"));
    $("#download-isp").addEventListener("click", exportCsv);
    $("#generator-form").addEventListener("submit", generateResidential);
    $("#copy-generated").addEventListener("click", () => copyText(generatedRecords.map(({ endpoint }) => endpoint).join("\n"), "Generated endpoints copied"));
    $("#dialog-close").addEventListener("click", () => $("#info-dialog").close());
    $("#info-dialog").addEventListener("click", (event) => { if (event.target === $("#info-dialog")) $("#info-dialog").close(); });

    document.addEventListener("click", (event) => {
      const routeButton = event.target.closest("[data-route]");
      if (routeButton) routeTo(routeButton.dataset.route);
      const infoButton = event.target.closest("[data-info]");
      if (infoButton) $("#info-dialog").showModal();
      const booster = event.target.closest("[data-booster]");
      if (booster) addBooster(Number(booster.dataset.booster));
      const planButton = event.target.closest("[data-plan]");
      if (planButton) showToast(`${planButton.dataset.plan} added to the demo account`);
    });

    $("#isp-plan").addEventListener("change", (event) => updatePlanButton(event.target));
    $("#resi-plan").addEventListener("change", (event) => updatePlanButton(event.target));
    window.addEventListener("hashchange", () => routeTo(location.hash.slice(1) || "home", false));
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeDrawer(); });
  }

  async function initialize() {
    ispRecords = makeBatch(25);
    renderIsp();
    renderUsage();
    cloneSidebarForMobile();
    bindEvents();
    $("#footer-year").textContent = String(new Date().getFullYear());

    if (await handleDiscordCallback()) return;

    const savedAccount = sessionStorage.getItem(ACCOUNT_KEY);
    const initialRoute = location.hash.slice(1);
    if (savedAccount && initialRoute && initialRoute !== "home") {
      try {
        setAccount(JSON.parse(savedAccount));
        routeTo(routeDetails[initialRoute] ? initialRoute : "isp", false);
      } catch (_) {
        sessionStorage.removeItem(ACCOUNT_KEY);
      }
    }
  }

  initialize();
})();
