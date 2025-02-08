module.exports = (sequelize, DataTypes) => {
  const Vacation = sequelize.define('Vacation', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    matricula: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'matricula'
      }
    },
    periodo: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    data_inicio: {
      type: DataTypes.DATE,
      allowNull: false
    },
    data_fim: {
      type: DataTypes.DATE,
      allowNull: false
    }
  }, {
    tableName: 'Vacations',  // Certificando-se de que o nome da tabela seja correto
    timestamps: true  // Caso você não esteja utilizando timestamps
  });

  Vacation.associate = function(models) {
    Vacation.belongsTo(models.User, { foreignKey: 'matricula', targetKey: 'matricula' });
  };

  return Vacation;
};
