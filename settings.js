// --------- settings.js ---------
const SETTINGS_KEY = 'karutaSettings.v1';

// 保存・読込ユーティリティ
const loadSettings = () => {
    try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; }
    catch { return {}; }
};
const saveSettings = (obj) => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(obj)); } catch { }
};

// 現在のUIから設定を収集
function collectSettings() {
    const direction = document.querySelector('input[name="direction"]:checked')?.value || 'random';
    const waitMs = +document.getElementById('waitRange').value || 0;
    const count = +document.getElementById('countRange').value || 100;

    return {
        direction,
        changing: document.getElementById('changing').checked,
        autoAdvance: document.getElementById('autoSend').checked,
        waitMs,
        count,
        allOrPart: document.getElementById('allOrPart').checked,
        selectedIds: Array.from(selectedIndividuals),
        updatedAt: Date.now()
    };
}

// 設定をUIへ反映（初回表示時）
function applySettings(s) {
    if (!s) return;

    // ラジオ
    if (s.direction) {
        const r = document.querySelector(`input[name="direction"][value="${s.direction}"]`);
        if (r) r.checked = true;
    }
    // トグル
    if ('changing' in s) document.getElementById('changing').checked = !!s.changing;
    if ('autoAdvance' in s) document.getElementById('autoSend').checked = !!s.autoAdvance;
    if ('allOrPart' in s) document.getElementById('allOrPart').checked = !!s.allOrPart;

    // スライダ
    if ('waitMs' in s) document.getElementById('waitRange').value = +s.waitMs;
    if ('count' in s) document.getElementById('countRange').value = +s.count;

    // 表示数値と見た目（既存の bindRange/paintrange を活用）
    document.getElementById('waitValue').textContent = document.getElementById('waitRange').value;
    document.getElementById('countValue').textContent = document.getElementById('countRange').value;
    paintRange(document.getElementById('waitRange'));
    paintRange(document.getElementById('countRange'));

    // 個別選択
    if (Array.isArray(s.selectedIds)) {
        selectedIndividuals.clear();
        s.selectedIds.forEach(id => selectedIndividuals.add(+id));
        recomputeUI(); // 既存関数：選択の見た目を更新
    }
}

// こまめに保存（連打対策のデバウンス）
let saveTimer = null;
function saveSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveSettings(collectSettings()), 100);
}


// スライダーと設定値の連動
function paintRange(el) {
    const min = +el.min, max = +el.max, val = +el.value;
    const pct = ((val - min) / (max - min)) * 100;
    el.style.background =
        `linear-gradient(to right,
                var(--slider-fill) 0%, var(--slider-fill) ${pct}%,
                var(--slider-base) ${pct}%, var(--slider-base) 100%)`;
}

function bindRange(inputEl, outEl) {
    const update = () => { outEl.textContent = inputEl.value; paintRange(inputEl); };
    inputEl.addEventListener('input', update);
    update(); // 初期表示
}

bindRange(document.getElementById('waitRange'), document.getElementById('waitValue'));
bindRange(document.getElementById('countRange'), document.getElementById('countValue'));

// ----共通データを参照 ------------------
const kimariji1 = window.KIMARIJI_GROUPS;
const kimariji2 = window.KIMARIJI_ITEMS;

const halfRow = 3, ROWS = 6, COLS = 11;
const TOTAL = ROWS * COLS;
const MAX_IMAGES = ROWS * COLS;
const revealedIds = new Set();   // 非表示モードで「見せる」と決めた札IDの集合
const selectedIndividuals = new Set();

const groupRowByPrefix = new Map();
const indivRowById = new Map();

// ★ 追加：グループ → 個別札ID[] のマップを作成
const groupMap = new Map();
kimariji1.forEach(g => {
    const ids = kimariji2
        .filter(k => k.s.startsWith(g.s))
        .map(k => k.id);
    groupMap.set(g.s, ids);
});

// --- 課題No3: 全選択/全解除（両リスト横断） ---
const oneSyllableLists = window.STANDALONE_IDS;
const selectAllBtn = document.getElementById('selectAll');
const clearAllBtn = document.getElementById('clearAll');

if (selectAllBtn) {
    selectAllBtn.addEventListener('click', () => {
        // グループに属する全個別ID ＋ 非所属7ID の和集合を作る
        const all = new Set(oneSyllableLists);
        groupMap.forEach(ids => ids.forEach(id => all.add(id)));
        // 反映
        selectedIndividuals.clear();
        all.forEach(id => selectedIndividuals.add(id));
        recomputeUI();
        saveSoon(); // localStorage へ即時保存
    });
}
if (clearAllBtn) {
    clearAllBtn.addEventListener('click', () => {
        selectedIndividuals.clear();
        recomputeUI();
        saveSoon(); // localStorage へ即時保存
    });
}

var cardsList = [];
var isVisible = true;


// ★ 新：選択状態から UI と盤面(非表示時)を一括再計算
function recomputeUI() {
    // まず行の見た目を更新
    indivRowById.forEach((row, id) => {
        row.classList.toggle('selected', selectedIndividuals.has(id));
    });
    groupRowByPrefix.forEach((row, prefix) => {
        const ids = groupMap.get(prefix) || [];
        const allSelected = ids.length > 0 && ids.every(id => selectedIndividuals.has(id));
        row.classList.toggle('selected', allSelected);
    });
}

// ▼ スイッチ・ラジオ・スライダの変更で保存
document.getElementById('changing').addEventListener('change', saveSoon);
document.getElementById('autoSend').addEventListener('change', saveSoon);
document.getElementById('allOrPart').addEventListener('change', saveSoon);
document.getElementById('waitRange').addEventListener('input', saveSoon);
document.getElementById('countRange').addEventListener('input', saveSoon);
document.querySelectorAll('input[name="direction"]').forEach(r => r.addEventListener('change', saveSoon));

// ★ 新：グループの選択トグル（常時可、非表示時は盤面も反映）
document.getElementById('listGroup').addEventListener('click', (e) => {
    const row = e.target.closest('.list-row');
    if (!row) return;
    const m = (row.textContent || '').match(/：(.+?)\s*$/);
    if (!m) return;
    const prefix = m[1].trim();

    const ids = groupMap.get(prefix) || [];
    const allSelected = ids.length > 0 && ids.every(id => selectedIndividuals.has(id));
    if (allSelected) {
        ids.forEach(id => selectedIndividuals.delete(id));
    } else {
        ids.forEach(id => selectedIndividuals.add(id));
    }
    recomputeUI();
    saveSoon();
});
// ★ 追加：個別の選択トグル（常時可）
document.getElementById('listIndividual').addEventListener('click', (e) => {
    const row = e.target.closest('.list-row');
    if (!row) return;
    const m = (row.textContent || '').match(/#(\d+)/);
    if (!m) return;
    const id = +m[1];
    if (selectedIndividuals.has(id)) selectedIndividuals.delete(id);
    else selectedIndividuals.add(id);
    recomputeUI();
    saveSoon();
});

// ▼ 「戻る（保存）」ボタン：保存してトップへ
document.getElementById('btnBackSave').addEventListener('click', () => {
    saveSettings(collectSettings());
    location.href = './index.html';
});

// ▼ 初期表示時に保存済み設定を適用
(function initSettingsPage() {
    applySettings(loadSettings());
})();

// 初期化
(function init() {
    // ★ 追加：行要素をマップ化
    document.querySelectorAll('#listGroup .list-row').forEach(row => {
        const m = (row.textContent || '').match(/：(.+?)\s*$/);
        if (m) { groupRowByPrefix.set(m[1].trim(), row); }
    });
    document.querySelectorAll('#listIndividual .list-row').forEach(row => {
        const m = (row.textContent || '').match(/#(\d+)/);
        if (m) { indivRowById.set(+m[1], row); }
    });

    //render();
    recomputeUI();
})();





var noneCards = window.NONE_CARDS;
var grid = document.getElementById('grid');
var out = document.getElementById('out');

if (noneCards.length !== ROWS * COLS) {
    throw new Error('noneCards の長さが 6×11 と一致しません（現在: ' + noneCards.length + '）');
}

function renderGrid() {
    grid.innerHTML = '';
    for (var i = 0; i < noneCards.length; i++) {
        var cell = document.createElement('label');
        cell.className = 'cell';
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        // false => checked, true => unchecked
        cb.checked = (noneCards[i] === false);
        cb.dataset.index = i;

        // 変更を配列へ反映（checked: true => noneCards 値は false）
        cb.addEventListener('change', function (e) {
            var idx = +e.target.dataset.index;
            noneCards[idx] = !e.target.checked; // 反転マッピング
            dumpArray();
        });

        cell.appendChild(cb);

        // （任意）行・列インジケータ
        var r = Math.floor(i / COLS), c = i % COLS;
        var rc = document.createElement('span');
        rc.className = 'rowcol';
        rc.textContent = (r + 1) + ',' + (c + 1);
        cell.title = 'row ' + (r + 1) + ', col ' + (c + 1);

        // 行列番号を表示したくない場合は次の行をコメントアウトしてください
        // cell.appendChild(rc);

        grid.appendChild(cell);
    }
    dumpArray();
}

function dumpArray() {
    // 行単位で改行、true/false をそのまま表示
    var lines = [];
    for (var r = 0; r < ROWS; r++) {
        var row = [];
        for (var c = 0; c < COLS; c++) {
            row.push(String(noneCards[r * COLS + c]));
        }
        lines.push(row.join(', '));
    }
    out.value = lines.join('\n');
}

renderGrid();
