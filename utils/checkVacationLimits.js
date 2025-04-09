// utils/checkVacationLimits.js
const { Op } = require('sequelize');
const { Vacation, User, Settings } = require('../models');
const { diffInDays } = require('./dateUtils');

const groupMapping = {
  'IPC': ['IPC', 'IPC-P'],
  'IPC-P': ['IPC', 'IPC-P'],
  'EPC': ['EPC', 'EPC-P'],
  'EPC-P': ['EPC', 'EPC-P'],
  'DPC': ['DPC', 'DPC-P'],
  'DPC-P': ['DPC', 'DPC-P']
};

async function checkVacationLimits(userCategory, startDate, endDate, ano_referencia) {
  const settings = await Settings.findOne({ where: { id: 1 } });
  const ano = Number(ano_referencia);
  const userGroup = groupMapping[userCategory];

  const vacations = await Vacation.findAll({
    include: [{
      model: User,
      attributes: ['categoria'],
      where: { ano_referencia: ano },
      required: true
    }],
    where: {
      ano_referencia: ano,
      [Op.or]: [
        { data_inicio: { [Op.between]: [startDate, endDate] } },
        { data_fim: { [Op.between]: [startDate, endDate] } },
        {
          data_inicio: { [Op.lte]: startDate },
          data_fim: { [Op.gte]: endDate }
        }
      ]
    }
  });

  let individualCount = 0;
  vacations.forEach(vac => {
    if (vac.User && vac.User.categoria === userCategory) {
      const overlapStart = vac.data_inicio > startDate ? vac.data_inicio : startDate;
      const overlapEnd = vac.data_fim < endDate ? vac.data_fim : endDate;
      const overlapDays = diffInDays(overlapStart, overlapEnd);
      if (overlapDays >= 1) individualCount++;
    }
  });

  let groupCount = 0;
  vacations.forEach(vac => {
    if (vac.User && userGroup.includes(vac.User.categoria)) {
      const overlapStart = vac.data_inicio > startDate ? vac.data_inicio : startDate;
      const overlapEnd = vac.data_fim < endDate ? vac.data_fim : endDate;
      const overlapDays = diffInDays(overlapStart, overlapEnd);
      if (overlapDays >= 1) groupCount++;
    }
  });

  let availableIndividual = 0;
  if (userCategory === 'IPC') availableIndividual = settings.max_ipc - individualCount;
  else if (userCategory === 'EPC') availableIndividual = settings.max_epc - individualCount;
  else if (userCategory === 'DPC') availableIndividual = settings.max_dpc - individualCount;
  else if (userCategory === 'IPC-P') availableIndividual = settings.max_ipc_p - individualCount;
  else if (userCategory === 'EPC-P') availableIndividual = settings.max_epc_p - individualCount;
  else if (userCategory === 'DPC-P') availableIndividual = settings.max_dpc_p - individualCount;

  let availableGroup = 0;
  if (userGroup[0] === 'IPC') availableGroup = settings.max_ipc_t - groupCount;
  else if (userGroup[0] === 'EPC') availableGroup = settings.max_epc_t - groupCount;
  else if (userGroup[0] === 'DPC') availableGroup = settings.max_dpc_t - groupCount;

  const availableSlots = Math.min(availableIndividual, availableGroup);

  if (availableSlots <= 0) {
    return {
      allowed: false,
      message: `Sua marcação de férias não foi autorizada, pois o limite total para o grupo ${userGroup.join('/')} para o ano ${ano} foi atingido.`,
      availableSlots: 0
    };
  }

  return { allowed: true, availableSlots };
}

module.exports = checkVacationLimits;
