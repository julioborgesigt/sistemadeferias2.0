// controllers/vacationController.js
const db = require('../models');
const User = db.User;
const Vacation = db.Vacation;
const Settings = db.Settings;
const { Op } = require("sequelize");

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

// Função para verificar se o período tem coincidência de até 3 dias e respeita o limite configurado
const checkVacationLimits = async (userCategory, startDate, endDate) => {
  const settings = await Settings.findOne({ where: { id: 1 } });

  const vacations = await Vacation.findAll({
    include: [{ model: User, attributes: ['categoria'] }],
    where: {
      [Op.or]: [
        { data_inicio: { [Op.between]: [startDate, endDate] } },
        { data_fim: { [Op.between]: [startDate, endDate] } }
      ]
    }
  });

  let categoryCount = { IPC: 0, EPC: 0, DPC: 0 };

  for (let vacation of vacations) {
    if (vacation.User.categoria !== userCategory) continue;

    const overlapStart = vacation.data_inicio > startDate ? vacation.data_inicio : startDate;
    const overlapEnd = vacation.data_fim < endDate ? vacation.data_fim : endDate;
    const overlapDays = diffInDays(overlapStart, overlapEnd);

    // Se a sobreposição for de 2 dias ou mais, conta como mesmo período
    if (overlapDays >= 2) {
      categoryCount[vacation.User.categoria]++;
    }
  }

  let availableSlots = 0;
  if (userCategory === 'IPC') availableSlots = settings.max_ipc - categoryCount.IPC;
  if (userCategory === 'EPC') availableSlots = settings.max_epc - categoryCount.EPC;
  if (userCategory === 'DPC') availableSlots = settings.max_dpc - categoryCount.DPC;

  if (availableSlots <= 0) {
    return { allowed: false, message: `O limite de ${userCategory}s em férias foi atingido. Já há ${categoryCount[userCategory]} no mesmo período.`, availableSlots: 0 };
  }

  return { allowed: true, availableSlots };
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
// Processa a marcação de férias pelo usuário
markVacation: async (req, res) => {
  const { matricula, qtd_periodos } = req.body;
  try {
    const user = await User.findOne({ where: { matricula } });
    if (!user) {
      return res.render('user_dashboard', { error_msg: 'Usuário não encontrado.', old: req.body, user, vacations: [] });
    }

    const existingVacations = await Vacation.findAll({ where: { matricula } });
    if (existingVacations.length > 0) {
      return res.render('user_dashboard', { error_msg: 'Você já marcou suas férias.', old: req.body, user, vacations: existingVacations });
    }

    const periods = [];
    for (let i = 1; i <= 3; i++) {
      const inicio = req.body[`periodo${i}_inicio`];
      const fim = req.body[`periodo${i}_fim`];
      if (inicio && fim) {
        periods.push({ inicio: new Date(inicio), fim: new Date(fim) });
      }
    }

    if (!qtd_periodos || periods.length !== parseInt(qtd_periodos)) {
      return res.render('user_dashboard', { error_msg: 'A quantidade de períodos informados não confere com a escolha.', old: req.body, user, vacations: [] });
    }

    let availableSlotsMessage = "";


    // Validações de duração dos períodos conforme a quantidade escolhida
    let durations = periods.map(period => diffInDays(period.inicio, period.fim));
    if (qtd_periodos === '1' && durations[0] !== 30) {
      return res.render('user_dashboard', { error_msg: 'Para 1 período, as férias devem ter exatamente 30 dias.', old: req.body, user, vacations: [] });
    } else if (qtd_periodos === '2') {
      const allowedCombos = [[10, 20], [15, 15], [20, 10]];
      const comboMatch = allowedCombos.some(combo => (durations[0] === combo[0] && durations[1] === combo[1]));
      if (!comboMatch) {
        return res.render('user_dashboard', { error_msg: 'Para 2 períodos, as durações devem ser 10+20, 15+15 ou 20+10 dias.', old: req.body, user, vacations: [] });
      }
    } else if (qtd_periodos === '3' && !durations.every(dur => dur === 10)) {
      return res.render('user_dashboard', { error_msg: 'Para 3 períodos, cada período deve ter exatamente 10 dias.', old: req.body, user, vacations: [] });
    }

   

    for (let period of periods) {
      if (isWeekend(period.inicio)) {
        return res.render('user_dashboard', { error_msg: 'A data inicial não pode ser um dia de final de semana.', old: req.body, user, vacations: [] });
      }

      if (period.inicio < new Date(user.periodo_aquisitivo_fim)) {
        return res.render('user_dashboard', { error_msg: 'A data inicial deve ser posterior ao término do período aquisitivo.', old: req.body, user, vacations: [] });
      }

      // Verifica se há vagas disponíveis no período
      const limitCheck = await checkVacationLimits(user.categoria, period.inicio, period.fim);
      if (!limitCheck.allowed) {
        return res.render('user_dashboard', { error_msg: limitCheck.message, old: req.body, user, vacations: [] });
      }

      availableSlotsMessage = `Sua marcação de férias foi autorizada. Existem ${limitCheck.availableSlots} vagas disponíveis para o período.`;
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
    res.render('user_dashboard', { error_msg: 'Erro ao marcar férias.', old: req.body, user, vacations: [] });
  }
},


// ✅ Nova rota para confirmação antes do redirecionamento
confirmVacation: async (req, res) => {
  const { matricula } = req.query;
  res.render('confirmation', { matricula });
},


  // Exibe o calendário anual com as marcações de férias
  // Exibe o calendário de férias

  // Exibe o calendário geral com as marcações de férias de todas as matrículas
showCalendar: async (req, res) => {
  try {
    // Define o ano e o mês a serem exibidos (padrão: mês atual)
    const year = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();
    const month = req.query.month ? parseInt(req.query.month) : (new Date().getMonth() + 1); // Mês: 1-12

    // Define o primeiro e último dia do mês
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0); // Último dia do mês

    // Consulta todas as férias que interceptam o mês
    const vacations = await Vacation.findAll({
      include: [{ model: User, attributes: ['nome'] }],
      where: {
        [Op.or]: [
          { data_inicio: { [Op.between]: [firstDay, lastDay] } },
          { data_fim: { [Op.between]: [firstDay, lastDay] } },
          { data_inicio: { [Op.lte]: firstDay }, data_fim: { [Op.gte]: lastDay } }
        ]
      }
    });

    // Inicializa um objeto para mapear cada data do mês a um array de primeiros nomes
    const calendarData = {};
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const currentDate = new Date(year, month - 1, day);
      const dateStr = currentDate.toISOString().slice(0, 10); // "YYYY-MM-DD"
      calendarData[dateStr] = [];
    }

    // Função auxiliar para iterar pelos dias entre duas datas (inclusive)
    function iterateDates(start, end) {
      const dates = [];
      let current = new Date(start);
      while (current <= end) {
        dates.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
      return dates;
    }

    // Para cada férias, percorre as datas em que ela ocorre (limitadas ao mês) e adiciona o primeiro nome do usuário
    vacations.forEach(vacation => {
      const firstName = vacation.User.nome.split(" ")[0]; // extrai o primeiro nome
      // Ajusta as datas para que fiquem dentro do mês
      const vacStart = vacation.data_inicio < firstDay ? firstDay : vacation.data_inicio;
      const vacEnd = vacation.data_fim > lastDay ? lastDay : vacation.data_fim;
      const dates = iterateDates(vacStart, vacEnd);
      dates.forEach(date => {
        const dateStr = date.toISOString().slice(0, 10);
        // Evita duplicatas
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
    // Recebe o ano e a categoria via query string
    const year = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();
    const category = req.query.category; // Pode ser 'IPC', 'EPC' ou 'DPC'

    // Objeto que armazenará o calendário por mês
    const calendarByMonth = {};

    // Função auxiliar para iterar pelas datas entre duas datas (inclusive)
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

      // Define a condição para buscar férias que interceptam o mês
      const whereConditions = {
        [Op.or]: [
          { data_inicio: { [Op.between]: [firstDay, lastDay] } },
          { data_fim: { [Op.between]: [firstDay, lastDay] } },
          { data_inicio: { [Op.lte]: firstDay }, data_fim: { [Op.gte]: lastDay } }
        ]
      };

      // Se uma categoria for informada, inclui essa condição na associação com User
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

      // Inicializa o calendário para o mês: para cada dia, um array vazio
      const calendarData = {};
      for (let d = 1; d <= lastDay.getDate(); d++) {
        const currentDate = new Date(year, month - 1, d);
        const dateStr = currentDate.toISOString().slice(0, 10);
        calendarData[dateStr] = [];
      }

      // Para cada férias, percorre os dias do período e adiciona o primeiro nome do usuário
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
}


};
