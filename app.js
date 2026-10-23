const SUPABASE_URL = 'https://dhmnbvwntcqmgwvbohdt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRobW5idndudGNxbWd3dmJvaGR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2OTAxMjEsImV4cCI6MjEwODI2NjEyMX0.rho1v1cyZYlUJFXmewHL8Xhp1MxG6KqepWeHxXaJ9Pw';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', async () => {
  // Verificar si hay usuario con sesión activa, si no, redirigir al login (index.html)
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    window.location.href = 'index.html';
    return;
  }

  // Mostrar Nombre de Usuario personalizado en el saludo del header
  if (user.user_metadata && user.user_metadata.full_name) {
    const greetingSub = document.getElementById('user-greeting-sub');
    if (greetingSub) {
      greetingSub.innerText = `Hola, ${user.user_metadata.full_name}`;
    }
  }

  // Botón Salir / Logout
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await supabaseClient.auth.signOut();
      window.location.href = 'index.html';
    });
  }

  actualizarFechaBadge();

  const txDateInput = document.getElementById('tx-date');
  if (txDateInput) {
    txDateInput.value = new Date().toISOString().split('T')[0];
  }

  cargarDatosGenerales();

  // Registrar Operación Manual
  const txForm = document.getElementById('transaction-form');
  if (txForm) {
    txForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const type = document.getElementById('tx-type').value;
      const category = document.getElementById('tx-category').value;
      const amount = parseFloat(document.getElementById('tx-amount').value);
      const date = document.getElementById('tx-date').value;

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
    const { data: transactions } = await supabaseClient.from('transactions').select('*').order('date', { ascending: false });
    const { data: fixedExpenses } = await supabaseClient.from('fixed_expenses').select('*');
    const { data: goals } = await supabaseClient.from('goals').select('*');

    renderizarPanel(transactions || [], fixedExpenses || [], goals || []);
  } catch (err) {
    console.error('Error cargando datos:', err);
  }
}

function renderizarPanel(transactions, fixedExpenses, goals) {
  let totalIncome = 0;
  let totalExpense = 0;

  const movementsList = document.getElementById('movements-list');
  if (movementsList) {
    movementsList.innerHTML = '';
    if (transactions.length === 0) {
      movementsList.innerHTML = '<li>No hay movimientos registrados.</li>';
    } else {
      transactions.forEach(tx => {
        if (tx.type === 'income') totalIncome += Number(tx.amount);
        else totalExpense += Number(tx.amount);

        const li = document.createElement('li');
        li.innerHTML = `
          <span><b>${tx.category}</b> (${tx.date})</span>
          <span class="${tx.type === 'income' ? 'income-amount' : 'expense-amount'}">${tx.type === 'income' ? '+' : '-'}$ ${tx.amount}</span>
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
        if (fx.status === 'paid') totalExpense += Number(fx.amount);

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