const { Question, Reponse, sequelize } = require('../models');
const { reponsesTotal } = require('../metrics');

function erreur(status, message, details) {
  const error = new Error(message);
  error.status = status;
  if (details) error.details = details;
  return error;
}

// La question en cours, SANS sa bonne réponse : elle ne sort jamais de
// l'API tant que la manche est ouverte, sinon le quiz n'a plus d'intérêt.
async function getQuestionCourante(req, res, next) {
  try {
    const question = await Question.findOne({ where: { active: true } });
    if (!question) {
      return next(erreur(404, 'Aucune manche en cours'));
    }

    res.json({
      success: true,
      data: {
        id: question.id,
        texte: question.texte,
        choix: question.choix,
        ordre: question.ordre
      }
    });
  } catch (error) {
    next(error);
  }
}

// Un joueur répond à la manche en cours. Le pseudo suffit à l'identifier :
// pas de compte, pas de mot de passe, la classe joue depuis son téléphone.
async function postReponse(req, res, next) {
  try {
    const { pseudo, choix } = req.body || {};

    if (typeof pseudo !== 'string' || pseudo.trim().length === 0) {
      return next(erreur(400, 'Le pseudo est requis', { field: 'pseudo' }));
    }
    if (!Number.isInteger(choix) || choix < 0 || choix > 3) {
      return next(erreur(400, 'Le choix doit être un entier entre 0 et 3', { field: 'choix' }));
    }

    const question = await Question.findOne({ where: { active: true } });
    if (!question) {
      return next(erreur(409, 'Aucune manche en cours'));
    }

    const correcte = question.bonneReponse === choix;

    try {
      await Reponse.create({
        questionId: question.id,
        pseudo: pseudo.trim(),
        choix,
        correcte
      });
    } catch (error) {
      // L'index unique (questionId, pseudo) fait le travail : un joueur ne
      // vote qu'une fois par manche, y compris s'il double-clique.
      if (error.name === 'SequelizeUniqueConstraintError') {
        return next(erreur(409, 'Vous avez déjà répondu à cette question'));
      }
      throw error;
    }

    reponsesTotal.inc({ correcte: String(correcte) });

    res.status(201).json({ success: true, data: { correcte } });
  } catch (error) {
    next(error);
  }
}

// Passe à la manche suivante, et revient à la première une fois la
// dernière jouée : la démo peut tourner en boucle sans intervention.
async function mancheSuivante(req, res, next) {
  try {
    const courante = await Question.findOne({ where: { active: true } });
    const ordreCourant = courante ? courante.ordre : 0;

    const suivante =
      (await Question.findOne({
        where: { ordre: { [require('sequelize').Op.gt]: ordreCourant } },
        order: [['ordre', 'ASC']]
      })) || (await Question.findOne({ order: [['ordre', 'ASC']] }));

    if (!suivante) {
      return next(erreur(404, 'Aucune question en base'));
    }

    await sequelize.transaction(async (t) => {
      await Question.update({ active: false }, { where: { active: true }, transaction: t });
      await Question.update({ active: true }, { where: { id: suivante.id }, transaction: t });
    });

    res.json({ success: true, data: { ordre: suivante.ordre, texte: suivante.texte } });
  } catch (error) {
    next(error);
  }
}

// Le score d'un joueur : une bonne réponse vaut un point.
async function getScore(req, res, next) {
  try {
    const pseudo = req.params.pseudo;
    const [points, repondues] = await Promise.all([
      Reponse.count({ where: { pseudo, correcte: true } }),
      Reponse.count({ where: { pseudo } })
    ]);

    res.json({ success: true, data: { pseudo, points, repondues } });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getQuestionCourante,
  postReponse,
  mancheSuivante,
  getScore
};
