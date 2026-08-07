const express = require('express');
const router = express.Router();
const quiz = require('../controllers/quizController');

router.get('/question', quiz.getQuestionCourante);
router.post('/reponse', quiz.postReponse);
router.post('/manche/suivante', quiz.mancheSuivante);
router.get('/score/:pseudo', quiz.getScore);

module.exports = router;
