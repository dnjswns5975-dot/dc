/* ─ State ─ */
let rawData = [], tableData = [], favSet = new Set(JSON.parse(localStorage.getItem('dc_favs') || '[]'));
let showFavOnly = false;
let activeYearMin = 0, activeYearMax = 9999;
let yearlyChart = null, kwChart = null, histChart = null, kwTrendChart = null;
let activeMapMode = 'keyword'; // 'keyword' or 'author'
let searchFullText = false;   // I: abstract full-text search toggle
let lastQuery = '';           // track last search for highlight

/* ─ Colors ─ */
const C = {
    indigo:'#6366f1', pink:'#ec4899', violet:'#8b5cf6',
    green:'#10b981', blue:'#3b82f6', teal:'#14b8a6',
    muted:'#94a3b8', bg:'rgba(15,23,42,0.9)',
    border:'rgba(255,255,255,0.07)'
};

Chart.defaults.color = C.muted;
Chart.defaults.font.family = "'Noto Sans KR', sans-serif";

/* ════════════════════════════════
   INIT
   ════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
    if (typeof kciData === 'undefined') { console.error('data.js not loaded'); return; }
    rawData = kciData;

    initParticles();
    buildYearSlider();
    applyFilters();          // initial render
    setupEventListeners();
});

/* ════════════════════════════════
   YEAR SLIDER
   ════════════════════════════════ */
function buildYearSlider() {
    const years = rawData.map(d => parseInt(d.year)).filter(y => !isNaN(y));
    const minY = Math.min(...years), maxY = Math.max(...years);
    activeYearMin = minY; activeYearMax = maxY;

    const s1 = document.getElementById('yearMin');
    const s2 = document.getElementById('yearMax');
    s1.min = s2.min = minY;
    s1.max = s2.max = maxY;
    s1.value = minY; s2.value = maxY;

    updateYearLabel();
}

function updateYearLabel() {
    const s1 = document.getElementById('yearMin');
    const s2 = document.getElementById('yearMax');
    const lo = parseInt(s1.value), hi = parseInt(s2.value);
    activeYearMin = Math.min(lo, hi);
    activeYearMax = Math.max(lo, hi);
    document.getElementById('yearRangeLabel').textContent =
        activeYearMin === activeYearMax ? `${activeYearMin}년` : `${activeYearMin} – ${activeYearMax}`;
}

/* ════════════════════════════════
   FILTER PIPELINE
   ════════════════════════════════ */
function applyFilters() {
    const query = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
    lastQuery = query;
    tableData = rawData.filter(d => {
        const y = parseInt(d.year);
        if (y < activeYearMin || y > activeYearMax) return false;
        if (showFavOnly && !favSet.has(d.title)) return false;
        if (query) {
            const basicMatch =
                (d.title   && d.title.toLowerCase().includes(query)) ||
                (d.authors && d.authors.some(a => a.toLowerCase().includes(query))) ||
                (d.journal && d.journal.toLowerCase().includes(query));
            if (basicMatch) return true;
            // Full-text mode also checks abstract + keywords
            if (searchFullText) {
                return (d.abstract && d.abstract.toLowerCase().includes(query)) ||
                       (d.keywords && d.keywords.some(k => k.toLowerCase().includes(query)));
            }
            return false;
        }
        return true;
    });

    processMetrics();
    processCharts();
    processRankings();
    processKwTrend();
    processNetwork();
    renderTable();
    generateAIInsight();
    document.getElementById('resultCount').textContent = `(${tableData.length}건)`;

    // Reset Gap Analyzer UI state on filter change
    const initState = document.getElementById('gapInitState');
    const scanningState = document.getElementById('gapScanningState');
    const resultsGrid = document.getElementById('gapResultsGrid');
    if (initState && scanningState && resultsGrid) {
        initState.classList.remove('hidden');
        scanningState.classList.add('hidden');
        resultsGrid.classList.add('hidden');
    }
}

/* ════════════════════════════════
   METRICS
   ════════════════════════════════ */
function processMetrics() {
    const total = tableData.length;
    const totalCit = tableData.reduce((s, d) => s + (d.citations || 0), 0);
    const avg = total ? (totalCit / total).toFixed(1) : 0;

    const sorted = tableData.map(d => d.citations || 0).sort((a,b) => b - a);
    let h = 0;
    for (let i = 0; i < sorted.length; i++) { if (sorted[i] >= i+1) h = i+1; else break; }

    animVal('total-papers',   0, total,          1200);
    animVal('total-citations',0, totalCit,        1200);
    animVal('avg-citations',  0, parseFloat(avg), 1200, true);
    animVal('h-index',        0, h,               1200);

    drawSparkline('spark-papers',   rawData, false);
    drawSparkline('spark-citations',rawData, true);
}

function drawSparkline(id, data, citations) {
    const el = document.getElementById(id); if (!el) return;
    const ctx = el.getContext('2d');
    const yc = {};
    data.forEach(d => {
        if (!d.year) return;
        yc[d.year] = (yc[d.year] || 0) + (citations ? (d.citations||0) : 1);
    });
    const vals = Object.keys(yc).sort().map(k => yc[k]);
    const max = Math.max(...vals) || 1;
    const w = el.width = 100, h = el.height = 50;
    ctx.clearRect(0,0,w,h);
    ctx.beginPath();
    vals.forEach((v,i) => {
        const x = (i / (vals.length-1)) * w;
        const y = h - (v/max)*h;
        i === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    });
    ctx.strokeStyle = C.indigo;
    ctx.lineWidth = 2;
    ctx.stroke();
}

/* ════════════════════════════════
   AI INSIGHT  (typing effect)
   ════════════════════════════════ */
function generateAIInsight() {
    const el = document.getElementById('ai-insight-text'); if (!el) return;

    const kws = {};
    tableData.forEach(r => (r.keywords||[]).forEach(k => { const t=k.trim(); if(t) kws[t]=(kws[t]||0)+1; }));
    const topKw = Object.entries(kws).sort((a,b)=>b[1]-a[1])[0];

    const authors = {};
    tableData.forEach(r => (r.authors||[]).forEach(a => {
        const t=a.trim(); if(t) authors[t]=(authors[t]||0)+(r.citations||0);
    }));
    const topAuthor = Object.entries(authors).sort((a,b)=>b[1]-a[1])[0];

    const topCited = [...tableData].sort((a,b)=>(b.citations||0)-(a.citations||0))[0];

    if (!topKw || !topAuthor || !topCited) { el.innerHTML = '데이터 분석 중...'; return; }

    const str = `분석 완료 — 선택 구간에서 가장 빈번한 키워드는 <strong>'${topKw[0]}'</strong>이며, 피인용 기반 최다 영향력 연구자는 <strong>${topAuthor[0]}</strong>(누적 ${topAuthor[1].toLocaleString()}회)입니다. 최고 인용 논문은 <strong>'${topCited.title.slice(0,40)}…'</strong>(${topCited.citations}회 인용)입니다.`;

    el.innerHTML = '';
    let i = 0, inTag = false;
    (function type() {
        if (i >= str.length) return;
        if (str[i] === '<') inTag = true;
        if (str[i] === '>') inTag = false;
        el.innerHTML = str.substring(0, ++i);
        setTimeout(type, inTag ? 0 : 18);
    })();
}

/* ════════════════════════════════
   CHARTS
   ════════════════════════════════ */
function processCharts() {
    // 1) Yearly trend
    const yc = {};
    tableData.forEach(d => { if(d.year) yc[d.year]=(yc[d.year]||0)+1; });
    const years = Object.keys(yc).sort(), counts = years.map(y=>yc[y]);

    const ctxY = document.getElementById('yearlyChart').getContext('2d');
    const grad = ctxY.createLinearGradient(0,0,0,260);
    grad.addColorStop(0,'rgba(99,102,241,0.45)');
    grad.addColorStop(1,'rgba(99,102,241,0)');

    if (yearlyChart) yearlyChart.destroy();
    yearlyChart = new Chart(ctxY, {
        type:'line',
        data:{ labels:years, datasets:[{
            label:'발행 수', data:counts,
            borderColor:C.indigo, backgroundColor:grad,
            borderWidth:3, pointRadius:0, pointHoverRadius:6,
            fill:true, tension:0.4
        }]},
        options:{
            responsive:true, maintainAspectRatio:false,
            plugins:{ legend:{display:false}, tooltip:tooltipDefaults() },
            interaction:{mode:'index',intersect:false},
            scales:{
                y:{grid:{color:'rgba(255,255,255,0.04)',drawBorder:false}, beginAtZero:true},
                x:{grid:{display:false,drawBorder:false}}
            }
        }
    });

    // 2) Citation histogram
    const bins = [0,1,3,5,10,20,50,100,Infinity];
    const labels = ['0','1-2','3-4','5-9','10-19','20-49','50-99','100+'];
    const binCounts = new Array(labels.length).fill(0);
    tableData.forEach(d => {
        const c = d.citations||0;
        for (let i=0; i<bins.length-1; i++) {
            if (c >= bins[i] && c < bins[i+1]) { binCounts[i]++; break; }
        }
    });
    const ctxH = document.getElementById('citationHistogram').getContext('2d');
    const barGrad = ctxH.createLinearGradient(0,0,0,260);
    barGrad.addColorStop(0, C.pink);
    barGrad.addColorStop(1,'rgba(139,92,246,0.4)');

    if (histChart) histChart.destroy();
    histChart = new Chart(ctxH, {
        type:'bar',
        data:{ labels, datasets:[{
            label:'논문 수', data:binCounts,
            backgroundColor:barGrad, borderRadius:8, borderSkipped:false
        }]},
        options:{
            responsive:true, maintainAspectRatio:false,
            plugins:{ legend:{display:false}, tooltip:tooltipDefaults() },
            scales:{
                y:{grid:{color:'rgba(255,255,255,0.04)',drawBorder:false}, beginAtZero:true},
                x:{grid:{display:false,drawBorder:false}}
            }
        }
    });

    // 3) Keyword doughnut
    const kc = {};
    tableData.forEach(d => (d.keywords||[]).forEach(k => { const t=k.trim(); if(t) kc[t]=(kc[t]||0)+1; }));
    const topKws = Object.entries(kc).sort((a,b)=>b[1]-a[1]).slice(0,6);
    const ctxK = document.getElementById('keywordChart').getContext('2d');

    if (kwChart) kwChart.destroy();
    kwChart = new Chart(ctxK, {
        type:'doughnut',
        data:{
            labels:topKws.map(k=>k[0]),
            datasets:[{
                data:topKws.map(k=>k[1]),
                backgroundColor:[C.indigo,C.pink,C.violet,C.blue,C.teal,'#f59e0b'],
                borderWidth:2, borderColor:'#0f172a', hoverOffset:10
            }]
        },
        options:{
            responsive:true, maintainAspectRatio:false, cutout:'78%',
            plugins:{
                legend:{position:'bottom',labels:{color:C.muted,usePointStyle:true,padding:18}}
            }
        }
    });
}

function tooltipDefaults() {
    return {
        backgroundColor:'rgba(15,23,42,0.95)',
        titleColor:'#fff', bodyColor:C.indigo,
        borderColor:C.border, borderWidth:1, padding:12, displayColors:false
    };
}

/* ════════════════════════════════
   RANKINGS
   ════════════════════════════════ */
function processRankings() {
    const ac={}, ic={};
    tableData.forEach(d => {
        (d.authors||[]).forEach(a => { const t=a.trim(); if(t) ac[t]=(ac[t]||0)+1; });
        if (d.institution) ic[d.institution]=(ic[d.institution]||0)+1;
    });
    const makeList = (obj,id) => {
        document.getElementById(id).innerHTML =
            Object.entries(obj).sort((a,b)=>b[1]-a[1]).slice(0,5)
                .map(([n,v])=>`<li><span class="rank-name">${n}</span><span class="rank-score">${v}건</span></li>`)
                .join('');
    };
    makeList(ac,'top-authors');
    makeList(ic,'top-institutions');
}

/* ════════════════════════════════
   KEYWORD TREND CHART
   ════════════════════════════════ */
function processKwTrend() {
    const canvas = document.getElementById('kwTrendChart');
    const legendEl = document.getElementById('kwTrendLegend');
    if (!canvas || !legendEl) return;

    // ① Collect all years in current range and top-8 global keywords
    const allYears = [...new Set(
        tableData.map(d => parseInt(d.year)).filter(y => !isNaN(y))
    )].sort((a, b) => a - b);

    if (allYears.length === 0) return;

    // Global keyword frequency across entire tableData
    const globalKc = {};
    tableData.forEach(d => {
        (d.keywords || []).forEach(k => {
            const t = k.trim();
            if (t) globalKc[t] = (globalKc[t] || 0) + 1;
        });
    });
    const topKws = Object.entries(globalKc)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(e => e[0]);

    if (topKws.length === 0) return;

    // ② Build per-year frequency map for each top keyword
    const yearKwMap = {};
    allYears.forEach(y => { yearKwMap[y] = {}; });
    tableData.forEach(d => {
        const y = parseInt(d.year);
        if (isNaN(y) || !yearKwMap[y]) return;
        (d.keywords || []).forEach(k => {
            const t = k.trim();
            if (topKws.includes(t)) {
                yearKwMap[y][t] = (yearKwMap[y][t] || 0) + 1;
            }
        });
    });

    // ③ Color palette (vivid, distinct)
    const palette = [
        '#6366f1','#ec4899','#10b981','#f59e0b',
        '#3b82f6','#8b5cf6','#ef4444','#14b8a6'
    ];

    const datasets = topKws.map((kw, i) => ({
        label: kw,
        data: allYears.map(y => yearKwMap[y][kw] || 0),
        borderColor: palette[i],
        backgroundColor: palette[i] + '22',
        borderWidth: 2,
        pointRadius: allYears.length < 10 ? 5 : 3,
        pointHoverRadius: 7,
        tension: 0.4,
        fill: false,
    }));

    // ④ Update subtitle
    const sub = document.getElementById('kwTrendSubtitle');
    if (sub) {
        sub.textContent = `${allYears[0]}–${allYears[allYears.length-1]}년 · 상위 ${topKws.length}개 키워드 연도별 출현 빈도`;
    }

    // ⑤ Draw / update chart
    const ctx = canvas.getContext('2d');
    if (kwTrendChart) { kwTrendChart.destroy(); kwTrendChart = null; }

    kwTrendChart = new Chart(ctx, {
        type: 'line',
        data: { labels: allYears, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            animation: { duration: 600, easing: 'easeInOutQuart' },
            plugins: {
                legend: { display: false },
                tooltip: {
                    ...tooltipDefaults(),
                    callbacks: {
                        title: items => `${items[0].label}년`,
                        label: item => ` ${item.dataset.label}: ${item.raw}회`
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
                    ticks: { color: '#94a3b8', maxTicksLimit: 12 }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
                    beginAtZero: true,
                    ticks: { color: '#94a3b8', precision: 0 }
                }
            }
        }
    });

    // ⑥ Render interactive legend
    legendEl.innerHTML = '';
    topKws.forEach((kw, i) => {
        const item = document.createElement('div');
        item.className = 'kw-legend-item';
        item.innerHTML = `<span class="kw-legend-dot" style="background:${palette[i]}"></span>${kw}`;
        item.addEventListener('click', () => {
            const meta = kwTrendChart.getDatasetMeta(i);
            const hidden = meta.hidden;
            meta.hidden = hidden ? null : true;
            item.classList.toggle('muted', !hidden);
            kwTrendChart.update();
        });
        legendEl.appendChild(item);
    });
}

/* ════════════════════════════════
   NETWORK
   ════════════════════════════════ */
let networkInstance = null;
function processNetwork() {
    const container = document.getElementById('networkRadar');
    if (!container) return;

    if (networkInstance) { networkInstance.destroy(); networkInstance = null; }

    if (activeMapMode === 'keyword') {
        const kc={}, co={};
        tableData.forEach(d => {
            const kws = (d.keywords||[]).map(k=>k.trim()).filter(k=>k);
            kws.forEach(k => kc[k]=(kc[k]||0)+1);
            for (let i=0;i<kws.length;i++) for (let j=i+1;j<kws.length;j++) {
                if (kws[i]===kws[j]) continue;
                const p=[kws[i],kws[j]].sort().join('||');
                co[p]=(co[p]||0)+1;
            }
        });

        const top = Object.entries(kc).sort((a,b)=>b[1]-a[1]).slice(0,22).map(e=>e[0]);
        const nodes = new vis.DataSet(top.map(kw=>({
            id:kw, label:kw, value:kc[kw],
            color:{background:'rgba(99,102,241,0.1)',border:C.violet,
                   highlight:{border:C.pink,background:'rgba(236,72,153,0.15)'}},
            font:{color:'#f8fafc',face:"'Noto Sans KR'",size:12}
        })));
        const edges = new vis.DataSet(
            Object.entries(co)
                .filter(([p])=>{ const [a,b]=p.split('||'); return top.includes(a)&&top.includes(b); })
                .map(([p,v])=>{ const [a,b]=p.split('||');
                    return {from:a,to:b,value:v,color:{color:'rgba(255,255,255,0.08)',highlight:C.pink}}; })
        );

        networkInstance = new vis.Network(container,{nodes,edges},{
            nodes:{shape:'dot',scaling:{min:8,max:22},borderWidth:2,
                   shadow:{enabled:true,color:'rgba(139,92,246,0.6)',size:12}},
            edges:{smooth:{type:'continuous'}},
            physics:{barnesHut:{gravitationalConstant:-1800,springConstant:0.025},
                     stabilization:{iterations:120}},
            interaction:{hover:true,tooltipDelay:150}
        });

    } else {
        const authorPapers = {};
        const coAuthors = {};

        tableData.forEach(d => {
            const auts = (d.authors || []).map(a => a.trim()).filter(a => a);
            auts.forEach(a => {
                if (!authorPapers[a]) authorPapers[a] = [];
                authorPapers[a].push(d);
            });
            for (let i = 0; i < auts.length; i++) {
                for (let j = i + 1; j < auts.length; j++) {
                    if (auts[i] === auts[j]) continue;
                    const pair = [auts[i], auts[j]].sort().join('||');
                    coAuthors[pair] = (coAuthors[pair] || 0) + 1;
                }
            }
        });

        // Select top 22 authors who published most
        const topAuthors = Object.entries(authorPapers)
            .sort((a, b) => b[1].length - a[1].length)
            .slice(0, 22)
            .map(e => ({ name: e[0], count: e[1].length, papers: e[1] }));

        const topAuthorNames = topAuthors.map(a => a.name);

        // Calculate researcher influence (Gross citations)
        const authorCitations = {};
        topAuthors.forEach(a => {
            authorCitations[a.name] = a.papers.reduce((sum, p) => sum + (p.citations || 0), 0);
        });

        const maxCit = Math.max(...Object.values(authorCitations)) || 1;

        const nodes = new vis.DataSet(topAuthors.map(auth => {
            const cit = authorCitations[auth.name];
            // Hub researcher: published 3+ papers or top 30% citation score
            const isHub = auth.count >= 3 || (cit / maxCit) > 0.4;
            
            const tooltipText = `${auth.name}\n- 논문 수: ${auth.count}편\n- 총 피인용: ${cit}회`;

            return {
                id: auth.name,
                label: auth.name,
                value: auth.count,
                title: tooltipText,
                color: isHub ? {
                    background: 'rgba(236,72,153,0.15)',
                    border: C.pink,
                    highlight: { border: '#fff', background: 'rgba(236,72,153,0.3)' }
                } : {
                    background: 'rgba(16,185,129,0.1)',
                    border: '#10b981',
                    highlight: { border: '#fff', background: 'rgba(16,185,129,0.25)' }
                },
                font: { color: '#f8fafc', face: "'Noto Sans KR'", size: isHub ? 13 : 11, bold: isHub },
                shadow: { enabled: true, color: isHub ? 'rgba(236,72,153,0.6)' : 'rgba(16,185,129,0.4)', size: isHub ? 15 : 8 }
            };
        }));

        const edges = new vis.DataSet(
            Object.entries(coAuthors)
                .filter(([p]) => {
                    const [a, b] = p.split('||');
                    return topAuthorNames.includes(a) && topAuthorNames.includes(b);
                })
                .map(([p, v]) => {
                    const [a, b] = p.split('||');
                    return {
                        from: a,
                        to: b,
                        value: v,
                        width: v * 1.5,
                        color: { color: 'rgba(255, 255, 255, 0.15)', highlight: C.pink },
                        title: `공동 연구: ${v}편`
                    };
                })
        );

        networkInstance = new vis.Network(container, { nodes, edges }, {
            nodes: {
                shape: 'dot',
                scaling: { min: 10, max: 28 },
                borderWidth: 2
            },
            edges: {
                smooth: { type: 'continuous' }
            },
            physics: {
                barnesHut: { gravitationalConstant: -2000, springConstant: 0.02, centralGravity: 0.15 },
                stabilization: { iterations: 150 }
            },
            interaction: { hover: true, tooltipDelay: 100 }
        });
    }
}

/* ════════════════════════════════
   TABLE (with Favorites)
   ════════════════════════════════ */
function renderTable() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';
    tableData.forEach(item => {
        const isFav = favSet.has(item.title);
        const q = lastQuery;

        // Determine match source for badge
        const abstractMatched = q && searchFullText &&
            item.abstract && item.abstract.toLowerCase().includes(q) &&
            !(item.title && item.title.toLowerCase().includes(q)) &&
            !(item.authors && item.authors.some(a => a.toLowerCase().includes(q))) &&
            !(item.journal && item.journal.toLowerCase().includes(q));

        const kwMatched = q && searchFullText &&
            item.keywords && item.keywords.some(k => k.toLowerCase().includes(q)) &&
            !abstractMatched &&
            !(item.title && item.title.toLowerCase().includes(q));

        const titleHtml = highlightText(item.title || '', q);
        const authorsHtml = highlightText((item.authors||[]).join(', '), q);
        const journalHtml = highlightText(item.journal || '-', q);

        let matchBadge = '';
        if (abstractMatched) matchBadge = '<span class="match-badge abstract-badge">초록 매칭</span>';
        else if (kwMatched)   matchBadge = '<span class="match-badge kw-badge">키워드 매칭</span>';

        const tr = document.createElement('tr');
        if (isFav) tr.classList.add('favorited');
        tr.innerHTML = `
            <td class="td-title" title="${item.title}">${titleHtml}${matchBadge}</td>
            <td class="td-authors">${authorsHtml}</td>
            <td>${journalHtml}</td>
            <td>${item.year||'-'}</td>
            <td><span class="td-badge">${item.citations||0}</span></td>
            <td>
                <button class="fav-star ${isFav?'active':''}" data-title="${item.title}" title="${isFav?'찜 해제':'찜하기'}">
                    ${isFav?'♥':'♡'}
                </button>
            </td>`;

        // Row click → modal (except star button)
        tr.addEventListener('click', e => {
            if (e.target.closest('.fav-star')) return;
            openModal(item);
        });
        tbody.appendChild(tr);
    });

    // Star buttons
    tbody.querySelectorAll('.fav-star').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const title = btn.dataset.title;
            if (favSet.has(title)) {
                favSet.delete(title);
                showToast('찜 목록에서 제거되었습니다', false);
            } else {
                favSet.add(title);
                showToast('♥ 찜 목록에 추가되었습니다!', true);
            }
            localStorage.setItem('dc_favs', JSON.stringify([...favSet]));
            renderTable();
        });
    });
}

/* ════════════════════════════════
   HIGHLIGHT HELPER
   ════════════════════════════════ */
function highlightText(text, query) {
    if (!query || !text) return text || '';
    // Escape special regex chars in query
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(${escaped})`, 'gi');
    return text.replace(re, '<mark class="search-highlight">$1</mark>');
}

/* ════════════════════════════════
   MODAL
   ════════════════════════════════ */
function openModal(item) {
    document.getElementById('modal-year').textContent      = item.year || '-';
    document.getElementById('modal-citations').textContent = `인용 ${item.citations||0}회`;
    document.getElementById('modal-title').textContent     = item.title;
    document.getElementById('modal-authors').innerHTML     = `<i class="fa-solid fa-user-pen"></i> ${(item.authors||[]).join(', ')||'-'}`;
    document.getElementById('modal-journal').innerHTML     = `<i class="fa-solid fa-book"></i> ${item.journal||'-'}`;
    document.getElementById('modal-institution').innerHTML = `<i class="fa-solid fa-building-columns"></i> ${item.institution||'-'}`;
    document.getElementById('modal-keywords').innerHTML    =
        (item.keywords||[]).map(k=>`<span class="keyword-tag">${k}</span>`).join('');
    document.getElementById('modal-abstract').textContent  = item.abstract || '초록 정보가 없습니다.';

    // Reset copilot to Summary tab
    document.getElementById('copilotSummaryContent').classList.remove('hidden');
    document.getElementById('copilotQAContent').classList.add('hidden');
    document.getElementById('copilotTabSummary').classList.add('active');
    document.getElementById('copilotTabQA').classList.remove('active');
    document.getElementById('qaAnswerText').textContent = '위의 권장 질문을 클릭하면 AI 분석 답변이 출력됩니다.';
    document.getElementById('qaAnswerLoading').classList.add('hidden');

    populateCopilot(item);
    document.getElementById('paperModal').classList.add('open');
}

function closeModal() {
    document.getElementById('paperModal').classList.remove('open');
}

/* ════════════════════════════════
   AI PAPER COPILOT  — 3단 요약 + Q&A
   ════════════════════════════════ */
function populateCopilot(item) {
    const abstract  = (item.abstract || '').trim();
    const title     = item.title || '';
    const keywords  = (item.keywords || []).join(', ');
    const year      = item.year || '';
    const citations = item.citations || 0;

    // Heuristic NLP: split abstract into sentences
    const sentences = abstract
        ? abstract.replace(/([.!?])\s+/g, '$1|').split('|').map(s => s.trim()).filter(s => s.length > 10)
        : [];

    // 연구 목적: first 1-2 sentences
    let objective;
    if (sentences.length >= 1) {
        objective = sentences.slice(0, Math.min(2, sentences.length)).join(' ');
    } else {
        objective = `본 연구는 「${title}」를 중심 주제로 삼아 학술적 고찰을 시도합니다.`;
    }

    // 주요 기여: middle sentences
    let contribution;
    const midStart = Math.floor(sentences.length * 0.3);
    const midEnd   = Math.floor(sentences.length * 0.7);
    if (sentences.length >= 3) {
        contribution = sentences.slice(midStart, Math.max(midEnd, midStart + 2)).join(' ');
    } else if (keywords) {
        contribution = `[${keywords}] 키워드를 중심으로 기존 이론 체계를 재해석하며, 새로운 방법론적 관점과 학술적 논거를 제시합니다.`;
    } else {
        contribution = `기존 연구 담론에서 간과된 측면을 조명하며 학술적 논의에 새로운 관점을 더합니다.`;
    }

    // 학술적 의의: last sentence + citation context
    let significance;
    if (sentences.length >= 2) {
        significance = sentences[sentences.length - 1];
    } else {
        significance = `${year}년 발표 이후 총 ${citations}회 피인용된 본 연구는 해당 분야의 핵심 참조 문헌으로 자리매김하고 있습니다.`;
    }
    if (abstract && citations > 0) {
        significance += ` (발표 후 ${citations}회 피인용됨으로써 학계에서 지속적으로 참조되는 영향력 있는 문헌입니다.)`;
    }

    typewrite('summaryObjective',    objective);
    typewrite('summaryContribution', contribution);
    typewrite('summarySignificance', significance);

    // Cache paper data for Q&A
    const store = document.querySelector('.copilot-container').dataset;
    store.abstract  = abstract;
    store.title     = title;
    store.keywords  = keywords;
    store.citations = citations;
    store.year      = year;
}

function typewrite(elementId, text, speed = 18) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.textContent = '';
    let i = 0;
    const timer = setInterval(() => {
        if (i < text.length) { el.textContent += text[i++]; }
        else { clearInterval(timer); }
    }, speed);
}

function setupCopilotHandlers() {
    // Tab switching
    const tabSummary = document.getElementById('copilotTabSummary');
    const tabQA      = document.getElementById('copilotTabQA');
    const paneSum    = document.getElementById('copilotSummaryContent');
    const paneQA     = document.getElementById('copilotQAContent');

    if (tabSummary && tabQA) {
        tabSummary.addEventListener('click', () => {
            tabSummary.classList.add('active');    tabQA.classList.remove('active');
            paneSum.classList.remove('hidden');    paneQA.classList.add('hidden');
        });
        tabQA.addEventListener('click', () => {
            tabQA.classList.add('active');         tabSummary.classList.remove('active');
            paneQA.classList.remove('hidden');     paneSum.classList.add('hidden');
        });
    }

    // Q&A buttons
    document.querySelectorAll('.qa-q-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const qType    = btn.dataset.q;
            const store    = document.querySelector('.copilot-container').dataset;
            const abstract  = store.abstract  || '';
            const title     = store.title     || '';
            const keywords  = store.keywords  || '';
            const citations = store.citations || '0';
            const year      = store.year      || '';

            const answerEl  = document.getElementById('qaAnswerText');
            const loadingEl = document.getElementById('qaAnswerLoading');

            answerEl.textContent = '';
            loadingEl.classList.remove('hidden');

            setTimeout(() => {
                loadingEl.classList.add('hidden');

                const sentences = abstract
                    ? abstract.replace(/([.!?])\s+/g, '$1|').split('|').map(s => s.trim()).filter(s => s.length > 10)
                    : [];

                let answer = '';
                if (qType === '1') {
                    if (sentences.length >= 3) {
                        const core = sentences.slice(
                            Math.floor(sentences.length * 0.2),
                            Math.floor(sentences.length * 0.6)
                        ).join(' ');
                        answer = `📌 핵심 주장: ${core}`;
                    } else {
                        answer = `📌 이 논문의 핵심 주장은 [${keywords || title}]에 관한 기존 논의를 비판적으로 재검토하고, 새로운 이론적 틀을 제시하는 데 있습니다.`;
                    }
                } else if (qType === '2') {
                    if (parseInt(citations) >= 10) {
                        answer = `🏆 학술적 의의: ${year}년 발표된 이 연구는 ${citations}회 피인용되며 해당 분야의 핵심 참조 문헌으로 자리잡았습니다. 특히 [${keywords}] 담론 형성에 결정적인 기여를 한 것으로 평가됩니다.`;
                    } else {
                        answer = `🌱 학술적 의의: [${keywords || title}] 영역에서 기존 연구들이 다루지 못한 관점을 보완하며, 향후 관련 연구의 방향성을 제시합니다.`;
                    }
                    if (sentences.length > 0) {
                        answer += ` 원문: "${sentences[sentences.length - 1]}"`;
                    }
                } else if (qType === '3') {
                    answer = `🔬 보완 가능한 한계: 본 논문은 [${keywords || '해당 주제'}] 분야의 이론적 깊이를 강화하고 있으나, `
                        + (sentences.length > 0
                            ? `경험적·실증적 검증이 보완된다면 더욱 강력한 설득력을 가질 수 있습니다. 비교 연구(comparative study) 설계를 도입하여 타 사상 체계와의 대조 분석을 심화하는 후속 연구가 권장됩니다.`
                            : `초록 데이터가 제한적이어서 다학제적 접근과 실증 연구가 요구됩니다.`);
                }

                typewrite('qaAnswerText', answer, 14);
            }, 900 + Math.random() * 500);
        });
    });
}

/* ════════════════════════════════
   TOAST
   ════════════════════════════════ */
function showToast(msg, isFav=false) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = `toast show${isFav?' toast-fav':''}`;
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.className='toast', 2500);
}

/* ════════════════════════════════
   EVENT LISTENERS
   ════════════════════════════════ */
function setupEventListeners() {
    // Year sliders
    ['yearMin','yearMax'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => {
            updateYearLabel();
            applyFilters();
        });
    });

    // Search
    document.getElementById('searchInput').addEventListener('input', () => applyFilters());

    // Fav filter button
    document.getElementById('favFilterBtn').addEventListener('click', () => {
        showFavOnly = !showFavOnly;
        document.getElementById('favFilterBtn').classList.toggle('active', showFavOnly);
        applyFilters();
    });

    // Sort
    let sort = { col:null, dir:'asc' };
    document.querySelectorAll('th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.getAttribute('data-sort');
            document.querySelectorAll('th[data-sort] i').forEach(i=>i.className='fa-solid fa-sort');
            sort.dir = sort.col===col ? (sort.dir==='asc'?'desc':'asc') : 'asc';
            sort.col = col;
            th.querySelector('i').className = `fa-solid fa-sort-${sort.dir==='asc'?'up':'down'}`;
            tableData.sort((a,b) => {
                let va=a[col], vb=b[col];
                if (col==='authors') { va=(va||[]).join(','); vb=(vb||[]).join(','); }
                if (typeof va==='string') va=va.toLowerCase();
                if (typeof vb==='string') vb=vb.toLowerCase();
                va=va??''; vb=vb??'';
                return sort.dir==='asc'?(va<vb?-1:va>vb?1:0):(va>vb?-1:va<vb?1:0);
            });
            renderTable();
        });
    });

    // Expand buttons
    const overlay = document.getElementById('overlay');
    const closeExpanded = () => {
        document.querySelectorAll('.panel.expanded').forEach(p=>{
            p.classList.remove('expanded');
            p.style.transform='';
        });
        overlay.classList.remove('active');
        setTimeout(()=>window.dispatchEvent(new Event('resize')),400);
    };
    document.querySelectorAll('.expand-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const panel = e.currentTarget.closest('.panel');
            if (panel.classList.contains('expanded')) {
                closeExpanded();
                btn.innerHTML='<i class="fa-solid fa-expand"></i>';
            } else {
                panel.classList.add('expanded');
                overlay.classList.add('active');
                btn.innerHTML='<i class="fa-solid fa-compress"></i>';
                setTimeout(()=>window.dispatchEvent(new Event('resize')),400);
            }
        });
    });
    overlay.addEventListener('click', () => {
        closeExpanded();
        document.querySelectorAll('.expand-btn').forEach(b=>b.innerHTML='<i class="fa-solid fa-expand"></i>');
    });

    // Modal close
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('paperModal').addEventListener('click', e=>{
        if (e.target===document.getElementById('paperModal')) closeModal();
    });
    document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeModal(); });

    // Export CSV
    document.getElementById('exportBtn').addEventListener('click', () => {
        const orig = document.getElementById('exportBtn').innerHTML;
        document.getElementById('exportBtn').innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> EXPORTING…';
        setTimeout(()=>{
            const rows=[['Title','Authors','Journal','Year','Citations'].join(',')];
            tableData.forEach(r=>{
                rows.push([
                    `"${(r.title||'').replace(/"/g,'""')}"`,
                    `"${(r.authors||[]).join('; ')}"`,
                    `"${(r.journal||'')}"`,
                    r.year||'', r.citations||0
                ].join(','));
            });
            const blob=new Blob(['\uFEFF'+rows.join('\n')],{type:'text/csv;charset=utf-8;'});
            const a=document.createElement('a');
            a.href=URL.createObjectURL(blob);
            a.download='Descartes_Export.csv';
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            document.getElementById('exportBtn').innerHTML='<i class="fa-solid fa-check"></i> DONE';
            showToast('CSV 파일이 다운로드되었습니다');
        },800);
    });

    // Analyze Research Gap Button
    const analyzeBtn = document.getElementById('analyzeGapBtn');
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', () => {
            runGapAnalysis();
        });
    }

    // Map Mode Toggles
    const kwBtn = document.getElementById('mapModeKw');
    const authBtn = document.getElementById('mapModeAuth');
    if (kwBtn && authBtn) {
        kwBtn.addEventListener('click', () => {
            if (activeMapMode === 'keyword') return;
            activeMapMode = 'keyword';
            kwBtn.classList.add('active');
            authBtn.classList.remove('active');
            processNetwork();
        });
        authBtn.addEventListener('click', () => {
            if (activeMapMode === 'author') return;
            activeMapMode = 'author';
            authBtn.classList.add('active');
            kwBtn.classList.remove('active');
            processNetwork();
        });
    }

    // AI Paper Copilot handlers
    setupCopilotHandlers();
}

/* ════════════════════════════════
   PARTICLES
   ════════════════════════════════ */
function initParticles() {
    const canvas=document.getElementById('particleCanvas');
    const ctx=canvas.getContext('2d');
    let W,H,pts=[];

    function resize(){ W=canvas.width=window.innerWidth; H=canvas.height=window.innerHeight; }
    resize(); window.addEventListener('resize',resize);

    for(let i=0;i<90;i++) pts.push({
        x:Math.random()*2000, y:Math.random()*1200,
        vx:(Math.random()-.5)*.25, vy:(Math.random()-.5)*.25,
        r:Math.random()*1.5+.3, a:Math.random()
    });

    (function loop(){
        ctx.clearRect(0,0,W,H);
        pts.forEach(p=>{
            p.x+=p.vx; p.y+=p.vy;
            if(p.x<0||p.x>W) p.vx*=-1;
            if(p.y<0||p.y>H) p.vy*=-1;
            ctx.beginPath();
            ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
            ctx.fillStyle=`rgba(99,102,241,${p.a*0.6})`;
            ctx.fill();
        });
        // draw thin lines between close particles
        for(let i=0;i<pts.length;i++) for(let j=i+1;j<pts.length;j++){
            const dx=pts[i].x-pts[j].x, dy=pts[i].y-pts[j].y;
            const d=Math.sqrt(dx*dx+dy*dy);
            if(d<120){
                ctx.beginPath();
                ctx.moveTo(pts[i].x,pts[i].y);
                ctx.lineTo(pts[j].x,pts[j].y);
                ctx.strokeStyle=`rgba(99,102,241,${(1-d/120)*0.12})`;
                ctx.stroke();
            }
        }
        requestAnimationFrame(loop);
    })();
}

/* ────── animateValue ────── */
function animVal(id, start, end, dur, isFloat=false) {
    const el=document.getElementById(id); if(!el) return;
    let t0=null;
    (function step(ts){
        if(!t0) t0=ts;
        const p=Math.min((ts-t0)/dur,1);
        const e=1-Math.pow(1-p,3);
        el.textContent=isFloat?((start+(end-start)*e)).toFixed(1):Math.floor(start+(end-start)*e);
        if(p<1) requestAnimationFrame(step);
        else el.textContent=isFloat?end.toFixed(1):end;
    })(performance.now());
}

/* ════════════════════════════════
   AI RESEARCH GAP ANALYZER
   ════════════════════════════════ */
function runGapAnalysis() {
    const initState = document.getElementById('gapInitState');
    const scanningState = document.getElementById('gapScanningState');
    const resultsGrid = document.getElementById('gapResultsGrid');
    const log1 = document.getElementById('scanLog1');
    const log2 = document.getElementById('scanLog2');
    const log3 = document.getElementById('scanLog3');

    if (!initState || !scanningState || !resultsGrid) return;

    // UI state switch to scanning
    initState.classList.add('hidden');
    resultsGrid.classList.add('hidden');
    scanningState.classList.remove('hidden');

    log2.classList.add('hidden');
    log3.classList.add('hidden');

    // Simulate logs appearing sequentially with cyberpunk feeling
    setTimeout(() => {
        log2.classList.remove('hidden');
    }, 700);

    setTimeout(() => {
        log3.classList.remove('hidden');
    }, 1400);

    setTimeout(() => {
        scanningState.classList.add('hidden');
        resultsGrid.classList.remove('hidden');
        renderGapResults();
    }, 2200);
}

function renderGapResults() {
    const resultsGrid = document.getElementById('gapResultsGrid');
    if (!resultsGrid) return;

    if (tableData.length === 0) {
        resultsGrid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--accent-2); padding: 30px; font-weight: 500;">분석할 데이터가 존재하지 않습니다. 상단 연도 범위를 늘리거나 필터링 단어를 변경해 주세요.</div>`;
        return;
    }

    // 1. Keyword Frequency & Co-occurrence calculation
    const kwCounts = {};
    const coCounts = {};

    tableData.forEach(d => {
        const kws = (d.keywords || []).map(k => k.trim().toLowerCase()).filter(k => k);
        // Frequency
        kws.forEach(k => {
            kwCounts[k] = (kwCounts[k] || 0) + 1;
        });
        // Co-occurrence
        for (let i = 0; i < kws.length; i++) {
            for (let j = i + 1; j < kws.length; j++) {
                if (kws[i] === kws[j]) continue;
                const pair = [kws[i], kws[j]].sort().join('||');
                coCounts[pair] = (coCounts[pair] || 0) + 1;
            }
        }
    });

    // 2. Select top 15 keywords
    const topKeywords = Object.entries(kwCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(e => e[0]);

    if (topKeywords.length < 2) {
        resultsGrid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 30px;">수집된 키워드 모수가 부족하여 공백 분석을 실행할 수 없습니다. (키워드 2개 이상 필요)</div>`;
        return;
    }

    // 3. Find pairs with 0 or minimal co-occurrence
    const gapPairs = [];
    for (let i = 0; i < topKeywords.length; i++) {
        for (let j = i + 1; j < topKeywords.length; j++) {
            const kwA = topKeywords[i];
            const kwB = topKeywords[j];
            const pairKey = [kwA, kwB].sort().join('||');
            const coCount = coCounts[pairKey] || 0;

            if (coCount === 0) {
                // Gap Score = kwA count * kwB count
                // A와 B의 개별 출현 빈도가 높은데 동시 출현이 없을수록 큰 Gap
                const gapScore = kwCounts[kwA] * kwCounts[kwB];
                gapPairs.push({ kwA, kwB, gapScore });
            }
        }
    }

    // Sort by Gap Score descending
    gapPairs.sort((a, b) => b.gapScore - a.gapScore);

    // Get top 3
    let topGaps = gapPairs.slice(0, 3);

    if (topGaps.length === 0) {
        // Fallback: if no 0 co-occurrence, get lowest co-occurrence pairs
        const allPairs = [];
        for (let i = 0; i < topKeywords.length; i++) {
            for (let j = i + 1; j < topKeywords.length; j++) {
                const kwA = topKeywords[i];
                const kwB = topKeywords[j];
                const pairKey = [kwA, kwB].sort().join('||');
                const coCount = coCounts[pairKey] || 0;
                const gapScore = (kwCounts[kwA] * kwCounts[kwB]) / (coCount + 1);
                allPairs.push({ kwA, kwB, gapScore, coCount });
            }
        }
        allPairs.sort((a, b) => b.gapScore - a.gapScore);
        topGaps = allPairs.slice(0, Math.min(3, allPairs.length));
    }

    // Helper to format proper casing from original keywords
    const capitalize = (str) => {
        let original = str;
        for (let d of tableData) {
            const found = (d.keywords || []).find(k => k.trim().toLowerCase() === str);
            if (found) {
                original = found.trim();
                break;
            }
        }
        return original;
    };

    // Topic templates based on index/variety
    const templates = [
        {
            title: (a, b) => `데카르트 [${a}] 논의를 활용한 현대 [${b}] 패러다임 분석`,
            desc: (a, b) => `학계에서 각각 활발히 다뤄지는 [${a}]와(과) [${b}]의 이론적 전제들을 최초로 상호 교차하여 대조 분석하는 논문 주제입니다. 기존 연구가 간과했던 인지론적 또는 존재론적 사각지대를 혁신적으로 보완할 수 있습니다.`
        },
        {
            title: (a, b) => `[${a}]와 [${b}]의 융합을 통한 새로운 방법론적 패러다임 설계`,
            desc: (a, b) => `[${a}]의 근간이 되는 형이상학적 전제들을 [${b}]의 실천적 모델에 투영하여, 융합 학문적 시너지를 발휘하는 미답지의 학술적 지평을 제시하고 신규 학파의 초석을 다지는 방향을 추천합니다.`
        },
        {
            title: (a, b) => `현대 ${b} 연구에 미치는 ${a}의 역사적/이론적 영향력의 재해석`,
            desc: (a, b) => `[${a}]에 관한 고전적 해석을 현대 [${b}] 시스템의 맥락에서 재평가하는 연구입니다. 두 주제 사이에 수치적으로 포착된 공백을 메우는 학술적 가교 역할을 선도할 것입니다.`
        }
    ];

    resultsGrid.innerHTML = '';
    topGaps.forEach((gap, idx) => {
        const wordA = capitalize(gap.kwA);
        const wordB = capitalize(gap.kwB);
        const temp = templates[idx % templates.length];
        
        const titleText = temp.title(wordA, wordB);
        const descText = temp.desc(wordA, wordB);

        // Normalized score based on order
        const matchPct = 98 - (idx * 4) - Math.floor(Math.random() * 2);

        const card = document.createElement('div');
        card.className = 'gap-card';
        card.innerHTML = `
            <div class="gap-card-header">
                <span class="gap-badge">융합 후보 #${idx+1}</span>
                <span class="gap-score"><i class="fa-solid fa-wand-magic-sparkles"></i> 융합 적합도 ${matchPct}%</span>
            </div>
            <h3 class="gap-title">${titleText}</h3>
            <div class="gap-keywords-wrap">
                <span class="gap-key-tag">${wordA}</span>
                <span class="gap-key-tag vs">VS</span>
                <span class="gap-key-tag">${wordB}</span>
            </div>
            <p class="gap-desc">${descText}</p>
        `;
        resultsGrid.appendChild(card);
    });
}
