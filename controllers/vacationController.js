// controllers/vacationController.js
const db = require('../models');
const User = db.User;
const Vacation = db.Vacation;
const Settings = db.Settings;
const { Op, col, literal } = require('sequelize');

const { parseStartDateBR, parseEndDateBR } = require('../utils/dateUtils');

const validateVacationPeriods = require('../utils/validateVacationPeriods'); // Importa a função



// Função para verificar se uma data é final de semana
function isWeekend(date) {
  const day = date.getDay();
  return (day === 0 || day === 6);
}

// Função para calcular a diferença em dias entre duas datas (contando o primeiro dia)
function diffInDays(date1, date2) {
  const diffTime = Math.abs(date2 - date1);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Converte uma string "YYYY-MM-DD" para um objeto Date que representa o início do dia (00:00)
 * no fuso horário de Brasília (UTC-3).

function parseStartDateBR(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  // Cria data local e converte para UTC automaticamente
  return new Date(year, month - 1, day, 0, 0, 1);
}
 */




/**
 * Converte uma string "YYYY-MM-DD" para um objeto Date que representa o final do dia (23:59)
 * no fuso horário de Brasília (UTC-3). Isso equivale a 02:59 UTC do dia seguinte.
 
function parseEndDateBR(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  // 23:59:59 no horário local
  return new Date(year, month - 1, day, 23, 59, 59);
}
*/



const checkVacationLimits = async (userCategory, startDate, endDate, ano_referencia) => {
  const settings = await Settings.findOne({ where: { id: 1 } });
  const ano = Number(ano_referencia);

  const groupMapping = {
    'IPC': ['IPC', 'IPC-P'],
    'IPC-P': ['IPC', 'IPC-P'],
    'EPC': ['EPC', 'EPC-P'],
    'EPC-P': ['EPC', 'EPC-P'],
    'DPC': ['DPC', 'DPC-P'],
    'DPC-P': ['DPC', 'DPC-P']
  };
  const userGroup = groupMapping[userCategory];

  // Busca todas as férias do grupo no ano que se sobrepõem ao novo intervalo
  const vacations = await Vacation.findAll({
    include: [{
      model: User,
      attributes: ['categoria'],
      where: { categoria: userGroup, ano_referencia: ano },
      required: true
    }],
    where: {
      ano_referencia: ano,
      [Op.or]: [
        {
          data_inicio: { [Op.lte]: endDate },
          data_fim: { [Op.gte]: startDate }
        }
      ]
    }
  });

  // Constrói um mapa de contagem diária
  const countByDate = {};

  for (const v of vacations) {
    let current = new Date(v.data_inicio);
    const end = new Date(v.data_fim);

    while (current <= end) {
      const key = current.toISOString().split('T')[0]; // formato YYYY-MM-DD
      countByDate[key] = (countByDate[key] || 0) + 1;
      current.setDate(current.getDate() + 1);
    }
  }

  // Agora verificamos o novo intervalo dia a dia
  const maxGroupLimit = 
    userGroup[0] === 'IPC' ? settings.max_ipc_t :
    userGroup[0] === 'EPC' ? settings.max_epc_t :
    userGroup[0] === 'DPC' ? settings.max_dpc_t : 0;

  let current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    const key = current.toISOString().split('T')[0];
    const count = countByDate[key] || 0;

    if (count >= maxGroupLimit) {
      return {
        allowed: false,
        message: `A data ${key.split('-').reverse().join('/')} já possui o limite de ${maxGroupLimit} funcionários de férias no grupo ${userGroup.join('/')}.`,
        availableSlots: 0
      };
    }
    current.setDate(current.getDate() + 1);
  }

  return {
    allowed: true,
    availableSlots: maxGroupLimit
  };
};









module.exports = {
  // Exibe o formulário de marcação de férias para o usuário
  showVacationForm: async (req, res) => {
    const { matricula } = req.query;
    if (!matricula) return res.send("Matrícula não informada.");
    const user = await User.findOne({ where: { matricula } });
    if (!user) return res.send("Usuário não encontrado.");
    const vacations = await Vacation.findAll({ where: { matricula } });
    res.render('user_dashboard', { user, vacations, old: {} });
  },

  // Processa a marcação de férias pelo usuário
  markVacation: async (req, res) => {
    const { matricula, ano_referencia, qtd_periodos } = req.body;
    try {
      const user = await User.findOne({ where: { matricula } });
      if (!user) {
        return res.render('user_dashboard', { error_msg: 'Usuário não encontrado.', old: req.body, user, vacations: [] });
      }
      const existingVacations = await Vacation.findAll({ where: { matricula, ano_referencia } });
      if (existingVacations.length > 0) {
        return res.render('user_dashboard', { error_msg: 'Você já marcou suas férias.', old: req.body, user, vacations: existingVacations });
      }
  
      const periods = [];
      for (let i = 1; i <= 3; i++) {
        const inicio = req.body[`periodo${i}_inicio`];
        const fim = req.body[`periodo${i}_fim`];
        if (inicio && fim) {
          // Converte as datas para que o início seja 00:00 e o fim seja 23:59 em Brasília
          periods.push({ inicio: parseStartDateBR(inicio), fim: parseEndDateBR(fim) });
        }
      }
  
      if (!qtd_periodos || periods.length !== parseInt(qtd_periodos)) {
        return res.render('user_dashboard', { error_msg: 'A quantidade de períodos informados não confere com a escolha.', old: req.body, user, vacations: [] });
      }
  
      let availableSlotsMessage = "";
      let durations = periods.map(period => diffInDays(period.inicio, period.fim));
      if (qtd_periodos === '1' && durations[0] !== 31) {
        return res.render('user_dashboard', { error_msg: 'Para 1 período, as férias devem ter exatamente 30 dias.', old: req.body, user, vacations: [] });
      } else if (qtd_periodos === '2') {
        const allowedCombos = [[11, 21], [16, 16], [21, 11]];
        const comboMatch = allowedCombos.some(combo => (durations[0] === combo[0] && durations[1] === combo[1]));
        if (!comboMatch) {
          return res.render('user_dashboard', { error_msg: 'Para 2 períodos, as durações devem ser 10+20, 15+15 ou 20+10 dias.', old: req.body, user, vacations: [] });
        }
      } else if (qtd_periodos === '3' && !durations.every(dur => dur === 11)) {
        return res.render('user_dashboard', { error_msg: 'Para 3 períodos, cada período deve ter exatamente 10 dias.', old: req.body, user, vacations: [] });
      }
  
      for (let period of periods) {
        if (isWeekend(period.inicio)) {
          return res.render('user_dashboard', { error_msg: 'A data inicial não pode ser um dia de final de semana.', old: req.body, user, vacations: [] });
        }
        if (period.inicio < new Date(user.periodo_aquisitivo_fim)) {
          return res.render('user_dashboard', { error_msg: 'A data inicial deve ser posterior ao término do período aquisitivo.', old: req.body, user, vacations: [] });
        }
        const maxDate = new Date(user.periodo_aquisitivo_fim);
        maxDate.setFullYear(maxDate.getFullYear() + 1);
        if (period.fim > maxDate) {
          const maxDateStr = maxDate.toLocaleDateString('pt-BR');
          return res.render('user_dashboard', {
            error_msg: `A data final ultrapassa o limite do período aquisitivo acrescido de 1 ano. A data máxima permitida é ${maxDateStr}.`,
            old: req.body, user, vacations: []
          });
        }
  
        // Verifica os limites de férias para a categoria no período
        const limitCheck = await checkVacationLimits(user.categoria, period.inicio, period.fim, ano_referencia);
        if (!limitCheck.allowed) {
          return res.render('user_dashboard', { error_msg: limitCheck.message, old: req.body, user, vacations: [] });
        }
  
        availableSlotsMessage = `Sua marcação de férias foi autorizada, pois existem ${limitCheck.availableSlots} vagas disponíveis para o período.`;
      }
  
      for (let i = 0; i < periods.length; i++) {
        await Vacation.create({
          matricula: user.matricula,
          periodo: i + 1,
          data_inicio: periods[i].inicio,
          data_fim: periods[i].fim
        });
      }
  
      req.flash('success_msg', availableSlotsMessage);
      return res.redirect(`/vacations/confirmation?matricula=${user.matricula}`);
  
    } catch (error) {
      console.error(error);
      return res.render('user_dashboard', { error_msg: 'Erro ao marcar férias.', old: req.body, user, vacations: [] });
    }
  },
  
  // Exibe a página de confirmação antes do redirecionamento para o calendário
  confirmVacation: async (req, res) => {
    const { matricula } = req.query;
    res.render('confirmation', { matricula });
  },
  
  // Exibe o calendário geral com as marcações de férias de todas as matrículas
  showCalendar: async (req, res) => {
    try {
      const year = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();
      const month = req.query.month ? parseInt(req.query.month) : (new Date().getMonth() + 1);
  
      const firstDay = new Date(year, month - 1, 1);
      const lastDay = new Date(year, month, 0);
  
      const vacations = await Vacation.findAll({
        include: [{ model: User, attributes: ['nome'] }],
        where: {
          ano_referencia: ano_referencia, // garante que busca apenas para o ano corrente
          [Op.or]: [
            { data_inicio: { [Op.between]: [startDate, endDate] } },
            { data_fim: { [Op.between]: [startDate, endDate] } }
          ]
        }
      });
  
      const calendarData = {};
      for (let day = 1; day <= lastDay.getDate(); day++) {
        const currentDate = new Date(year, month - 1, day);
        const dateStr = currentDate.toISOString().slice(0, 10);
        calendarData[dateStr] = [];
      }
  
      function iterateDates(start, end) {
        const dates = [];
        let current = new Date(start);
        while (current <= end) {
          dates.push(new Date(current));
          current.setDate(current.getDate() + 1);
        }
        return dates;
      }
  
      vacations.forEach(vacation => {
        const firstName = vacation.User.nome.split(" ")[0];
        const vacStart = vacation.data_inicio < firstDay ? firstDay : vacation.data_inicio;
        const vacEnd = vacation.data_fim > lastDay ? lastDay : vacation.data_fim;
        const dates = iterateDates(vacStart, vacEnd);
        dates.forEach(date => {
          const dateStr = date.toISOString().slice(0, 10);
          if (calendarData[dateStr] && !calendarData[dateStr].includes(firstName)) {
            calendarData[dateStr].push(firstName);
          }
        });
      });
  
      res.render('calendar', { calendarData, year, month });
    } catch (error) {
      console.error(error);
      res.send("Erro ao carregar o calendário.");
    }
  },
  
  // Exibe o calendário anual filtrado por cargo e ano
  showYearCalendar: async (req, res) => {
    try {
      const year = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();
      const category = req.query.category;
  
      const calendarByMonth = {};
  
      function iterateDates(start, end) {
        const dates = [];
        let current = new Date(start);
        while (current <= end) {
          dates.push(new Date(current));
          current.setDate(current.getDate() + 1);
        }
        return dates;
      }
  
      for (let month = 1; month <= 12; month++) {
        const firstDay = new Date(year, month - 1, 1);
        const lastDay = new Date(year, month, 0);
  
        const whereConditions = {
          [Op.or]: [
            { data_inicio: { [Op.between]: [firstDay, lastDay] } },
            { data_fim: { [Op.between]: [firstDay, lastDay] } },
            { data_inicio: { [Op.lte]: firstDay }, data_fim: { [Op.gte]: lastDay } }
          ]
        };
  
        let includeCondition = [{ model: User, attributes: ['nome', 'categoria'] }];
        if (category) {
          includeCondition = [{
            model: User,
            attributes: ['nome', 'categoria'],
            where: { categoria: category }
          }];
        }
  
        const vacations = await Vacation.findAll({
          include: includeCondition,
          where: whereConditions
        });
  
        const calendarData = {};
        for (let d = 1; d <= lastDay.getDate(); d++) {
          const currentDate = new Date(year, month - 1, d);
          const dateStr = currentDate.toISOString().slice(0, 10);
          calendarData[dateStr] = [];
        }
  
        vacations.forEach(vacation => {
          const firstName = vacation.User.nome.split(" ")[0];
          const vacStart = vacation.data_inicio < firstDay ? firstDay : vacation.data_inicio;
          const vacEnd = vacation.data_fim > lastDay ? lastDay : vacation.data_fim;
          const dates = iterateDates(vacStart, vacEnd);
          dates.forEach(date => {
            const dateStr = date.toISOString().slice(0, 10);
            if (calendarData[dateStr] && !calendarData[dateStr].includes(firstName)) {
              calendarData[dateStr].push(firstName);
            }
          });
        });
  
        calendarByMonth[month] = calendarData;
      }
  
      res.render('year_calendar', { calendarByMonth, year, category });
    } catch (error) {
      console.error(error);
      res.send("Erro ao carregar o calendário anual.");
    }
  },
  
  // Exibe a página de opções do calendário (com botões para cada cargo/ano)
  showCalendarOptions: async (req, res) => {
    res.render('calendar_options');
  },

  // Em controllers/vacationController.js





  
// Renderiza o formulário de férias para admin
// Exemplo no seu controlador (vacationController.js ou outro apropriado)

// ...


showAdminVacationForm: async (req, res) => {
  try {
    const pendingUsers = await User.findAll({
      include: [{
        model: Vacation,
        required: false,
        where: {
          ano_referencia: { [Op.eq]: db.sequelize.col('User.ano_referencia') }
        }
      }],
      where: literal('`Vacations`.`id` IS NULL')
    });
    res.render('admin_vacation_form', { users: pendingUsers, old: {} });
  } catch (error) {
    console.error(error);
    req.flash('error_msg', 'Erro ao carregar a lista de usuários.');
    res.redirect('/users/dashboard');
  }
},





  // Processa o cadastro de férias pelo admin
  // Em controllers/vacationController.js

  adminMarkVacation: async (req, res) => {
    const { matricula, ano_referencia, qtd_periodos } = req.body;
    try {
      const user = await User.findOne({ where: { matricula, ano_referencia } });
      if (!user) {
        return res.render('admin_vacation_form', { error_msg: 'Usuário não encontrado.', old: req.body });
      }
      const existingVacations = await Vacation.findAll({ where: { matricula, ano_referencia } });
      if (existingVacations.length > 0) {
        return res.render('admin_vacation_form', { error_msg: 'O usuário já possui férias cadastradas.', old: req.body });
      }
  
      const periods = [];
      for (let i = 1; i <= 3; i++) {
        const inicio = req.body[`periodo${i}_inicio`];
        const fim = req.body[`periodo${i}_fim`];
        if (inicio && fim) {
          // Usa as funções existentes para converter as datas para o fuso de Brasília
          periods.push({ inicio: parseStartDateBR(inicio), fim: parseEndDateBR(fim) });
        }
      }
  
      if (!qtd_periodos || periods.length !== parseInt(qtd_periodos)) {
        return res.render('admin_vacation_form', { error_msg: 'A quantidade de períodos informados não confere com a escolha.', old: req.body });
      }
  
      if (periods.length >= 2) {
        if (periods[1].inicio < periods[0].inicio) {
          return res.render('admin_vacation_form', { 
            error_msg: 'O início do segundo período não pode ser anterior ao início do primeiro período.', 
            old: req.body 
          });
        }
      }
  
      let availableSlotsMessage = "";
      let durations = periods.map(period => diffInDays(period.inicio, period.fim));
      if (qtd_periodos === '1' && durations[0] !== 31) {
        return res.render('admin_vacation_form', { error_msg: 'Para 1 período, as férias devem ter exatamente 30 dias.', old: req.body });
      } else if (qtd_periodos.startsWith('2')) {
        const allowedCombos = [[11, 21], [16, 16], [21, 11]];
        const comboMatch = allowedCombos.some(combo => (durations[0] === combo[0] && durations[1] === combo[1]));
        if (!comboMatch) {
          return res.render('admin_vacation_form', { error_msg: 'Para 2 períodos, as durações devem ser 10+20, 15+15 ou 20+10 dias.', old: req.body });
        }
      } else if (qtd_periodos === '3' && !durations.every(dur => dur === 11)) {
        return res.render('admin_vacation_form', { error_msg: 'Para 3 períodos, cada período deve ter exatamente 10 dias.', old: req.body });
      }
  
      // Valida cada período com as outras regras
      for (let period of periods) {
        if (isWeekend(period.inicio)) {
          return res.render('admin_vacation_form', { error_msg: 'A data inicial não pode ser um dia de final de semana.', old: req.body });
        }
        if (period.inicio < new Date(user.periodo_aquisitivo_fim)) {
          const dataLimite = new Date(user.periodo_aquisitivo_fim).toLocaleDateString('pt-BR');
          return res.render('admin_vacation_form', { error_msg: `A data inicial deve ser posterior ao término do período aquisitivo, que é ${dataLimite}.`, old: req.body });
        }
        const maxDate = new Date(user.periodo_aquisitivo_fim);
        maxDate.setFullYear(maxDate.getFullYear() + 1);
        maxDate.setDate(maxDate.getDate() + 2);
        if (period.fim > maxDate) {
          const maxDateStr = maxDate.toLocaleDateString('pt-BR');
          return res.render('admin_vacation_form', {
            error_msg: `A data final ultrapassa o limite do período aquisitivo acrescido de 1 ano. A data máxima permitida é ${maxDateStr}.`,
            old: req.body
          });
        }
  
        // Passa o ano_referencia para a verificação dos limites
        const limitCheck = await checkVacationLimits(user.categoria, period.inicio, period.fim, ano_referencia);
        if (!limitCheck.allowed) {
          return res.render('admin_vacation_form', { error_msg: limitCheck.message, old: req.body });
        }
  
        availableSlotsMessage = `Férias cadastradas com sucesso, pois existiam ${limitCheck.availableSlots} vagas disponíveis para o período.`;
      }
  
      // Cria os registros de férias, atribuindo o ano de referência
      for (let i = 0; i < periods.length; i++) {
        await Vacation.create({
          matricula: user.matricula,
          periodo: i + 1,
          data_inicio: periods[i].inicio,
          data_fim: periods[i].fim,
          ano_referencia: ano_referencia
        });
      }
  
      return res.render('admin_vacation_confirmation', { 
        success_msg: availableSlotsMessage 
      });
    } catch (error) {
      console.error(error);
      return res.render('admin_vacation_form', { error_msg: 'Erro ao cadastrar férias.', old: req.body });
    }
  },



editVacationForm: async (req, res) => {
  const { matricula, ano } = req.params;

  try {
    const user = await User.findOne({
      where: { matricula, ano_referencia: ano },
      include: [{
        model: Vacation,
        where: { ano_referencia: ano },
        required: false
      }]
    });

    if (!user || !user.Vacations || user.Vacations.length === 0) {
      req.flash('error_msg', 'Dados de férias não encontrados.');
      return res.redirect('/users/dashboard');
    }

    res.render('vacation_edit_form', {
      user,
      ferias: user.Vacations
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Erro ao carregar dados de férias.');
    res.redirect('/users/dashboard');
  }
},

// Atualizar os dados de férias


// controllers/vacationController.js (trecho do updateVacation atualizado)

// controllers/vacationController.js (parte de updateVacation com validações aplicadas modularmente)



// Atualizar os dados de férias com validações


updateVacation: async (req, res) => {
  const { matricula, ano } = req.params;
  const isJsonRequest = req.headers.accept.includes('application/json');

  try {
    console.log(`[UPDATE] Requisição recebida para matrícula ${matricula}, ano ${ano}`);
    console.log(`[BODY RECEBIDO]`, req.body);

    const { qtd_periodos } = req.body;
    const updates = [];

    for (let i = 1; i <= qtd_periodos; i++) {
      const inicioRaw = req.body[`data_inicio_${i}`];
      const fimRaw = req.body[`data_fim_${i}`];
      const periodo = req.body[`periodo_${i}`];

      if (!inicioRaw || !fimRaw || !periodo) {
        const message = 'Todos os campos são obrigatórios.';
        return isJsonRequest
          ? res.json({ success: false, message })
          : res.redirect('/users/dashboard');
      }

      updates.push({
        inicio: parseStartDateBR(inicioRaw),
        fim: parseEndDateBR(fimRaw),
        periodo: parseInt(periodo)
      });
    }

    const user = await User.findOne({ where: { matricula, ano_referencia: ano } });
    if (!user) {
      const message = 'Usuário não encontrado.';
      return isJsonRequest
        ? res.json({ success: false, message })
        : res.redirect('/users/dashboard');
    }

    // 🔹 Backup férias antigas
    const oldVacations = await Vacation.findAll({ where: { matricula, ano_referencia: ano } });
    const backup = oldVacations.map(v => v.toJSON());

    // 🔹 Remove férias atuais
    await Vacation.destroy({ where: { matricula, ano_referencia: ano } });

    // 🔹 Validação unificada com férias removidas
    const validation = await validateVacationPeriods({
      user,
      periods: updates,
      qtd_periodos,
      ano_referencia: ano
    });

    if (!validation.valid) {
      await Vacation.bulkCreate(backup); // Restaura férias
      return res.json({ success: false, message: validation.message });
    }

    // 🔹 Cria as férias novas
    for (const { inicio, fim, periodo } of updates) {
      await Vacation.create({
        matricula,
        periodo,
        data_inicio: inicio,
        data_fim: fim,
        ano_referencia: ano
      });
    }

    return res.json({ success: true, message: 'Férias atualizadas com sucesso!' });

  } catch (err) {
    console.error('[ERRO] Ao atualizar férias:', err);
    const message = 'Erro ao atualizar férias.';
    return isJsonRequest
      ? res.json({ success: false, message })
      : res.redirect('/users/dashboard');
  }
}



};





