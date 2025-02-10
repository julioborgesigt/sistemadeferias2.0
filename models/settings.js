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
    }
  });

  return Settings;
};
