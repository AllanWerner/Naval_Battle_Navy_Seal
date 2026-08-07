"""Le pouls de quiz-scores vers le tableau de la classe.

Transposition de src/pouls.js : meme route, meme corps JSON, memes regles.
Toute correction faite dans le module Node est a reporter ici.

Ecrit avec urllib de la bibliotheque standard, et non requests ou httpx :
le pouls est un effet de bord accessoire, il ne justifie pas d'ajouter une
dependance a une image qui n'en a que quatre.
"""

import json
import os
import socket
import threading
import urllib.error
import urllib.request

TABLEAU = os.environ.get("TABLEAU_URL")
GROUPE = os.environ.get("GROUPE")
COULEUR = os.environ.get("COULEUR", "#888888")
SERVICE = os.environ.get("SERVICE")
VERSION = os.environ.get("VERSION", "dev")
PAVILLON = os.environ.get("PAVILLON_FICHIER", "/data/pavillon.txt")
MOI = os.environ.get("URL_INTERNE", "http://localhost:8000")

# Le GIL ne protege pas un += , mais un verrou explicite coute moins cher a
# lire qu'un raisonnement sur ce qui est atomique en CPython.
_verrou = threading.Lock()
_total_encaisse = 0  # depuis le demarrage de ce process, affiche sur le carre
_a_declarer = 0      # encaisses depuis le dernier pouls, ce que le tableau attend


def lire_pavillon():
    """Le pavillon est relu du disque a chaque pouls : s'il vit dans un volume,
    il traverse le redeploiement. Ici le volume est monte en lecture seule,
    c'est l'API qui l'ecrit."""
    try:
        with open(PAVILLON, encoding="utf-8") as fichier:
            return fichier.read().strip()
    except OSError:
        return ""


def _un_coup():
    """Une vraie requete sur sa propre route de travail, qui recalcule le
    classement complet."""
    global _total_encaisse, _a_declarer
    try:
        with urllib.request.urlopen(f"{MOI}/travail", timeout=5) as reponse:
            if reponse.status < 400:
                with _verrou:
                    _total_encaisse += 1
                    _a_declarer += 1
    except (urllib.error.URLError, socket.timeout, OSError):
        pass


def encaisser(nombre):
    """Les coups partent par paquets de dix en parallele, sinon un gros retard
    bloquerait le pouls suivant. Le plafond de 300 est celui du module Node."""
    a_faire = min(nombre, 300)
    for debut in range(0, a_faire, 10):
        paquet = [
            threading.Thread(target=_un_coup, daemon=True)
            for _ in range(debut, min(debut + 10, a_faire))
        ]
        for fil in paquet:
            fil.start()
        for fil in paquet:
            fil.join()


def _envoyer_pouls():
    global _a_declarer
    attente = 5.0
    with _verrou:
        declares = _a_declarer
    corps = json.dumps(
        {
            "groupe": GROUPE,
            "couleur": COULEUR,
            "service": SERVICE,
            "pod": socket.gethostname(),
            "version": VERSION,
            "pavillon": lire_pavillon(),
            "encaisses": declares,
            "total_encaisse": _total_encaisse,
        }
    ).encode("utf-8")
    a_encaisser = 0
    try:
        requete = urllib.request.Request(
            f"{TABLEAU}/api/pouls",
            data=corps,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(requete, timeout=10) as reponse:
            ordre = json.loads(reponse.read().decode("utf-8"))
        # Les coups declares ne sont retires du compteur local qu'une fois le
        # tableau au courant : si l'appel echoue, ils repartiront dans le
        # pouls suivant.
        with _verrou:
            _a_declarer -= declares
        attente = ordre.get("prochain_pouls_ms") or 5000
        attente = attente / 1000
        a_encaisser = ordre.get("coups_a_encaisser") or 0
    except (urllib.error.URLError, socket.timeout, OSError, ValueError) as erreur:
        print(f"[pouls] tableau injoignable : {erreur}", flush=True)

    if a_encaisser > 0:
        encaisser(a_encaisser)

    minuteur = threading.Timer(attente, _envoyer_pouls)
    minuteur.daemon = True
    minuteur.start()


def demarrer_le_pouls():
    """Demarre le pouls en fil de fond. Ne leve jamais : un tableau injoignable
    ne doit pas empecher le service de rendre ses classements."""
    if not TABLEAU or not GROUPE or not SERVICE:
        print("[pouls] TABLEAU_URL, GROUPE et SERVICE sont obligatoires", flush=True)
        return
    print(f"[pouls] {GROUPE}/{SERVICE} vers {TABLEAU}", flush=True)
    threading.Thread(target=_envoyer_pouls, daemon=True).start()
