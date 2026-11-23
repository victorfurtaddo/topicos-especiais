'use strict';
const source = document.getElementById('chart-data');
async function renderCharts() {
  if (!source || typeof Chart === 'undefined') return;
  await document.fonts.ready;
  const series = JSON.parse(source.dataset.evolution);
  const money = value => new Intl.NumberFormat('pt-BR', {style: 'currency', currency: 'BRL'}).format(value);
  const colors = ['#8bbca3','#9eafc9','#b0a6c2','#c6b08b','#c29a99','#8cb5b8','#b6a0b3','#adb497','#8ea0b3','#b59b8b','#b8c0cb'];
  Chart.defaults.color = '#a8afb9';
  Chart.defaults.font.family = 'Open Sans, sans-serif';
  Chart.defaults.font.size = 12;
  const motion = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  new Chart(document.getElementById('evolution-chart'), {
    type: 'bar',
    data: {labels: series.labels, datasets: [
      {label: 'Receitas', data: series.income, backgroundColor: colors[0], borderRadius: 2, maxBarThickness: 19},
      {label: 'Despesas', data: series.expense, backgroundColor: colors[1], borderRadius: 2, maxBarThickness: 19}
    ]},
    options: {responsive: true, maintainAspectRatio: false, animation: motion ? {duration: 300} : false,
      plugins: {legend: {display: false}, tooltip: {callbacks: {label: item => `${item.dataset.label}: ${money(item.raw)}`}}},
      scales: {x: {grid: {display: false}, border: {display: false}}, y: {beginAtZero: true, grid: {color: '#333a43'}, border: {display: false}, ticks: {maxTicksLimit: 6, callback: value => money(value)}}}
    }
  });
  const donut = document.getElementById('category-chart');
  if (donut) new Chart(donut, {
    type: 'doughnut', data: {labels: JSON.parse(source.dataset.categories), datasets: [{data: JSON.parse(source.dataset.values), backgroundColor: colors, borderColor: '#1b2027', borderWidth: 4, hoverOffset: 3}]},
    options: {responsive: true, maintainAspectRatio: false, cutout: '80%', animation: motion ? {duration: 300} : false, plugins: {legend: {display: false}, tooltip: {callbacks: {label: item => `${item.label}: ${money(item.raw)}`}}}}
  });
}

renderCharts();
