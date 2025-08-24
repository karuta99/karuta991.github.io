// --------- memorize-placement.js ---------
const kimariji1 = window.KIMARIJI_GROUPS;
const kimariji2 = window.KIMARIJI_ITEMS;
const KEY = 'karutaSettings.v1';
const ALL_IDS = (window.KIMARIJI_ALL_IDS ? window.KIMARIJI_ALL_IDS() : window.KIMARIJI_ITEMS.map(x => x.id));

const loadSettings = () => {
    try {
        return JSON.parse(localStorage.getItem(KEY)) || {};
    } catch {
        return {};
    }
};
const s = loadSettings();

(() => {
    const ta = document.querySelector('.title-box textarea');
    if (!ta) return;

    const asOnOff = v => (v ? 'ON' : 'OFF');
    const dirLabel = v => ({ random: 'ランダム', normal: '正方向', reverse: '逆さま' }[v] || 'ランダム');
    const render = () => {
        const lines = [
            `向き,${dirLabel(s.direction)}`,
            `変化,${asOnOff(!!s.changing)}`,
            `自動,${asOnOff(!!s.autoAdvance)}`,
            `待機,${(s.waitMs ?? 500)}ms`,
            `枚数,${(s.count ?? 100)}`,
            `限定,${asOnOff(!!s.allOrPart)}`,
            '',
            '決まり字一覧(番号だけ)',
            Array.isArray(s.selectedIds)
                ? s.selectedIds.map(Number).sort((a, b) => a - b).join(',')
                : ''
        ];
        ta.value = lines.join('\n');
    };

    // 初期表示
    render();
    // 設定画面で変更→戻ってきたとき等、他タブからの更新も反映
    window.addEventListener('storage', (ev) => {
        if (ev.key === KEY) render();
    });
})();



const halfRow = 3, ROWS = 6, COLS = 11;
const middle = halfRow * COLS, TOTAL = ROWS * COLS;
const MAX_IMAGES = 66;
const grid = document.getElementById('grid');
const shuffleBtn = document.getElementById('shuffleBtn');
const isVisibleBtn = document.getElementById('changeVisible');
const BASE_SCALE = 0.09;    // iPhone XR * 0.055

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

// blank.png の実寸を読み取り、CSS変数を更新
function setSizeFromFirst() {
    return new Promise((resolve) => {
        const probe = new Image();
        probe.onload = () => {
            const w = probe.naturalWidth * BASE_SCALE;
            const h = probe.naturalHeight * BASE_SCALE;
            const r = document.documentElement.style;
            r.setProperty('--w', w + 'px');
            r.setProperty('--h', h + 'px');
            resolve({ w, h });
        };
        probe.onerror = () => resolve();
        probe.src = 'cards/blank.png';
    });
}
var cardsList = [];
let sessionAllowedIds = [];

var isVisible = true;
var noneCards = [
    false, false, true, false, false, true, true, false, false, false, false,
    false, false, false, false, true, true, true, false, false, false, false,
    false, false, false, false, true, true, true, false, false, false, false,
    false, false, false, false, true, true, true, false, false, false, false,
    false, false, false, false, true, true, true, false, false, false, false,
    false, false, false, false, true, true, false, false, true, false, false
];
//デバッグ用
/*
    false, false, false, false, true, true, true, false, false, false, false,
    false, false, false, true, true, true, true, true, false, false, false,
    false, false, true, true, true, true, true, true, true, false, false,
    false, false, true, true, true, true, true, true, true, false, false,
    false, false, false, true, true, true, true, true, false, false, false,
    false, false, false, false, true, true, true, false, false, false, false
*/

//基本用
/*
    false, false, false, false, false, true, true, false, false, false, false,
    false, false, false, false, true, true, true, false, false, false, false,
    false, false, false, false, true, true, true, false, false, false, false,
    false, false, false, false, true, true, true, false, false, false, false,
    false, false, false, false, true, true, true, false, false, false, false,
    false, false, false, false, true, true, false, false, false, false, false
*/

//全部用
/*
    false, false, false, false, false, true, true, false, false, false, false,
    false, false, false, false, true, true, true, false, false, false, false,
    false, false, false, false, true, true, true, false, false, false, false,
    false, false, false, false, true, true, true, false, false, false, false,
    false, false, false, false, true, true, true, false, false, false, false,
    false, false, false, false, true, true, false, false, false, false, false
*/
var notShow = [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
];

const decideAllowedIds = () => {
    const s = loadSettings();
    if (s.allOrPart && Array.isArray(s.selectedIds) && s.selectedIds.length > 0) {
        const want = new Set(s.selectedIds.map(Number));
        return ALL_IDS.filter(id => want.has(id));
    }
    return ALL_IDS.slice();
};
const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };

// 対象IDから 66 枚分を重複なしで抽選（不足なら対象分だけ）
function pickNumbers() {
    sessionAllowedIds = decideAllowedIds();
    const pool = shuffle(sessionAllowedIds.slice());
    // グリッドの none マスを除いた「実表示可能枚数」
    const DISPLAYABLE = noneCards.reduce((n, isNone) => n + (isNone ? 0 : 1), 0); // ← 50
    const need = Math.min(DISPLAYABLE, pool.length);
    return pool.slice(0, need);
}


// 画像を配置
function render() {
    // 要件に基づく配置：
    // ① N = 選択ID数（= cardsList.length）
    // ② upRows = floor(N/2)
    // ③ downRows = N - upRows
    // ④ 上3行は先頭から upRows を埋め、不足は 0
    // ⑤ 下3行の枠数を数え、skipRows = 枠数 - downRows
    // ⑥ 下3行は先頭に skipRows 個の 0 を置き、残りを残IDで埋める
    const frag = document.createDocumentFragment();
    const countDisplayable = (from, to) => {
        let n = 0;
        for (let i = from; i < to; i++) {
            if (!noneCards[i]) n++;
        }
        return n;
    };

    const topSlots = countDisplayable(0, middle);
    const bottomSlots = countDisplayable(middle, TOTAL);

    // 選択ID列（抽選済み）
    const N = cardsList.length;
    const upRows = Math.floor(N / 2);
    const downRows = N - upRows;

    // 上段に置くID、下段に置くID（安全のため枠数でクランプ）
    const topPlace = Math.min(upRows, topSlots);
    const topIds = cardsList.slice(0, topPlace);
    const remainAfterTop = N - topPlace;
    const bottomPlace = Math.min(downRows, bottomSlots, remainAfterTop);
    const bottomIds = cardsList.slice(topPlace, topPlace + bottomPlace);
    const effNone = noneCards.slice();
    /*
    // 下段の先頭は 0 を skipRows 個だけ配置してから残りを配置
    const skipRows = Math.max(0, bottomSlots - bottomPlace);
    let ti = 0;          // topIds index
    let bi = 0;          // bottomIds index
    let bz = skipRows;   // 残りの 0（下段先頭のスキップ分）
    */

    // ④ 上3行：先頭から topPlace 個の表示可能枠だけ残し、それ以外の表示可能枠は削除扱いにする
    if (topSlots > topPlace) {
        let keep = topPlace;
        for (let i = 0; i < middle; i++) {
            if (!effNone[i]) {           // 表示可能枠
                if (keep > 0) {
                    keep--;
                } else {
                    effNone[i] = true;    // 余りの枠は削除
                }
            }
        }
    }

    // ⑤ 下3行の枠数（削除前） bottomSlots は既に算出済み
    // ⑥ 先頭の skipRows 個の枠を削除（= effNone を true）し、残りに bottomIds を詰める
    let toSkip = Math.max(0, bottomSlots - bottomPlace);
    if (toSkip > 0) {
        for (let i = middle; i < TOTAL && toSkip > 0; i++) {
            if (!effNone[i]) {           // 表示可能枠
                effNone[i] = true;       // 先頭から順に削除
                toSkip--;
            }
        }
    }

    let ti = 0;          // topIds index
    let bi = 0;          // bottomIds index

    const appendCell = (i, cssClass) => {
        //if (effNone[i]) return;
        const cell = document.createElement('div');
        if (effNone[i]) {
            cell.className = cssClass + ' none';
            frag.appendChild(cell);
            return;
        }
        cell.className = cssClass;

        let id = 0;
        if (i < middle) {
            // 上3行：先頭から upRows を埋め、不足は 0
            if (ti < topIds.length) id = topIds[ti++];
        } else {
            // 下3行：先頭に skipRows 個 0、その後に bottomIds
            if (bi < bottomIds.length) id = bottomIds[bi++];
        }
        const img = document.createElement('img');
        img.alt = id ? `${id}.png` : 'blank';
        const showReal = id && (isVisible || revealedIds.has(id));
        img.src = showReal ? `cards/${id}.png` : `cards/0.png`;
        cell.appendChild(img);
        frag.appendChild(cell);
    };

    for (let i = 0; i < middle; i++) appendCell(i, 'cell flip');
    for (let i = middle; i < TOTAL; i++) appendCell(i, 'cell');

    grid.innerHTML = '';
    grid.appendChild(frag);
}


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

    // 非表示モード時のみ、選択＝“見せる札”に反映
    revealedIds.clear();
    if (!isVisible) {
        // none ではないマスに置かれている札だけを対象
        const onBoard = new Set(cardsList);
        selectedIndividuals.forEach(id => { if (onBoard.has(id)) revealedIds.add(id); });
        render(); // 盤面反映
    }
}


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
});


// イベント: シャッフル（再抽選して表示モードに戻す）
shuffleBtn.addEventListener('click', () => {
    cardsList = pickNumbers();
    isVisible = true;
    revealedIds.clear();
    selectedIndividuals.clear();    //シャッフル時に、選択情報も合わせてリセットする。
    render();
    recomputeUI();
});

// イベント: 表示 ⇄ 非表示
isVisibleBtn.addEventListener('click', () => {
    isVisible = !isVisible;
    if (!isVisible) revealedIds.clear();
    render();
    recomputeUI();
});

window.addEventListener('storage', (ev) => {
    if (ev.key !== KEY) return;
    cardsList = pickNumbers();     // sessionAllowedIds も更新される
    revealedIds.clear();
    isVisible = true;
    render();
    recomputeUI();
});



// 初期化
(async function init() {
    await setSizeFromFirst();
    cardsList = pickNumbers();
    isVisible = true;

    // ★ 追加：行要素をマップ化
    document.querySelectorAll('#listGroup .list-row').forEach(row => {
        const m = (row.textContent || '').match(/：(.+?)\s*$/);
        if (m) { groupRowByPrefix.set(m[1].trim(), row); }
    });
    document.querySelectorAll('#listIndividual .list-row').forEach(row => {
        const m = (row.textContent || '').match(/#(\d+)/);
        if (m) { indivRowById.set(+m[1], row); }
    });

    render();
    recomputeUI();
})();
