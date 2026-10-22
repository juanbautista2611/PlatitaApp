document.addEventListener('DOMContentLoaded', () => {
  const todayObj = new Date();
  const options = { day: 'numeric', month: 'short', year: 'numeric' };
  const dateBadge = document.getElementById('current-date-badge');
  if (dateBadge) {
    dateBadge.textContent = todayObj.toLocaleDateString('es-ES', options);
  }

  const dateInput = document.getElementById('tx-date');
  if (dateInput) {
    const year = todayObj.getFullYear();
    const month = String(todayObj.getMonth() + 1).padStart(2, '0');
    const day = String(todayObj.getDate()).padStart(2, '0');
    dateInput.value = `${year}-${month}-${day}`;
  }

  loadAllData();

  // Registrar Movimiento Manual
  const txForm = document.getElementById('transaction-form');
  if (txForm) {
    txForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newTx = {
        type: document.getElementById('tx-type').value,
        category: document.getElementById('tx-category').value,
        amount: Math.round(parseFloat(document.getElementById('tx-amount').value)),
        date: document.getElementById('tx-date').value,
        description: 'Movimiento manual'
      };

      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTx)
      });

      if (res.ok) {
        txForm.reset();
        if (dateInput) dateInput.value = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
        loadAllData();
      }
    });
  }

  // Registrar Gasto Fijo Permanente
  const fixedForm = document.getElementById('fixed-form');
  if (fixedForm) {
    fixedForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nameInput = document.getElementById('fx-name');
      const amountInput = document.getElementById('fx-amount');

      if (!nameInput || !amountInput) return;

      const newFixed = {
        name: nameInput.value.trim(),
        amount: Math.round(parseFloat(amountInput.value)),
        category: 'Fijo'
      };

      try {
        const res = await fetch('/api/fixed-expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newFixed)
        });

        if (res.ok) {
          fixedForm.reset();
          loadAllData();
        } else {
          alert('No se pudo guardar el gasto fijo.');
        }
      } catch (err) {
        console.error('Error al enviar gasto fijo:', err);
      }
    });
  }

  // Registrar Meta de Ahorro
  const goalForm = document.getElementById('goal-form');
  if (goalForm) {
    goalForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newGoal = {
        title: document.getElementById('goal-title').value,
        target_amount: Math.round(parseFloat(document.getElementById('goal-target').value)),
        current_amount: Math.round(parseFloat(document.getElementById('goal-current').value)),
        deadline: '2026'
      };

      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newGoal)
      });

      if (res.ok) {
        goalForm.reset();
        loadAllData();
      }
    });
  }

  // Botón de Reinicio Mensual
  const resetBtn = document.getElementById('reset-month-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if (confirm('¿Estás seguro de iniciar un nuevo mes? Esto limpiará las transacciones del mes anterior y pondrá todos tus gastos fijos como pendientes nuevamente.')) {
        try {
          const res = await fetch('/api/reset-month', { method: 'POST' });
          if (res.ok) {
            loadAllData();
            alert('¡Nuevo mes iniciado con éxito!');
          } else {
            alert('Error al reiniciar el mes.');
          }
        } catch (err) {
          console.error('Error de red al reiniciar el mes:', err);
        }
      }
    });
  }

});

async function loadAllData() {
  try {
    const resTx = await fetch('/api/transactions');
    const transactions = await resTx.json();

    const resGoals = await fetch('/api/goals');
    const goals = await resGoals.json();

    const resFx = await fetch('/api/fixed-expenses');
    const fixedExpenses = await resFx.json();

    updateDashboard(transactions, goals, fixedExpenses);
    renderMovements(transactions);
    renderFixedExpenses(fixedExpenses);
    updateGoals(goals);
  } catch (error) {
    console.error('Error al cargar datos:', error);
  }
}

// Actualizar dashboard sumando SOLO los gastos fijos que estén pagados ('paid')
function updateDashboard(transactions, goals, fixedExpenses) {
  let income = 0;
  let expenses = 0;

  transactions.forEach(tx => {
    if (tx.type === 'income') income += tx.amount;
    else if (tx.type === 'expense') expenses += tx.amount;
  });

  // Sumar al gasto total únicamente los compromisos fijos que ya fueron pagados
  if (fixedExpenses && fixedExpenses.length > 0) {
    fixedExpenses.forEach(fx => {
      if (fx.status === 'paid') {
        expenses += fx.amount;
      }
    });
  }

  let currentSavings = 0;
  if (goals && goals.length > 0) {
    currentSavings = goals[0].current_amount || 0;
  }

  const balance = income - expenses;
  const freeDisposable = balance - currentSavings;

  document.getElementById('current-balance').textContent = formatCurrency(balance);
  document.getElementById('monthly-income').textContent = formatCurrency(income);
  document.getElementById('monthly-expenses').textContent = formatCurrency(expenses);
  document.getElementById('free-disposable').textContent = formatCurrency(freeDisposable);
}

function renderMovements(transactions) {
  const listElement = document.getElementById('movements-list');
  listElement.innerHTML = '';

  if (transactions.length === 0) {
    listElement.innerHTML = '<li>Sin movimientos recientes.</li>';
    return;
  }

  transactions.slice(0, 5).forEach(tx => {
    const li = document.createElement('li');
    const isIncome = tx.type === 'income';
    const amountClass = isIncome ? 'income-amount' : 'expense-amount';
    const sign = isIncome ? '+ ' : '- ';

    li.innerHTML = `
      <div>
        <strong>${tx.category}</strong><br>
        <small style="color:#64748b">${tx.date}</small>
      </div>
      <span class="${amountClass}">${sign}${formatCurrency(tx.amount)}</span>
    `;
    listElement.appendChild(li);
  });
}

function renderFixedExpenses(fixedExpenses) {
  const list = document.getElementById('fixed-list');
  list.innerHTML = '';

  if (!fixedExpenses || fixedExpenses.length === 0) {
    list.innerHTML = '<li>Sin compromisos fijos cargados.</li>';
    return;
  }

  fixedExpenses.forEach(fx => {
    const li = document.createElement('li');
    li.className = 'fixed-item-row';
    
    const isPaid = fx.status === 'paid';
    const amountClass = isPaid ? 'expense-amount-green' : 'expense-amount-red';
    const badgeClass = isPaid ? 'badge-paid' : 'badge-pending';
    const badgeText = isPaid ? '✓ Pagado' : 'Marcar como Pago';

    li.innerHTML = `
      <div class="fixed-info">
        <strong>${fx.name}</strong>
        <span class="${amountClass}">- ${formatCurrency(fx.amount)}</span>
      </div>
      <div class="fixed-actions">
        <button class="${badgeClass} toggle-btn" data-id="${fx.id}">${badgeText}</button>
        <button class="btn-delete-fixed delete-btn" data-id="${fx.id}" title="Eliminar">🗑️</button>
      </div>
    `;
    list.appendChild(li);
  });

  // Vincular eventos de los botones fijos de forma segura
  document.querySelectorAll('.toggle-btn').forEach(button => {
    button.addEventListener('click', async (e) => {
      const id = e.target.getAttribute('data-id');
      await toggleFixedStatus(id);
    });
  });

  document.querySelectorAll('.delete-btn').forEach(button => {
    button.addEventListener('click', async (e) => {
      const id = e.target.getAttribute('data-id');
      await deleteFixedExpense(id);
    });
  });
}

async function toggleFixedStatus(id) {
  try {
    const res = await fetch(`/api/fixed-expenses/${id}/toggle`, { method: 'PUT' });
    if (res.ok) loadAllData();
  } catch (error) { console.error('Error al cambiar estado:', error); }
}

async function deleteFixedExpense(id) {
  if (confirm('¿Eliminar compromiso fijo permanentemente?')) {
    try {
      const res = await fetch(`/api/fixed-expenses/${id}`, { method: 'DELETE' });
      if (res.ok) loadAllData();
    } catch (error) { console.error('Error al eliminar:', error); }
  }
}

function updateGoals(goals) {
  if (goals && goals.length > 0) {
    const goal = goals[0];
    const percentage = Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100));
    
    document.getElementById('goal-title-display').textContent = goal.title;
    document.getElementById('goal-amount-display').textContent = formatCurrency(goal.current_amount);
    document.getElementById('goal-subtext').textContent = `Meta: ${formatCurrency(goal.target_amount)} (${percentage}%)`;
    document.getElementById('goal-progress-fill').style.width = percentage + '%';
  } else {
    document.getElementById('goal-title-display').textContent = 'Ahorro objetivo';
    document.getElementById('goal-amount-display').textContent = '$ 0';
    document.getElementById('goal-subtext').textContent = 'Sin meta definida';
    document.getElementById('goal-progress-fill').style.width = '0%';
  }
}

function formatCurrency(amount) {
  return '$ ' + Math.round(amount).toLocaleString('es-AR');
}