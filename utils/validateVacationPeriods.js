// utils/validateVacationPeriods.js
const { parseStartDateBR, parseEndDateBR, diffInDays, isWeekend } = require('./dateUtils');
const checkVacationLimits = require('./checkVacationLimits');

async function validateVacationPeriods({ user, periods, qtd_periodos, ano_referencia }) {
  if (!qtd_periodos || periods.length !== parseInt(qtd_periodos)) {
    return { valid: false, message: 'A quantidade de períodos informados não confere com a escolha.' };
  }

  if (periods.length >= 2) {
    if (periods[1].inicio < periods[0].inicio) {
      return { valid: false, message: 'O início do segundo período não pode ser anterior ao início do primeiro período.' };
    }
  }

  let durations = periods.map(p => diffInDays(p.inicio, p.fim));
  if (qtd_periodos === '1' && durations[0] !== 30) {
    return { valid: false, message: 'Para 1 período, as férias devem ter exatamente 30 dias!.' };
  } else if (qtd_periodos === '2') {
    const allowedCombos = [[10, 20], [15, 15], [20, 10]];
    const match = allowedCombos.some(([a, b]) => a === durations[0] && b === durations[1]);
    if (!match) {
      return { valid: false, message: 'Para 2 períodos, as durações devem ser 10+20, 15+15 ou 20+10 dias.' };
    }
  } else if (qtd_periodos === '3' && !durations.every(d => d === 10)) {
    return { valid: false, message: 'Para 3 períodos, cada período deve ter exatamente 10 dias.' };
  }

  for (const period of periods) {
    if (isWeekend(period.inicio)) {
      return { valid: false, message: 'A data inicial não pode ser um dia de final de semana.' };
    }

    if (period.inicio < new Date(user.periodo_aquisitivo_fim)) {
      const limite = new Date(user.periodo_aquisitivo_fim).toLocaleDateString('pt-BR');
      return { valid: false, message: `A data inicial deve ser posterior ao fim do período aquisitivo: ${limite}.` };
    }

    const maxDate = new Date(user.periodo_aquisitivo_fim);
    maxDate.setFullYear(maxDate.getFullYear() + 1);
    maxDate.setDate(maxDate.getDate() + 2);
    if (period.fim > maxDate) {
      const maxStr = maxDate.toLocaleDateString('pt-BR');
      return { valid: false, message: `A data final ultrapassa o limite permitido de 1 ano. Máximo: ${maxStr}.` };
    }

    const limitCheck = await checkVacationLimits(user.categoria, period.inicio, period.fim, ano_referencia);
    if (!limitCheck.allowed) {
      return { valid: false, message: limitCheck.message };
    }
  }

  return { valid: true, message: 'Validação bem-sucedida.' };
}

module.exports = validateVacationPeriods;
