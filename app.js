const SUPABASE_URL = 'https://dhmnbvwntcqmgwvbohdt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRobW5idndudGNxbWd3dmJvaGR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2OTAxMjEsImV4cCI6MjEwODI2NjEyMX0.rho1v1cyZYlUJFXmewHL8Xhp1MxG6KqepWeHxXaJ9Pw';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let mainDoughnutChart = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Lógica de Modo Oscuro / Modo Claro
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const currentTheme = localStorage.getItem('platita_theme') || 'dark';

  if (currentTheme === 'light') {
    document.body.classList.add('light-mode');
    if (themeToggleBtn) themeToggleBtn.innerText = '☀️';
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      document.body.classList.toggle('light-mode');
      const isLight = document.body.classList.contains('light-mode');
      localStorage.setItem('platita_theme', isLight ? 'light' : 'dark');
      themeToggleBtn.innerText = isLight ? '☀️' : '🌙';
    });
  }
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

  const txDateInput = document.getElementById('tx-date');
  if (txDateInput) {
    txDateInput.value = hoy.toISOString().split('T')[0];
  }

  await cargarCategorias();
  cargarDatosGenerales();

  const txTypeSelect = document.getElementById('tx-type');
  if (txTypeSelect) {
    txTypeSelect.addEventListener('change', () => cargarCategorias());
  }

  // Crear categoría personalizada
  const categoryForm = document.getElementById('category-form');
  if (categoryForm) {
    categoryForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('new-cat-name').value.trim();
      const type = document.getElementById('tx-type').value;

      if (!name) return;

      const { error } = await supabaseClient
        .from('user_categories')
        .insert([{ name, type }]);

      if (error) {
        alert('Error al crear categoría: ' + error.message);
      } else {
        document.getElementById('new-cat-name').value = '';
        await cargarCategorias();
        alert('¡Categoría creada con éxito!');
      }
    });
  }

  // Registrar presupuesto máximo por categoría
  const budgetForm = document.getElementById('budget-form');
  if (budgetForm) {
    budgetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const category_name = document.getElementById('budget-category').value;
      const max_budget = parseFloat(document.getElementById('budget-max').value);

      if (!category_name) {
        alert('Seleccioná una categoría.');
        return;
      }

      await supabaseClient.from('category_budgets').delete().eq('category_name', category_name);
      const { error } = await supabaseClient
        .from('category_budgets')
        .insert([{ category_name, max_budget: Math.round(max_budget) }]);

      if (error) alert('Error al guardar presupuesto: ' + error.message);
      else {
        budgetForm.reset();
        alert('¡Presupuesto fijado con éxito!');
        cargarDatosGenerales();
      }
    });
  }

  // Registrar Operación Manual
  const txForm = document.getElementById('transaction-form');
  if (txForm) {
    txForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const type = document.getElementById('tx-type').value;
      const category = document.getElementById('tx-category').value;
      const amount = parseFloat(document.getElementById('tx-amount').value);
      const date = document.getElementById('tx-date').value;

      if (!category) {
        alert('Por favor seleccioná una categoría.');
        return;
      }

      const { error } = await supabaseClient
        .from('transactions')
        .insert([{ type, category, amount: Math.round(amount), date }]);

      if (error) alert('Error: ' + error.message);
      else {
        txForm.reset();
        if (txDateInput) txDateInput.value = new Date().toISOString().split('T')[0];
        cargarDatosGenerales();
      }
    });
  }

  // Registrar Gasto Fijo
  const fixedForm = document.getElementById('fixed-form');
  if (fixedForm) {
    fixedForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('fx-name').value;
      const amount = parseFloat(document.getElementById('fx-amount').value);

      const { error } = await supabaseClient
        .from('fixed_expenses')
        .insert([{ name, amount: Math.round(amount), category: 'Fijo', status: 'pending' }]);

      if (error) alert('Error: ' + error.message);
      else {
        fixedForm.reset();
        cargarDatosGenerales();
      }
    });
  }

  // Registrar Meta de Ahorro
  const goalForm = document.getElementById('goal-form');
  if (goalForm) {
    goalForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('goal-title').value;
      const target_amount = parseFloat(document.getElementById('goal-target').value);
      const current_amount = parseFloat(document.getElementById('goal-current').value);

      await supabaseClient.from('goals').delete().neq('id', 0);
      const { error } = await supabaseClient
        .from('goals')
        .insert([{ title, target_amount: Math.round(target_amount), current_amount: Math.round(current_amount) }]);

      if (error) alert('Error: ' + error.message);
      else {
        goalForm.reset();
        cargarDatosGenerales();
      }
    });
  }

  // Aportar a la Meta de Ahorro
  const aportarAhorroForm = document.getElementById('aportar-ahorro-form');
  if (aportarAhorroForm) {
    aportarAhorroForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const montoAporte = parseFloat(document.getElementById('aporte-amount').value);

      if (isNaN(montoAporte) || montoAporte <= 0) {
        alert('Ingresá un monto válido.');
        return;
      }

      const { data: goals, error: fetchError } = await supabaseClient.from('goals').select('*');
      if (fetchError || !goals || goals.length === 0) {
        alert('Primero debés definir una meta de ahorro arriba.');
        return;
      }

      const goal = goals[0];
      const nuevoMontoActual = Number(goal.current_amount) + Math.round(montoAporte);

      const { error: updateError } = await supabaseClient
        .from('goals')
        .update({ current_amount: nuevoMontoActual })
        .eq('id', goal.id);

      if (updateError) {
        alert('Error al actualizar el ahorro: ' + updateError.message);
      } else {
        aportarAhorroForm.reset();
        alert(`¡Excelente! Se sumaron $${Math.round(montoAporte)} a tu ahorro.`);
        cargarDatosGenerales();
      }
    });
  }

  // Reiniciar Mes
  const resetBtn = document.getElementById('reset-month-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if (confirm('¿Estás seguro de iniciar un nuevo mes? Se borrarán tus movimientos y se destildarán tus fijos.')) {
        await supabaseClient.from('transactions').delete().neq('id', 0);
        await supabaseClient.from('fixed_expenses').update({ status: 'pending' }).neq('id', 0);
        cargarDatosGenerales();
      }
    });
  }
});

async function cargarCategorias() {
  const type = document.getElementById('tx-type').value;
  const selectCat = document.getElementById('tx-category');
  const selectBudgetCat = document.getElementById('budget-category');

  const { data: cats } = await supabaseClient
    .from('user_categories')
    .select('*')
    .eq('type', type);

  let lista = cats || [];
  if (lista.length === 0) {
    lista = type === 'expense' 
      ? [{name: 'Alimentos'}, {name: 'Servicios'}, {name: 'Transporte'}, {name: 'Entretenimiento'}]
      : [{name: 'Sueldo'}, {name: 'Freelance'}, {name: 'Ventas'}, {name: 'Otros'}];
  }

  if (selectCat) {
    selectCat.innerHTML = '<option value="">Seleccioná categoría...</option>';
    lista.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.name;
      opt.innerText = c.name;
      selectCat.appendChild(opt);
    });
  }

  if (selectBudgetCat) {
    const { data: expenseCats } = await supabaseClient.from('user_categories').select('*').eq('type', 'expense');
    let listaExp = expenseCats || [];
    if (listaExp.length === 0) listaExp = [{name: 'Alimentos'}, {name: 'Servicios'}, {name: 'Transporte'}, {name: 'Entretenimiento'}];

    selectBudgetCat.innerHTML = '<option value="">Seleccionar categoría de gasto...</option>';
    listaExp.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.name;
      opt.innerText = c.name;
      selectBudgetCat.appendChild(opt);
    });
  }
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
    const { data: budgets } = await supabaseClient.from('category_budgets').select('*');

    const txFiltradas = (transactions || []).filter(tx => tx.date && tx.date.startsWith(selectedMonth));

    renderizarPanel(txFiltradas, fixedExpenses || [], goals || [], budgets || []);
  } catch (err) {
    console.error('Error cargando datos:', err);
  }
}

function renderizarPanel(transactions, fixedExpenses, goals, budgets) {
  let totalIncome = 0;
  let totalExpense = 0;
  const gastosPorCategoria = {};

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
        }

        const li = document.createElement('li');
        li.className = 'fixed-item-row';
        li.innerHTML = `
          <div class="fixed-info">
            <strong>${tx.category}</strong>
            <span style="font-size: 0.7rem; color: #94a3b8;">(${tx.date})</span>
            <span class="${tx.type === 'income' ? 'income-amount' : 'expense-amount'}">${tx.type === 'income' ? '+' : '-'}$ ${tx.amount}</span>
          </div>
          <div class="fixed-actions">
            <button class="btn-delete-fixed" onclick="deleteTransaction(${tx.id})" title="Eliminar movimiento">🗑️</button>
          </div>
        `;
        movementsList.appendChild(li);
      });
    }
  }

  const fixedList = document.getElementById('fixed-list');
  if (fixedList) {
    fixedList.innerHTML = '';
    if (fixedExpenses.length === 0) {
      fixedList.innerHTML = '<li>No hay compromisos fijos.</li>';
    } else {
      fixedExpenses.forEach(fx => {
        if (fx.status === 'paid') {
          totalExpense += Number(fx.amount);
          gastosPorCategoria['Gastos Fijos'] = (gastosPorCategoria['Gastos Fijos'] || 0) + Number(fx.amount);
        }

        const li = document.createElement('li');
        li.className = 'fixed-item-row';
        li.innerHTML = `
          <div class="fixed-info">
            <strong>${fx.name}</strong>
            <span class="${fx.status === 'paid' ? 'expense-amount-green' : 'expense-amount-red'}">$ ${fx.amount}</span>
          </div>
          <div class="fixed-actions">
            <button class="${fx.status === 'pending' ? 'badge-pending' : 'badge-paid'}" onclick="toggleFixed(${fx.id}, '${fx.status}')">
              ${fx.status === 'pending' ? 'Pagar' : 'Pagado'}
            </button>
            <button class="btn-delete-fixed" onclick="deleteFixed(${fx.id})">🗑️</button>
          </div>
        `;
        fixedList.appendChild(li);
      });
    }
  }

  if (goals && goals.length > 0) {
    const goal = goals[0];
    document.getElementById('goal-title-display').innerText = goal.title;
    document.getElementById('goal-amount-display').innerText = `$ ${goal.current_amount} / ${goal.target_amount}`;
    const percent = Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100) || 0);
    document.getElementById('goal-progress-fill').style.width = `${percent}%`;
  } else {
    document.getElementById('goal-title-display').innerText = 'Ahorro objetivo';
    document.getElementById('goal-amount-display').innerText = '$ 0';
    document.getElementById('goal-progress-fill').style.width = '0%';
  }

  document.getElementById('monthly-income').innerText = `$ ${totalIncome}`;
  document.getElementById('monthly-expenses').innerText = `$ ${totalExpense}`;
  document.getElementById('current-balance').innerText = `$ ${totalIncome - totalExpense}`;
  document.getElementById('free-disposable').innerText = `$ ${totalIncome - totalExpense}`;

  renderizarGraficoCategorias(gastosPorCategoria, budgets || []);
}

function renderizarGraficoCategorias(gastosMap, budgets) {
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
    const presupuestoObj = budgets.find(b => b.category_name === cat);
    
    let estadoTexto = `$ ${gastado} gastados`;
    let colorTexto = '#94a3b8';

    if (presupuestoObj) {
      const limite = presupuestoObj.max_budget;
      const porcentaje = (gastado / limite) * 100;
      if (porcentaje >= 100) {
        estadoTexto = `$ ${gastado} / $ ${limite} (⚠️ ¡Límite superado!)`;
        colorTexto = '#f87171';
      } else if (porcentaje >= 80) {
        estadoTexto = `$ ${gastado} / $ ${limite} (⚡ Cerca del límite)`;
        colorTexto = '#fbbf24';
      } else {
        estadoTexto = `$ ${gastado} / $ ${limite} (Restan $ ${limite - gastado})`;
        colorTexto = '#34d399';
      }
    }

    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.justifyContent = 'space-between';
    row.style.alignItems = 'center';
    row.innerHTML = `
      <strong style="color: #f1f5f9;">${cat}:</strong>
      <span style="color: ${colorTexto}; font-weight: 600;">${estadoTexto}</span>
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

window.toggleFixed = async function(id, currentStatus) {
  const newStatus = currentStatus === 'pending' ? 'paid' : 'pending';
  await supabaseClient.from('fixed_expenses').update({ status: newStatus }).eq('id', id);
  cargarDatosGenerales();
};

window.deleteFixed = async function(id) {
  if (confirm('¿Eliminar este gasto fijo?')) {
    await supabaseClient.from('fixed_expenses').delete().eq('id', id);
    cargarDatosGenerales();
  }
};

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