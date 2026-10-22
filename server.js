const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
// Servir archivos estáticos desde la raíz del proyecto actual
app.use(express.static(path.join(__dirname)));

// ==========================================
// CONFIGURACIÓN DE SUPABASE
// ==========================================
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Redirigir la raíz al welcome.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'welcome.html'));
});

// Transacciones
app.get('/api/transactions', async (req, res) => {
  const { data, error } = await supabase.from('transactions').select('*').order('date', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/transactions', async (req, res) => {
  const { type, category, amount, date, description } = req.body;
  const { data, error } = await supabase
    .from('transactions')
    .insert([{ type, category, amount: Math.round(amount), date, description }]);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Registrado con éxito', data });
});

// Gastos Fijos
app.get('/api/fixed-expenses', async (req, res) => {
  const { data, error } = await supabase.from('fixed_expenses').select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/fixed-expenses', async (req, res) => {
  const { name, amount, category } = req.body;
  const { data, error } = await supabase
    .from('fixed_expenses')
    .insert([{ name, amount: Math.round(amount), category: category || 'Fijo', status: 'pending' }]);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Gasto fijo guardado', data });
});

app.put('/api/fixed-expenses/:id/toggle', async (req, res) => {
  const id = req.params.id;
  const { data: row, error: fetchError } = await supabase.from('fixed_expenses').select('*').eq('id', id).single();
  if (fetchError || !row) return res.status(404).json({ error: 'Gasto fijo no encontrado' });

  const newStatus = row.status === 'pending' ? 'paid' : 'pending';

  const { error: updateError } = await supabase
    .from('fixed_expenses')
    .update({ status: newStatus })
    .eq('id', id);

  if (updateError) return res.status(500).json({ error: updateError.message });

  if (newStatus === 'paid') {
    const today = new Date().toISOString().split('T')[0];
    await supabase.from('transactions').insert([
      { type: 'expense', category: row.name, amount: row.amount, date: today, description: 'Gasto fijo pagado' }
    ]);
  }

  res.json({ message: 'Estado actualizado', status: newStatus });
});

app.delete('/api/fixed-expenses/:id', async (req, res) => {
  const id = req.params.id;
  const { error } = await supabase.from('fixed_expenses').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Eliminado con éxito' });
});

// Objetivos de Ahorro
app.get('/api/goals', async (req, res) => {
  const { data, error } = await supabase.from('goals').select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/goals', async (req, res) => {
  const { title, target_amount, current_amount, deadline } = req.body;
  await supabase.from('goals').delete().neq('id', 0); 

  const { data, error } = await supabase
    .from('goals')
    .insert([{ title, target_amount: Math.round(target_amount), current_amount: Math.round(current_amount), deadline }]);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Meta actualizada', data });
});

// Reiniciar mes
app.post('/api/reset-month', async (req, res) => {
  await supabase.from('transactions').delete().neq('id', 0);
  await supabase.from('fixed_expenses').update({ status: 'pending' }).neq('id', 0);
  res.json({ message: 'Mes reiniciado con éxito' });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});