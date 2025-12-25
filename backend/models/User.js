const bcrypt = require("bcryptjs");

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    "User",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true,
        },
      },
      nome: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      sobrenome: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      celular: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      password: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      google_id: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: true,
      },

      resetPasswordToken: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      resetPasswordExpires: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      tempResetToken: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      // === ADIÇÃO NECESSÁRIA PARA O PLANO ATIVO ===
      plano_ativo_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      // ===========================================
    },
    {
      tableName: "users",
      timestamps: true,

      hooks: {
        beforeCreate: async (user) => {
          // Apenas hashear se a senha existir (não é login social)
          if (user.password) {
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(user.password, salt);
          }
        },
        beforeUpdate: async (user) => {
          // Garante que a senha seja hasheada apenas se foi modificada
          if (user.changed("password") && user.password) {
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(user.password, salt);
          }
        },
      },
    }
  ); 
  
  // Método de comparação (agora como método do modelo)

  User.prototype.comparePassword = function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password || "");
  };

  return User;
};
