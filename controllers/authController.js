// controllers/authController.js
const db = require('../models');
const Admin = db.Admin;

module.exports = {
  loginForm: (req, res) => {
    res.render('login');
  },

  login: async (req, res) => {
    const { email, password } = req.body;
    console.log(`🔍 Tentativa de login com email: ${email}`);

    try {
      const admin = await Admin.findOne({ where: { email } });

      if (!admin) {
        console.log("⚠️ Nenhum usuário encontrado no banco de dados.");
        req.flash('error_msg', 'Administrador não encontrado.');
        return res.redirect('/auth/login');
      }

      console.log(`✅ Usuário encontrado: ${admin.email}`);
      console.log(`🔑 Senha cadastrada no banco: "${admin.password}"`);
      console.log(`🔑 Senha digitada: "${password}"`);

      // Comparação direta da senha (se não estiver usando bcrypt)
      if (admin.password.trim() !== password.trim()) {
        console.log("⛔ Senha incorreta.");
        req.flash('error_msg', 'Senha incorreta.');
        return res.redirect('/auth/login');
      }

      console.log("✅ Login bem-sucedido!");
      
      // Armazena informações do administrador na sessão
      req.session.admin = {
        id: admin.id,
        email: admin.email,
        nome: admin.nome
      };

      res.redirect('/users/dashboard');
    } catch (error) {
      console.error("❌ Erro no login:", error);
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
