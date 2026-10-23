const SUPABASE_URL = 'https://dhmnbvwntcqmgwvbohdt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRobW5idndudGNxbWd3dmJvaGR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2OTAxMjEsImV4cCI6MjEwODI2NjEyMX0.rho1v1cyZYlUJFXmewHL8Xhp1MxG6KqepWeHxXaJ9Pw';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let mainDoughnutChart = null;
let dailyTrendChart = null;

function formatearDinero(monto) {
  if (isNaN(monto) || monto === null) return '$ 0';
  return Number(monto).toLocaleString('es-AR', {
    style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 0
  });
}

function formatearInputMoneda(input) {
  let valorLimpiado = input.value.replace(/\D/g, '');
  if (valorLimpiado === '') {
    input.value = '';
    return;
  }
  let numeroFormateado = Number(valorLimpiado).toLocaleString('es-AR');
  input.value = `$ ${numeroFormateado}`;
}

function limpiarMonto(valorString) {
  if (!valorString) return 0;
  let limpio = valorString.toString().replace(/\D/g, '');
  return parseFloat(limpio) || 0;
}

document.addEventListener('DOMContentLoaded', async () => {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    window.location.href = 'index.html';
    return;
  }

  if (user.user_metadata && user.user_metadata.full_name) {
    const greetingSub = document.getElementById('user-greeting-sub');
    if (greetingSub) {
      greetingSub.innerText = `Hola, ${user.user_metadata.full_name}`;
    }
  }

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await supabaseClient.auth.signOut();
      window.location.href = 'index.html';
    });
  }

  actualizarFechaBadge();

  const filterMonthInput = document.getElementById('filter-month');
  const hoy = new Date();
  const mesActualStr = hoy.toISOString().slice(0, 7);
  if (filterMonthInput) {
    filterMonthInput.value = mesActualStr;
    filterMonthInput.addEventListener('change', () => {
      cargarDatosGenerales();
    });
  }

  cargarDatosGenerales();
  verificarAlertasVencimientos();

  // Carga rápida de sueldo/ingreso directo en app.html
  const quickIncomeForm = document.getElementById('quick-income-form');
  if (quickIncomeForm) {
    quickIncomeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const amount = limpiarMonto(document.getElementById('quick-income-amount').value);
      const fechaHoy = new Date().toISOString().split('T')[0];

      if (amount <= 0) return;

      const { error } = await supabaseClient
        .from('transactions')
        .insert([{ type: 'income', category: 'Sueldo', amount: Math.round(amount), date: fechaHoy }]);

      if (error) {
        alert('Error al registrar sueldo: ' + error.message);
      } else {
        quickIncomeForm.reset();
        alert('¡Sueldo / Ingreso cargado con éxito!');
        cargarDatosGenerales();
      }
    });
  }
});

async function verificarAlertasVencimientos() {
  const section = document.getElementById('alerts-widget-section');
  const container = document.getElementById('alerts-container');
  if (!section || !container) return;

  const { data: events } = await supabaseClient.from('calendar_events').select('*').eq('status', 'pending');
  if (!events || events.length === 0) {
    section.style.display = 'none';
    return;
  }

  const hoyStr = new Date().toISOString().split('T')[0];
  const hoyDate = new Date(hoyStr);

  const proximos = events.filter(ev => {
    const vencDate = new Date(ev.due_date);
    const diffTime = vencDate - hoyDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 4;
  });

  if (proximos.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  container.innerHTML = '';
  proximos.forEach(ev => {
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; justify-content: space-between; align-items: center; background: rgba(15, 23, 42, 0.4); padding: 0.4rem 0.6rem; border-radius: 0.3rem;';
    row.innerHTML = `
      <span><strong>${ev.title}</strong> (${formatearDinero(ev.amount)})</span>
      <span style="color: #f87171; font-weight: 600;">Vence: ${ev.due_date}</span>
    `;
    container.appendChild(row);
  });
}

function actualizarFechaBadge() {
  const badge = document.getElementById('current-date-badge');
  if (badge) {
    const hoy = new Date();
    const opciones = { day: 'numeric', month: 'short', year: 'numeric' };
    badge.innerText = hoy.toLocaleDateString('es-ES', opciones).replace('.', '');
  }
}

async function cargarDatosGenerales() {
  try {
    const filterMonthInput = document.getElementById('filter-month');
    const selectedMonth = filterMonthInput ? filterMonthInput.value : new Date().toISOString().slice(0, 7);

    const { data: transactions } = await supabaseClient.from('transactions').select('*').order('date', { ascending: false });
    const { data: fixedExpenses } = await supabaseClient.from('fixed_expenses').select('*');
    const { data: goals } = await supabaseClient.from('goals').select('*');

    const txFiltradas = (transactions || []).filter(tx => tx.date && tx.date.startsWith(selectedMonth));

    renderizarPanel(txFiltradas, fixedExpenses || [], goals || [], selectedMonth);
  } catch (err) {
    console.error('Error cargando datos:', err);
  }
}

function renderizarPanel(transactions, fixedExpenses, goals, selectedMonth) {
  let totalIncome = 0;
  let totalExpense = 0;
  const gastosPorCategoria = {};
  const gastosDiarios = {};

  const movementsList = document.getElementById('movements-list');
  if (movementsList) {
    movementsList.innerHTML = '';
    if (transactions.length === 0) {
      movementsList.innerHTML = '<li>No hay movimientos registrados en este período.</li>';
    } else {
      transactions.forEach(tx => {
        if (tx.type === 'income') {
          totalIncome += Number(tx.amount);
        } else {
          totalExpense += Number(tx.amount);
          const cat = tx.category.trim();
          gastosPorCategoria[cat] = (gastosPorCategoria[cat] || 0) + Number(tx.amount);

          const dia = tx.date;
          gastosDiarios[dia] = (gastosDiarios[dia] || 0) + Number(tx.amount);
        }

        const li = document.createElement('li');
        li.className = 'fixed-item-row';
        li.innerHTML = `
          <div class="fixed-info">
            <strong>${tx.category}</strong>
            <span style="font-size: 0.7rem; color: #94a3b8;">(${tx.date})</span>
            <span class="${tx.type === 'income' ? 'income-amount' : 'expense-amount'}">${tx.type === 'income' ? '+' : '-'}${formatearDinero(tx.amount)}</span>
          </div>
          <div class="fixed-actions">
            <button class="btn-delete-fixed" onclick="deleteTransaction(${tx.id})" title="Eliminar movimiento">🗑️</button>
          </div>
        `;
        movementsList.appendChild(li);
      });
    }
  }

  if (fixedExpenses) {
    fixedExpenses.forEach(fx => {
      if (fx.status === 'paid') {
        totalExpense += Number(fx.amount);
        gastosPorCategoria['Gastos Fijos'] = (gastosPorCategoria['Gastos Fijos'] || 0) + Number(fx.amount);
      }
    });
  }

  if (goals && goals.length > 0) {
    const goal = goals[0];
    document.getElementById('goal-title-display').innerText = goal.title;
    document.getElementById('goal-amount-display').innerText = `${formatearDinero(goal.current_amount)} / ${formatearDinero(goal.target_amount)}`;
    const percent = Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100) || 0);
    document.getElementById('goal-progress-fill').style.width = `${percent}%`;
  } else {
    document.getElementById('goal-title-display').innerText = 'Ahorro objetivo';
    document.getElementById('goal-amount-display').innerText = '$ 0';
    document.getElementById('goal-progress-fill').style.width = '0%';
  }

  document.getElementById('monthly-income').innerText = formatearDinero(totalIncome);
  document.getElementById('monthly-expenses').innerText = formatearDinero(totalExpense);
  document.getElementById('current-balance').innerText = formatearDinero(totalIncome - totalExpense);

  renderizarGraficoCategorias(gastosPorCategoria);
  renderizarGraficoTendenciaDiaria(gastosDiarios, selectedMonth);
}

function renderizarGraficoCategorias(gastosMap) {
  const canvasElement = document.getElementById('mainCategoriesChart');
  const statusContainer = document.getElementById('category-budgets-status');
  if (!canvasElement || !statusContainer) return;

  const ctx = canvasElement.getContext('2d');
  const labels = Object.keys(gastosMap);
  const dataValues = Object.values(gastosMap);

  statusContainer.innerHTML = '';

  if (labels.length === 0) {
    statusContainer.innerHTML = '<span style="text-align:center; color:#64748b; display:block; padding: 0.5rem;">No hay gastos en este período.</span>';
    if (mainDoughnutChart) mainDoughnutChart.destroy();
    return;
  }

  labels.forEach(cat => {
    const gastado = gastosMap[cat];
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.justifyContent = 'space-between';
    row.style.alignItems = 'center';
    row.innerHTML = `
      <strong style="color: #f1f5f9;">${cat}:</strong>
      <span style="color: #38bdf8; font-weight: 600;">${formatearDinero(gastado)}</span>
    `;
    statusContainer.appendChild(row);
  });

  const palette = ['#3b82f6', '#34d399', '#c084fc', '#fbbf24', '#38bdf8', '#fb7185', '#a855f7'];
  const backgroundColors = labels.map((_, i) => palette[i % palette.length]);

  if (mainDoughnutChart) mainDoughnutChart.destroy();
  mainDoughnutChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: dataValues,
        backgroundColor: backgroundColors,
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#94a3b8', font: { size: 10 }, boxWidth: 10 }
        }
      }
    }
  });
}

function renderizarGraficoTendenciaDiaria(gastosDiariosMap, selectedMonth) {
  const canvasElement = document.getElementById('dailyTrendChart');
  if (!canvasElement) return;

  const ctx = canvasElement.getContext('2d');
  const [anio, mes] = selectedMonth.split('-');
  const diasEnMes = new Date(anio, mes, 0).getDate();

  const labels = [];
  const dataValues = [];
  let acumulado = 0;

  for (let d = 1; d <= diasEnMes; d++) {
    const diaStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
    labels.push(d);
    if (gastosDiariosMap[diaStr]) {
      acumulado += gastosDiariosMap[diaStr];
    }
    dataValues.push(acumulado);
  }

  if (dailyTrendChart) dailyTrendChart.destroy();
  dailyTrendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Gasto Acumulado ($)',
        data: dataValues,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointRadius: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          ticks: { color: '#94a3b8', font: { size: 9 } },
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        },
        y: {
          ticks: { color: '#94a3b8', font: { size: 9 } },
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        }
      }
    }
  });
}

window.deleteTransaction = async function(id) {
  if (confirm('¿Estás seguro de eliminar este movimiento?')) {
    const { error } = await supabaseClient.from('transactions').delete().eq('id', id);
    if (error) {
      alert('Error al eliminar: ' + error.message);
    } else {
      cargarDatosGenerales();
    }
  }
};