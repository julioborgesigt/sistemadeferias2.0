const { diffInDays, isWeekend } = require('./dateUtils');
const checkVacationLimits = require('./checkVacationLimits');

function validarCombinacaoDeDias(durations, qtd_periodos) {
  if (qtd_periodos === 1) {
    return durations[0] === 31;
  }

  if (qtd_periodos === 2) {
    const combosValidos = [
      [11, 21],
      [21, 11],
      [16, 16]
    ];
    return combosValidos.some(([a, b]) => (durations[0] === a && durations[1] === b));
  }

  if (qtd_periodos === 3) {
    return durations.every(d => d === 11);
  }

  return false;
}

async function validarPeriodos(periods, user, ano_referencia) {
  if (periods.length !== parseInt(user.qtd_periodos)) {
    return { success: false, message: 'A quantidade de períodos não corresponde à seleção.' };
  }

  const durations = periods.map(p => diffInDays(p.inicio, p.fim));
  if (!validarCombinacaoDeDias(durations, periods.length)) {
    return {
      success: false,
      message: 'Combinação de dias inválida para os períodos escolhidos.'
    };
  }

  for (let period of periods) {
    if (isWeekend(period.inicio)) {
      return { success: false, message: 'A data inicial não pode ser um final de semana.' };
    }

    const fimAquisitivo = new Date(user.periodo_aquisitivo_fim);
    if (period.inicio < fimAquisitivo) {
      return {
        success: false,
        message: `A data inicial deve ser posterior ao fim do período aquisitivo (${fimAquisitivo.toLocaleDateString('pt-BR')}).`
      };
    }

    const limiteMax = new Date(fimAquisitivo);
    limiteMax.setFullYear(limiteMax.getFullYear() + 1);
    limiteMax.setDate(limiteMax.getDate() + 2);

    if (period.fim > limiteMax) {
      return {
        success: false,
        message: `A data final excede o limite de 1 ano após o término do período aquisitivo (${limiteMax.toLocaleDateString('pt-BR')}).`
      };
    }

    const limite = await checkVacationLimits(user.categoria, period.inicio, period.fim, ano_referencia);
    if (!limite.allowed) {
      return { success: false, message: limite.message };
    }
  }

  return { success: true };
}

module.exports = {
  validarCombinacaoDeDias,
  validarPeriodos
};
