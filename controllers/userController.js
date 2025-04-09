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
      // Busca todos os usuários com suas férias
      const users = await User.findAll({
        include: [{ model: Vacation, required: false }],
        order: [['classificacao', 'ASC']],
      });
      
      // Filtro manual para manter apenas as férias do ano correto
      users.forEach(user => {
        user.Vacations = user.Vacations?.filter(vac => vac.ano_referencia === user.ano_referencia) || [];
      });
      

      // Separa os usuários por categoria
      const ipcUsers = users.filter(u => u.categoria === 'IPC');
      const epcUsers = users.filter(u => u.categoria === 'EPC');
      const dpcUsers = users.filter(u => u.categoria === 'DPC');
  
      const settings = await Settings.findOne({ where: { id: 1 } }) || { max_ipc: 2, max_epc: 2, max_dpc: 2 };
  
      // Conta quantos usuários de cada categoria estão de férias
      const vacationCounts = await Vacation.findAll({
        include: [{ model: User, attributes: ['categoria'] }]
      });
      let categoryUsage = { IPC: 0, EPC: 0, DPC: 0 };
      vacationCounts.forEach(vacation => {
        if (vacation.User && vacation.User.categoria) {
          categoryUsage[vacation.User.categoria]++;
        }
      });
  
      // Obtém os anos distintos (ano_referencia) dos usuários
      const distinctYearsRaw = await User.findAll({
        attributes: [[db.sequelize.fn('DISTINCT', db.sequelize.col('ano_referencia')), 'ano_referencia']],
        raw: true
      });
      const distinctYears = distinctYearsRaw.map(item => item.ano_referencia).sort();
      const currentYear = new Date().getFullYear();
      
      res.render('admin_dashboard', {
        admin: req.session.admin,
        users,
        settings,
        categoryUsage,
        ipcUsers,
        epcUsers,
        dpcUsers,
        distinctYears,  // passa o array de anos
        currentYear,    // passa o ano corrente
        formatDate: (date) => {
          const d = new Date(date);
          // Ajusta para UTC-3 (Brasília)
          const adjustedDate = new Date(d.getTime() + (3 * 60 * 60 * 1000));
          return [
            adjustedDate.getUTCDate().toString().padStart(2, '0'),
            (adjustedDate.getUTCMonth() + 1).toString().padStart(2, '0'),
            adjustedDate.getUTCFullYear()
          ].join('/');
        }
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
      
      // Verifica se já existe um usuário com a mesma matrícula
      const existingUser = await User.findOne({ where: { matricula, ano_referencia } });
      if (existingUser) {
        req.flash('error_msg', 'Usuário já cadastrado para este ano de referência. Por favor, verifique os dados ou atualize o usuário existente.');
        // Certifique-se de buscar e passar os distinctDates também, se necessário
        const distinctDates = await User.findAll({
          attributes: [[db.sequelize.fn('DISTINCT', db.sequelize.col('data_ingresso')), 'data_ingresso']],
          raw: true
        });
        return res.render('user_registration', { 
          old: req.body, 
          distinctDates,
          error_msg: req.flash('error_msg'),
          success_msg: req.flash('success_msg')
        });
      }


      
      const ajustaParaUTC = (data) => {
        return new Date(data.getTime() - (3 * 60 * 60 * 1000)); // Ajusta para UTC-3 antes de salvar
      };
  
      const isdoisvinculos = doisvinculos === 'on';
      const isGestante = gestante === 'on';
      const isEstudante = estudante === 'on';
      const hasConjuge = possui_conjuge === 'on';
  
      // Data de referência: 31 de dezembro do ano corrente (ano_referencia informado)
      const referenceDate = new Date(ano_referencia, 11, 31);
      const ingressoDate = new Date(data_ingresso + "T00:00:00-03:00"); // Define fuso horário de Brasília
      const nascimentoDate = new Date(data_nascimento + "T00:00:00-03:00");
  
      const data_ingresso_dias = diffInDays(referenceDate, ingressoDate);
      const data_nascimento_dias = diffInDays(referenceDate, nascimentoDate);
      const aquisitivoInicio = ajustaParaUTC(new Date(periodo_aquisitivo_inicio));
      const aquisitivoFim = ajustaParaUTC(new Date(periodo_aquisitivo_fim));
  
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
      return res.render('user_registration_confirmation', { 
        success_msg: req.flash('success_msg')
      });
    } catch (error) {
      console.error(error);
      // Ao tratar o erro, também busque distinctDates para que a view não quebre
      const distinctDates = await User.findAll({
        attributes: [[db.sequelize.fn('DISTINCT', db.sequelize.col('data_ingresso')), 'data_ingresso']],
        raw: true
      });
      req.flash('error_msg', 'Erro ao cadastrar usuário.');
      return res.render('user_registration', { old: req.body, distinctDates });
    }
  },
  
  

  // Atualiza os limites de férias para cada categoria
  updateLimits: async (req, res) => {
    if (!req.session.admin) {
      req.flash('error_msg', 'Acesso negado.');
      return res.redirect('/auth/login');
    }
    try {
      const { max_ipc, max_epc, max_dpc, max_ipc_p, max_epc_p, max_dpc_p, max_ipc_t, max_epc_t, max_dpc_t } = req.body;
      let settings = await Settings.findOne({ where: { id: 1 } });
      if (!settings) {
        settings = await Settings.create({
          max_ipc: max_ipc || 2,
          max_epc: max_epc || 2,
          max_dpc: max_dpc || 2,
          max_ipc_p: max_ipc_p || 2,
          max_epc_p: max_epc_p || 2,
          max_dpc_p: max_dpc_p || 2,
          max_ipc_t: max_ipc_t || 3,
          max_epc_t: max_epc_t || 3,
          max_dpc_t: max_dpc_t || 3
        });
      } else {
        await settings.update({
          max_ipc,
          max_epc,
          max_dpc,
          max_ipc_p,
          max_epc_p,
          max_dpc_p,
          max_ipc_t,
          max_epc_t,
          max_dpc_t
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
      const groups = {
        'IPC': ['IPC', 'IPC-P'],
        'EPC': ['EPC', 'EPC-P'],
        'DPC': ['DPC', 'DPC-P']
      };
  
      // Para cada grupo (ex: IPC e IPC-P juntos)
      for (const groupName in groups) {
        const groupCategories = groups[groupName];
        // Obtém os anos distintos para os usuários deste grupo
        const distinctYears = await User.findAll({
          attributes: [[db.sequelize.fn('DISTINCT', db.sequelize.col('ano_referencia')), 'ano_referencia']],
          where: { categoria: { [Op.in]: groupCategories } },
          raw: true
        });
        
        for (const obj of distinctYears) {
          const ano = obj.ano_referencia;
          // Busca os usuários cuja categoria está no grupo e com o ano de referência informado
          let users = await User.findAll({
            where: { 
              categoria: { [Op.in]: groupCategories },
              ano_referencia: ano
            }
          });
          
          // Ordena os usuários conforme a lógica existente
          users.sort((a, b) => {
            if (a.gestante !== b.gestante) return b.gestante - a.gestante;
            if (a.qtd_filhos !== b.qtd_filhos) return b.qtd_filhos - a.qtd_filhos;
            if (a.estudante !== b.estudante) return b.estudante - a.estudante;
            if (a.doisvinculos !== b.doisvinculos) return b.doisvinculos - a.doisvinculos;
            if (a.data_ingresso_dias !== b.data_ingresso_dias) return b.data_ingresso_dias - a.data_ingresso_dias;
            if (a.possui_conjuge !== b.possui_conjuge) return b.possui_conjuge - a.possui_conjuge;
            return b.data_nascimento_dias - a.data_nascimento_dias;
          });
    
          // Atualiza a classificação para cada usuário do grupo
          for (let i = 0; i < users.length; i++) {
            users[i].classificacao = i + 1;
            await users[i].save();
          }
        }
      }
    } catch (error) {
      console.error("Erro ao atualizar classificação:", error);
    }
  },
  
  
  
  // Exemplo de controlador para resetar férias
  resetVacations: async (req, res) => {
    if (!req.session.admin) {
      req.flash('error_msg', 'Acesso negado.');
      return res.redirect('/auth/login');
    }
    try {
      const { matricula, ano_referencia } = req.body;
      if (!matricula || !ano_referencia) {
        req.flash('error_msg', 'Matrícula ou ano de referência não informados.');
        return res.redirect('/users/dashboard');
      }
      // Apaga somente as férias do usuário para o ano informado
      const deletedCount = await Vacation.destroy({ where: { matricula, ano_referencia } });
      req.flash('success_msg', `Férias resetadas para o usuário ${matricula} no ano ${ano_referencia}. ${deletedCount} registro(s) removido(s).`);
      res.redirect('/users/dashboard');
    } catch (error) {
      console.error("Erro ao resetar férias:", error);
      req.flash('error_msg', 'Erro ao resetar férias.');
      res.redirect('/users/dashboard');
    }
  },

  // Função para apagar o usuário (apagar matrícula) e seus registros de férias
  // Exemplo de controlador para apagar matrícula
  deleteUser: async (req, res) => {
    if (!req.session.admin) {
      req.flash('error_msg', 'Acesso negado.');
      return res.redirect('/auth/login');
    }
    try {
      const { matricula, ano_referencia } = req.body;
      if (!matricula || !ano_referencia) {
        req.flash('error_msg', 'Matrícula ou ano de referência não informados.');
        return res.redirect('/users/dashboard');
      }
      // Opcional: apaga primeiro os registros de férias para esse ano, se necessário
      await Vacation.destroy({ where: { matricula, ano_referencia } });
      // Apaga o usuário somente para o ano de referência informado
      const deleted = await User.destroy({ where: { matricula, ano_referencia } });
      if (deleted) {
        await module.exports.updateUserClassification(); // para recalcular a classificação
        req.flash('success_msg', `Matrícula ${matricula} apagada com sucesso para o ano ${ano_referencia}.`);
      } else {
        req.flash('error_msg', `Matrícula ${matricula} não encontrada para o ano ${ano_referencia}.`);
      }
      res.redirect('/users/dashboard');
    } catch (error) {
      console.error('Erro ao apagar matrícula:', error);
      req.flash('error_msg', 'Erro ao apagar matrícula.');
      res.redirect('/users/dashboard');
    }
  },

// Exibe a página de classificação dos servidores com filtro por cargo
// controllers/userController.js
showClassification: async (req, res) => {
  try {
    const users = await User.findAll({
      include: [{ model: Vacation, required: false }],
      order: [['classificacao', 'ASC']]
    });

    // Separar usuários por categoria
    const ipcUsers = users.filter(u => u.categoria === 'IPC');
    const epcUsers = users.filter(u => u.categoria === 'EPC');
    const dpcUsers = users.filter(u => u.categoria === 'DPC');

    res.render('classification', { 
      admin: req.session.admin, 
      users,
      ipcUsers,
      epcUsers,
      dpcUsers,
      // Modifique a função formatDate para:
      formatDate: (date) => {
        const d = new Date(date);
        // Ajuste para UTC-3 (Brasília) e previna mudança de dia
        const adjustedDate = new Date(d.getTime() + (3 * 60 * 60 * 1000)); 
        
        return [
          adjustedDate.getUTCDate().toString().padStart(2, '0'),
          (adjustedDate.getUTCMonth() + 1).toString().padStart(2, '0'),
          adjustedDate.getUTCFullYear()
        ].join('/');
      }
    });
  } catch (error) {
    console.error('Erro ao carregar a classificação:', error);
    req.flash('error_msg', 'Erro ao carregar a classificação.');
    res.redirect('/users/dashboard');
  }
},
  



migrateUsers: async (req, res) => {
  try {
    // Agora o ano de origem e de destino vêm do formulário
    const origem = Number(req.body.sourceYear);
    const destino = Number(req.body.targetYear);

    // Impede migração para o mesmo ano
    if (origem === destino) {
      req.flash('error_msg', 'O ano de origem e o ano de destino não podem ser iguais.');
      return res.redirect('/users/dashboard');
    }

    const usersToMigrate = await User.findAll({
      where: { ano_referencia: origem }
    });

    if (usersToMigrate.length === 0) {
      req.flash('error_msg', 'Nenhum usuário encontrado para o ano de origem informado.');
      return res.redirect('/users/dashboard');
    }

    for (const user of usersToMigrate) {
      const refDate = new Date(destino, 11, 31);

      const novoDataIngressoDias = diffInDays(user.data_ingresso, refDate);
      const novoDataNascimentoDias = diffInDays(user.data_nascimento, refDate);

      const novoPeriodoInicio = new Date(user.data_ingresso);
      novoPeriodoInicio.setFullYear(destino);
      const novoPeriodoFim = new Date(novoPeriodoInicio);
      novoPeriodoFim.setFullYear(novoPeriodoFim.getFullYear() + 1);
      novoPeriodoFim.setDate(novoPeriodoFim.getDate() - 1);

      const existingUser = await User.findOne({
        where: {
          matricula: user.matricula,
          ano_referencia: destino
        }
      });

      if (existingUser) {
        existingUser.nome = user.nome;
        existingUser.gestante = user.gestante;
        existingUser.qtd_filhos = user.qtd_filhos;
        existingUser.estudante = user.estudante;
        existingUser.doisvinculos = user.doisvinculos;
        existingUser.data_ingresso_dias = novoDataIngressoDias;
        existingUser.data_nascimento_dias = novoDataNascimentoDias;
        existingUser.periodo_aquisitivo_inicio = novoPeriodoInicio;
        existingUser.periodo_aquisitivo_fim = novoPeriodoFim;
        existingUser.categoria = user.categoria;
        await existingUser.save();
      } else {
        await User.create({
          matricula: user.matricula,
          nome: user.nome,
          ano_referencia: destino,
          gestante: user.gestante,
          qtd_filhos: user.qtd_filhos,
          estudante: user.estudante,
          doisvinculos: user.doisvinculos,
          data_ingresso: user.data_ingresso,
          data_ingresso_dias: novoDataIngressoDias,
          possui_conjuge: user.possui_conjuge,
          data_nascimento: user.data_nascimento,
          data_nascimento_dias: novoDataNascimentoDias,
          periodo_aquisitivo_inicio: novoPeriodoInicio,
          periodo_aquisitivo_fim: novoPeriodoFim,
          categoria: user.categoria
        });
      }
    }

    await module.exports.updateUserClassification();
    req.flash('success_msg', `Migração concluída com sucesso de ${origem} para ${destino}.`);
    res.redirect('/users/dashboard');
  } catch (error) {
    console.error("Erro na migração:", error);
    req.flash('error_msg', 'Erro ao migrar os dados.');
    res.redirect('/users/dashboard');
  }
},

// Exibir o formulário com os dados atuais do usuário
editUserForm: async (req, res) => {
  const { matricula, ano } = req.params;
  const { User, Vacation } = require('../models');

  try {
    const user = await User.findOne({
      where: { matricula, ano_referencia: ano },
      include: [{
        model: Vacation,
        where: { ano_referencia: ano },
        required: false
      }]
    });

    if (!user) {
      req.flash('error_msg', 'Usuário não encontrado.');
      return res.redirect('/users/dashboard');
    }

    res.render('user_edit_form', { user });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Erro ao carregar dados do usuário.');
    res.redirect('/users/dashboard');
  }
},

// Atualizar os dados do usuário
updateUser: async (req, res) => {
  const { matricula, ano } = req.params;
  const {
    nome,
    data_ingresso,
    data_nascimento,
    categoria,
    gestante,
    qtd_filhos,
    estudante,
    doisvinculos,
    possui_conjuge
  } = req.body;

  try {
    const user = await User.findOne({
      where: { matricula, ano_referencia: ano }
    });

    if (!user) {
      req.flash('error_msg', 'Usuário não encontrado.');
      return res.redirect('/users/dashboard');
    }

    // Convertendo datas
    const dataIngressoDate = new Date(data_ingresso);
    const dataNascimentoDate = new Date(data_nascimento);
    const refDate = new Date(Number(ano), 11, 31); // 31 de dezembro do ano de referência

    // Atualizando dados
    user.nome = nome;
    user.data_ingresso = dataIngressoDate;
    user.data_nascimento = dataNascimentoDate;
    user.categoria = categoria;
    user.gestante = gestante === 'on';
    user.qtd_filhos = qtd_filhos;
    user.estudante = estudante === 'on';
    user.doisvinculos = doisvinculos === 'on';
    user.possui_conjuge = possui_conjuge === 'on';

    // Atualizando campos calculados
    user.data_ingresso_dias = diffInDays(dataIngressoDate, refDate);
    user.data_nascimento_dias = diffInDays(dataNascimentoDate, refDate);

    await user.save();
    await module.exports.updateUserClassification();
    req.flash('success_msg', 'Usuário atualizado com sucesso.');
    res.redirect('/users/dashboard');
  } catch (err) {
    console.error('Erro ao atualizar usuário:', err);
    req.flash('error_msg', 'Erro ao atualizar usuário.');
    res.redirect('/users/dashboard');
                  
  }
}







};
