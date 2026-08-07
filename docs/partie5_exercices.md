# Jour 5 — Exercices : Tenir sa flotte

> Partie pratique. Le cadrage, les rôles et les règles d'équipe sont dans [partie5_cours.md](partie5_cours.md).
> Pour reprendre ce dépôt sur le repo de groupe, voir [SETUP_REPO_GROUPE.md](SETUP_REPO_GROUPE.md).

## Sommaire

- [Le projet](#le-projet)
- **Palier 1 — le premier carré s'allume**
  - [Phase 1 : le repo de groupe et la machine cible](#phase-1--le-repo-de-groupe-et-la-machine-cible)
  - [Phase 2 : un service, et son pouls](#phase-2--un-service-et-son-pouls)
- **Palier 2 — la flotte au complet, livrée par un push**
  - [Phase 3 : les autres services, une image chacun](#phase-3--les-autres-services-une-image-chacun)
  - [Phase 4 : le push qui livre la flotte entière](#phase-4--le-push-qui-livre-la-flotte-entière)
- **Palier 3 — ce que le remplacement d'un conteneur emporte**
  - [Phase 5 : hisser le pavillon, et le garder](#phase-5--hisser-le-pavillon-et-le-garder)
  - [Phase 6 : des sondes qui disent la vérité](#phase-6--des-sondes-qui-disent-la-vérité)
- **Palier 4 — encaisser les salves**
  - [Phase 7 : la route de travail, et la première saturation](#phase-7--la-route-de-travail-et-la-première-saturation)
  - [Phase 8 : plus d'exemplaires, et le carnet de la flotte](#phase-8--plus-dexemplaires-et-le-carnet-de-la-flotte)
- **Palier 5 — les six pannes**
  - [Phase 9 : le tirage, et la manœuvre](#phase-9--le-tirage-et-la-manœuvre)
  - [Phase 10 : le runbook de la flotte](#phase-10--le-runbook-de-la-flotte)
- **Palier 6 — le tableau de bord qui explique**
  - [Phase 11 : la mesure branchée sur la flotte](#phase-11--la-mesure-branchée-sur-la-flotte)
  - [Phase 12 : les quatre panneaux qui suffisent](#phase-12--les-quatre-panneaux-qui-suffisent)
- **Palier 7 — porter la flotte sur le cluster**
  - [Phase 13 : les manifestes de la flotte](#phase-13--les-manifestes-de-la-flotte)
  - [Phase 14 : la mise à jour pendant le feu](#phase-14--la-mise-à-jour-pendant-le-feu)
- [Ce qui est rendu](#ce-qui-est-rendu)
- [Grille d'évaluation](#grille-dévaluation)

---

## Le projet

À la fin de la journée, le repo de groupe et la machine cible racontent ceci :

- [ ] **trois services minimum plus une base**, chacun avec sa propre image publiée sur un registry ;
- [ ] un `git push` sur la branche principale qui **redéploie la flotte entière**, sans une seule commande tapée à la main ;
- [ ] **trois carrés allumés en permanence** sur le tableau de la classe, avec le pavillon de l'équipage dessous ;
- [ ] un **pavillon qui survit au redéploiement**, parce qu'il vit dans un volume et pas dans un conteneur ;
- [ ] une flotte qui **encaisse les salves sans pâlir**, parce que la capacité a été mesurée et augmentée ;
- [ ] **six pannes essayées et documentées**, avec pour chacune ce qui s'est affiché au tableau et la manœuvre qui répare ;
- [ ] un **tableau de bord qui explique** le cas où un carré s'éteint, plutôt que de se contenter de le constater ;
- [ ] une **procédure remontant la flotte sur une autre machine**, suivable par quelqu'un d'un autre équipage.

> **En une phrase :** quand un carré s'éteint, quelqu'un dans l'équipage sait dire **pourquoi** avant de savoir comment le rallumer.

Chaque phase s'ouvre sur quatre lignes de cadrage, à lire avant de toucher un clavier : le premier réflexe d'une phase n'est pas d'ouvrir un fichier, il est de se mettre d'accord dessus.

---

# Palier 1 : le premier carré s'allume

## Phase 1 : le repo de groupe et la machine cible

> **Objectif** : avoir une machine cible qui répond, et un repo où quatre personnes peuvent pousser sans se marcher dessus.
> **Point de départ** : le repo d'un membre de l'équipage, celui qui déployait déjà en J3, et sa maquette `vm-prod`.
> **Qui pilote** : le membre en charge de la livraison.
> **Terminé quand** : tout le monde a poussé une branche sur le repo de groupe, et `docker ps` répond en SSH sur `vm-prod`.

**Avant de commencer :** le repo se note sur ses commits autant que sur son résultat. Un commit par phase terminée, les fichiers ajoutés un par un, jamais de `git add .` en aveugle, une branche par intention.

Créez d'abord le repo de l'équipage (voir la section 4 du cours) et **vérifiez que chacun peut cloner et pousser avant d'aller plus loin**. Une personne qui découvre à 15h qu'elle n'a pas les droits d'écriture, c'est une pull request qui attend.

La machine cible est celle de J3, la maquette `vm-prod` : un conteneur qui embarque un serveur SSH et son propre Docker. Elle vit sur l'ordinateur du membre en charge de la livraison.

```bash
# La machine cible d'avant-hier, telle qu'on l'a laissée
docker start vm-prod

# On vérifie qu'elle répond toujours, et que son Docker interne est vivant
ssh -i deploy_key -p 2222 root@localhost 'docker ps'
```

Devrait afficher la liste des conteneurs qui tournaient dessus, éventuellement vide, mais **sans erreur de connexion**.

Si `vm-prod` a disparu, ou si elle vivait sur le poste de quelqu'un d'autre, elle se reconstruit à partir du `Dockerfile.vm` de J3. C'est le premier test réel de votre procédure de la veille : **si elle ne suffit pas à remonter la machine cible, c'est maintenant qu'on la corrige, pas à 16h.**

---

## Phase 2 : un service, et son pouls

> **Objectif** : allumer le premier carré de votre flotte au tableau, devant toute la classe.
> **Point de départ** : le repo de groupe de la phase 1, et le service le plus simple de votre application.
> **Qui pilote** : le membre en charge des images, avec celui en astreinte à côté pour lire le tableau.
> **Terminé quand** : le carré apparaît en moins de dix secondes, s'éteint quand on coupe le service, et se rallume seul après une coupure réseau.

**Le réflexe repo :** faites un commit à la seconde où le carré s'allume, avant de toucher à quoi que ce soit d'autre.

Un seul service pour commencer, le plus simple à faire tourner. Il doit répondre sur une route de santé et envoyer son pouls au tableau.

Le code du pouls est fourni, c'est de la plomberie. Version Node.js, à déposer dans le repo et à importer depuis chaque service :

```js
// pouls.js : à importer depuis chaque service qui doit tenir un carré au tableau
import os from "node:os";
import fs from "node:fs";

const TABLEAU = process.env.TABLEAU_URL;
const GROUPE = process.env.GROUPE;
const COULEUR = process.env.COULEUR || "#888888";
const SERVICE = process.env.SERVICE;
const VERSION = process.env.VERSION || "dev";
const PAVILLON = process.env.PAVILLON_FICHIER || "/data/pavillon.txt";
const MOI = process.env.URL_INTERNE || "http://localhost:3000";

let totalEncaisse = 0; // depuis le démarrage de ce process, affiché sur le carré
let aDeclarer = 0;     // encaissés depuis le dernier pouls, ce que le tableau attend

// Le pavillon est relu du disque à chaque pouls : s'il vit dans un volume, il
// traverse le redéploiement, sinon il disparaît du tableau devant toute la classe.
function lirePavillon() {
  try {
    return fs.readFileSync(PAVILLON, "utf8").trim();
  } catch {
    return "";
  }
}

// Un coup, c'est une vraie requête sur sa propre route de travail. Les coups partent
// par paquets de dix en parallèle, sinon un gros retard bloquerait le pouls suivant.
async function encaisser(nombre) {
  const aFaire = Math.min(nombre, 300);
  for (let debut = 0; debut < aFaire; debut += 10) {
    const paquet = [];
    for (let i = debut; i < Math.min(debut + 10, aFaire); i++) {
      paquet.push(
        fetch(`${MOI}/travail`)
          .then((reponse) => {
            if (reponse.ok) {
              totalEncaisse++;
              aDeclarer++;
            }
          })
          .catch(() => {})
      );
    }
    await Promise.all(paquet);
  }
}

async function envoyerPouls() {
  let attente = 5000;
  const declares = aDeclarer;
  try {
    const reponse = await fetch(`${TABLEAU}/api/pouls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        groupe: GROUPE,
        couleur: COULEUR,
        service: SERVICE,
        pod: os.hostname(),
        version: VERSION,
        pavillon: lirePavillon(),
        encaisses: declares,
        total_encaisse: totalEncaisse,
      }),
    });
    // Les coups déclarés ne sont retirés du compteur local qu'une fois le tableau
    // au courant : si l'appel échoue, ils repartiront dans le pouls suivant.
    aDeclarer -= declares;
    const ordre = await reponse.json();
    attente = ordre.prochain_pouls_ms || 5000;
    if (ordre.coups_a_encaisser > 0) await encaisser(ordre.coups_a_encaisser);
  } catch (erreur) {
    console.error("[pouls] tableau injoignable :", erreur.message);
  }
  setTimeout(envoyerPouls, attente);
}

export function demarrerLePouls() {
  if (!TABLEAU || !GROUPE || !SERVICE) {
    console.error("[pouls] TABLEAU_URL, GROUPE et SERVICE sont obligatoires");
    return;
  }
  console.log(`[pouls] ${GROUPE}/${SERVICE} vers ${TABLEAU}`);
  envoyerPouls();
}
```

Version Python, sans dépendance hors bibliothèque standard :

```python
# pouls.py : demarrer_le_pouls() lance un thread, à appeler une fois au démarrage
import json, os, socket, threading, time, urllib.error, urllib.request

TABLEAU = os.environ.get("TABLEAU_URL", "")
GROUPE = os.environ.get("GROUPE", "")
COULEUR = os.environ.get("COULEUR", "#888888")
SERVICE = os.environ.get("SERVICE", "")
VERSION = os.environ.get("VERSION", "dev")
PAVILLON = os.environ.get("PAVILLON_FICHIER", "/data/pavillon.txt")
MOI = os.environ.get("URL_INTERNE", "http://localhost:8000")

_total_encaisse = 0
_a_declarer = 0

def _lire_pavillon():
    try:
        with open(PAVILLON, encoding="utf-8") as fichier:
            return fichier.read().strip()
    except OSError:
        return ""

def _appeler(url, donnees=None, delai=4):
    corps = None if donnees is None else json.dumps(donnees).encode("utf-8")
    requete = urllib.request.Request(url, data=corps, method="POST" if corps else "GET")
    if corps:
        requete.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(requete, timeout=delai) as reponse:
        return reponse.read()

def _encaisser(nombre):
    global _total_encaisse, _a_declarer
    for _ in range(min(nombre, 300)):
        try:
            _appeler(f"{MOI}/travail")
            _total_encaisse += 1
            _a_declarer += 1
        except (urllib.error.URLError, socket.timeout, OSError):
            return

def _pouls():
    global _a_declarer
    while True:
        attente = 5.0
        declares = _a_declarer
        try:
            brut = _appeler(f"{TABLEAU}/api/pouls", {
                "groupe": GROUPE, "couleur": COULEUR, "service": SERVICE,
                "pod": socket.gethostname(), "version": VERSION,
                "pavillon": _lire_pavillon(),
                "encaisses": declares, "total_encaisse": _total_encaisse,
            })
            # Retirés du compteur local seulement une fois le tableau au courant.
            _a_declarer -= declares
            ordre = json.loads(brut)
            attente = ordre.get("prochain_pouls_ms", 5000) / 1000
            if ordre.get("coups_a_encaisser", 0) > 0:
                _encaisser(ordre["coups_a_encaisser"])
        except (urllib.error.URLError, socket.timeout, OSError, ValueError) as erreur:
            print(f"[pouls] tableau injoignable : {erreur}", flush=True)
        time.sleep(attente)

def demarrer_le_pouls():
    if not (TABLEAU and GROUPE and SERVICE):
        print("[pouls] TABLEAU_URL, GROUPE et SERVICE sont obligatoires", flush=True)
        return
    threading.Thread(target=_pouls, daemon=True).start()
```

**Ce que le pouls attend de vous**, en revanche, reste à écrire :

- une route **`/travail`** sur chaque service qui envoie son pouls, qui fait un petit travail réel et répond. Elle encaissera les coups au palier 4, mais **elle doit exister dès maintenant**, même vide ;
- les variables **`TABLEAU_URL`, `GROUPE`, `COULEUR`, `SERVICE`, `VERSION`, `URL_INTERNE`**, injectées par le compose et jamais écrites en dur dans l'image ;
- l'appel à `demarrerLePouls()` au démarrage du service.

**Le contrôle avant de passer à la suite**, dans cet ordre :

1. Le service tourne en local et sa route de santé répond. **Le carré apparaît au tableau en moins de dix secondes.**
2. On coupe le service. **Le carré disparaît dans les huit secondes**, pas plus tard.
3. On coupe le wifi vingt secondes, puis on le rétablit **sans toucher au service**. Le carré s'éteint, puis se rallume tout seul. Un pouls qui abandonne définitivement après une erreur réseau est un pouls à réparer, et il vaut mieux le voir ici qu'au pire moment.

---

# Palier 2 : la flotte au complet, livrée par un push

## Phase 3 : les autres services, une image chacun

> **Objectif** : faire tourner trois services distincts, avec trois images et trois cycles de vie indépendants.
> **Point de départ** : un service qui envoie déjà son pouls, et le reste de l'application encore à écrire.
> **Qui pilote** : le membre en charge des images, avec une pull request par service.
> **Terminé quand** : la flotte monte en local avec `compose.prod.yml`, trois carrés au tableau, et aucun service ne démarre en silence avec une configuration incomplète.

**Rappel notation :** une pull request par service, relue par quelqu'un d'un autre rôle. C'est aussi le moment où l'équipe découvre si ses trois services se ressemblent trop.

Chaque service a son propre Dockerfile et sa propre image, taguée avec le sha du commit. La base vient d'une image officielle, sans être reconstruite.

> ⚠️ **Le piège du palier** : une image unique qui contiendrait les trois services, lancée avec trois commandes différentes. Ça marche, et ça détruit tout ce qu'on a construit cette semaine, puisqu'une correction sur le front oblige alors à reconstruire et redéployer l'API. **Un service, une image, un cycle de vie.**

```yaml
# compose.prod.yml : la flotte telle qu'elle tourne sur la machine cible
services:
  front:
    image: ${REGISTRY}/${GROUPE}-front:${TAG}
    restart: unless-stopped
    environment:
      TABLEAU_URL: ${TABLEAU_URL}
      GROUPE: ${GROUPE}
      COULEUR: ${COULEUR}
      SERVICE: front
      VERSION: ${TAG}
      URL_INTERNE: http://front:3000
      API_URL: http://api:3000
    ports:
      # 3000 est un des quatre ports que la machine cible publie depuis J3,
      # avec 9090 pour Prometheus, 3001 pour Grafana et 2222 pour SSH
      - "3000:3000"
    depends_on:
      - api

  api:
    # TODO : même forme que front, avec SERVICE: api et sa connexion à la base
    # Attention : pas de ports exposés vers l'extérieur si seul le front l'appelle

  annexe:
    # TODO : votre troisième carré

  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - donnees:/var/lib/postgresql/data

volumes:
  donnees:
```

Notez **`restart: unless-stopped`** sur chaque service : c'est la politique de redémarrage de Docker, qui demande au démon de relancer un conteneur qui s'arrête tout seul. Elle décidera du sort de la première panne de la journée, autant la poser en connaissance de cause.

**Ce qu'on vérifie ici.** La flotte monte en local avec `docker compose -f compose.prod.yml up`, et les trois carrés apparaissent. Puis deux cas moins agréables :

- la stack lancée **sans `TABLEAU_URL`** : les services doivent démarrer quand même **en le signalant dans leurs logs** ;
- la stack lancée **sans le mot de passe de la base**.

> Un service qui démarre en silence avec une configuration incomplète est bien plus dangereux qu'un service qui refuse de démarrer.

---

## Phase 4 : le push qui livre la flotte entière

> **Objectif** : remplacer la flotte entière sur la machine cible d'un seul `git push`, sans une commande tapée à la main.
> **Point de départ** : les trois images publiées, le `compose.prod.yml` de la phase 3, et la pipeline de J3.
> **Qui pilote** : le membre en charge de la livraison, seul dans le fichier de workflow.
> **Terminé quand** : un push anodin change les tags des carrés sans en éteindre un, et le même push rejoué deux fois ne casse rien.

**Avant de coder :** cette phase touche au fichier que tout le monde veut modifier. Entrez-y à une personne à la fois, et ne laissez pas la branche ouverte une heure.

La pipeline de J3 déployait un service. Trois choses changent :

- **construire plusieurs images** dans le même workflow, idéalement en parallèle, chacune taguée avec le même sha ;
- **envoyer le fichier de compose** sur la machine cible en même temps que le reste, parce que c'est lui qui décrit la flotte ;
- **remplacer la flotte entière d'un seul geste**, avec un `docker compose pull` suivi d'un `docker compose up -d`.

```yaml
# .github/workflows/deploy.yml, extrait : le job qui livre la flotte
deploy:
  needs: [build]           # les images doivent exister avant qu'on aille les chercher
  runs-on: self-hosted     # le runner de J3, celui qui atteint la machine cible
  steps:
    - uses: actions/checkout@v4

    - name: Envoyer la description de la flotte
      run: |
        # TODO : copier compose.prod.yml sur la machine cible, via scp, dans /srv/flotte
        # La clé privée vient des secrets du repo, jamais du repo lui-même

    - name: Remplacer la flotte
      run: |
        # TODO : en SSH sur la machine cible, depuis /srv/flotte
        #   1. écrire le fichier .env, avec le sha du commit comme TAG
        #   2. docker compose pull
        #   3. docker compose up -d
        # Cette séquence doit pouvoir être relancée deux fois de suite sans rien casser

    - name: Vérifier que la flotte est debout
      run: |
        # TODO : interroger la route de santé de chaque service exposé
        # Le job doit échouer si un service ne répond pas au bout de trente secondes
```

La dernière étape n'est pas décorative. **Une pipeline verte qui a livré une flotte morte est pire qu'une pipeline rouge**, parce qu'elle vous fait chercher ailleurs.

**Trois scénarios à rejouer :**

- [ ] un push anodin, une virgule dans le front : les carrés changent de tag l'un après l'autre, **sans qu'aucun ne s'éteigne plus de quelques secondes** ;
- [ ] le même push, lancé deux fois de suite : le deuxième passage ne casse rien, c'est l'idempotence de J3 sur une flotte ;
- [ ] un push avec une image cassée, par exemple une commande de démarrage volontairement fausse : **la pipeline devient rouge à l'étape de vérification**, et le carré concerné s'éteint. Ce cas resservira au palier 5.

---

# Palier 3 : ce que le remplacement d'un conteneur emporte

## Phase 5 : hisser le pavillon, et le garder

> **Objectif** : afficher le pavillon sous vos carrés, et l'y garder après un déploiement.
> **Point de départ** : la flotte livrée par la pipeline, et une route `/pavillon` qui n'existe pas encore.
> **Qui pilote** : le membre en charge de l'état, celui des images en relecture.
> **Terminé quand** : le pavillon hissé est toujours au tableau quinze secondes après un vrai push.

**Un mot sur le repo :** deux branches et deux pull requests, puisque cette phase touche au compose et à un service.

```js
// Le pavillon arrive par POST, part sur le disque, et le pouls le relit ensuite
app.post("/pavillon", (requete, reponse) => {
  // TODO : écrire le corps de la requête dans le fichier PAVILLON_FICHIER
  // Le dossier parent doit exister, et la longueur est limitée à 140 caractères
  // TODO : répondre 201, et 400 si le message est vide
});
```

**Où ce fichier est-il écrit ?** Trois emplacements, un seul piège.

| Emplacement | Survit à un redémarrage du conteneur | Survit à un redéploiement |
|---|---|---|
| Dans le système de fichiers du conteneur | oui | **non** |
| Dans un volume nommé, monté sur le service | oui | oui |
| Dans la base de données | oui | oui, si la base a son propre volume |

Les deux dernières lignes sont des choix défendables, **la première est un piège qui se referme en public**.

**Le test qui compte**, en trois gestes : hisser le pavillon, le voir au tableau, puis déclencher un vrai redéploiement par un push. S'il est toujours là quinze secondes plus tard, le palier est tenu.

---

## Phase 6 : des sondes qui disent la vérité

> **Objectif** : écrire une route de santé capable de dire que la base est tombée, au lieu de dire que le serveur HTTP tourne.
> **Point de départ** : les routes de santé de J1, qui répondent `200` sans rien vérifier.
> **Qui pilote** : le membre en charge de la mesure, celui de l'état pour les dépendances.
> **Terminé quand** : base arrêtée à la main, l'API passe `unhealthy` en moins de trente secondes pendant que le carré du front reste plein.

**Côté commits :** un commit par service instrumenté, pour pouvoir revenir en arrière service par service quand une sonde se révèle trop stricte.

Deux niveaux à distinguer sur chaque service :

- **Le service répond** : le process est vivant, il accepte les connexions. C'est ce que le pouls prouve déjà, et ce que le carré affiche.
- **Le service fonctionne** : ses dépendances répondent, il peut faire son travail. **C'est ce que la route de santé doit vérifier**, en interrogeant vraiment la base ou le service dont elle dépend.

```yaml
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/sante"]
      interval: 10s
      timeout: 3s
      retries: 3
      start_period: 15s
```

**Ce qui doit se produire :**

- [ ] base arrêtée à la main : la route de santé de l'API passe en erreur en moins de trente secondes, et `docker compose ps` affiche le service `unhealthy` ;
- [ ] pendant ce temps, **le carré du front reste plein**, et le front affiche sa page avec sa zone de données remplacée par un message honnête ;
- [ ] base relancée : tout revient **sans qu'aucune commande ne soit tapée sur les services**, et sans redéploiement.

---

# Palier 4 : encaisser les salves

## Phase 7 : la route de travail, et la première saturation

> **Objectif** : faire encaisser de vrais coups à vos services, et savoir à partir de combien ils pâlissent.
> **Point de départ** : la route `/travail` créée vide au palier 1.
> **Qui pilote** : le membre en charge de l'état pour le travail réel, celui de la mesure pour les chiffres.
> **Terminé quand** : une salve tirée depuis votre poste fait pâlir le carré, qui redevient plein tout seul ensuite.

**Avant de lancer :** rangez les chiffres dans le repo, dans le journal de bord, et pas dans un fichier local que personne ne reverra.

Un coup, c'est une requête sur `/travail`, et **elle doit coûter un peu** : lire en base, calculer, écrire. Quelques millisecondes suffisent, l'important est que ce soit du vrai travail et pas un `return 200` immédiat.

```js
// La route qui encaisse les coups : elle doit faire un travail réel et mesurable
app.get("/travail", async (requete, reponse) => {
  // TODO : un travail qui coûte quelques millisecondes et qui touche à la réalité
  //        du service (une lecture en base, un calcul, une écriture)
  // TODO : répondre 200 si le travail a abouti, 503 s'il n'a pas pu être fait
});
```

Pour trouver le point de bascule, une salve tirée depuis votre propre poste :

```bash
# Une salve manuelle sur son propre service, pour trouver où ça casse.
# Le feu doit être ouvert au tableau, sinon la salve est ignorée.
for i in $(seq 1 5); do
  curl -s -X POST "$TABLEAU_URL/api/coups" \
    -H 'Content-Type: application/json' \
    -d "{\"groupe\":\"$GROUPE\",\"service\":\"api\",\"nombre\":200}"
done
```

Devrait afficher, au tableau, un carré qui **pâlit d'abord**, puis redevient plein au fur et à mesure que le retard se résorbe.

---

## Phase 8 : plus d'exemplaires, et le carnet de la flotte

> **Objectif** : encaisser davantage avec la même flotte, parce qu'on a mesuré avant de dupliquer.
> **Point de départ** : une route `/travail` qui coûte quelques millisecondes, et le point de bascule de la phase 7.
> **Qui pilote** : le membre en charge de la mesure, celui de la livraison pour le passage à l'échelle.
> **Terminé quand** : le carnet de la flotte a ses six lignes remplies, chacune avec son avant et son après.

**Petit rappel :** prenez vos mesures **avant et après**, jamais seulement après. Un chiffre sans point de comparaison ne prouve rien.

```bash
# Trois exemplaires de l'API, derrière le même nom de service sur le réseau interne
docker compose -f compose.prod.yml up -d --scale api=3
```

**Deux pièges**, et les rencontrer fait partie du travail : un service qui expose un **port fixe** vers l'extérieur ne peut pas être dupliqué, puisque deux conteneurs ne peuvent pas écouter sur le même port. Et un service qui garde son **état en mémoire** donne des réponses différentes selon l'exemplaire qui répond.

**Le carnet de la flotte**, à ouvrir ici et compléter aux paliers suivants :

| Ce qu'on mesure | Avant | Après | Ce qui a changé entre les deux |
|---|---|---|---|
| Taille de chaque image | | | |
| Durée entre le push et le dernier carré à jour | | | |
| Coups encaissés par pouls, avec un exemplaire | | | |
| Coups encaissés par pouls, avec trois exemplaires | | | |
| Nombre de coups avant que le carré ne pâlisse | | | |
| Temps de retour à un carré plein après une salve de mille coups | | | |

Est-ce que trois exemplaires encaissent vraiment trois fois plus ? **La réponse est rarement oui**, et la raison de l'écart est plus instructive que le chiffre lui-même. La base de données, elle, n'a pas été dupliquée.

---

# Palier 5 : les six pannes

## Phase 9 : le tirage, et la manœuvre

> **Objectif** : vivre six pannes chez vous, en privé, avant que la classe n'ait le droit de les provoquer en public.
> **Point de départ** : la flotte complète sur la machine cible, et `pannes.sh` déposé dans le repo.
> **Qui pilote** : le membre en astreinte, avec tout l'équipage autour du tableau.
> **Terminé quand** : chaque panne est tirée au moins une fois, chacune a son entrée au journal, et trois réparations sont chronométrées.

**Sur le repo :** une entrée de journal par panne essayée, **même celles qu'on n'a pas su réparer. Surtout celles-là.**

```bash
#!/usr/bin/env bash
# pannes.sh : tire une panne au hasard et l'applique sur la machine cible.
# À lancer depuis votre poste, la machine cible doit être joignable en SSH.
# Personne dans l'équipage ne regarde le numéro qui sort, c'est tout l'intérêt.
set -u

CIBLE="ssh -i deploy_key -p 2222 root@localhost"
SERVICES=(front api annexe)
VICTIME=${SERVICES[$RANDOM % ${#SERVICES[@]}]}
ID="docker ps -qf name=$VICTIME | head -1"

case $((RANDOM % 6)) in
  0) $CIBLE "docker kill \$($ID)" ;;
  1) $CIBLE "docker stop \$(docker ps -qf name=db | head -1)" ;;
  2) $CIBLE "docker exec \$($ID) chmod 000 /data" ;;
  3) $CIBLE "cd /srv/flotte && sed -i 's|^DB_PASSWORD=.*|DB_PASSWORD=|' .env && docker compose up -d api" ;;
  4) $CIBLE "cd /srv/flotte && sed -i 's|^TAG=.*|TAG=nexistepas|' .env && docker compose up -d $VICTIME" ;;
  5) $CIBLE "cd /srv/flotte && sed -i 's|^TABLEAU_URL=.*|TABLEAU_URL=http://127.0.0.1:1|' .env && docker compose up -d $VICTIME" ;;
esac

echo "Le tableau va parler. Qu'est-ce qui s'est éteint, et pourquoi ?"
```

Chaque panne se travaille en trois temps : **ce que le tableau montre, ce qui a réellement cassé, la manœuvre qui répare.** Les deux premières colonnes ne se devinent pas depuis le script, elles se lisent sur l'écran et dans les logs.

| La panne | Ce que la classe voit au tableau | Ce qui a cassé |
|---|---|---|
| 1. Le conteneur tué | un carré s'éteint, puis revient tout seul, ou pas | le process est mort, la politique de redémarrage décide de la suite |
| 2. La base coupée | le carré de l'API pâlit ou s'éteint, celui du front dépend de votre dégradation | rien n'est cassé dans l'API, sa dépendance a disparu |
| 3. Le pavillon muet | le pavillon disparaît, tous les carrés restent pleins | le dossier du volume n'est plus lisible, le service tourne pourtant très bien |
| 4. Le secret effacé | un carré s'éteint au redémarrage suivant | la configuration est incomplète, l'image est intacte |
| 5. La version introuvable | un carré s'éteint et ne revient pas | le tag demandé n'existe pas sur le registry |
| 6. Le tableau injoignable | un carré s'éteint alors que le service va parfaitement bien | rien du tout, sauf le chemin entre votre service et le tableau |

**La sixième est la plus retorse**, et elle boucle sur ce qu'on disait ce matin : le tableau ne dit pas si votre service va bien, il dit **si votre service arrive à raconter qu'il va bien**. Quelqu'un qui ouvre l'application dans son navigateur pendant que le carré est éteint le découvre en dix secondes ; quelqu'un qui ne regarde que le tableau cherche vingt minutes.

**La vérification du palier** : chaque panne tirée au moins une fois, chacune avec son entrée au journal, et trois réparations chronométrées au minimum. Un tirage qui ne casse rien de visible compte aussi et mérite sa ligne : **une panne invisible est un trou de surveillance**, et le palier 6 existe pour ça.

---

## Phase 10 : le runbook de la flotte

> **Objectif** : écrire un document avec lequel un autre équipage remonte votre flotte sans jamais vous parler.
> **Point de départ** : la procédure de J3, et les six pannes de la phase 9.
> **Qui pilote** : le membre en astreinte, celui de la livraison en relecture.
> **Terminé quand** : quelqu'un qui n'a pas écrit le document s'en sert de bout en bout, et on a noté où il a bloqué.

**Avant d'attaquer :** écrivez ce document **pour l'équipage qui s'en servira**, jamais pour vous-même. Écrit pour vous-même, il ne vaut rien.

La procédure de J3 décrivait un service sur une machine. Celle d'aujourd'hui décrit une flotte, et elle gagne trois sections :

- [ ] **Remonter la flotte de zéro sur une autre machine.** Depuis un poste vierge, avec le repo et rien d'autre. C'est la section que le changement de machine de production testera pour de vrai.
- [ ] **Les six pannes**, chacune avec son symptôme au tableau, sa cause, sa manœuvre, et le temps que la réparation a pris chez vous.
- [ ] **Ce qu'on regarde en premier quand un carré s'éteint.** Trois commandes, dans l'ordre, avec ce que chacune permet d'écarter. Pas dix : trois, celles qu'on tape à 3h du matin sans réfléchir.

Le test est celui de J3, il n'a pas d'alternative : **quelqu'un qui n'a pas écrit le document s'en sert, sans poser de question à l'auteur, et on note où il bloque.**

---

# Palier 6 : le tableau de bord qui explique un carré éteint

Le tableau de la classe constate, il ne diagnostique rien : c'est un écran de score, pas un outil d'exploitation.

## Phase 11 : la mesure branchée sur la flotte

> **Objectif** : récolter des métriques qui viennent de tous les services, et plus d'un seul.
> **Point de départ** : Prometheus et Grafana montés en J3, branchés sur une cible unique.
> **Qui pilote** : le membre en charge de la mesure.
> **Terminé quand** : chaque service apparaît comme cible dans Prometheus, et le tableau de bord est exporté en JSON dans le repo.

**Le repo d'abord :** exportez la définition du tableau de bord en JSON et commitez-la. **Un dashboard qui n'existe que dans un navigateur n'existe pas.**

Les métriques qui comptent aujourd'hui, en plus de celles de J3 :

- le nombre de **coups encaissés** par service et par seconde ;
- la **durée de la route `/travail`**, en histogramme, parce que la moyenne masque exactement ce qu'on cherche ;
- le **nombre d'exemplaires** qui répondent réellement pour chaque service ;
- l'**état de la dépendance** de chaque service, en un simple 0 ou 1.

---

## Phase 12 : les quatre panneaux qui suffisent

> **Objectif** : nommer une panne en regardant un écran, sans ouvrir un terminal.
> **Point de départ** : les métriques de la phase 11, et un tableau de bord qui affiche tout sans rien trancher.
> **Qui pilote** : le membre en charge de la mesure et celui en astreinte, ensemble.
> **Terminé quand** : quelqu'un de l'équipage nomme une panne tirée au sort en ne regardant que les quatre panneaux.

**Réflexe commit :** ajoutez un panneau, exportez, commitez.

L'exercice n'est pas d'ajouter des panneaux, il est **d'en avoir peu et de savoir ce que chacun élimine**. Quatre questions, dix secondes chacune :

1. **Est-ce que le service reçoit du trafic ?** Un carré éteint avec du trafic qui arrive et une charge qui monte ne raconte pas la même histoire qu'un carré éteint avec une courbe à plat.
2. **Est-ce qu'il répond, et en combien de temps ?** La latence qui explose avant l'extinction désigne la saturation ; l'extinction sans montée de latence désigne autre chose.
3. **Est-ce que ses dépendances vont bien ?** La panne 2 et la panne 6 se distinguent ici, **et nulle part ailleurs**.
4. **Est-ce que la version qui tourne est celle qu'on croit ?** La panne 5 se voit ici en deux secondes.

**L'épreuve du palier**, plus dure qu'elle n'en a l'air : quelqu'un tire une panne pendant qu'un autre membre regarde **uniquement le tableau de bord**, sans terminal et sans savoir ce qui a été tiré. Il doit nommer la panne. Si les quatre panneaux ne suffisent pas, il en manque un, ou il y en a trop.

---

# Palier 7 : porter la flotte sur le cluster

La flotte tient sur une machine, et cette machine est un point de défaillance unique : elle tombe, tous les carrés s'éteignent ensemble.

## Phase 13 : les manifestes de la flotte

> **Objectif** : faire tourner la flotte sur le cluster, sans plus dépendre du poste d'une seule personne.
> **Point de départ** : le `compose.prod.yml`, le cluster de J4, et le volume du pavillon.
> **Qui pilote** : le membre en charge de la livraison, celui de l'état pour le stockage.
> **Terminé quand** : les mêmes carrés s'allument depuis le cluster, pavillon compris, avec un fichier par objet dans le repo.

**Avant d'écrire un manifeste :** un fichier par objet dans un dossier dédié, et un commit par service porté. Mélanger les deux mondes dans un même commit rend le retour arrière impossible.

Chaque service devient un Deployment et un Service, la base garde son PersistentVolumeClaim, les variables passent par ConfigMap et Secret, et un Ingress expose le front.

Le pavillon mérite une attention particulière : le volume Docker devient une PVC, et la question de savoir **qui la monte** se pose autrement. Deux exemplaires d'un même service qui montent le même volume écrivent dans le même fichier, ce qui marche pour un pavillon et ne marcherait pas pour tout.

---

## Phase 14 : la mise à jour pendant le feu

> **Objectif** : livrer une nouvelle version pendant que la classe tire, sans qu'un seul carré s'éteigne.
> **Point de départ** : la flotte portée sur le cluster, et le rolling update de J4.
> **Qui pilote** : le membre en charge de la livraison, celui en astreinte au chronomètre.
> **Terminé quand** : le tag change sur les carrés sans extinction ni retard, et les deux lignes du dernier relevé sont remplies.

**Dernier rappel :** notez le chiffre qui sort de cette phase dans le carnet. C'est la démonstration la plus visible de la journée.

Bien câblé, le tag d'image change sur le carré, **le carré ne s'éteint pas**, et le retard ne monte pas. Mal câblé, le carré pâlit quelques secondes pendant que du trafic part vers un exemplaire qui n'est pas prêt à le recevoir.

| La façon de livrer | Carrés éteints pendant la livraison | Coups perdus | Durée totale |
|---|---|---|---|
| `docker compose up -d` sur la machine cible | | | |
| Rolling update sur le cluster | | | |

Combien de coups une livraison coûte-t-elle vraiment ? Personne dans la salle n'a la réponse avant de l'avoir mesurée, et **l'écart entre les deux lignes est le résumé le plus court de la semaine**.

---

## Ce qui est rendu

Le repo de groupe, public ou avec accès donné, contient à la fin de la journée :

- [ ] le code des **trois services au minimum** plus la base, chacun avec son propre `Dockerfile` ;
- [ ] le `compose.prod.yml` qui décrit la flotte, et les manifestes du cluster pour les équipages qui l'ont portée ;
- [ ] les workflows dans `.github/workflows/`, dont le job qui livre la flotte entière ;
- [ ] `pannes.sh` et le **tableau des six pannes**, complété avec ce que le tableau a montré pour chacune ;
- [ ] la définition du **tableau de bord, exportée en JSON** ;
- [ ] `docs/RUNBOOK_FLOTTE.md`, avec la remontée depuis zéro sur une autre machine ;
- [ ] un `README.md` qui donne le nom de l'équipage, sa couleur, son pavillon, le nombre de carrés jurés, et **qui tient quel rôle** ;
- [ ] le **carnet de la flotte**, avec ses relevés chiffrés, y compris ceux qui sont décevants.

> ⛔ Aucun mot de passe, aucune clé privée, aucun fichier d'environnement réel dans le repo. **Un `git log -p` qui les ferait apparaître, même supprimés depuis, compte comme une fuite.**

## Grille d'évaluation

| Critère | Poids | Ce qui est regardé |
|---|---|---|
| **Conteneurisation de la flotte** | 20 % | une image par service, multi-stage, non-root, healthcheck, rien d'inutile dedans |
| **Déploiement automatisé** | 20 % | un push livre la flotte entière, le job échoue si un service ne répond pas, retour arrière possible |
| **Surveillance** | 15 % | métriques exposées par service, quatre panneaux qui permettent de nommer une panne sans terminal |
| **Runbook et pannes** | 15 % | six pannes documentées avec symptôme, cause et manœuvre, remontée depuis zéro éprouvée par un tiers |
| **La flotte tenue** | 15 % | carrés jurés contre carrés tenus pendant l'ouverture du feu, saturation encaissée |
| **L'état qui survit** | 10 % | pavillon dans un volume, redéploiement sans perte, base qui garde ses données |
| **Rigueur du repo** | 5 % | commits atomiques, pull requests relues par un autre rôle, aucun secret versionné |

**Apprécié en plus, sans être attendu :** un service annexe qui fait quelque chose que personne d'autre n'a eu l'idée de faire, une dégradation gracieuse visible au tableau pendant la panne 2, une livraison faite pendant l'ouverture du feu sans qu'un carré s'éteigne, un panneau qui a permis de nommer une panne avant l'équipage qui la subissait.
