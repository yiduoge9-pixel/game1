// =====================
// Helpers
// =====================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const STORAGE_KEY = "censhership_evidence_v2";
const UI_KEY = "censhership_ui_v2";

function nowISO(){
  return new Date().toISOString();
}

function clamp(n, a, b){
  return Math.max(a, Math.min(b, n));
}

function escapeHTML(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function loadEvidence(){
  try{
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  }catch{
    return [];
  }
}

function saveEvidence(list){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function loadUI(){
  try{
    return JSON.parse(localStorage.getItem(UI_KEY) || "{}");
  }catch{
    return {};
  }
}

function saveUI(ui){
  localStorage.setItem(UI_KEY, JSON.stringify(ui));
}

// =====================
// Simple model
// =====================
const TRIGGERS = [
  "vagina","vaginal","vulva","clitoris","sex","sexual","orgasm","nipple","breast",
  "menopause","postpartum","fertility","period","menstruation","abortion","contraception",
  "lube","libido","masturbation","intimacy","pelvic","dryness","std","sti",
  "miscarriage","breastfeeding"
];

const PLATFORM_SENS = {
  instagram:1.2,
  facebook:1.15,
  tiktok:1.0,
  youtube:0.85,
  linkedin:0.75
};

const TYPE_SENS = {
  edu:0.9,
  story:1.0,
  product:1.15
};

function tokenizeLower(text){
  return (text || "").toLowerCase();
}

function escapeRegExp(s){
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findTriggers(textLower){
  const hits = [];

  TRIGGERS.forEach(w => {
    const re = new RegExp(`\\b${escapeRegExp(w)}\\b`, "gi");
    if(re.test(textLower)){
      hits.push(w);
    }
  });

  return Array.from(new Set(hits));
}

function computeVisibilityScore(triggerCount, platform, type){
  const base = 92;
  const sens = (PLATFORM_SENS[platform] || 1.0) * (TYPE_SENS[type] || 1.0);
  const penalty = (triggerCount * 12) * sens;

  return clamp(Math.round(base - penalty), 3, 95);
}

// =====================
// Language + Kiosk
// =====================
const ui = {
  lang:"en",
  kiosk:false,
  ...loadUI()
};

function applyLang(lang){
  document.body.classList.remove("lang-zh","lang-en","lang-both");
  document.body.classList.add(`lang-${lang}`);

  ui.lang = lang;
  saveUI(ui);

  $$(".lang .chip").forEach(b => {
    b.classList.toggle("active", b.dataset.lang === lang);
  });
}

function setKiosk(on){
  document.body.classList.toggle("kiosk", !!on);

  ui.kiosk = !!on;
  saveUI(ui);

  const hint = $("#kioskHint");

  if(hint){
    hint.textContent = on
      ? "Kiosk ON: Only quick submission is visible."
      : "Kiosk OFF: Full interface restored.";
  }
}

// =====================
// Evidence Wall
// =====================
function addEvidence(entry){
  const list = loadEvidence();

  list.unshift(entry);
  saveEvidence(list);

  renderKPIs();
  renderWall();
}

function aggregate(list){
  const wordCounts = new Map();
  const platformCounts = new Map();
  const outcomeCounts = new Map();
  const people = new Set();

  list.forEach(e => {
    if(e.who){
      people.add(e.who.trim().toLowerCase());
    }

    (e.words || []).forEach(w => {
      const k = w.trim().toLowerCase();
      if(!k) return;

      wordCounts.set(k, (wordCounts.get(k) || 0) + 1);
    });

    if(e.platform){
      platformCounts.set(e.platform, (platformCounts.get(e.platform) || 0) + 1);
    }

    if(e.outcome){
      outcomeCounts.set(e.outcome, (outcomeCounts.get(e.outcome) || 0) + 1);
    }
  });

  const topN = (m, n = 6) =>
    Array.from(m.entries())
      .sort((a,b) => b[1] - a[1])
      .slice(0,n)
      .map(([k,v]) => `${k}(${v})`)
      .join("  ");

  return {
    entries:list.length,
    people:people.size,
    topWords:topN(wordCounts,6) || "—",
    topPlatforms:topN(platformCounts,5) || "—",
    topOutcomes:topN(outcomeCounts,5) || "—"
  };
}

function outcomeLabel(outcome){
  const map = {
    removed:"Removed",
    shadow:"Shadowban",
    suppressed:"Suppressed",
    selfcensor:"Self-censored"
  };

  return map[outcome] || outcome;
}

function renderKPIs(){
  const elEntries = $("#kpiEntries");
  const elPeople = $("#kpiPeople");
  const elTop = $("#kpiTopWords");

  if(!elEntries && !elPeople && !elTop) return;

  const agg = aggregate(loadEvidence());

  if(elEntries) elEntries.textContent = String(agg.entries);
  if(elPeople) elPeople.textContent = String(agg.people);
  if(elTop) elTop.textContent = agg.topWords;
}

function renderWall(){
  const wall = $("#wall");
  const stats = $("#wallStats");

  if(!wall || !stats) return;

  const list = loadEvidence();
  const agg = aggregate(list);

  stats.textContent = `Entries: ${agg.entries}, People: ${agg.people}`;

  wall.innerHTML = list.map(e => {
    const words = (e.words || [])
      .map(w => `<span class="pill"><b>${escapeHTML(w)}</b></span>`)
      .join(" ");

    const meta = [
      e.platform ? `platform: ${escapeHTML(e.platform)}` : "",
      e.outcome ? `outcome: ${escapeHTML(e.outcome)}` : "",
      e.time ? new Date(e.time).toLocaleString() : ""
    ].filter(Boolean).join(" · ");

    return `
      <div class="item">
        <div><b>${escapeHTML(e.who || "anon")}</b> <span class="tag">${outcomeLabel(e.outcome)}</span></div>
        <div style="margin-top:8px">${words || "<span class='small'>—</span>"}</div>
        ${e.note ? `<div class="small" style="margin-top:8px">${escapeHTML(e.note)}</div>` : ""}
        <div class="meta">${escapeHTML(meta)}</div>
      </div>
    `;
  }).join("");

  const aggWords = $("#aggWords");
  const aggPlatforms = $("#aggPlatforms");
  const aggOutcomes = $("#aggOutcomes");

  if(aggWords) aggWords.textContent = agg.topWords;
  if(aggPlatforms) aggPlatforms.textContent = agg.topPlatforms;
  if(aggOutcomes) aggOutcomes.textContent = agg.topOutcomes;
}

// =====================
// Export / Import
// =====================
function exportJSON(){
  const data = loadEvidence();
  const blob = new Blob([JSON.stringify(data,null,2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = "censhership_evidence.json";
  a.click();

  URL.revokeObjectURL(url);
}

function toggleImportBox(){
  const box = $("#importBox");

  if(!box) return;

  box.style.display = (box.style.display === "none" || !box.style.display) ? "" : "none";
}

function importJSON(){
  const box = $("#importBox");

  if(!box) return;

  try{
    const parsed = JSON.parse(box.value);

    if(!Array.isArray(parsed)){
      throw new Error("JSON must be an array");
    }

    saveEvidence(parsed);
    renderKPIs();
    renderWall();

    box.value = "";
  }catch(e){
    alert(`Import failed: ${e.message}`);
  }
}

// =====================
// Game: Fixed question + 4 options
// =====================
const WORD_SETS = [
  {
    options:["menopause", "education", "support", "health"],
    correct:0,
    reason:'"menopause" is often treated as a sensitive health-related term.'
  },
  {
    options:["postpartum", "community", "care", "wellbeing"],
    correct:0,
    reason:'"postpartum" relates to reproductive health and may be flagged.'
  },
  {
    options:["vagina", "science", "research", "study"],
    correct:0,
    reason:'"vagina" is an anatomical term, but many moderation systems still treat it as sensitive.'
  },
  {
    options:["pelvic pain", "exercise", "fitness", "movement"],
    correct:0,
    reason:'"pelvic pain" contains body-related health language that may reduce visibility.'
  },
  {
    options:["breastfeeding", "nutrition", "diet", "food"],
    correct:0,
    reason:'"breastfeeding" may be moderated because it includes maternal health language.'
  },
  {
    options:["miscarriage", "family", "story", "experience"],
    correct:0,
    reason:'"miscarriage" is a highly sensitive reproductive health term and may be suppressed.'
  }
];

let currentSet = 0;
let selectedIndex = null;
let answered = false;
let roundData = null;

function shuffleArray(arr){
  const copy = [...arr];

  for(let i = copy.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function buildRoundDisplay(set){
  const correctWord = set.options[set.correct];
  const shuffledOptions = shuffleArray(set.options);

  return {
    options:shuffledOptions,
    correct:shuffledOptions.indexOf(correctWord),
    reason:set.reason,
    originalCorrectWord:correctWord
  };
}

function updateProgress(){
  const fill = $("#progressFill");

  if(!fill) return;

  const percent = ((currentSet + 1) / WORD_SETS.length) * 100;
  fill.style.width = `${percent}%`;
}

function showCongratsModal(){
  const modal = $("#congratsModal");

  if(modal){
    modal.classList.add("show");
  }
}

function hideCongratsModal(){
  const modal = $("#congratsModal");

  if(modal){
    modal.classList.remove("show");
  }
}

function restartGame(){
  currentSet = 0;
  selectedIndex = null;
  answered = false;

  hideCongratsModal();
  renderSet();
}

function renderSet(){
  const optionButtons = $$(".option-btn");
  const visLabel = $("#visLabel");
  const reasonBox = $("#reasonBox");
  const nextBtn = $("#nextQuestionBtn");
  const submitBtn = $("#submitAnswerBtn");

  if(!optionButtons.length) return;

  selectedIndex = null;
  answered = false;
  roundData = buildRoundDisplay(WORD_SETS[currentSet]);

  optionButtons.forEach((btn, i) => {
    btn.textContent = roundData.options[i];

    btn.classList.remove(
      "selected",
      "correct",
      "wrong",
      "decor-one",
      "decor-two",
      "decor-three",
      "decor-four"
    );

    /*
      Decoration rule:
      Every question uses paired images across all four visible options.

      1st and 2nd options = 1.jpg
      3rd and 4th options = 2.jpg
    */
    if(i === 0){
      btn.classList.add("decor-one");
    }

    if(i === 1){
      btn.classList.add("decor-two");
    }

    if(i === 2){
      btn.classList.add("decor-three");
    }

    if(i === 3){
      btn.classList.add("decor-four");
    }

    btn.disabled = false;
  });

  if(visLabel) visLabel.textContent = "—";
  if(reasonBox) reasonBox.textContent = "";
  if(nextBtn) nextBtn.style.display = "none";

  if(submitBtn){
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit";
  }

  updateProgress();
}

function submitCurrentAnswer(){
  const optionButtons = $$(".option-btn");
  const visLabel = $("#visLabel");
  const reasonBox = $("#reasonBox");
  const nextBtn = $("#nextQuestionBtn");
  const submitBtn = $("#submitAnswerBtn");
  const platform = $("#platform")?.value || "instagram";
  const type = $("#contentType")?.value || "edu";

  if(answered) return;

  if(selectedIndex === null){
    alert("Please choose one option.");
    return;
  }

  answered = true;

  optionButtons.forEach((btn, i) => {
    btn.disabled = true;

    if(i === roundData.correct){
      btn.classList.add("correct");
    }

    if(i === selectedIndex && i !== roundData.correct){
      btn.classList.add("wrong");
    }
  });

  const selectedWord = roundData.options[selectedIndex];
  const hits = findTriggers(tokenizeLower(selectedWord));
  const score = computeVisibilityScore(hits.length, platform, type);

  if(visLabel){
    visLabel.textContent = selectedIndex === roundData.correct ? "Correct" : "Not quite";
  }

  if(reasonBox){
    reasonBox.textContent = roundData.reason;
  }

  if(submitBtn){
    submitBtn.disabled = true;
  }

  if(currentSet >= WORD_SETS.length - 1){
    if(nextBtn){
      nextBtn.style.display = "none";
    }

    showCongratsModal();
  }else{
    if(nextBtn){
      nextBtn.textContent = "Next question";
      nextBtn.style.display = "inline-flex";
    }
  }

  addEvidence({
    who:"anon",
    platform,
    outcome:score < 30 ? "shadow" : score < 60 ? "suppressed" : "selfcensor",
    words:hits.length ? hits : [roundData.originalCorrectWord],
    note:`Selected: ${selectedWord}. Correct: ${roundData.originalCorrectWord}.`,
    time:nowISO(),
    meta:{
      type,
      source:"game_multiple_choice"
    }
  });
}

function nextSet(){
  if(currentSet >= WORD_SETS.length - 1){
    return;
  }

  currentSet++;
  renderSet();
}

// =====================
// Quick submit
// =====================
function quickSubmitEvidence(){
  const who = ($("#whoInput")?.value || "anon").trim() || "anon";
  const words = ($("#wordsInput")?.value || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  const outcome = $("#outcomeInput")?.value || "suppressed";
  const note = ($("#feelInput")?.value || "").trim();
  const platform = $("#platform")?.value || "instagram";

  addEvidence({
    who,
    words,
    outcome,
    platform,
    note,
    time:nowISO(),
    meta:{ source:"quick_submit" }
  });

  if($("#wordsInput")) $("#wordsInput").value = "";
  if($("#feelInput")) $("#feelInput").value = "";

  const msg = $("#quickMsg");

  if(msg){
    msg.textContent = "Saved locally.";
    setTimeout(() => {
      msg.textContent = "";
    }, 1400);
  }
}

// =====================
// Init by page
// =====================
function bindCommon(){
  $$(".lang .chip").forEach(btn => {
    btn.addEventListener("click", () => applyLang(btn.dataset.lang));
  });

  const kioskBtn = $("#kioskBtn");

  if(kioskBtn){
    kioskBtn.addEventListener("click", () => setKiosk(!ui.kiosk));
  }
}

function bindWallPage(){
  const exportBtn = $("#exportBtn");
  const importBtn = $("#importBtn");
  const clearBtn = $("#clearWallBtn");

  if(exportBtn){
    exportBtn.addEventListener("click", exportJSON);
  }

  if(importBtn){
    importBtn.addEventListener("click", () => {
      toggleImportBox();

      const box = $("#importBox");

      if(box && box.style.display !== "none" && box.value.trim().startsWith("[")){
        importJSON();
      }
    });
  }

  if(clearBtn){
    clearBtn.addEventListener("click", () => {
      if(confirm("Clear all evidence?")){
        saveEvidence([]);
        renderKPIs();
        renderWall();
      }
    });
  }

  renderKPIs();
  renderWall();
}

function bindGamePage(){
  const submitBtn = $("#submitAnswerBtn");
  const nextBtn = $("#nextQuestionBtn");
  const restartBtn = $("#restartGameBtn");
  const closeCongratsBtn = $("#closeCongratsBtn");
  const optionButtons = $$(".option-btn");

  optionButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      if(answered) return;

      optionButtons.forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");

      selectedIndex = Number(btn.dataset.index);
    });
  });

  if(submitBtn){
    submitBtn.addEventListener("click", submitCurrentAnswer);
  }

  if(nextBtn){
    nextBtn.addEventListener("click", nextSet);
  }

  if(restartBtn){
    restartBtn.addEventListener("click", restartGame);
  }

  if(closeCongratsBtn){
    closeCongratsBtn.addEventListener("click", hideCongratsModal);
  }

  $("#quickAddBtn")?.addEventListener("click", quickSubmitEvidence);

  renderSet();
  renderKPIs();
}

function bindHomePage(){
  renderKPIs();
}

function boot(){
  const style = document.createElement("style");

  style.textContent = `
    .hl{
      padding:2px 4px;
      border-radius:8px;
      background: rgba(255,45,45,.22);
      border:1px solid rgba(255,45,45,.35);
      color:#fff;
    }
  `;

  document.head.appendChild(style);

  applyLang(ui.lang || "en");
  setKiosk(!!ui.kiosk);

  bindCommon();

  const page = document.body.dataset.page || "";

  if(page === "wall") bindWallPage();
  if(page === "game") bindGamePage();
  if(page === "home") bindHomePage();

  if(page === "brief" || page === "lab" || page === "popup" || page === "intro"){
    renderKPIs();
    renderWall();
  }
}

boot();
