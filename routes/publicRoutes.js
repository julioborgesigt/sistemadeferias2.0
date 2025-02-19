// routes/publicRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../models');
const User = db.User;
const Vacation = db.Vacation;

// Rota para exibir o formulário de acesso do usuário
router.get('/', (req, res) => {
  res.render('userLogin');
});

// Rota para processar o acesso do usuário
router.post('/', async (req, res) => {
  const { matricula } = req.body;
  try {
    console.log(`🔍 Tentativa de login com matrícula: ${matricula}`);

    // Busca o usuário com a matrícula informada
    const user = await User.findOne({ where: { matricula } });
    if (!user) {
      console.log('⚠️ Usuário não encontrado.');
      req.flash('error_msg', 'Usuário não encontrado.');
      return res.redirect('/user');
    }
    console.log(`✅ Usuário encontrado: ${user.matricula}, Classificação: ${user.classificacao}`);

    // Verifica se o usuário já marcou férias
    const userVacations = await Vacation.findAll({ where: { matricula } });
    if (userVacations.length > 0) {
      console.log('⚠️ Usuário já marcou férias.');
      req.flash('error_msg', 'Você já marcou suas férias.');
      return res.redirect('/user');
    }

    const userWithVacations = await User.findOne({
      include: [{
        model: Vacation,
        required: false,
      }],
      where: { matricula: '11111111' }, // Insira a matrícula de um usuário para testar
    });
    console.log("00000000000000000000000001222222222222222222222222");
    console.log(userWithVacations);


  // Buscar o próximo usuário na fila (sem férias marcadas e com melhor classificação)
  const { Op } = require('sequelize');
  const pendingUser = await User.findOne({
    where: {
      matricula: {
        [Op.notIn]: db.sequelize.literal('(SELECT matricula FROM Vacations)')
      },
      categoria: user.categoria // Filtro por categoria
    },
    order: [['classificacao', 'ASC']],
    attributes: ['matricula', 'classificacao', 'categoria'], // Incluir categoria
  });


    



    if (!pendingUser) {
      console.log('⚠️ Nenhum usuário pendente para marcação de férias.');
      req.flash('error_msg', 'Nenhum usuário pendente de marcação.');
      return res.redirect('/user');
    }

    console.log(`📝 Usuário com melhor classificação pendente: ${pendingUser.matricula}`);
    console.log(`🔎 Usuário pendente encontrado: ${pendingUser?.matricula}`);

    // Se a matrícula não for a do usuário que tem a melhor posição na fila, bloquear o acesso
    if (pendingUser.matricula !== matricula) {
      console.log(`⛔ A matrícula ${matricula} (${user.categoria}) tentou acessar. A vez é do ${pendingUser.categoria} ${pendingUser.matricula}.`);
      req.flash('error_msg', `Ainda não é sua vez na categoria ${user.categoria}. A vez é do usuário ${pendingUser.matricula}.`);
      return res.redirect('/user');
    }

    console.log(`✅ Usuário autorizado para marcação de férias: ${matricula}`);
    res.redirect(`/vacations/form?matricula=${matricula}`);
  } catch (error) {
    console.error('❌ ERRO AO PROCESSAR LOGIN:', error);
    req.flash('error_msg', 'Erro ao tentar acessar a marcação.');
    return res.redirect('/user');
  }
});

module.exports = router;
