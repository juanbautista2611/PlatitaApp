const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

const dbFile = path.join(__dirname, 'platita.db');
const db = new sqlite3.Database(dbFile, (err) => {
  if (err) {
    console.error('Error al conectar con la base de datos', err.message);
  } else {
    console.log('Conectado a la base de datos SQLite (platita.db)');
    const fs = require('fs');
    const schemaFile = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaFile)) {
      const schema = fs.readFileSync(schemaFile, 'utf8');
      db.exec(schema, (err) => {
        if (err) console.error('Error al ejecutar el esquema:', err.message);
      });
    }
  }
});

// Transacciones
app.get('/api/transactions', (req, res) => {
  db.all('SELECT * FROM transactions ORDER BY date DESC', [], (err, rows) => {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json(rows);
  });
});

app.post('/api/transactions', (req, res) => {
  const { type, category, amount, date, description } = req.body;
  const query = `INSERT INTO transactions (type, category, amount, date, description) VALUES (?, ?, ?, ?, ?)`;
  db.run(query, [type, category, Math.round(amount), date, description], function(err) {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json({ id: this.lastID });
  });
});

// Gastos Fijos
app.get('/api/fixed-expenses', (req, res) => {
  db.all('SELECT * FROM fixed_expenses', [], (err, rows) => {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json(rows);
  });
});

app.post('/api/fixed-expenses', (req, res) => {
  const { name, amount, category } = req.body;
  const query = `INSERT INTO fixed_expenses (name, amount, category, status) VALUES (?, ?, ?, 'pending')`;
  db.run(query, [name, Math.round(amount), category || 'Fijo'], function(err) {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json({ id: this.lastID });
  });
});

// Cambiar estado de Gasto Fijo (Pendiente <-> Pagado)
app.put('/api/fixed-expenses/:id/toggle', (req, res) => {
  const id = req.params.id;
  db.get('SELECT * FROM fixed_expenses WHERE id = ?', [id], (err, row) => {
    if (err || !row) { res.status(404).json({ error: 'Gasto fijo no encontrado' }); return; }

    const newStatus = row.status === 'pending' ? 'paid' : 'pending';
    
    db.run('UPDATE fixed_expenses SET status = ? WHERE id = ?', [newStatus, id], function(err) {
      if (err) { res.status(500).json({ error: err.message }); return; }
      res.json({ message: 'Estado actualizado', status: newStatus });
    });
  });
});

app.delete('/api/fixed-expenses/:id', (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM fixed_expenses WHERE id = ?', [id], function(err) {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json({ message: 'Eliminado con éxito' });
  });
});

// Objetivos
app.get('/api/goals', (req, res) => {
  db.all('SELECT * FROM goals', [], (err, rows) => {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json(rows);
  });
});

app.post('/api/goals', (req, res) => {
  const { title, target_amount, current_amount, deadline } = req.body;
  db.run(`DELETE FROM goals`, [], () => {
    const query = `INSERT INTO goals (title, target_amount, current_amount, deadline) VALUES (?, ?, ?, ?)`;
    db.run(query, [title, Math.round(target_amount), Math.round(current_amount), deadline], function(err) {
      if (err) { res.status(500).json({ error: err.message }); return; }
      res.json({ id: this.lastID });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

// Reiniciar mes (Borra transacciones y pasa todos los gastos fijos a 'pending')
app.post('/api/reset-month', (req, res) => {
  db.serialize(() => {
    db.run('DELETE FROM transactions', (err) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      db.run("UPDATE fixed_expenses SET status = 'pending'", (err) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Mes reiniciado con éxito' });
      });
    });
  });
});