// controllers/authController.js
const db = require('../models');
const Admin = db.Admin;

module.exports = {
  loginForm: (req, res) => {
    res.render('login');
  },

  login: async (req, res) => {
    const { email, password } = req.body;
    try {
      const admin = await Admin.findOne({ where: { email } });
      if (!admin) {
        req.flash('error_msg', 'Administrador não encontrado.');
        return res.redirect('/auth/login');
      }

      // Em produção, utilize bcrypt para comparar a senha
      if (admin.password !== password) {
        req.flash('error_msg', 'Senha incorreta.');
        return res.redirect('/auth/login');
      }

      // Armazena informações do administrador na sessão
      req.session.admin = admin;
      res.redirect('/users/dashboard');
    } catch (error) {
      console.error(error);
      req.flash('error_msg', 'Erro durante o login.');
      res.redirect('/auth/login');
    }
  },

  logout: (req, res) => {
    req.session.destroy(err => {
      if (err) console.error(err);
      res.redirect('/auth/login');
    });
  }
};
