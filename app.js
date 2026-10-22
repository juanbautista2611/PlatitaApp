// Inicializar Supabase con tus credenciales públicas de la API
const SUPABASE_URL = 'https://dhmnbvwntcqmgwvbohdt.supabase.co'; // Ej: https://tu-proyecto.supabase.co
const SUPABASE_ANON_KEY = 'sb_publishable_vmWeDJXqZDwG7Ua2sE6NfQ_m2zIJjlf'; // Tu clave anon public

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', () => {
  cargarDatosGenerales();

  // Evento para registrar transacciones
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

      if (error) {
        alert('Error al registrar: ' + error.message);
      } else {
        txForm.reset();
        cargarDatosGenerales();
      }
    });
  }

  // Evento para gastos fijos
  const fixedForm = document.getElementById('fixed-form');
  if (fixedForm) {
    fixedForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('fx-name').value;
      const amount = parseFloat(document.getElementById('fx-amount').value);

      const { error } = await supabaseClient
        .from('fixed_expenses')
        .insert([{ name, amount: Math.round(amount), category: 'Fijo', status: 'pending' }]);

      if (error) {
        alert('Error al guardar gasto fijo: ' + error.message);
      } else {
        fixedForm.reset();
        cargarDatosGenerales();
      }
    });
  }

  // Evento para metas de ahorro
  const goalForm = document.getElementById('goal-form');
  if (goalForm) {
    goalForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('goal-title').value;
      const target_amount = parseFloat(document.getElementById('goal-target').value);
      const current_amount = parseFloat(document.getElementById('goal-current').value);

      // Limpiamos metas anteriores y guardamos la nueva
      await supabaseClient.from('goals').delete().neq('id', 0);
      const { error } = await supabaseClient
        .from('goals')
        .insert([{ title, target_amount: Math.round(target_amount), current_amount: Math.round(current_amount) }]);

      if (error) {
        alert('Error al actualizar meta: ' + error.message);
      } else {
        goalForm.reset();
        cargarDatosGenerales();
      }
    });
  }

  // Botón de reinicio mensual
  const resetBtn = document.getElementById('reset-month-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if (confirm('¿Estás seguro de iniciar un nuevo mes? Se borrarán los movimientos y se destildarán los fijos.')) {
        await supabaseClient.from('transactions').delete().neq('id', 0);
        await supabaseClient.from('fixed_expenses').update({ status: 'pending' }).neq('id', 0);
        cargarDatosGenerales();
      }
    });
  }
});

// Función principal para refrescar toda la interfaz con datos de Supabase
async function cargarDatosGenerales() {
  try {
    // 1. Obtener Transacciones
    const { data: transactions } = await supabaseClient.from('transactions').select('*').order('date', { ascending: false });
    
    // 2. Obtener Gastos Fijos
    const { data: fixedExpenses } = await supabaseClient.from('fixed_expenses').select('*');

    // 3. Obtener Metas
    const { data: goals } = await supabaseClient.from('goals').select('*');

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
          <span class="${tx.type}">${tx.type === 'income' ? '+' : '-'}$ ${tx.amount}</span>
        `;
        movementsList.appendChild(li);
      });
    }
  }

  // Renderizar Gastos Fijos
  const fixedList = document.getElementById('fixed-list');
  if (fixedList) {
    fixedList.innerHTML = '';
    fixedExpenses.forEach(fx => {
      if (fx.status === 'paid') totalExpense += Number(fx.amount);

      const li = document.createElement('li');
      li.innerHTML = `
        <span>${fx.name} - $ ${fx.amount} (${fx.status})</span>
        <button onclick="toggleFixed(${fx.id}, '${fx.status}')">${fx.status === 'pending' ? 'Pagar' : 'Pendiente'}</button>
      `;
      fixedList.appendChild(li);
    });
  }

  // Renderizar Metas
  if (goals && goals.length > 0) {
    const goal = goals[0];
    document.getElementById('goal-title-display').innerText = goal.title;
    document.getElementById('goal-amount-display').innerText = `$ ${goal.current_amount} / ${goal.target_amount}`;
    const percent = Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100) || 0);
    document.getElementById('goal-progress-fill').style.width = `${percent}%`;
  }

  // Actualizar Balances
  document.getElementById('monthly-income').innerText = `$ ${totalIncome}`;
  document.getElementById('monthly-expenses').innerText = `$ ${totalExpense}`;
  document.getElementById('current-balance').innerText = `$ ${totalIncome - totalExpense}`;
  document.getElementById('free-disposable').innerText = `$ ${totalIncome - totalExpense}`;
}

// Función global para alternar estado de gasto fijo
window.toggleFixed = async function(id, currentStatus) {
  const newStatus = currentStatus === 'pending' ? 'paid' : 'pending';
  await supabaseClient.from('fixed_expenses').update({ status: newStatus }).eq('id', id);

  if (newStatus === 'paid') {
    const fxData = await supabaseClient.from('fixed_expenses').select('*').eq('id', id).single();
    if (fxData.data) {
      const today = new Date().toISOString().split('T')[0];
      await supabaseClient.from('transactions').insert([{
        type: 'expense',
        category: fxData.data.name,
        amount: fxData.data.amount,
        date: today
      }]);
    }
  }
  cargarDatosGenerales();
};