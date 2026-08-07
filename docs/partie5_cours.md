# Jour 5 — Cours : La Bataille des Services

> Initiation à la méthodologie DevOps, GitLab CI/CD et conteneurisation Docker.
> Partie cadrage et organisation. La partie pratique est dans [partie5_exercices.md](partie5_exercices.md).

En équipes de 3 ou 4, chaque équipage construit un arsenal de services que le reste de la classe essaiera de casser, en pleine démo.

## Sommaire

1. [La carte de bataille](#1--la-carte-de-bataille)
2. [Constituer les équipages](#2--constituer-les-équipages)
3. [Le contrat de la flotte](#3--le-contrat-de-la-flotte)
4. [Travailler à plusieurs sur un même repo](#4--travailler-à-plusieurs-sur-un-même-repo)
5. [L'ouverture du feu et les passages](#5--louverture-du-feu-et-les-passages)
6. [Récapitulatif de la semaine](#récapitulatif-jour-5)

---

## 1 — La carte de bataille

Un tableau projeté, une couleur par équipage, un carré par service.

- **Carré plein** : le service tourne.
- **Carré vide** : il ne répond plus, et toute la salle le voit en même temps que vous.

Votre équipage jure ce matin de tenir un certain nombre de carrés allumés jusqu'au soir. À heure fixe, la classe aura le droit de tirer dessus, et une panne sera tirée au sort pendant que vous parlez.

Vous savez déjà tout faire : construire une image, la publier, la déployer par une pipeline, la surveiller, écrire la procédure. Ce qui change, c'est qu'il y a un écran, et que l'écran ne ment pas.

### Le pouls

> **Le pouls :** un appel HTTP que votre service envoie au tableau toutes les quelques secondes pour dire « je suis vivant, voilà qui je suis ».

Chaque pouls transporte cinq choses : le nom de l'équipage, sa couleur, le nom du service, le nom du conteneur qui parle, et la version d'image qui tourne. Le tableau répond, et sa réponse contient **le nombre de coups que le service doit encaisser**.

### Les trois états d'un carré

| État | Signification | Nature du problème |
|---|---|---|
| **PLEIN** | pouls il y a moins de 8 secondes, aucun retard | le service répond et suit le rythme |
| **PÂLE** | le pouls arrive encore, mais plus de 40 coups se sont accumulés | il répond, il ne suit plus : **capacité** |
| **VIDE** | plus aucun pouls depuis 8 secondes | mort, ou incapable de parler : **existence** |

La nuance entre les deux derniers vaut la journée entière. Ce ne sont pas les mêmes causes, ni les mêmes réparations.

### Le pavillon

Sous les carrés de chaque équipage s'affiche son pavillon : une phrase libre, du genre « On coule pas, on plie ». Vos services la lisent **sur leur disque** et la renvoient à chaque pouls.

D'où le piège de la journée : rangée au bon endroit, elle survit au prochain déploiement. Rangée au mauvais endroit, elle s'efface de l'écran pile au moment où vous livrez, devant toute la classe.

Le carré affiche aussi **le tag de l'image qui tourne dedans**. Quand vous livrez, les carrés changent de tag l'un après l'autre, et la classe regarde le déploiement traverser vos services en direct.

### Pourquoi c'est le service qui appelle

Pourquoi pas un tableau qui irait interroger chaque service ?

**Parce que le réseau l'interdit.** Vos services tournent sur vos machines, derrière le réseau de l'école, souvent derrière une box et un pare-feu. Une machine extérieure ne peut pas ouvrir une connexion vers un poste sans adresse publique. C'est le mur rencontré en J3, quand un runner hébergé chez GitHub n'atteignait pas un conteneur posé sur un poste, et qu'il a fallu un runner self-hosted.

Le sens de la flèche est imposé par le réseau : le trafic part toujours de chez vous vers le tableau. Un appel sortant en HTTPS passe partout.

**Retenez-le : la sixième panne de la journée sort entièrement de là.**

### Le déroulé

1. Constitution des équipages : carte de compétences, rôles, contrat de la flotte.
2. Le tableau apparaît au projecteur, vide. Chaque équipage annonce sa couleur, son nom et le nombre de carrés qu'il jure de tenir.
3. La construction, tout le reste de la journée, le tableau projeté en permanence.
4. **L'ouverture du feu**, à heure fixe : la classe entière tire sur toutes les flottes en même temps.
5. Les passages : chaque équipage raconte sa flotte et encaisse une panne.

---

## 2 — Constituer les équipages

Une équipe qui se forme par affinité produit toujours le même résultat : celui qui maîtrise déjà Docker fait Docker, celui qui maîtrise déjà la pipeline fait la pipeline, et chacun ressort de la journée aussi compétent qu'il y est entré. On fait le contraire.

### La carte de compétences

Chacun se note de 0 à 2 sur cinq axes, sur ce qu'il a **réellement fait** cette semaine.

| Axe | 0 | 1 | 2 |
|---|---|---|---|
| Image et Dockerfile | j'ai suivi sans finir | mon image tourne | multi-stage, non-root, et je sais pourquoi |
| Compose et réseau | j'ai copié le fichier | ma stack monte | j'ai débogué un service qui n'en joignait pas un autre |
| Pipeline | j'ai regardé | ma pipeline est verte | j'ai fait échouer un job exprès et je l'ai réparé |
| Déploiement et machine cible | pas allé jusque là | mon push déploie | j'ai fait un retour arrière et je l'ai chronométré |
| Surveillance | pas allé jusque là | mon dashboard affiche | mes panneaux m'ont servi à trouver une panne |

**Règle de composition : jamais deux 2 sur le même axe dans la même équipe.** Une flotte a besoin d'une compétence par rôle, pas de trois personnes qui savent faire la même chose.

### Le rôle interdit

**Personne ne tient le rôle sur lequel il est le plus fort.** Le 2 en pipeline ne touche pas au workflow, le 2 en Docker n'écrit aucun Dockerfile. Ils font autre chose, et surtout, ils répondent aux questions.

Ça coûte une demi-heure et ça en rapporte deux. Expliquer un job de déploiement à quelqu'un qui ne l'a jamais écrit reste le meilleur moyen de découvrir les trois endroits où on ne l'avait pas compris. Et une équipe où une seule personne sait faire une chose tombe le jour où cette personne est absente.

### Les cinq rôles

Une personne peut en tenir deux si l'équipe est à trois, mais **aucun rôle ne reste vacant**. Chaque rôle porte le nom de la personne qui le tient : à 15h, quand un carré s'éteint, on doit pouvoir appeler quelqu'un et pas un concept.

#### En charge des images

Décide de ce qui entre dans chaque conteneur, et surtout de ce qui n'y entre pas. Personne d'autre n'écrit de Dockerfile.

- Un Dockerfile par service, multi-stage, utilisateur non privilégié.
- Mesurer la taille de chaque image avant et après ses décisions, et reporter les deux chiffres dans le carnet de la flotte.
- Vérifier que chaque service démarre avec les variables d'environnement qu'on lui donne, jamais avec une valeur en dur.
- Répondre aux questions des autres sans construire à leur place.

*Tenu quand* : n'importe qui dans l'équipage peut reconstruire les trois images d'une seule commande.

#### En charge de la livraison

Possède le fichier de workflow et la machine cible. **Le seul territoire où on entre à une personne à la fois**, parce que deux branches qui modifient la pipeline coûtent une heure à tout le monde.

- Construire et publier les images depuis la pipeline, taguées au sha du commit.
- Envoyer le compose sur la machine cible et y remplacer la flotte entière, sans jamais ouvrir de terminal à la main.
- Faire échouer le job quand un service ne répond pas, plutôt qu'afficher un vert qui ment.
- Savoir revenir à la version précédente, et connaître le temps que ça prend.

*Tenu quand* : plus personne n'a tapé une commande à la main sur la machine cible depuis la phase 4.

#### En charge de l'état

Tout le reste de la flotte est jetable. Cette personne s'occupe de ce qui n'a pas le droit de disparaître.

- Choisir où vivent la base et le pavillon, monter les volumes qui les portent.
- Écrire la route qui reçoit le pavillon, vérifier après chaque déploiement qu'il est toujours au tableau.
- Garder le mot de passe de la base hors du repo, du premier commit au dernier.
- Relire tout ce qui touche à une écriture sur disque.

*Tenu quand* : un redéploiement complet ne fait rien perdre, et la classe le voit à l'écran.

#### En charge de la mesure

Construit ce que le tableau de la classe ne donne pas : **la raison**. Le tableau dit qu'un carré est éteint, elle seule peut dire pourquoi.

- Exposer les métriques de chaque service, les brancher sur Prometheus.
- Construire les quatre panneaux, et défendre chaque panneau qui reste.
- Trouver le point de bascule de la flotte.
- Tenir le carnet de la flotte à jour, y compris les chiffres décevants.

*Tenu quand* : quelqu'un nomme une panne en regardant uniquement les panneaux, sans ouvrir un terminal.

#### En astreinte

Le rôle le plus recherché de la journée, et celui qu'on comprend en dernier. Cette personne **ne construit rien**. Elle garde le tableau sous les yeux, prévient dès qu'un carré change d'état, et écrit ce qui s'est passé pendant que les autres réparent.

- Annoncer chaque changement au tableau, avec l'heure, sans attendre qu'on lui demande.
- Tenir le journal de bord : une entrée par panne, y compris celles qu'on n'a pas su réparer.
- Écrire le runbook, celui avec lequel un autre équipage remontera la flotte sans jamais vous parler.
- Faire l'introduction du passage devant la classe et raconter le diagnostic à voix haute.

*Tenu quand* : l'équipage apprend une panne par cette personne, et pas par le rire de la salle.

> **Chaque membre du groupe doit prendre la parole pour être noté.**

### Deux règles pour tout le monde

- **Personne ne fusionne sa propre pull request.** La relecture vient de quelqu'un d'un autre rôle, et c'est là que le relecteur apprend quelque chose.
- **La machine de production change de main au moins une fois.** Si votre procédure ne permet pas de remonter la flotte ailleurs que sur la machine qui l'a vue naître, ce n'est pas une procédure, c'est un souvenir.

### Équipages à géométrie variable

**À trois** : le rôle en astreinte se cumule avec celui de la mesure, et le nombre de carrés jurés baisse d'un. Trois personnes qui promettent six services passeront la journée à réparer et zéro minute à comprendre.

**À cinq** : il reste une place pour le **saboteur**. Son après-midi consiste à casser la flotte de sa propre équipe avant que la classe n'en ait le droit. Chaque problème trouvé avant l'ouverture du feu est un problème que personne ne verra en public.

---

## 3 — Le contrat de la flotte

Le sujet est cadré volontairement : **le vrai sujet de la journée, c'est la chaîne de livraison, pas l'application qu'elle transporte.**

### Ce qui est imposé

Quatre briques au minimum, trois d'entre elles tiennent un carré.

| La brique | Ce qu'elle fait | Carré |
|---|---|---|
| Le front | une page web que la classe peut ouvrir | oui |
| L'API métier | les données de l'application, lues et écrites | oui |
| La base de données | PostgreSQL ou équivalent | **non** |
| Le service annexe | autre chose, qui fait un travail que les deux autres ne font pas | oui |

La DB n'a pas de carré, et ce n'est pas un oubli : **une base ne parle pas HTTP, elle ne peut pas envoyer de pouls**. Elle est là quand même, parce que le jour où elle coule, c'est le carré de votre API qui s'éteint. Un carré vide qui désigne une panne située ailleurs, c'est la première chose que la classe apprendra à lire.

Le service annexe doit être **différent** des deux autres : compter, notifier, agréger, transformer, discuter avec l'extérieur. Un deuxième front ne compte pas, une API qui fait la même chose sur une autre table non plus.

### Le contrat à annoncer

Cinq choses, après constitution des équipes :

1. le **nom** de l'équipage et sa **couleur**, en hexadécimal (`#e05252`) ;
2. les **membres** de l'équipe ;
3. le **nombre de carrés** juré jusqu'à la fin de l'après-midi, trois au minimum ;
4. le **pavillon**, la phrase qui s'affichera sous les carrés ;
5. le **repository**.

Le chiffre juré est un pari. Six carrés, c'est six images à construire, six sondes à câbler, six services à garder vivants sous la charge. **Trois carrés tenus proprement valent mieux que six dont la moitié est pâle.** Chaque carré au-delà de trois compte dans l'évaluation, à condition qu'il rende un service que les autres ne rendent pas.

### Ce qui est libre

Le langage, le sujet, le nombre de services au-delà de trois. Réserve d'idées, avec pour chaque ligne le front, l'API métier, puis le service annexe :

- un **buzzer** de jeu télévisé : le gros bouton, qui a buzzé en premier, l'historique des manches ;
- un **quiz en direct** : les questions et le score, les réponses et le décompte, le classement ;
- un **mur de messages éphémères** : le mur, poster et lire, le nettoyage de ce qui a expiré ;
- un **compteur collectif** : le bouton et le total, l'incrément, les clics par seconde ;
- un **sondage projeté** : les choix et les barres, les votes, l'export ;
- une **file de karaoké** : la file, s'inscrire et passer son tour, l'alerte aux trois suivants ;
- un **mini réseau social de promo** : le fil, les posts, la détection des doublons.

Toutes ont la même qualité : la classe peut les utiliser depuis son téléphone pendant votre passage, ce qui rend votre charge réelle plutôt que simulée.

> ⛔ **Interdit** : une Todo API / App, ou un ClickFast.

### Le pavillon : le message qui doit survivre

Le pavillon se hisse par un appel HTTP sur un de vos services, qui l'écrit sur son disque et le renvoie ensuite à chaque pouls.

C'est un exercice de persistance. Un fichier écrit dans le système de fichiers d'un conteneur vit exactement aussi longtemps que ce conteneur : le prochain déploiement le remplace, et le fichier part avec lui. Un fichier écrit dans un **volume Docker** survit au remplacement. Aujourd'hui l'enjeu est public : si le pavillon tombe pendant que vous livrez, la classe le voit avant vous.

### FAQ : le front doit-il tomber quand l'API tombe ?

**Non, et c'est le réflexe le plus précieux de la journée.**

Dans l'écriture la plus naturelle, le front appelle l'API au chargement, l'appel échoue, une exception remonte, la page ne s'affiche pas. **Deux carrés éteints pour une seule panne**, et le tableau raconte une histoire plus grave que la réalité.

> **La dégradation gracieuse :** un service qui continue de rendre la partie de son travail qui ne dépend pas de ce qui est tombé, au lieu de tomber avec.

Un front qui dégrade proprement affiche sa page et ses éléments statiques, et remplace la zone qui dépend de l'API par un message honnête du type « données indisponibles ». Son carré reste plein, parce que lui, il répond.

La question vaut pour chaque service : **si tout ce dont je dépends disparaît, est-ce que je réponds encore ?** Un service dont la réponse est non n'est pas cassé, mais il propage les pannes des autres, et sa propre santé ne veut plus rien dire.

---

## 4 — Travailler à plusieurs sur un même repo

Depuis lundi, chacun pousse sur `main` sans se poser de question. Aujourd'hui vous êtes trois ou quatre sur le même repo, et une pull request mal gérée coûte une heure à tout le monde.

### Le repo de groupe

Personne ne fournit de repo : l'équipage crée le sien, et ça prend cinq minutes. Il ne part pas de zéro, puisqu'on récupère **le travail de la veille de l'un d'entre vous**, avec son Dockerfile de production, sa pipeline qui déploie, son compose et sa procédure.

Le membre en charge de la livraison s'en occupe, dans cet ordre :

1. Créer un repo vide sur GitHub, au nom de l'équipage, **sans README ni `.gitignore`** : le moindre fichier créé là évite un conflit inutile au premier push.
2. Y pousser le repo de la veille de l'un des membres, celui qui déployait déjà en J3.
3. Ajouter les autres membres comme collaborateurs avec droit d'écriture (`Settings` puis `Collaborators`).
4. Protéger `main` si le plan GitHub le permet, pour que la fusion passe forcément par une pull request.

```bash
# Depuis le repo de la veille, sur l'ordinateur du membre en charge de la livraison
git remote add equipage git@github.com:<compte>/<nom-de-l-equipage>.git
git push equipage main

# Chacun des autres membres clone le repo de l'équipage, et travaille uniquement dedans
git clone git@github.com:<compte>/<nom-de-l-equipage>.git
```

> ⛔ **Ne pas reproposer les mêmes fonctionnalités et les mêmes services** que le repo d'origine, sinon c'est trop facile.

### Les quatre règles du GitHub flow

- **`main` est toujours déployable.** Ce qui est sur `main` est ce qui tourne sur la machine cible.
- **Un travail, une branche**, nommée par ce qu'elle fait : `front-degradation`, `pipeline-deploy`, `service-stats`.
- **Un retour sur `main`, une pull request**, relue par quelqu'un d'un autre rôle, jamais par son auteur.
- **Des pull requests petites et fréquentes**, une par intention. À cinquante fichiers, elle n'est plus relue, elle est approuvée les yeux fermés.

> **Une pull request :** une demande de fusionner une branche dans une autre, qui ouvre un espace de discussion et de relecture avant que le code ne rejoigne le tronc commun.

### 🚨 Le conflit qui coûte une soirée

Les conflits n'arrivent presque jamais sur le code métier. Ils arrivent sur **les trois fichiers que tout le monde touche** : le compose, le workflow, le fichier d'environnement d'exemple.

Trois habitudes suffisent :

- **Un fichier partagé, une personne à la fois.** Celui qui modifie le compose l'annonce, le fait, et le pousse dans la demi-heure.
- **Un `git pull --rebase origin main` avant chaque pull request.** Le conflit se règle sur votre branche, par la personne qui connaît son propre code.
- **Le compose se découpe en blocs, un service par bloc, chacun le sien.** Deux personnes qui ajoutent leur service à la fin du fichier créent un conflit ; deux personnes qui écrivent dans leur bloc n'en créent aucun.

---

## 5 — L'ouverture du feu et les passages

À heure fixe, quel que soit l'état d'avancement de chacun, **le feu s'ouvre**. Tous les carrés de la classe deviennent cliquables, par tout le monde, en même temps. Un quart d'heure de chaos collectif, où chacun découvre ce que sa flotte encaisse et à partir de quand elle pâlit.

Personne n'est exclu de ce moment. Un équipage qui n'a qu'un carré allumé participe avec un carré, et il apprendra la même chose que les autres, en pire et donc plus vite.

Viennent ensuite les passages, **dix minutes par équipage** :

1. **La flotte, en deux minutes.** Ce que fait l'application, combien de carrés, et pourquoi ce pavillon.
2. **La livraison, en direct.** Un `git push`, et la classe regarde les tags changer sur vos carrés.
3. **La panne, tirée au sort.** Quelqu'un de l'équipage lance le script, personne ne sait ce qui sort.
4. **Le diagnostic, à voix haute**, avec le tableau de bord projeté à côté du tableau de la classe.

### La minute d'hypothèse

Au moment où la panne est lancée, **toute la classe a soixante secondes pour écrire son hypothèse**, avant que l'équipage au tableau ne dise quoi que ce soit. Une ligne suffit : « la base est tombée », « le tag n'existe pas », « le service tourne mais il ne joint plus le tableau ». L'équipage annonce la sienne ensuite.

Le rituel oblige chacun à lire un tableau de bord qui n'est pas le sien, ce qui est exactement l'exercice d'une astreinte prise sur un service qu'on n'a pas écrit.

### Ce qui compte pendant le passage

**Pas la vitesse de réparation. Sérieusement, pas la vitesse.**

Ce qui compte, c'est ce qui est dit à voix haute pendant que ça se passe : nommer ce qu'on voit, dire ce qu'on élimine et pourquoi, annoncer la manœuvre avant de la lancer, reconnaître quand on ne sait pas.

Un équipage qui répare en trente secondes sans savoir dire ce qui s'est passé réussit moins bien son passage qu'un équipage qui n'a pas réparé mais qui a raconté correctement ce que son tableau de bord montrait. Même critère qu'en J3 pendant la passation d'astreinte, et ce n'est pas une coïncidence : c'est le métier.

---

## Récapitulatif Jour 5

### Ce qu'on a appris cette semaine

1. **Un conteneur n'est pas une petite machine virtuelle** : des namespaces, des cgroups, et un système de fichiers en couches, montés à la main en J1 avant qu'un seul `docker run` ne soit tapé.
2. **Une image de production se construit, elle ne s'improvise pas** : multi-stage, utilisateur non privilégié, sonde de santé, et une taille qu'on mesure avant et après chaque décision.
3. **Une pipeline vérifie avant de livrer, et elle sait s'arrêter** : lint, tests, image construite une seule fois et promue telle quelle du staging à la production.
4. **Déployer, c'est remplacer une version par une autre sans casser ce qui tourne** : idempotence, retour arrière chronométré, et un job qui échoue proprement plutôt qu'une pipeline verte devant un service mort.
5. **On ne surveille pas pour surveiller** : quatre panneaux qui permettent de nommer une panne valent mieux que quinze qui décorent.
6. **Le cluster maintient un état voulu, il ne devine rien** : ce qu'il voit, il le répare tout seul ; ce qu'on lui cache reste cassé jusqu'à ce qu'une main humaine intervienne.
7. **Une procédure vaut ce que vaut la personne qui n'a pas participé à l'écrire** : c'est le seul test, et il est passé deux fois cette semaine.
8. **Un service qui va bien et un service qui arrive à dire qu'il va bien sont deux choses différentes** : la sixième panne de la Bataille Navale, et la moitié des fausses alertes en production.

### Où continuer

- **Refaites la flotte tout seul, en une soirée.** Trois services, une pipeline, un tableau de bord. Ce qui a pris une journée à quatre en prend trois heures à un, et c'est le meilleur test de ce qui est vraiment acquis.
- **Regardez ce que fait votre entreprise ou votre lieu de stage** : où sont les images, qui a le droit de déployer, combien de temps prend un retour arrière, et qui reçoit l'alerte à 3h du matin.
- **La doc Docker sur les bonnes pratiques d'images** et **le guide Prometheus sur le choix des métriques** sont les deux lectures qui rapportent le plus vite.
- **Le cluster ne s'arrête pas à ce qu'on en a vu** : autoscaling, gestion des ressources, Helm. Le modèle déclaratif de J4 est la clé qui ouvre tout le reste.
