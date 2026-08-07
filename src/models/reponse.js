const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Une ligne par reponse envoyee. C'est la table qui grossit pendant
// l'ouverture du feu, et celle que quiz-scores agrege pour le classement.
const Reponse = sequelize.define('Reponse', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  questionId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  pseudo: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: { notEmpty: true, len: [1, 32] }
  },
  choix: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: { min: 0, max: 3 }
  },
  // Calcule au moment de l'ecriture : le classement se lit alors en un
  // COUNT, sans avoir a rejoindre les questions ni connaitre leurs reponses.
  correcte: {
    type: DataTypes.BOOLEAN,
    allowNull: false
  }
}, {
  timestamps: true,
  indexes: [
    { fields: ['pseudo'] },
    // Un joueur ne repond qu'une fois par question.
    { unique: true, fields: ['questionId', 'pseudo'] }
  ]
});

module.exports = Reponse;
