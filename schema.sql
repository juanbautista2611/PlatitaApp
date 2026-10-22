CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL, -- 'income' o 'expense'
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS fixed_expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  amount REAL NOT NULL,
  category TEXT NOT NULL,
  status TEXT DEFAULT 'pending' -- 'pending' o 'paid'
);

CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  target_amount REAL NOT NULL,
  current_amount REAL NOT NULL,
  deadline TEXT
);