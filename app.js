// ===== 고정값 =====
const BASE_NEED_CROP = 8;  // 베이스 1개에 필요한 작물 수(고정)
const GIANT_DROP = 7;      // 왕 작물 드롭 배수(고정)

// 작물 평균 드롭(고정)
const CROP_AVG = {
  tomato: 2.0,
  onion: 1.5,
  garlic: 2.5,
};

const $ = (id) => document.getElementById(id);

function nval(id, fallback = 0) {
  const el = $(id);
  if (!el) return fallback;
  const v = parseFloat(el.value);
  return Number.isFinite(v) ? v : fallback;
}
function ival(id, fallback = 0) {
  const el = $(id);
  if (!el) return fallback;
  const v = parseInt(el.value, 10);
  return Number.isFinite(v) ? v : fallback;
}
function clamp(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x));
}
function fmtInt(x) {
  if (!Number.isFinite(x)) return "0";
  return Math.round(x).toLocaleString("ko-KR");
}
function fmtMoney(x) {
  if (!Number.isFinite(x)) return "0 원";
  return Math.round(x).toLocaleString("ko-KR") + " 원";
}

// ===== 괭이 강화 단계별 씨앗 드롭 =====
// 1강 2개, 2~4강 3개, 5~6강 4개, 8~10강 5개, 11~12강 6개, 13~14강 7개, 15강 12개
// (요청에 7강이 빠져있어서 7강은 4개로 처리)
function dropByHoeLevel(level) {
  const lv = Math.max(1, Math.min(15, Math.floor(level)));

  if (lv === 1) return 2;
  if (lv >= 2 && lv <= 4) return 3;
  if (lv >= 5 && lv <= 7) return 4;
  if (lv >= 8 && lv <= 10) return 5;
  if (lv >= 11 && lv <= 12) return 6;
  if (lv >= 13 && lv <= 14) return 7;
  if (lv === 15) return 12;

  return 2;
}

// ===== 최종 배율(돈 좀 벌어볼까 / 한 솥 가득) =====
function moneyPct(level) {
  const lv = Math.max(0, Math.min(10, Math.floor(level)));
  if (lv === 0) return 0;
  if (lv >= 1 && lv <= 6) return lv;
  if (lv === 7) return 10;
  if (lv === 8) return 15;
  if (lv === 9) return 30;
  if (lv === 10) return 50;
  return 0;
}
function potPct(level) {
  const lv = Math.max(0, Math.min(5, Math.floor(level)));
  if (lv === 0) return 0;
  if (lv === 1) return 1;
  if (lv === 2) return 2;
  if (lv === 3) return 3;
  if (lv === 4) return 4;
  if (lv === 5) return 7;
  return 0;
}

function buildPctOptions(maxLevel, pctFn, defaultLevel) {
  const def = Math.max(0, Math.min(maxLevel, Math.floor(defaultLevel)));
  let html = "";
  for (let lv = 0; lv <= maxLevel; lv++) {
    const pct = pctFn(lv);
    const sel = lv === def ? "selected" : "";
    html += `<option value="${lv}" ${sel}>${lv}강 (+${pct}%)</option>`;
  }
  return html;
}

function initMultiplierSelects() {
  // ✅ 기본값: 돈 9강, 솥 2강
  $("moneyLevel").innerHTML = buildPctOptions(10, moneyPct, 9);
  $("potLevel").innerHTML = buildPctOptions(5, potPct, 2);
}

// ===== 사람 목록 =====
let people = [];

// ✅ 기본값: 괭이 8강
function makePerson(i, stamina = 3000, hoeLevel = 8) {
  return { idx: i + 1, stamina, hoeLevel };
}

function buildHoeOptions(selected) {
  const sel = Math.max(1, Math.min(15, Math.floor(selected)));
  let html = "";
  for (let lv = 1; lv <= 15; lv++) {
    const drops = dropByHoeLevel(lv);
    const isSel = lv === sel ? "selected" : "";
    html += `<option value="${lv}" ${isSel}>${lv}강 (드롭 ${drops}개)</option>`;
  }
  return html;
}

function renderPeople(count) {
  const wrap = $("peopleWrap");
  wrap.innerHTML = "";
  people = [];

  for (let i = 0; i < count; i++) {
    const p = makePerson(i);
    people.push(p);

    const card = document.createElement("div");
    card.className = "personCard";
    card.innerHTML = `
      <div class="personHead">
        <div style="font-weight:850;">사람 ${i + 1}</div>
        <div class="pill">개별 입력</div>
      </div>
      <div class="grid2">
        <div>
          <label>스테미나</label>
          <input data-k="stamina" data-i="${i}" type="number" min="0" step="1" value="${p.stamina}">
        </div>
        <div>
          <label>괭이 강화</label>
          <select data-k="hoeLevel" data-i="${i}">
            ${buildHoeOptions(p.hoeLevel)}
          </select>
        </div>
      </div>
    `;
    wrap.appendChild(card);
  }

  wrap.querySelectorAll("input, select").forEach((el) => {
    const handler = () => {
      const i = parseInt(el.dataset.i, 10);
      const k = el.dataset.k;
      const v = (el.tagName === "SELECT") ? parseInt(el.value, 10) : parseFloat(el.value);
      if (Number.isFinite(i) && people[i]) {
        people[i][k] = Number.isFinite(v) ? v : 0;
        computeAndRender();
      }
    };
    el.addEventListener("input", handler);
    el.addEventListener("change", handler);
  });

  computeAndRender();
}

function computeAndRender() {
  // 입력
  const p = clamp(nval("giantProbPct", 3) / 100, 0, 1);
  const cookPrice = Math.max(0, nval("cookPrice", 3300));

  const bTomato = Math.max(0, nval("bTomato", 1));
  const bOnion  = Math.max(0, nval("bOnion", 1));
  const bGarlic = Math.max(0, nval("bGarlic", 1));

  // 배율(돈/솥)
  const moneyLv = ival("moneyLevel", 0);
  const potLv   = ival("potLevel", 0);
  const mPct = moneyPct(moneyLv);
  const pPct = potPct(potLv);

  $("moneyPct").textContent = `+${mPct}%`;
  $("potPct").textContent = `+${pPct}%`;

  // 최종 배율
  const finalMul = (1 + mPct / 100) * (1 + pPct / 100);

  // 기대 드롭(왕 작물 확률 + 고정 배수)
  const expectedMul = (1 - p) + (p * GIANT_DROP);
  const expectedTomato = CROP_AVG.tomato * expectedMul;
  const expectedOnion  = CROP_AVG.onion  * expectedMul;
  const expectedGarlic = CROP_AVG.garlic * expectedMul;

  // 총 씨앗
  let totalSeeds = 0;
  for (const person of people) {
    const st = Math.max(0, person.stamina);
    const lv = Math.max(1, Math.min(15, Math.floor(person.hoeLevel)));
    const seedDrop = dropByHoeLevel(lv);
    totalSeeds += Math.floor(st / 7) * seedDrop;
  }

  // ✅ 씨앗 세트(64개=1세트)
  const setCount = Math.floor(totalSeeds / 64);
  const remain = totalSeeds % 64;

  // 요리 1개에 필요한 씨앗(기대값)
  let seedsPerCook = Infinity;
  if (expectedTomato > 0 && expectedOnion > 0 && expectedGarlic > 0) {
    const needTomatoSeed = BASE_NEED_CROP / expectedTomato;
    const needOnionSeed  = BASE_NEED_CROP / expectedOnion;
    const needGarlicSeed = BASE_NEED_CROP / expectedGarlic;

    seedsPerCook =
      (bTomato * needTomatoSeed) +
      (bOnion  * needOnionSeed) +
      (bGarlic * needGarlicSeed);
  }

  const cooksPossible =
    (Number.isFinite(seedsPerCook) && seedsPerCook > 0)
      ? Math.floor(totalSeeds / seedsPerCook)
      : 0;

  const grossPrice = cooksPossible * cookPrice;
  const finalPrice = grossPrice * finalMul;

  // 출력
  $("finalPrice").textContent = fmtMoney(finalPrice);
  $("cooksPossible").textContent = fmtInt(cooksPossible);
  $("grossPrice").textContent = fmtMoney(grossPrice);

  // ✅ 추가 출력
  $("totalSeeds").textContent = fmtInt(totalSeeds);
  $("seedSets").textContent = `${fmtInt(setCount)}세트 + ${fmtInt(remain)}개`;
}

function bindAllInputs() {
  const ids = [
    "giantProbPct",
    "cookPrice",
    "bTomato", "bOnion", "bGarlic",
    "moneyLevel", "potLevel",
  ];

  ids.forEach(id => {
    const el = $(id);
    const handler = () => computeAndRender();
    el.addEventListener("input", handler);
    el.addEventListener("change", handler);
  });

  $("applyPeople").addEventListener("click", () => {
    const cnt = clamp(ival("peopleCount", 1), 1, 50);
    renderPeople(cnt);
  });

  $("peopleCount").addEventListener("change", () => {
    const cnt = clamp(ival("peopleCount", 1), 1, 50);
    renderPeople(cnt);
  });
}

// init
initMultiplierSelects();
bindAllInputs();
renderPeople(clamp(ival("peopleCount", 4), 1, 50));