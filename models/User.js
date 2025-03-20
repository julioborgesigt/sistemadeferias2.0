module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    matricula: {
      type: DataTypes.STRING,
      allowNull: false
    },
    nome: {
      type: DataTypes.STRING,
      allowNull: false
    },
    ano_referencia: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    gestante: {
      type: DataTypes.BOOLEAN,
      allowNull: false
    },
    qtd_filhos: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    estudante: {
      type: DataTypes.BOOLEAN,
      allowNull: false
    },
    doisvinculos: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    data_ingresso: {
      type: DataTypes.DATE,
      allowNull: false
    },
    data_ingresso_dias: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    possui_conjuge: {
      type: DataTypes.BOOLEAN,
      allowNull: false
    },
    data_nascimento: {
      type: DataTypes.DATE,
      allowNull: false
    },
    data_nascimento_dias: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    periodo_aquisitivo_inicio: {
      type: DataTypes.DATE,
      allowNull: false
    },
    periodo_aquisitivo_fim: {
      type: DataTypes.DATE,
      allowNull: false
    },
    classificacao: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    categoria: {
      type: DataTypes.ENUM('IPC', 'EPC', 'DPC', 'IPC-P', 'EPC-P', 'DPC-P'),
      allowNull: false,
      defaultValue: 'IPC'
    }
  }, {
    indexes: [
      {
        unique: true,
        fields: ['matricula', 'ano_referencia']
      }
    ]
  });

  User.associate = function(models) {
    User.hasMany(models.Vacation, { foreignKey: 'matricula', sourceKey: 'matricula' });
  };

  return User;
};
