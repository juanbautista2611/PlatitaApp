// Inicializar Supabase con tus credenciales públicas de la API
const SUPABASE_URL = 'https://dhmnbvwntcqmgwvbohdt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRobW5idndudGNxbWd3dmJvaGR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2OTAxMjEsImV4cCI6MjEwODI2NjEyMX0.rho1v1cyZYlUJFXmewHL8Xhp1MxG6KqepWeHxXaJ9Pw';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', () => {
  // 1. Actualizar la fecha del badge superior de manera automática
  actualizarFechaBadge();

  // 2. Ajustar la fecha actual en el input de transacciones
  const txDateInput = document.getElementById('tx-date');
  if (txDateInput) {
    txDateInput.value = new Date().toISOString().split('T')[0];
  }

  cargarDatosGenerales();
  // ... (el resto de tus eventos siguen igual)
});

// Función para mostrar la fecha de hoy automáticamente en formato corto (ej: 22 Oct 2026)
function actualizarFechaBadge() {
  const badge = document.getElementById('current-date-badge');
  if (badge) {
    const hoy = new Date();
    const opciones = { day: 'numeric', month: 'short', year: 'numeric' };
    // Esto se adapta automáticamente al idioma y mes actual
    badge.innerText = hoy.toLocaleDateString('es-ES', opciones).replace('.', '');
  }
}

// Función principal para refrescar toda la interfaz con datos de Supabase
async function cargarDatosGenerales() {
  try {
    const { data: transactions, error: txError } = await supabaseClient.from('transactions').select('*').order('date', { ascending: false });
    const { data: fixedExpenses, error: fxError } = await supabaseClient.from('fixed_expenses').select('*');
    const { data: goals, error: goalError } = await supabaseClient.from('goals').select('*');

    if (txError || fxError || goalError) {
      console.error('Error en Supabase:', txError || fxError || goalError);
    }

    renderizarPanel(transactions || [], fixedExpenses || [], goals || []);
  } catch (err) {
    console.error('Error cargando datos de Supabase:', err);
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

  // Renderizar Gastos Fijos
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

  // Renderizar Metas
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

  // Actualizar Balances
  document.getElementById('monthly-income').innerText = `$ ${totalIncome}`;
  document.getElementById('monthly-expenses').innerText = `$ ${totalExpense}`;
  document.getElementById('current-balance').innerText = `$ ${totalIncome - totalExpense}`;
  document.getElementById('free-disposable').innerText = `$ ${totalIncome - totalExpense}`;
}

// Funciones globales para botones interactivos
window.toggleFixed = async function(id, currentStatus) {
  const newStatus = currentStatus === 'pending' ? 'paid' : 'pending';
  const { error } = await supabaseClient.from('fixed_expenses').update({ status: newStatus }).eq('id', id);

  if (!error && newStatus === 'paid') {
    const { data: fxData } = await supabaseClient.from('fixed_expenses').select('*').eq('id', id).single();
    if (fxData) {
      const today = new Date().toISOString().split('T')[0];
      await supabaseClient.from('transactions').insert([{
        type: 'expense',
        category: fxData.name,
        amount: fxData.amount,
        date: today
      }]);
    }
  }
  cargarDatosGenerales();
};

window.deleteFixed = async function(id) {
  if (confirm('¿Eliminar este gasto fijo?')) {
    await supabaseClient.from('fixed_expenses').delete().eq('id', id);
    cargarDatosGenerales();
  }
};