// controllers/userController.js
const db = require('../models');
const User = db.User;
const Vacation = db.Vacation;  // Importando o modelo Vacation
const { Op } = require("sequelize");


// Função para calcular a diferença em dias entre duas datas
function diffInDays(date1, date2) {
  const diffTime = Math.abs(date2 - date1);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

module.exports = {
  // Exibe o dashboard do administrador com a lista de usuários
  dashboard: async (req, res) => {
    if (!req.session.admin) {
      req.flash('error_msg', 'Acesso negado.');
      return res.redirect('/auth/login');
    }
    try {
      const users = await User.findAll({
        include: [
          {
            model: Vacation,
            required: false, // Permite que o usuário tenha ou não férias registradas
          },
        ],
        order: [['classificacao', 'ASC']], // Ordena pela classificação
      });
  
      res.render('admin_dashboard', { admin: req.session.admin, users });
    } catch (error) {
      console.error('Erro ao carregar o dashboard:', error);
      req.flash('error_msg', 'Erro ao carregar a lista de usuários.');
      res.redirect('/users/dashboard');
    }
  },
  

  // Exibe o formulário de cadastro de usuário
  showRegistrationForm: (req, res) => {
    if (!req.session.admin) {
      req.flash('error_msg', 'Acesso negado.');
      return res.redirect('/auth/login');
    }
    res.render('user_registration');
  },

  // Processa o cadastro de usuário e realiza os cálculos de dias
  registerUser: async (req, res) => {
    if (!req.session.admin) {
      req.flash('error_msg', 'Acesso negado.');
      return res.redirect('/auth/login');
    }
    try {
      const {
        matricula,
        nome,
        ano_referencia,
        gestante,
        qtd_filhos,
        estudante,
        data_ingresso,
        possui_conjuge,
        data_nascimento,
        periodo_aquisitivo_inicio,
        periodo_aquisitivo_fim
      } = req.body;

      const isGestante = gestante === 'on' ? true : false;
      const isEstudante = estudante === 'on' ? true : false;
      const hasConjuge = possui_conjuge === 'on' ? true : false;

      // Define a data de referência: 31/12 do ano anterior ao cadastro
      const referenceDate = new Date(ano_referencia - 1, 11, 31); 
      const ingressoDate = new Date(data_ingresso);
      const nascimentoDate = new Date(data_nascimento);

      const data_ingresso_dias = diffInDays(referenceDate, ingressoDate);
      const data_nascimento_dias = diffInDays(referenceDate, nascimentoDate);

      await User.create({
        matricula,
        nome,
        ano_referencia,
        gestante: isGestante,
        qtd_filhos: parseInt(qtd_filhos),
        estudante: isEstudante,
        data_ingresso: ingressoDate,
        data_ingresso_dias,
        possui_conjuge: hasConjuge,
        data_nascimento: nascimentoDate,
        data_nascimento_dias,
        periodo_aquisitivo_inicio: new Date(periodo_aquisitivo_inicio),
        periodo_aquisitivo_fim: new Date(periodo_aquisitivo_fim)
      });
      await module.exports.updateUserClassification();
      req.flash('success_msg', 'Usuário cadastrado com sucesso!');
      res.redirect('/users/dashboard');
    } catch (error) {
      console.error(error);
      req.flash('error_msg', 'Erro ao cadastrar usuário.');
      res.redirect('/users/dashboard');
    }
  },

  // Atualiza a classificação dos usuários com base nos critérios definidos
  updateUserClassification: async () => {
    try {
      let users = await User.findAll();
      users.sort((a, b) => {
        // Critério 1: Gestante
        if (a.gestante !== b.gestante) {
          return b.gestante - a.gestante;
        }
        // Critério 2: Quantidade de filhos (maior primeiro)
        if (a.qtd_filhos !== b.qtd_filhos) {
          return b.qtd_filhos - a.qtd_filhos;
        }
        // Critério 3: Estudante
        if (a.estudante !== b.estudante) {
          return b.estudante - a.estudante;
        }
        // Critério 4: Data de ingresso (em dias, menor é melhor)
        if (a.data_ingresso_dias !== b.data_ingresso_dias) {
          return a.data_ingresso_dias - b.data_ingresso_dias;
        }
        // Critério 5: Possui cônjuge
        if (a.possui_conjuge !== b.possui_conjuge) {
          return b.possui_conjuge - a.possui_conjuge;
        }
        // Critério 6: Data de nascimento (em dias, menor é melhor)
        return a.data_nascimento_dias - b.data_nascimento_dias;
      });

      // Atualiza a classificação de cada usuário
      for (let i = 0; i < users.length; i++) {
        users[i].classificacao = i + 1;
        await users[i].save();
      }
    } catch (error) {
      console.error("Erro ao atualizar classificação:", error);
    }
  }
};
