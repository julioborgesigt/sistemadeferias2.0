require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const flash = require('connect-flash');
const path = require('path');

const app = express();

// 📌 Configurações do EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 📌 Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// 📌 Configuração do MySQL para armazenamento de sessões
const sessionStore = new MySQLStore({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  clearExpired: true,
  expiration: 1000 * 60 * 60 * 24 // Sessões expiram em 24 horas
});

app.use(session({
  secret: process.env.SESSION_SECRET || 'chave_super_secreta',
  store: sessionStore,
  resave: false,
  saveUninitialized: false
}));

app.use(flash());

// 📌 Middleware para monitorar a sessão em cada requisição
app.use((req, res, next) => {
  console.log("📝 Sessão atual:", req.session);
  if (req.session.admin) {
    console.log(`✅ Sessão ativa para o administrador: ${req.session.admin.email}`);
  } else {
    console.log("⚠️ Nenhuma sessão ativa.");
  }
  next();
});

// 📌 Variáveis globais para mensagens flash
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  next();
});

// 📌 Importando as rotas
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const vacationRoutes = require('./routes/vacationRoutes');
const publicRoutes = require('./routes/publicRoutes');

app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/vacations', vacationRoutes);
app.use('/user', publicRoutes);

// 📌 Rota padrão
app.get('/', (req, res) => {
  res.redirect('/auth/login');
});

// 📌 Inicializando o servidor e sincronizando o banco
const db = require('./models');
const PORT = process.env.PORT || 3000;

db.sequelize.sync({ alter: true })
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando na porta ${PORT} (Ambiente: ${process.env.NODE_ENV || 'development'})`);
  });
})
.catch(err => {
  console.error('❌ Erro ao sincronizar o banco:', err);
});
