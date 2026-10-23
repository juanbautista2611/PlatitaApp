const SUPABASE_URL = 'https://dhmnbvwntcqmgwvbohdt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRobW5idndudGNxbWd3dmJvaGR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2OTAxMjEsImV4cCI6MjEwODI2NjEyMX0.rho1v1cyZYlUJFXmewHL8Xhp1MxG6KqepWeHxXaJ9Pw';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

  const txDateInput = document.getElementById('tx-date');
  if (txDateInput) {
    txDateInput.value = new Date().toISOString().split('T')[0];
  }

  await cargarCategorias();
  cargarCompromisosFijos();

  const txTypeSelect = document.getElementById('tx-type');
  if (txTypeSelect) {
    txTypeSelect.addEventListener('change', () => cargarCategorias());
  }

  // Crear categoría
  const categoryForm = document.getElementById('category-form');
  if (categoryForm) {
    categoryForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('new-cat-name').value.trim();
      const type = document.getElementById('tx-type').value;
      if (!name) return;

      const { error } = await supabaseClient.from('user_categories').insert([{ name, type }]);
      if (error) alert('Error: ' + error.message);
      else {
        document.getElementById('new-cat-name').value = '';
        await cargarCategorias();
        alert('¡Categoría creada con éxito!');
      }
    });
  }

  // Registrar Operación
  const txForm = document.getElementById('transaction-form');
  if (txForm) {
    txForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const type = document.getElementById('tx-type').value;
      const category = document.getElementById('tx-category').value;
      const amount = limpiarMonto(document.getElementById('tx-amount').value);
      const date = document.getElementById('tx-date').value;

      if (!category) {
        alert('Seleccioná una categoría.');
        return;
      }

      const { error } = await supabaseClient.from('transactions').insert([{ type, category, amount: Math.round(amount), date }]);
      if (error) alert('Error: ' + error.message);
      else {
        txForm.reset();
        if (txDateInput) txDateInput.value = new Date().toISOString().split('T')[0];
        alert('¡Movimiento registrado con éxito!');
      }
    });
  }

  // Gasto Fijo
  const fixedForm = document.getElementById('fixed-form');
  if (fixedForm) {
    fixedForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('fx-name').value;
      const amount = limpiarMonto(document.getElementById('fx-amount').value);

      const { error } = await supabaseClient.from('fixed_expenses').insert([{ name, amount: Math.round(amount), category: 'Fijo', status: 'pending' }]);
      if (error) alert('Error: ' + error.message);
      else {
        fixedForm.reset();
        cargarCompromisosFijos();
        alert('¡Gasto fijo añadido!');
      }
    });
  }

  // Meta de Ahorro
  const goalForm = document.getElementById('goal-form');
  if (goalForm) {
    goalForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('goal-title').value;
      const target_amount = limpiarMonto(document.getElementById('goal-target').value);
      const current_amount = limpiarMonto(document.getElementById('goal-current').value);

      await supabaseClient.from('goals').delete().neq('id', 0);
      const { error } = await supabaseClient.from('goals').insert([{ title, target_amount: Math.round(target_amount), current_amount: Math.round(current_amount) }]);

      if (error) alert('Error: ' + error.message);
      else {
        goalForm.reset();
        alert('¡Meta de ahorro actualizada!');
      }
    });
  }

  // Aportar
  const aportarAhorroForm = document.getElementById('aportar-ahorro-form');
  if (aportarAhorroForm) {
    aportarAhorroForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const montoAporte = limpiarMonto(document.getElementById('aporte-amount').value);

      const { data: goals } = await supabaseClient.from('goals').select('*');
      if (!goals || goals.length === 0) {
        alert('Primero definí una meta de ahorro.');
        return;
      }

      const goal = goals[0];
      const nuevoMontoActual = Number(goal.current_amount) + Math.round(montoAporte);

      await supabaseClient.from('goals').update({ current_amount: nuevoMontoActual }).eq('id', goal.id);
      aportarAhorroForm.reset();
      alert(`¡Se sumaron ${formatearDinero(montoAporte)} a tu ahorro!`);
    });
  }
});

async function cargarCategorias() {
  const type = document.getElementById('tx-type').value;
  const selectCat = document.getElementById('tx-category');

  const { data: cats } = await supabaseClient.from('user_categories').select('*').eq('type', type);
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
}

async function cargarCompromisosFijos() {
  const { data: fixedExpenses } = await supabaseClient.from('fixed_expenses').select('*');
  const fixedList = document.getElementById('fixed-list');
  if (!fixedList) return;

  fixedList.innerHTML = '';
  if (!fixedExpenses || fixedExpenses.length === 0) {
    fixedList.innerHTML = '<li>No hay compromisos fijos.</li>';
    return;
  }

  fixedExpenses.forEach(fx => {
    const li = document.createElement('li');
    li.className = 'fixed-item-row';
    li.innerHTML = `
      <div class="fixed-info">
        <strong>${fx.name}</strong>
        <span class="${fx.status === 'paid' ? 'expense-amount-green' : 'expense-amount-red'}">${formatearDinero(fx.amount)}</span>
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

window.toggleFixed = async function(id, currentStatus) {
  const newStatus = currentStatus === 'pending' ? 'paid' : 'pending';
  await supabaseClient.from('fixed_expenses').update({ status: newStatus }).eq('id', id);
  cargarCompromisosFijos();
};

window.deleteFixed = async function(id) {
  if (confirm('¿Eliminar este gasto fijo?')) {
    await supabaseClient.from('fixed_expenses').delete().eq('id', id);
    cargarCompromisosFijos();
  }
};