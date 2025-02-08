// app.js
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');

const app = express();

// Configurações do EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: true
}));
app.use(flash());

// Variáveis globais para mensagens flash
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  next();
});

// Importando as rotas
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const vacationRoutes = require('./routes/vacationRoutes');
const publicRoutes = require('./routes/publicRoutes');

app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/vacations', vacationRoutes);
app.use('/user', publicRoutes);

// Rota padrão
app.get('/', (req, res) => {
  res.redirect('/auth/login');
});

// Inicializando o servidor e sincronizando o banco
const db = require('./models');
const PORT = process.env.PORT || 3000;

db.sequelize.sync({ alter: true })
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Servidor rodando na porta ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Erro ao sincronizar o banco:', err);
  });
