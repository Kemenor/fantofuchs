/** German UI strings. Typed against the English catalogue, so nothing can be left out. */
import type { Catalogue } from './strings.ts';

export const de: Catalogue = {
  tabs: { films: 'Filme', time: 'Zeit', plan: 'Plan', share: 'Teilen', setup: 'Setup' },
  nav: {
    sections: 'Bereiche',
    scheduled: (n) => `${n} Programme eingeplant`,
    language: 'Sprache',
    theme: 'Darstellung',
    themeSystem: 'System folgen',
    themeLight: 'Hell',
    themeDark: 'Dunkel',
    toLight: 'Zur hellen Darstellung wechseln',
    toDark: 'Zur dunklen Darstellung wechseln',
  },

  people: {
    edit: (name) => `Wunschliste und freie Zeit von ${name} bearbeiten`,
    add: 'Weitere Person hinzufügen',
    addPrompt: 'Wer kommt noch mit?',
    planFor: 'Planen für',
    everyone: 'Alle',
    alone: (name) => `nur ${name}`,
    remove: 'Entfernen',
    removeConfirm: (name) => `${name} samt Wunschliste entfernen?`,
    nameOf: (name) => `Name der Person ${name}`,
    marked: (marks, windows) => `${marks} markiert · ${windows} Zeitfenster`,
  },

  interest: {
    must: 'Muss',
    want: 'Will',
    maybe: 'Evtl.',
    mustHint: 'Auf keinen Fall verpassen — schlägt beliebig viele Vielleichts',
    wantHint: 'Würde ich gerne sehen',
    maybeHint: 'Nur wenn es in eine Lücke passt',
    group: (person, title) => `Wie gern ${person} „${title}“ sehen möchte`,
    label: (level, title) => `${level} — ${title}`,
  },

  programme: {
    search: 'Filme, Regie, Bereiche suchen…',
    searchLabel: 'Filme, Regie und Bereiche suchen',
    allSections: 'Alle Bereiche',
    allDays: 'Alle Tage',
    filterSection: 'Nach Bereich filtern',
    filterDay: 'Nach Tag filtern',
    marked: 'Markiert',
    count: (shown, total) => `${shown} von ${total} Programmen`,
    films: (n) => `${n} Filme`,
    noMatch: 'Nichts gefunden',
    noMatchHint: 'Versuch einen anderen Bereich, Tag oder Suchbegriff.',
    onSite: 'Auf fantoche.ch ↗',
    toggle: (title, open) => `${title} — Details ${open ? 'ausblenden' : 'anzeigen'}`,
    closedNote: 'geschlossene Schulvorstellung, nicht öffentlich',
    windowNote: 'jederzeit innerhalb dieses Fensters vorbeischauen',
    plannedNote: 'in deinem Plan',
  },

  time: {
    heading: (name) => `Freie Zeit von ${name}`,
    unavailable: 'Nicht verfügbar',
    allDay: 'Ganzer Tag',
    fromFour: 'Ab 16:00',
    allDayLabel: (day) => `Am ${day} den ganzen Tag frei`,
    fromFourLabel: (day) => `Am ${day} ab 16:00 frei`,
    to: 'bis',
    freeFrom: (day) => `${day} — frei ab`,
    freeUntil: (day) => `${day} — frei bis`,
    addWindow: '+ Fenster',
    addWindowLabel: (day) => `Weiteres freies Fenster am ${day} hinzufügen`,
    removeWindow: 'Dieses Zeitfenster entfernen',
    removeWindowLabel: (day, from, to) => `${day} ${from} bis ${to} entfernen`,
    hours: (h) => `${h} Stunden verfügbar`,
    none: 'Noch keine freie Zeit eingetragen',
    copyToAll: 'Für alle übernehmen',
    clear: 'Alles löschen',
  },

  plan: {
    programmes: (n) => (n === 1 ? '1 Programm' : `${n} Programme`),
    ofFilm: (d) => `${d} Film`,
    walking: (m) => `${m}′ Fussweg`,
    noWalking: 'kein Fussweg zwischen den Spielorten',
    forWhom: (names) => `für ${names}`,
    addToCalendar: 'Zum Kalender hinzufügen',
    daySummary: (n, from, to) => `${n === 1 ? '1 Programm' : `${n} Programme`} · ${from}–${to}`,
    notProven:
      'Das ist der beste Plan, der im Zeitbudget gefunden wurde — bei so vielen markierten Filmen liess sich aber nicht beweisen, dass es der bestmögliche ist. Mit weniger Vielleichts wird die Antwort exakt.',
    nothingMarked: 'Noch nichts markiert',
    nothingMarkedHint:
      'Geh zu Filme und markier, was du sehen willst. Der Plan entsteht von selbst daraus.',
    noSharedTime: 'Keine gemeinsame freie Zeit',
    noSharedTimeHint: (names) =>
      `Trag unter Zeit ein, wann ${names} jeweils frei sind — dieser Plan nutzt nur Stunden, die ihr alle habt.`,
    noTimeHint: 'Trag deine freien Stunden unter Zeit ein.',
    nothingFits: 'Nichts passt',
    nothingFitsHint: 'Keiner der markierten Filme läuft während deiner freien Zeit.',
    dropIn: 'Jederzeit vorbeischauen',
    dropInHint:
      'Ausstellungen und Pop-ups sind stundenlang offen und werden deshalb nicht als feste Slots eingeplant — schieb sie in eine Lücke.',
    didNotFit: (n) => `Hat nicht gepasst (${n})`,
    reasonUnavailable: 'Läuft nie, während du frei bist',
    reasonClash: 'Kollidiert mit etwas, das dir wichtiger war',
    assumedEnd: (d) => `Ende nicht veröffentlicht, ${d} angenommen`,
    gapWalk: (m) => `${m}′ Fussweg`,
    gapSamePlace: 'gleiches Gebäude',
    gapSpare: (d) => `${d} Puffer`,
    gapStraightOn: 'direkt weiter',
    gap: (idle, parts) => `${idle}′ — ${parts}`,
    fitsHere: (n) => (n === 1 ? '1 Film passt hier' : `${n} Filme passen hier`),
    addFiller: 'Dazu',
    addFillerLabel: (title) => `${title} auf die Wunschliste setzen`,
    alsoAt: 'Läuft auch',
    alsoAtLabel: (title) => `Weitere Vorstellungen von ${title}, die noch passen würden`,
    noAlternatives: 'einzige Vorstellung, die passt',
    print: 'Drucken',
    printedFor: (names) => `Plan für ${names}`,
    switchHint:
      'Der Gemeinsam-Modus nutzt nur Stunden, die alle frei haben, und zählt einen Film doppelt, wenn ihr ihn beide wollt.',
  },

  share: {
    sendTitle: 'Plan senden',
    sendBlurb:
      'Markier deine Filme und trag deine freie Zeit ein, dann schick das hier an die Person, mit der du hingehst. Sie lädt es, füllt ihre Hälfte aus und schickt alles zurück.',
    everyoneCount: (n) => `Alle (${n})`,
    onlyMe: (name) => `Nur ${name}`,
    copyLink: 'Link kopieren',
    downloadFile: 'Datei herunterladen',
    showLink: 'Link anzeigen',
    linkCopied: 'Link kopiert — füg ihn in eine Nachricht ein.',
    linkCopiedLong: (n) =>
      `Kopiert, aber der Link ist lang (${n} Zeichen) — falls er im Chat abgeschnitten wird, schick lieber die Datei.`,
    clipboardBlocked:
      'Dieser Browser lässt die Seite nicht auf die Zwischenablage zugreifen — hier ist der Link zum selber Kopieren:',
    linkBoxLabel: 'Dein Link zum Teilen — markieren und kopieren',
    fragmentNote:
      'Der Link trägt den Plan in sich selbst — nichts wird hochgeladen, und es gibt keinen Server, der ihn verlieren könnte.',

    loadTitle: 'Plan laden',
    chooseFile: 'Datei wählen…',
    chooseFileLabel: 'Plan aus einer Datei laden',
    pasteToggle: 'Link oder Code einfügen',
    pastePlaceholder: 'Füg den Link oder Code ein, den dir jemand geschickt hat…',
    pasteLabel: 'Geteilten Link oder Plan-Code einfügen',
    mergeIt: 'Zusammenführen',
    mergeNote:
      'Beim Laden wird zusammengeführt: Neue Personen kommen dazu, und bei einer bereits vorhandenen gewinnt die zuletzt bearbeitete Fassung. Deine eigene Arbeit wird nie von einer älteren Kopie überschrieben.',

    backupTitle: 'Backup',
    downloadBackup: 'Vollständiges Backup herunterladen',
    restoreBackup: 'Backup wiederherstellen…',
    restoreLabel: 'Alles aus einer Backup-Datei wiederherstellen',
    restoreConfirm: 'Alles hier durch den Inhalt dieses Backups ersetzen?',
    backupNote:
      'Ein Backup enthält auch deine Zeit-Einstellungen, und beim Wiederherstellen wird alles ersetzt statt zusammengeführt — gedacht für den Umzug in einen neuen Browser, nicht zum Austausch mit anderen.',

    incomingFrom: (who) => `${who} hat dir einen Plan geschickt`,
    incoming: 'Ein geteilter Plan',
    incomingRegion: 'Ein geteilter Plan ist eingetroffen',
    person: (name, marks, windows) =>
      `${name} (${marks} markiert, ${windows} ${windows === 1 ? 'freies Fenster' : 'freie Fenster'})`,
    mergeIntoMine: 'Mit meinem zusammenführen',
    replaceAll: 'Alles ersetzen',
    replaceConfirm: 'Alles hier verwerfen und nur das aus diesem Plan verwenden?',
    notNow: 'Jetzt nicht',
    mergeExplain:
      'Beim Zusammenführen gewinnt pro Person die zuletzt bearbeitete Fassung — ein Plan hin und her zu schicken überschreibt also nie, was du in der Zwischenzeit gemacht hast.',
    dismiss: 'Schliessen',
    unnamedSelf:
      'Du heisst noch „Me“ — benenn dich unter Setup um, markier dann deine eigenen Filme und deine freie Zeit und schick alles zurück.',

    doneReplaced: (n) => `Alles durch ${n} Personen aus der Datei ersetzt.`,
    doneNothing: 'Nichts zu ändern; du hattest bereits alles davon.',
    doneAdded: (names) => `${names} hinzugefügt`,
    doneUpdated: (names) => `${names} aktualisiert`,
    doneKept: (names) => `deine neuere Fassung von ${names} behalten`,
    done: (parts) => `Fertig — ${parts}.`,
    wrongEdition: (theirs, ours) =>
      `Dieser Plan ist für Fantoche ${theirs}, diese App hat aber ${ours}. Die markierten Filme passen nicht zusammen.`,
    wrongEditionShort: (theirs, ours) => `Dieser Plan ist für Fantoche ${theirs}, nicht ${ours}.`,
    unreadable: 'Diese Datei konnte nicht gelesen werden.',
    clipboardFailed: 'Kopieren in die Zwischenablage nicht möglich. Nimm stattdessen die Datei.',
  },

  settings: {
    people: 'Personen',
    timing: 'Zeiten',
    buffer: 'Puffer zwischen Vorstellungen',
    bufferHint: 'Zusätzlich zum Fussweg — anstehen, Platz suchen, Kaffee.',
    samePlace: 'Saalwechsel im selben Gebäude',
    samePlaceHint: 'Zum Beispiel Trafo 1 → Trafo 2. Zählt anstelle eines Fusswegs.',
    walkSpeed: 'Gehgeschwindigkeit',
    walkSpeedHint: 'Zusammen mit der Distanz zwischen den Spielorten ergibt das den Fussweg.',
    detour: 'Umwegfaktor',
    detourHint: 'Strassen sind keine Luftlinien. 1.35 passt für eine Innenstadt.',
    excludeClosed: 'Geschlossene Schulvorstellungen überspringen',
    excludeClosedHint: 'Manche Vorstellungen sind Schulklassen vorbehalten und nicht öffentlich.',
    skipping: 'Überspringen',
    including: 'Einbeziehen',
    minutes: 'Min.',
    kmh: 'km/h',
    times: '×',
    numberLabel: (label, unit) => `${label} in ${unit}`,

    walkingTitle: 'Fusswege',
    walkingBlurb:
      'Geschätzt aus den Koordinaten der Spielorte. Überschreib alles, was du besser weisst.',
    hide: 'Ausblenden',
    showPairs: (n) => `${n} Paare anzeigen`,
    resetPair: (n) => `Zurück auf geschätzte ${n} Min.`,
    reset: 'zurücksetzen',
    pairLabel: (a, b) => `Fussweg-Minuten zwischen ${a} und ${b}`,

    data: 'Daten',
    langNote:
      'Auch das Programm selbst — Bereiche, Inhaltsangaben, Namen der Spielorte — kommt in dieser Sprache von Fantoche, nicht nur die Beschriftungen.',
    dataSummary: (blocks, showings, venues, places) =>
      `${blocks} Programme · ${showings} Vorstellungen · ${venues} Spielorte in ${places} Gebäuden.`,
    scrapedOn: (date) => `Von fantoche.ch geladen am ${date}.`,
    privacy:
      'Deine Wunschlisten und freien Zeiten liegen nur in diesem Browser — kein Konto, kein Server, nichts verlässt das Gerät.',
    shareLives: 'Plan verschicken und sichern findest du beides unter Teilen.',
    resetTiming: 'Zeiten auf Standard zurücksetzen',
    deleteAll: 'Alles löschen',
    deleteConfirm:
      'Wirklich alle Personen, Wunschlisten und Zeitfenster löschen? Das lässt sich nicht rückgängig machen.',
  },
};
