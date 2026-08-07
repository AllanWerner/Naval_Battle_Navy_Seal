"""quiz-scores : le service annexe de la flotte.

Il ne sert aucune page et n'ecrit rien : il agrege. Le front affiche, l'API
metier ecrit, celui-ci lit et calcule le classement. C'est ce qui en fait un
troisieme carre legitime au tableau, et pas un doublon des deux autres.

Il lit les memes tables que quiz-api, en lecture seule. Les noms sont ceux
generes par Sequelize : tables au pluriel, colonnes en camelCase, donc
toujours entre guillemets en SQL.
"""

import os
import time

import psycopg2
from fastapi import FastAPI, HTTPException, Query, Response
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, Histogram, generate_latest

app = FastAPI(title="quiz-scores")

TABLE_REPONSES = "Reponses"
TABLE_QUESTIONS = "Questions"

# ----------------------------------------------------------------- metriques
requetes_total = Counter(
    "http_requests_total",
    "Nombre total de requetes HTTP servies",
    ["method", "route", "status"],
)
duree_requete = Histogram(
    "http_request_duration_seconds",
    "Duree des requetes HTTP en secondes",
    ["method", "route", "status"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5),
)
# L'etat de la dependance, en 0 ou 1 : c'est le panneau qui distingue une
# panne de ce service d'une panne de la base (phase 12).
base_joignable = Gauge(
    "quiz_scores_base_joignable", "1 si la base repond, 0 sinon"
)
joueurs_classes = Gauge(
    "quiz_scores_joueurs", "Nombre de joueurs presents au classement"
)


@app.middleware("http")
async def mesurer(requete, appeler_suivant):
    debut = time.perf_counter()
    reponse = await appeler_suivant(requete)
    # La route matchee, jamais l'URL brute : un pseudo dans le chemin ferait
    # exploser le nombre de series Prometheus.
    route = requete.scope.get("route")
    etiquettes = {
        "method": requete.method,
        "route": route.path if route else "unmatched",
        "status": str(reponse.status_code),
    }
    requetes_total.labels(**etiquettes).inc()
    duree_requete.labels(**etiquettes).observe(time.perf_counter() - debut)
    return reponse


# ------------------------------------------------------------------- acces DB
def get_connection():
    # Memes variables que quiz-api : les deux services lisent la meme
    # configuration, il serait absurde qu'ils l'appellent differemment.
    return psycopg2.connect(
        host=os.environ["DB_HOST"],
        port=os.environ.get("DB_PORT", "5432"),
        dbname=os.environ["DB_NAME"],
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        connect_timeout=3,
    )


def interroger(sql, parametres=()):
    """Execute une requete en lecture et renvoie ses lignes.

    Toute erreur de connexion devient un 503 : la base est injoignable, ce
    service n'est pas casse pour autant. Jamais de stacktrace au client.
    """
    try:
        conn = get_connection()
    except psycopg2.OperationalError:
        base_joignable.set(0)
        raise HTTPException(
            status_code=503, detail="quiz-scores ne parvient pas a joindre la base"
        )

    try:
        with conn.cursor() as cursor:
            cursor.execute(sql, parametres)
            lignes = cursor.fetchall()
        base_joignable.set(1)
        return lignes
    except psycopg2.Error as erreur:
        base_joignable.set(0)
        raise HTTPException(status_code=503, detail=str(erreur).strip())
    finally:
        conn.close()


# -------------------------------------------------------------------- routes
@app.get("/health")
def health():
    """Liveness. Volontairement independant de Postgres : un souci de base ne
    doit pas faire passer le conteneur lui-meme pour mort."""
    return {"status": "ok"}


@app.get("/sante")
def sante():
    """La sonde qui dit la verite : elle interroge vraiment la base."""
    interroger("SELECT 1")
    return {"status": "ok", "base": "joignable"}


@app.get("/classement")
def classement(limite: int = Query(10, ge=1, le=100)):
    """Le classement : un point par bonne reponse.

    En cas d'egalite, celui qui a repondu a moins de questions passe devant :
    il a ete plus juste, pas seulement plus present.
    """
    lignes = interroger(
        f'''
        SELECT "pseudo",
               COUNT(*) FILTER (WHERE "correcte") AS points,
               COUNT(*) AS repondues
        FROM "{TABLE_REPONSES}"
        GROUP BY "pseudo"
        ORDER BY points DESC, repondues ASC, "pseudo" ASC
        LIMIT %s
        ''',
        (limite,),
    )
    joueurs_classes.set(len(lignes))
    return {
        "classement": [
            {"rang": rang, "pseudo": pseudo, "points": points, "repondues": repondues}
            for rang, (pseudo, points, repondues) in enumerate(lignes, start=1)
        ]
    }


@app.get("/stats")
def stats():
    """Le taux de bonnes reponses par question. C'est ce que l'animateur
    commente entre deux manches, et ce que le front n'a pas les moyens de
    calculer sans taper la base."""
    lignes = interroger(
        f'''
        SELECT q."ordre",
               q."texte",
               COUNT(r."id") AS reponses,
               COUNT(*) FILTER (WHERE r."correcte") AS justes
        FROM "{TABLE_QUESTIONS}" q
        LEFT JOIN "{TABLE_REPONSES}" r ON r."questionId" = q."id"
        GROUP BY q."id", q."ordre", q."texte"
        ORDER BY q."ordre"
        '''
    )
    return {
        "questions": [
            {
                "ordre": ordre,
                "texte": texte,
                "reponses": reponses,
                "justes": justes,
                # Arrondi au pourcent : la precision au dixieme n'apporte rien
                # sur trente joueurs, et alourdit la lecture a l'ecran.
                "taux_reussite": round(justes * 100 / reponses) if reponses else None,
            }
            for ordre, texte, reponses, justes in lignes
        ]
    }


@app.get("/travail")
def travail():
    """La route qui encaisse les coups. Elle recalcule vraiment le classement
    complet, sans limite : c'est le travail le plus couteux du service, donc
    celui qui a du sens a mesurer."""
    lignes = interroger(
        f'''
        SELECT "pseudo", COUNT(*) FILTER (WHERE "correcte") AS points
        FROM "{TABLE_REPONSES}"
        GROUP BY "pseudo"
        '''
    )
    return {"success": True, "data": {"joueurs": len(lignes)}}


@app.get("/metrics")
def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
