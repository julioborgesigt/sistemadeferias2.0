module.exports = (sequelize, DataTypes) => {
  const Settings = sequelize.define('Settings', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    max_ipc: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 2
    },
    max_epc: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 2
    },
    max_dpc: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 2
    },
    // Novos limites para os cargos com sufixo -P:
    max_ipc_p: {
      type: DataTypes.INTEGER,
      defaultValue: 2
    },
    max_epc_p: {
      type: DataTypes.INTEGER,
      defaultValue: 2
    },
    max_dpc_p: {
      type: DataTypes.INTEGER,
      defaultValue: 2
    },
    // Novos campos para o limite total do grupo
    max_ipc_t: {
      type: DataTypes.INTEGER,
      defaultValue: 3
    },
    max_epc_t: {
      type: DataTypes.INTEGER,
      defaultValue: 3
    },
    max_dpc_t: {
      type: DataTypes.INTEGER,
      defaultValue: 3
    }
  });

  return Settings;
};
