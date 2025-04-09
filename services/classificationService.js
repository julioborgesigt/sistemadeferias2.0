const { User } = require('../models');

async function updateUserClassification() {
  const users = await User.findAll({ order: [['data_ingresso_dias', 'DESC']] });
  for (let i = 0; i < users.length; i++) {
    users[i].classificacao = i + 1;
    await users[i].save();
  }
}

module.exports = { updateUserClassification };
