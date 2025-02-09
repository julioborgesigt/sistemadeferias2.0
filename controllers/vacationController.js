// controllers/vacationController.js
const db = require('../models');
const User = db.User;
const Vacation = db.Vacation;
const { Op } = require("sequelize");

// Função para verificar se uma data é final de semana
function isWeekend(date) {
  const day = date.getDay();
  return (day === 0 || day === 6);
}

// Função para calcular a diferença em dias entre duas datas
function diffInDays(date1, date2) {
  const diffTime = Math.abs(date2 - date1);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

module.exports = {
  // Exibe o formulário de marcação de férias para o usuário
  showVacationForm: async (req, res) => {
    const { matricula } = req.query;
    if (!matricula) {
      return res.send("Matrícula não informada.");
    }
    const user = await User.findOne({ where: { matricula } });
    if (!user) {
      return res.send("Usuário não encontrado.");
    }
    const vacations = await Vacation.findAll({ where: { matricula } });
    res.render('user_dashboard', { user, vacations, old: {} });
  },

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

      // Coleta os períodos informados
      const periods = [];
      if (req.body.periodo1_inicio && req.body.periodo1_fim) {
        periods.push({ 
          inicio: new Date(req.body.periodo1_inicio.replace(/-/g, '/')), 
          fim: new Date(req.body.periodo1_fim.replace(/-/g, '/'))  });
      }
      if (req.body.periodo2_inicio && req.body.periodo2_fim) {
        periods.push({ 
          inicio: new Date(req.body.periodo2_inicio.replace(/-/g, '/')), 
          fim: new Date(req.body.periodo2_fim.replace(/-/g, '/'))  });
      }
      if (req.body.periodo3_inicio && req.body.periodo3_fim) {
        periods.push({ 
          inicio: new Date(req.body.periodo3_inicio.replace(/-/g, '/')), 
          fim: new Date(req.body.periodo3_fim.replace(/-/g, '/'))  });
      }

      // Verifica se a quantidade de períodos informados confere com a escolha do usuário
      if (!qtd_periodos || periods.length !== parseInt(qtd_periodos)) {
        return res.render('user_dashboard', { error_msg: 'A quantidade de períodos informados não confere com a escolha.', old: req.body, user, vacations: [] });
      }

      // 2. Validação de duração dos períodos conforme a quantidade escolhida:
      let durations = periods.map(period => diffInDays(period.inicio, period.fim));
      // OBSERVAÇÃO: diffInDays retorna a quantidade de dias contando a diferença; 
      // verifique se deseja considerar "30 dias exatos" como diferença de 30 ou 31 datas marcadas.
      // Aqui consideramos que 30 dias significa diffInDays === 30.
      if (qtd_periodos === '1') {
        if (durations[0] !== 29) {
          return res.render('user_dashboard', { error_msg: 'Para 1 período, as férias devem ter exatamente 30 dias.', old: req.body, user, vacations: [] });
          

        }
      } else if (qtd_periodos === '2') {
        // Possíveis combinações permitidas: [10,20], [15,15] ou [20,10]
        const allowedCombos = [
          [9, 19],
          [14, 14],
          [19, 9]
        ];
        const comboMatch = allowedCombos.some(combo =>
          (durations[0] === combo[0] && durations[1] === combo[1])
        );
        if (!comboMatch) {
          return res.render('user_dashboard', { error_msg: 'Para 2 períodos, as durações devem ser 10+20, 15+15 ou 20+10 dias.', old: req.body, user, vacations: [] });
          

        }
      } else if (qtd_periodos === '3') {
        // Cada período deve ter 10 dias
        if (!durations.every(dur => dur === 9)) {
          return res.render('user_dashboard', { error_msg: 'Para 3 períodos, cada período deve ter exatamente 10 dias.', old: req.body, user, vacations: [] });
          
        }
      }

      // Validações para cada período individual
      for (let period of periods) {
        if (isWeekend(period.inicio)) {
          return res.render('user_dashboard', { error_msg: 'A data inicial não pode ser um dia de final de semana.', old: req.body, user, vacations: [] });
        }
        if (period.inicio < new Date(user.periodo_aquisitivo_fim)) {
          return res.render('user_dashboard', { error_msg: 'A data inicial deve ser posterior ao término do período aquisitivo.', old: req.body, user, vacations: [] });
        }
        const maxDate = new Date(user.periodo_aquisitivo_fim);
        maxDate.setFullYear(maxDate.getFullYear() + 1);
        const maxDateStr = maxDate.toLocaleDateString('pt-BR'); // Converte a data para o formato DD/MM/AAAA

        if (period.fim > maxDate) {
          return res.render('user_dashboard', {
            error_msg: `A data final ultrapassa o limite do período aquisitivo acrescido de 1 ano. A data máxima permitida é ${maxDateStr}.`,
            old: req.body, user, vacations: []
          });
        }

        // Regra: No máximo 2 usuários podem iniciar férias no mesmo dia
        const existingStartCount = await Vacation.count({ where: { data_inicio: period.inicio } });
        if (existingStartCount >= 2) {
          return res.render('user_dashboard', { error_msg: 'Já existem dois usuários iniciando férias nesse dia.', old: req.body, user, vacations: [] });
        }

        // Regra: Não pode coincidir mais de 3 dias com outro usuário
        const overlappingVacations = await Vacation.findAll({
          where: {
            [Op.or]: [
              { data_inicio: { [Op.between]: [period.inicio, period.fim] } },
              { data_fim: { [Op.between]: [period.inicio, period.fim] } }
            ]
          }
        });

        for (let vacation of overlappingVacations) {
          const overlapStart = vacation.data_inicio > period.inicio ? vacation.data_inicio : period.inicio;
          const overlapEnd = vacation.data_fim < period.fim ? vacation.data_fim : period.fim;
          const overlapDays = diffInDays(overlapStart, overlapEnd);

          if (overlapDays > 3) {
            return res.render('user_dashboard', { error_msg: 'O período de férias não pode ter mais de 3 dias coincidentes com outro funcionário.', old: req.body, user, vacations: [] });
          }
        }
      }

      // Se todas as validações passarem, insere os registros de férias
      const now = new Date();
      let count = 1;
      for (let period of periods) {
        await Vacation.create({
          matricula: user.matricula,
          periodo: count,
          data_inicio: period.inicio,
          data_fim: period.fim,
          createdAt: now,
          updatedAt: now
        });
        count++;
      }

      req.flash('success_msg', 'Férias marcadas com sucesso!');
      res.redirect(`/vacations/calendar?matricula=${user.matricula}`);
    } catch (error) {
      console.error(error);
      return res.render('user_dashboard', { error_msg: 'Erro ao marcar férias.', old: req.body, user, vacations: [] });
    }
  },

  // Exibe o calendário anual com as marcações de férias
  showCalendar: async (req, res) => {
    try {
      const vacations = await Vacation.findAll({ include: [{ model: db.User, attributes: ['matricula'] }] });
      res.render('calendar', { vacations });
    } catch (error) {
      console.error(error);
      res.send("Erro ao carregar o calendário.");
    }
  }
};
