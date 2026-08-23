(() => {
  "use strict";

  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
  const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
  const random = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const routeDetails = {
    isp: ["ISP", "Access your ISP proxies"],
    residential: ["Residential", "Manage your Residential Plan"],
    purchase: ["Purchase", "View ProxyFarm’s 2021 proxy plans"],
  };

  let ispRecords = [];
  let generatedRecords = [];
  let loading = false;

  function makeEndpoint(index, type = "isp", country = "US") {
    const ranges = ["192.0.2", "198.51.100", "203.0.113"];
    const host = `${ranges[index % ranges.length]}.${random(10, 240)}`;
    const port = type === "residential" ? random(10000, 59999) : random(8000, 9999);
    const user = type === "residential" ? `pf-${country.toLowerCase()}-${random(1000, 9999)}` : `archive-${random(100, 999)}`;
    return { endpoint: `${host}:${port}:${user}:pf2021`, host, port, user, region: country, response: random(90, 680) };
  }

  function makeBatch(amount = 25, type = "isp", country = "US") {
    return Array.from({ length: amount }, (_, index) => makeEndpoint(index, type, country));
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
    const list = $("#isp-list");
    list.replaceChildren(...ispRecords.map((record) => {
      const row = document.createElement("div");
      row.className = "proxy-row";
      row.innerHTML = `<code>${record.endpoint}</code><span>${record.response}ms · SAMPLE</span><button type="button">COPY</button>`;
      row.querySelector("button").addEventListener("click", () => copyText(record.endpoint, "Sample endpoint copied"));
      return row;
    }));
    $("#isp-count").textContent = `${ispRecords.length} sample endpoints`;
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
      await wait(random(280, index === phases.length - 1 ? 900 : 2100));
    }

    timer.textContent = `${((performance.now() - started) / 1000).toFixed(1)}s`;
    await wait(180);
    layer.hidden = true;
    loading = false;
    return true;
  }

  async function enterDashboard() {
    const completed = await runLoading("Opening the 2021 console", ["Restoring the interface…", "Loading reserved endpoints…", "Preparing read-only records…"]);
    if (!completed) return;
    $("#login-screen").hidden = true;
    $("#dashboard").hidden = false;
    routeTo("isp");
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
    const completed = await runLoading("Rotating sample records", ["Selecting a documentation range…", "Assigning archived credentials…", "Measuring local response timing…", "Finalizing the batch…"]);
    if (completed) {
      ispRecords = makeBatch(25);
      renderIsp();
      showToast("25 reserved sample endpoints generated");
    }
    button.disabled = false;
  }

  async function generateResidential(event) {
    event.preventDefault();
    const country = $("#country").value;
    const amount = Math.max(1, Math.min(100, Number($("#amount").value) || 10));
    const type = $("#proxy-type").value;
    const button = $("#generate-button");
    if (!country) {
      showToast("Choose a country first");
      return;
    }
    button.disabled = true;
    const completed = await runLoading("Generating reserved endpoints", ["Applying region settings…", `Preparing ${type} sessions…`, "Randomizing local response timing…", "Writing the output…"]);
    if (completed) {
      generatedRecords = makeBatch(amount, "residential", country);
      $("#generated-output").value = generatedRecords.map(({ endpoint }) => endpoint).join("\n");
      $("#copy-generated").disabled = false;
      showToast(`${amount} reserved sample endpoint${amount === 1 ? "" : "s"} generated`);
    }
    button.disabled = false;
  }

  function exportCsv() {
    const rows = ["endpoint,response_ms,classification", ...ispRecords.map(({ endpoint, response }) => `${endpoint},${response},RFC5737-reserved`)];
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "proxyfarm-2021-sample-proxies.csv";
    link.click();
    URL.revokeObjectURL(url);
    showToast("CSV downloaded");
  }

  function cloneSidebarForMobile() {
    const clone = $(".sidebar .sidebar-content").cloneNode(true);
    $("#mobile-drawer .sidebar-inner").append(clone);
  }

  function bindEvents() {
    $("#dashboard-entry").addEventListener("click", enterDashboard);
    $("#hamburger").addEventListener("click", openDrawer);
    $("#drawer-close").addEventListener("click", closeDrawer);
    $("#refresh-isp").addEventListener("click", rotateIsp);
    $("#copy-isp").addEventListener("click", () => copyText(ispRecords.map(({ endpoint }) => endpoint).join("\n"), "All sample endpoints copied"));
    $("#download-isp").addEventListener("click", exportCsv);
    $("#generator-form").addEventListener("submit", generateResidential);
    $("#copy-generated").addEventListener("click", () => copyText(generatedRecords.map(({ endpoint }) => endpoint).join("\n"), "Generated sample endpoints copied"));
    $("#terms-button").addEventListener("click", () => $("#archive-dialog").showModal());
    $("#dialog-close").addEventListener("click", () => $("#archive-dialog").close());
    $("#archive-dialog").addEventListener("click", (event) => { if (event.target === $("#archive-dialog")) $("#archive-dialog").close(); });

    document.addEventListener("click", (event) => {
      const routeButton = event.target.closest("[data-route]");
      if (routeButton) routeTo(routeButton.dataset.route);
      const noticeButton = event.target.closest("[data-notice]");
      if (noticeButton) showToast(noticeButton.dataset.notice);
    });

    $("#isp-plan").addEventListener("change", (event) => { $("#isp-plan").closest(".plan-card").querySelector(".unavailable-button").textContent = `$${event.target.value} · UNAVAILABLE`; });
    $("#resi-plan").addEventListener("change", (event) => { $("#resi-plan").closest(".plan-card").querySelector(".unavailable-button").textContent = `$${event.target.value} · UNAVAILABLE`; });
    window.addEventListener("hashchange", () => routeTo(location.hash.slice(1) || "home", false));
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeDrawer(); });
  }

  ispRecords = makeBatch(25);
  renderIsp();
  cloneSidebarForMobile();
  bindEvents();
  $("#footer-year").textContent = `PRESERVED ${new Date().getFullYear()}`;
  const initialRoute = location.hash.slice(1);
  if (initialRoute && initialRoute !== "home") routeTo(initialRoute, false);
})();
