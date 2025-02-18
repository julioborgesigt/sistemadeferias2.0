// controllers/userController.js
const db = require('../models');
const User = db.User;
const Vacation = db.Vacation;
const Settings = db.Settings;
const { Op } = require("sequelize");

// Função para calcular a diferença em dias entre duas datas
function diffInDays(date1, date2) {
  const diffTime = Math.abs(date2 - date1);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

module.exports = {
  // Exibe o dashboard do administrador com usuários e limites de férias configuráveis
  dashboard: async (req, res) => {
    if (!req.session.admin) {
      req.flash('error_msg', 'Acesso negado.');
      return res.redirect('/auth/login');
    }
    try {
      const users = await User.findAll({
        include: [{ model: Vacation, required: false }],
        order: [['categoria', 'ASC'], ['classificacao', 'ASC']],
      });
      // Separe os usuários por categoria
      const ipcUsers = users.filter(u => u.categoria === 'IPC');
      const epcUsers = users.filter(u => u.categoria === 'EPC');
      const dpcUsers = users.filter(u => u.categoria === 'DPC');
      const settings = await Settings.findOne({ where: { id: 1 } }) || { max_ipc: 2, max_epc: 2, max_dpc: 2 };

      // Contar quantos usuários de cada categoria estão de férias
      const vacationCounts = await Vacation.findAll({
        include: [{ model: User, attributes: ['categoria'] }]
      });

      let categoryUsage = { IPC: 0, EPC: 0, DPC: 0 };
      vacationCounts.forEach(vacation => {
        categoryUsage[vacation.User.categoria]++;
      });

      res.render('admin_dashboard', {
        admin: req.session.admin,
        users,
        settings,
        categoryUsage,
        ipcUsers,
        epcUsers,
        dpcUsers
      });
    } catch (error) {
      console.error('Erro ao carregar o dashboard:', error);
      req.flash('error_msg', 'Erro ao carregar a lista de usuários.');
      res.redirect('/users/dashboard');
    }
  },

  // Exibe o formulário de cadastro de usuário
  showRegistrationForm: async (req, res) => {
    if (!req.session.admin) {
      req.flash('error_msg', 'Acesso negado.');
      return res.redirect('/auth/login');
    }

    try {
      // Buscar datas de ingresso únicas no banco
      const distinctDates = await User.findAll({
        attributes: [[db.sequelize.fn('DISTINCT', db.sequelize.col('data_ingresso')), 'data_ingresso']],
        raw: true
      });

      // Enviar as datas formatadas para a view
      res.render('user_registration', { distinctDates });
    } catch (error) {
      console.error("Erro ao carregar as datas de ingresso:", error);
      res.render('user_registration', { distinctDates: [] });
    }
  },

  // Processa o cadastro de usuário
  registerUser: async (req, res) => {
    if (!req.session.admin) {
      req.flash('error_msg', 'Acesso negado.');
      return res.redirect('/auth/login');
    }
    try {
      const { matricula, nome, ano_referencia, gestante, qtd_filhos, estudante, doisvinculos, data_ingresso, possui_conjuge, data_nascimento, periodo_aquisitivo_inicio, periodo_aquisitivo_fim, categoria } = req.body;
      
      const isdoisvinculos = doisvinculos === 'on'; // Se o checkbox for marcado
      

      const isGestante = gestante === 'on';
      const isEstudante = estudante === 'on';
      const hasConjuge = possui_conjuge === 'on';

      const referenceDate = new Date(ano_referencia - 1, 11, 31);
      const ingressoDate = new Date(data_ingresso + "T00:00:00-03:00"); // Define fuso horário de Brasília
      const nascimentoDate = new Date(data_nascimento + "T00:00:00-03:00");

      const data_ingresso_dias = diffInDays(referenceDate, ingressoDate);
      const data_nascimento_dias = diffInDays(referenceDate, nascimentoDate);
      const aquisitivoInicio = new Date(periodo_aquisitivo_inicio + "T00:00:00-03:00"); 
      const aquisitivoFim = new Date(periodo_aquisitivo_fim + "T00:00:00-03:00");


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
        periodo_aquisitivo_inicio: aquisitivoInicio,
        periodo_aquisitivo_fim: aquisitivoFim,
        categoria,
        doisvinculos: isdoisvinculos
      });

      await module.exports.updateUserClassification();
      req.flash('success_msg', 'Usuário cadastrado com sucesso!');
      res.redirect('/users/dashboard');
    } catch (error) {
      console.error(error);
      req.flash('error_msg', 'Erro ao cadastrar usuário.');
      
    }
  },

  // Atualiza os limites de férias para cada categoria
  updateLimits: async (req, res) => {
    if (!req.session.admin) {
      req.flash('error_msg', 'Acesso negado.');
      return res.redirect('/auth/login');
    }

    try {
      const { max_ipc, max_epc, max_dpc } = req.body;

      let settings = await Settings.findOne({ where: { id: 1 } });

      if (!settings) {
        settings = await Settings.create({
          max_ipc: max_ipc || 2,
          max_epc: max_epc || 2,
          max_dpc: max_dpc || 2
        });
      } else {
        await settings.update({
          max_ipc,
          max_epc,
          max_dpc
        });
      }

      req.flash('success_msg', 'Limites atualizados com sucesso!');
      res.redirect('/users/dashboard');
    } catch (error) {
      console.error('Erro ao atualizar limites:', error);
      req.flash('error_msg', 'Erro ao atualizar limites.');
      res.redirect('/users/dashboard');
    }
  },


  updateUserClassification: async () => {
    try {
      const categories = ['IPC', 'EPC', 'DPC'];
      
      for (const category of categories) {
        let users = await User.findAll({
          where: { categoria: category }
        });
  
        users.sort((a, b) => {
          if (a.gestante !== b.gestante) return b.gestante - a.gestante;
        if (a.qtd_filhos !== b.qtd_filhos) return b.qtd_filhos - a.qtd_filhos;
        if (a.estudante !== b.estudante) return b.estudante - a.estudante;
        if (a.doisvinculos !== b.doisvinculos) return b.doisvinculos - a.doisvinculos;
        if (a.data_ingresso_dias !== b.data_ingresso_dias) return b.data_ingresso_dias - a.data_ingresso_dias;
        if (a.possui_conjuge !== b.possui_conjuge) return b.possui_conjuge - a.possui_conjuge;
        return b.data_nascimento_dias - a.data_nascimento_dias;
        });
  
        for (let i = 0; i < users.length; i++) {
          users[i].classificacao = i + 1;
          await users[i].save();
        }
      }
    } catch (error) {
      console.error("Erro ao atualizar classificação:", error);
    }
  },
  resetVacations: async (req, res) => {
    // Apenas administradores podem resetar as férias
    if (!req.session.admin) {
      req.flash('error_msg', 'Acesso negado.');
      return res.redirect('/auth/login');
    }
    try {
      const { matricula } = req.body;
      if (!matricula) {
        req.flash('error_msg', 'Matrícula não informada.');
        return res.redirect('/users/dashboard');
      }

      // Apaga todas as férias para o usuário informado
      const deletedCount = await Vacation.destroy({ where: { matricula } });

      req.flash('success_msg', `Férias resetadas para o usuário ${matricula}. ${deletedCount} registro(s) removido(s).`);
      res.redirect('/users/dashboard');
    } catch (error) {
      console.error("Erro ao resetar férias:", error);
      req.flash('error_msg', 'Erro ao resetar férias.');
      res.redirect('/users/dashboard');
    }
  },
  // Função para apagar o usuário (apagar matrícula) e seus registros de férias
deleteUser: async (req, res) => {
  if (!req.session.admin) {
    req.flash('error_msg', 'Acesso negado.');
    return res.redirect('/auth/login');
  }
  try {
    const { matricula } = req.body;
    if (!matricula) {
      req.flash('error_msg', 'Matrícula não informada.');
      return res.redirect('/users/dashboard');
    }
    
    // Opcional: Primeiro, apague as férias associadas se não estiver usando ON DELETE CASCADE
    await Vacation.destroy({ where: { matricula } });
    
    // Apaga o usuário
    const deleted = await User.destroy({ where: { matricula } });
    
    if (deleted) {
      // Recalcula a classificação após a exclusão
      await module.exports.updateUserClassification();
      req.flash('success_msg', `Matrícula ${matricula} apagada com sucesso.`);
    } else {
      req.flash('error_msg', `Matrícula ${matricula} não encontrada.`);
    }
    res.redirect('/users/dashboard');
  } catch (error) {
    console.error('Erro ao apagar matrícula:', error);
    req.flash('error_msg', 'Erro ao apagar matrícula.');
    res.redirect('/users/dashboard');
  }
},
// Exibe a página de classificação dos servidores com filtro por cargo
showClassification: async (req, res) => {
  if (!req.session.admin) {
    req.flash('error_msg', 'Acesso negado.');
    return res.redirect('/auth/login');
  }
  try {
    const users = await User.findAll({
      include: [{ model: Vacation, required: false }],
      order: [['classificacao', 'ASC']]
    });
    res.render('classification', { admin: req.session.admin, users });
  } catch (error) {
    console.error('Erro ao carregar a classificação:', error);
    req.flash('error_msg', 'Erro ao carregar a classificação.');
    res.redirect('/users/dashboard');
  }
}
  

};
