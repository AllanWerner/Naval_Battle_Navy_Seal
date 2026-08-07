const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Une seule question est "active" a la fois : c'est la manche en cours.
// Le front lit celle-la, et POST /api/manche/suivante fait tourner.
const Question = sequelize.define('Question', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  texte: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: { notEmpty: true, len: [1, 255] }
  },
  // Quatre propositions, stockees en JSON : pas de table separee pour
  // quatre chaines qui ne sont jamais interrogees individuellement.
  choix: {
    type: DataTypes.JSONB,
    allowNull: false
  },
  // L'index (0 a 3) de la bonne proposition. N'est JAMAIS renvoye au front.
  bonneReponse: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: { min: 0, max: 3 }
  },
  ordre: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true
  },
  active: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  timestamps: true
});

module.exports = Question;
