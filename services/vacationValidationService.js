const { isWeekend, diffInDays } = require('../utils/dateUtils');
const { checkVacationLimits } = require('./limitsService');

const validateVacationPeriods = async (user, periods, qtd_periodos, ano_referencia) => {
  const errors = [];

  // Validações de quantidade de dias
  let durations = periods.map(p => diffInDays(p.inicio, p.fim));
  if (qtd_periodos === '1' && durations[0] !== 31) {
    errors.push('Para 1 período, as férias devem ter exatamente 30 dias.');
  } else if (qtd_periodos === '2') {
    const valid = [[11, 21], [16, 16], [21, 11]].some(
      ([a, b]) => (durations[0] === a && durations[1] === b)
    );
    if (!valid) errors.push('Para 2 períodos, deve ser 10+20, 15+15 ou 20+10 dias.');
  } else if (qtd_periodos === '3' && !durations.every(d => d === 11)) {
    errors.push('Para 3 períodos, cada um deve ter exatamente 10 dias.');
  }

  // Regras adicionais por período
  for (let period of periods) {
    if (isWeekend(period.inicio)) {
      errors.push('Data inicial não pode ser em fim de semana.');
    }
    if (period.inicio < new Date(user.periodo_aquisitivo_fim)) {
      errors.push(`Data inicial deve ser após ${new Date(user.periodo_aquisitivo_fim).toLocaleDateString('pt-BR')}`);
    }

    const maxDate = new Date(user.periodo_aquisitivo_fim);
    maxDate.setFullYear(maxDate.getFullYear() + 1);
    maxDate.setDate(maxDate.getDate() + 2);
    if (period.fim > maxDate) {
      errors.push(`Data final excede o limite de ${maxDate.toLocaleDateString('pt-BR')}`);
    }

    const limitCheck = await checkVacationLimits(user.categoria, period.inicio, period.fim, ano_referencia);
    if (!limitCheck.allowed) errors.push(limitCheck.message);
  }

  return errors;
};

module.exports = { validateVacationPeriods };
