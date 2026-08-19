/** French UI strings. Typed against the English catalogue, so nothing can be left out. */
import type { Catalogue } from './strings.ts';

export const fr: Catalogue = {
  tabs: { films: 'Films', time: 'Horaires', plan: 'Plan', share: 'Partager', setup: 'Réglages' },
  nav: {
    sections: 'Sections',
    scheduled: (n) => `${n} programmes planifiés`,
    language: 'Langue',
    theme: 'Apparence',
    themeSystem: 'Suivre le système',
    themeLight: 'Clair',
    themeDark: 'Sombre',
    toLight: "Passer à l'apparence claire",
    toDark: "Passer à l'apparence sombre",
  },

  people: {
    edit: (name) => `Modifier la liste et les disponibilités de ${name}`,
    add: 'Ajouter une personne',
    addPrompt: 'Qui vient encore ?',
    planFor: 'Planifier pour',
    everyone: 'Tout le monde',
    alone: (name) => `${name} seul·e`,
    remove: 'Retirer',
    removeConfirm: (name) => `Retirer ${name} et sa liste de souhaits ?`,
    nameOf: (name) => `Nom de la personne ${name}`,
    marked: (marks, windows) => `${marks} marqués · ${windows} créneaux`,
  },

  interest: {
    must: 'Absolu',
    want: 'Envie',
    maybe: 'Peut-être',
    mustHint: 'À ne manquer sous aucun prétexte — passe avant tous les « peut-être »',
    wantHint: "J'aimerais bien le voir",
    maybeHint: 'Seulement si ça tombe dans un trou',
    group: (person, title) => `À quel point ${person} veut voir « ${title} »`,
    label: (level, title) => `${level} — ${title}`,
  },

  programme: {
    search: 'Chercher films, réalisation, sections…',
    searchLabel: 'Chercher des films, de la réalisation et des sections',
    allSections: 'Toutes les sections',
    allDays: 'Tous les jours',
    filterSection: 'Filtrer par section',
    filterDay: 'Filtrer par jour',
    marked: 'Marqués',
    count: (shown, total) => `${shown} programmes sur ${total}`,
    films: (n) => `${n} films`,
    noMatch: 'Aucun résultat',
    noMatchHint: 'Essaie une autre section, un autre jour ou un autre mot-clé.',
    onSite: 'Sur fantoche.ch ↗',
    toggle: (title, open) => `${title} — ${open ? 'masquer' : 'afficher'} les détails`,
    closedNote: 'séance scolaire fermée, non ouverte au public',
    windowNote: "passer à n'importe quel moment pendant ce créneau",
    plannedNote: 'dans ton plan',
  },

  time: {
    heading: (name) => `Disponibilités de ${name}`,
    unavailable: 'Pas disponible',
    allDay: 'Toute la journée',
    fromFour: 'Dès 16:00',
    allDayLabel: (day) => `Libre toute la journée le ${day}`,
    fromFourLabel: (day) => `Libre dès 16:00 le ${day}`,
    to: 'à',
    freeFrom: (day) => `${day} — libre dès`,
    freeUntil: (day) => `${day} — libre jusqu'à`,
    addWindow: '+ créneau',
    addWindowLabel: (day) => `Ajouter un autre créneau libre le ${day}`,
    removeWindow: 'Supprimer ce créneau',
    removeWindowLabel: (day, from, to) => `Supprimer ${day} ${from} à ${to}`,
    hours: (h) => `${h} heures disponibles`,
    none: 'Aucune disponibilité saisie',
    copyToAll: 'Copier pour tout le monde',
    clear: 'Tout effacer',
  },

  plan: {
    programmes: (n) => (n === 1 ? '1 programme' : `${n} programmes`),
    ofFilm: (d) => `${d} de film`,
    walking: (m) => `${m}′ de marche`,
    noWalking: 'aucun trajet entre les lieux',
    forWhom: (names) => `pour ${names}`,
    addToCalendar: 'Ajouter au calendrier',
    daySummary: (n, from, to) => `${n === 1 ? '1 programme' : `${n} programmes`} · ${from}–${to}`,
    notProven:
      "C'est le meilleur plan trouvé dans le temps imparti, mais avec autant de films marqués il n'a pas pu être prouvé optimal. Avec moins de « peut-être », la réponse devient exacte.",
    nothingMarked: 'Rien de marqué',
    nothingMarkedHint: 'Va dans Films et marque ce que tu veux voir. Le plan se construit tout seul.',
    noSharedTime: 'Aucune disponibilité commune',
    noSharedTimeHint: (names) =>
      `Saisis sous Horaires quand ${names} sont libres — ce plan n'utilise que les heures que vous avez tous.`,
    noTimeHint: 'Saisis tes heures libres sous Horaires.',
    nothingFits: 'Rien ne rentre',
    nothingFitsHint: 'Aucun des films marqués ne passe pendant tes heures libres.',
    dropIn: 'À voir quand tu veux',
    dropInHint:
      'Les expositions et pop-ups restent ouverts des heures, donc ils ne sont pas planifiés comme des séances — glisse-les dans un trou.',
    didNotFit: (n) => `N'est pas rentré (${n})`,
    reasonUnavailable: 'Ne passe jamais pendant tes heures libres',
    reasonClash: 'Entre en conflit avec quelque chose que tu voulais davantage',
    assumedEnd: (d) => `fin non publiée, ${d} supposées`,
    gapWalk: (m) => `${m}′ de marche`,
    gapSamePlace: 'même bâtiment',
    gapSpare: (d) => `${d} de marge`,
    gapStraightOn: 'enchaîné',
    gap: (idle, parts) => `${idle}′ — ${parts}`,
    switchHint:
      "Le mode commun n'utilise que les heures libres de tout le monde, et compte un film double quand vous le voulez tous les deux.",
  },

  share: {
    sendTitle: 'Envoyer ton plan',
    sendBlurb:
      "Marque tes films, saisis tes disponibilités, puis envoie ceci à la personne qui t'accompagne. Elle le charge, remplit sa moitié et renvoie le tout.",
    everyoneCount: (n) => `Tout le monde (${n})`,
    onlyMe: (name) => `Seulement ${name}`,
    copyLink: 'Copier le lien',
    downloadFile: 'Télécharger le fichier',
    showLink: 'Afficher le lien',
    linkCopied: 'Lien copié — colle-le dans un message.',
    linkCopiedLong: (n) =>
      `Copié, mais le lien est long (${n} caractères) — s'il est coupé dans la discussion, envoie plutôt le fichier.`,
    clipboardBlocked:
      "Ce navigateur refuse l'accès au presse-papiers ; voici le lien à copier toi-même :",
    linkBoxLabel: 'Ton lien de partage — sélectionne-le et copie-le',
    fragmentNote:
      "Le lien porte le plan dans son propre texte — rien n'est téléversé, et aucun serveur ne peut le perdre.",

    loadTitle: 'Charger un plan',
    chooseFile: 'Choisir un fichier…',
    chooseFileLabel: 'Charger un plan depuis un fichier',
    pasteToggle: 'Coller un lien ou un code',
    pastePlaceholder: "Colle le lien ou le code qu'on t'a envoyé…",
    pasteLabel: 'Coller un lien partagé ou un code de plan',
    mergeIt: 'Fusionner',
    mergeNote:
      "Le chargement fusionne : les nouvelles personnes sont ajoutées, et pour une personne déjà présente c'est la version modifiée le plus récemment qui gagne. Ton propre travail n'est jamais écrasé par une copie plus ancienne.",

    backupTitle: 'Sauvegarde',
    downloadBackup: 'Télécharger une sauvegarde complète',
    restoreBackup: 'Restaurer une sauvegarde…',
    restoreLabel: 'Tout restaurer depuis un fichier de sauvegarde',
    restoreConfirm: 'Remplacer tout ce qui est ici par le contenu de cette sauvegarde ?',
    backupNote:
      "Une sauvegarde contient aussi tes réglages de temps, et la restaurer remplace tout au lieu de fusionner — c'est pour changer de navigateur, pas pour échanger des plans.",

    incomingFrom: (who) => `${who} t'a envoyé un plan`,
    incoming: 'Un plan partagé',
    incomingRegion: 'Un plan partagé est arrivé',
    person: (name, marks, windows) =>
      `${name} (${marks} marqués, ${windows} ${windows === 1 ? 'créneau libre' : 'créneaux libres'})`,
    mergeIntoMine: 'Fusionner avec le mien',
    replaceAll: 'Tout remplacer',
    replaceConfirm: "Tout jeter ici et n'utiliser que ce plan ?",
    notNow: 'Pas maintenant',
    mergeExplain:
      "La fusion garde, pour chaque personne, la version modifiée le plus récemment : s'échanger un plan n'écrase donc jamais ce que tu as fait entre-temps.",
    dismiss: 'Fermer',
    unnamedSelf:
      'Tu t’appelles encore « Me » — renomme-toi sous Réglages, puis marque tes propres films et disponibilités et renvoie le tout.',

    doneReplaced: (n) => `Tout remplacé par ${n} personnes du fichier.`,
    doneNothing: 'Rien à changer ; tu avais déjà tout.',
    doneAdded: (names) => `${names} ajouté·e·s`,
    doneUpdated: (names) => `${names} mis à jour`,
    doneKept: (names) => `ta version plus récente de ${names} conservée`,
    done: (parts) => `Terminé — ${parts}.`,
    wrongEdition: (theirs, ours) =>
      `Ce plan est pour Fantoche ${theirs}, alors que cette app a ${ours}. Les films marqués ne correspondront pas.`,
    wrongEditionShort: (theirs, ours) => `Ce plan est pour Fantoche ${theirs}, pas ${ours}.`,
    unreadable: "Ce fichier n'a pas pu être lu.",
    clipboardFailed: 'Copie dans le presse-papiers impossible. Utilise plutôt le fichier.',
  },

  settings: {
    people: 'Personnes',
    timing: 'Temps',
    buffer: 'Marge entre les séances',
    bufferHint: 'En plus du trajet — faire la queue, trouver une place, un café.',
    samePlace: 'Changer de salle dans le même bâtiment',
    samePlaceHint: 'Trafo 1 → Trafo 2, par exemple. Compté à la place d’un trajet.',
    walkSpeed: 'Vitesse de marche',
    walkSpeedHint: 'Combinée à la distance entre les lieux pour calculer le trajet.',
    detour: 'Facteur de détour',
    detourHint: 'Les rues ne sont pas des lignes droites. 1.35 convient à un centre-ville.',
    excludeClosed: 'Ignorer les séances scolaires fermées',
    excludeClosedHint:
      'Certaines séances sont réservées aux classes et ne sont pas ouvertes au public.',
    skipping: 'Ignorées',
    including: 'Incluses',
    minutes: 'min',
    kmh: 'km/h',
    times: '×',
    numberLabel: (label, unit) => `${label} en ${unit}`,

    walkingTitle: 'Temps de marche',
    walkingBlurb:
      'Estimés à partir des coordonnées des lieux. Corrige ceux que tu connais mieux.',
    hide: 'Masquer',
    showPairs: (n) => `Afficher les ${n} paires`,
    resetPair: (n) => `Revenir aux ${n} min estimées`,
    reset: 'réinitialiser',
    pairLabel: (a, b) => `Minutes de marche entre ${a} et ${b}`,

    data: 'Données',
    langNote:
      'Le programme lui-même — sections, résumés, noms des lieux — vient de Fantoche dans cette langue aussi, pas seulement les libellés.',
    dataSummary: (blocks, showings, venues, places) =>
      `${blocks} programmes · ${showings} séances · ${venues} lieux dans ${places} bâtiments.`,
    scrapedOn: (date) => `Récupéré depuis fantoche.ch le ${date}.`,
    privacy:
      'Tes listes et disponibilités sont stockées uniquement dans ce navigateur — pas de compte, pas de serveur, rien ne quitte l’appareil.',
    shareLives: 'Envoyer ton plan et le sauvegarder se trouvent tous deux sous Partager.',
    resetTiming: 'Rétablir les temps par défaut',
    deleteAll: 'Tout supprimer',
    deleteConfirm:
      'Supprimer toutes les personnes, listes et disponibilités ? Cette action est irréversible.',
  },
};
