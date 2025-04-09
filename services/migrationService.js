const { User, Vacation } = require('../models');

async function migrateData(sourceYear, targetYear) {
  const users = await User.findAll({ where: { ano_referencia: sourceYear } });

  for (const user of users) {
    const cloned = await User.create({
      ...user.toJSON(),
      id: undefined, // remove id
      ano_referencia: targetYear,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const vacations = await Vacation.findAll({
      where: { matricula: user.matricula, ano_referencia: sourceYear }
    });

    for (const vac of vacations) {
      await Vacation.create({
        ...vac.toJSON(),
        id: undefined,
        ano_referencia: targetYear,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
  }
}

module.exports = { migrateData };
