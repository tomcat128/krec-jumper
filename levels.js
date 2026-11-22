'use strict';
/*
 * Level-Definitionen für KREC Jumper.
 *
 * Koordinaten sind Kacheln (30 px). Das Spielfeld ist 18 Zeilen hoch (0 = oben).
 * Der normale Boden beginnt in Zeile 15. Mit „height" wird ein Level höher als das Bild – dann fährt
 * die Kamera auch nach oben mit, und der Boden liegt in den untersten drei Zeilen (height − 3).
 * Bei „width: 32" ist das Level genau ein Bild breit.
 *
 * Bausteine:
 *   b.ground(x0, x1, top)        Boden von Spalte x0 bis x1, Oberkante in Zeile top (sonst drei Zeilen über dem unteren Rand)
 *   b.block(x, y, w = 1, h = 1)  feste Kisten
 *   b.plat(x, y, w)              Planke – von unten durchspringbar
 *   b.star(x, y) / b.stars(x, y, n) / b.arc(x, y, n)   Sterne (einzeln, Reihe, Bogen)
 *   b.heart(x, y)                Extra-Herz
 *   b.cone(x, row)               Hütchen: draufspringen oder wegdrehen
 *   b.ball(x, row)               Stachelball: nur mit der Sitzpirouette besiegbar
 *   b.bird(x, y, range)          Taube: fliegt hin und her; von oben oder mit dem Axel aus jeder Richtung besiegbar
 *   b.flag(x, row)               Rücksetzpunkt
 *   b.sign(x, row, text)         Hinweisschild
 *   b.goal(x, row)               Zielbogen
 *   b.arena(x0, x1, row)         Rollsportanlage am Tannenhof von Spalte x0 bis x1 (mind. 40 breit). Steht das Ziel
 *                                am Eingang, läuft dahinter der Abspann: Einrollen, Verbeugung, Applaus, Noten
 *
 * Faustregeln, damit alles schaffbar bleibt: Lücken höchstens 4 Kacheln breit,
 * Stufen höchstens 3 Kacheln hoch (dann höchstens 3 Kacheln Abstand zur Seite). Gegner dürfen nie als
 * Trittstein nötig sein. Steht das Ziel auf einer Planke, braucht es rechts davon noch gut vier Kacheln Auslauf.
 */
globalThis.KJ_LEVELS = [
  {
    name: 'Morgens im Park',
    theme: 'park',
    width: 200,
    par: 75,
    build(b) {
      b.ground(0, 30);
      b.sign(5, 15, '← →  rollen     LEERTASTE oder A  Rittberger-Sprung');
      b.stars(9, 13, 4);
      b.block(15, 14, 2, 1);
      b.arc(14, 12, 4);
      b.sign(20, 15, 'Spring mit dem Rittberger von oben auf das Hütchen!');
      b.cone(26, 15);
      b.arc(30, 13, 5);

      b.ground(34, 62);
      b.sign(36, 15, 'Stachelbälle piksen! Halte ↓ oder B für die Sitzpirouette.');
      b.block(39, 14);
      b.ball(44, 15);
      b.block(47, 14);
      b.sign(49, 15, 'In der Sitzpirouette LEERTASTE oder A: Waage – doppelte Punkte!');
      b.plat(50, 12, 4);
      b.stars(50, 11, 4);
      b.cone(54, 15);
      b.cone(59, 15);
      b.arc(62, 13, 5);

      b.ground(66, 92);
      b.flag(68, 15);
      b.ground(74, 82, 13);
      b.arc(75, 11, 6);
      b.cone(79, 13);
      b.stars(85, 13, 3);
      b.ball(88, 15);
      b.sign(90, 15, 'Oben in der Luft nochmal springen: Axel! Der trifft Tauben auch von der Seite.');

      b.bird(95, 11, 2.5);
      b.arc(92, 13, 6);

      b.ground(97, 127);
      b.block(101, 14);
      b.block(102, 13, 1, 2);
      b.block(103, 12, 1, 3);
      b.plat(106, 11, 6);
      b.stars(107, 10, 4);
      b.block(107, 14);
      b.ball(111, 15);
      b.ball(115, 15);
      b.block(118, 14);
      b.cone(123, 15);
      b.arc(127, 13, 5);

      b.ground(131, 150, 14);
      b.flag(133, 14);
      b.cone(138, 14);
      b.plat(139, 11, 3);
      b.heart(140, 10);
      b.cone(144, 14);
      b.bird(146.5, 9, 3);

      b.arc(150, 12, 5);
      b.ground(154, 158, 14);
      b.star(156, 12);
      b.bird(160.5, 9, 2);
      b.ground(162, 166, 13);
      b.star(164, 11);
      b.arc(166, 12, 5);

      b.ground(170, 199);
      b.block(174, 14);
      b.ball(178, 15);
      b.stars(177, 12, 3);
      b.block(183, 14);
      b.cone(187, 15);
      b.goal(193, 15);
    },
  },

  {
    name: 'Abendkür am Kanal',
    theme: 'abend',
    width: 230,
    par: 95,
    build(b) {
      b.ground(0, 18);
      b.stars(5, 13, 3);
      b.cone(10, 15);
      b.cone(15, 15);
      b.arc(18, 13, 6);

      b.ground(23, 40);
      b.ball(27, 15);
      b.ball(35, 15);
      b.plat(26, 12, 3);
      b.stars(26, 11, 3);
      b.plat(31, 9, 3);
      b.stars(31, 8, 3);
      b.plat(36, 12, 3);
      b.stars(36, 11, 3);

      b.plat(43, 14, 2);
      b.bird(44, 10, 2.5);
      b.stars(43, 12, 2);

      b.ground(47, 62, 14);
      b.flag(49, 14);
      b.cone(53, 14);
      b.cone(56, 14);
      b.block(60, 13);
      b.block(61, 12, 1, 2);
      b.block(62, 11, 1, 3);

      b.plat(65, 11, 2);
      b.star(65.5, 9);
      b.bird(67.5, 7, 3);
      b.plat(69, 12, 2);
      b.star(69.5, 10);

      b.ground(73, 96);
      b.ball(77, 15);
      b.block(81, 14);
      b.plat(83, 11, 4);
      b.heart(84.5, 10);
      b.ball(85, 15);
      b.block(89, 14);
      b.cone(92, 15);
      b.arc(96, 12, 4);

      b.ground(100, 104, 13);
      b.star(102, 11);
      b.ground(108, 112, 11);
      b.stars(109, 9, 3);
      b.arc(112, 10, 4);

      b.ground(116, 140, 14);
      b.flag(118, 14);
      b.block(121, 13);
      b.bird(125, 10, 3);
      b.ball(127, 14);
      b.bird(132, 9, 3);
      b.cone(134, 14);
      b.cone(137, 14);
      b.stars(124, 12, 3);

      b.plat(145, 13, 3);
      b.star(146, 11);
      b.plat(150, 11, 3);
      b.stars(150, 9, 3);
      b.plat(155, 13, 3);
      b.star(156, 11);

      b.ground(160, 185);
      b.flag(162, 15);
      b.block(165, 14);
      b.ball(168, 15);
      b.ball(172, 15);
      b.block(175, 14);
      b.plat(167, 11, 7);
      b.stars(168, 10, 5);
      b.cone(178, 15);
      b.bird(181, 11, 3);
      b.arc(185, 13, 4);

      b.ground(189, 229);
      b.cone(194, 15);
      b.block(198, 14);
      b.block(199, 13, 1, 2);
      b.block(200, 12, 1, 3);
      b.arc(201, 10, 4);
      b.ball(206, 15);
      b.cone(211, 15);
      b.block(214, 14);
      b.goal(222, 15);
    },
  },

  {
    // Der Aufstieg: ein Bild breit, fünfeinhalb Bilder hoch. Es geht in Dreierstufen nach oben; alle sechs Stufen
    // fängt ein durchgehender Boden einen Sturz auf. Ganz oben auf der obersten Planke steht das Ziel.
    // Auf den Böden halten Kisten die Gegner von der Stelle fern, an der man von unten ankommt.
    name: 'Hoch hinaus',
    theme: 'blau',
    width: 32,
    height: 105,
    par: 100,
    build(b) {
      b.ground(0, 31);                                   // Zeile 102
      b.sign(5, 102, 'Hoch hinaus! Spring über die Planken nach oben – ganz oben wartet das Ziel.');
      b.stars(9, 100, 3);

      // 1 – breite Planken zum Warmwerden
      b.plat(7, 99, 5);    b.stars(8, 97, 3);
      b.plat(14, 96, 5);   b.stars(15, 94, 3);
      b.plat(21, 93, 5);   b.stars(22, 91, 3);
      b.plat(26, 90, 5);   b.star(28, 88);
      b.plat(19, 87, 4);   b.stars(20, 85, 2);
      b.bird(5, 92, 2.5);

      b.plat(0, 84, 32);                                 // erster Boden
      b.block(12, 83);
      b.cone(8, 84);
      b.sign(2, 84, 'Die durchgehenden Böden fangen dich auf, wenn du abrutschst.');

      // 2 – Kistentreppe: Kisten sind fest, von unten kommt man nicht durch
      b.block(5, 81, 3);   b.star(6, 79);
      b.block(11, 78, 3);  b.star(12, 76);
      b.block(17, 75, 2);  b.star(17.5, 73);
      b.block(22, 72, 2);  b.star(22.5, 70);
      b.block(27, 69, 3);  b.star(28, 67);
      b.bird(11, 71, 2.5);

      b.plat(0, 66, 32);                                 // zweiter Boden
      b.block(16, 65);
      b.ball(8, 66);
      b.stars(11, 64, 3);

      // 3 – Planken mit Hütchen
      b.plat(20, 63, 6);   b.cone(23, 63);
      b.plat(11, 60, 6);   b.cone(14, 60);
      b.plat(3, 57, 5);    b.heart(5, 55);
      b.plat(10, 54, 4);   b.stars(11, 52, 2);
      b.plat(16, 51, 4);   b.stars(17, 49, 2);
      b.bird(25, 55, 3);
      b.stars(24, 53, 3);                                // für Mutige

      b.plat(0, 48, 32);                                 // dritter Boden
      b.block(10, 47);     b.cone(6, 48);    b.stars(3, 46, 3);
      b.block(23, 47);     b.cone(27, 48);   b.stars(26, 46, 3);

      // 4 – schmalere Planken im Zickzack
      b.plat(12, 45, 3);   b.star(13, 43);
      b.plat(6, 42, 3);    b.star(7, 40);
      b.plat(1, 39, 3);    b.star(2, 37);
      b.plat(7, 36, 3);    b.star(8, 34);
      b.plat(13, 33, 3);   b.star(14, 31);
      b.bird(20, 41, 3);
      b.bird(21, 35, 2.5);
      b.stars(18, 38, 3);                                // nur im Sprung zu holen

      b.plat(0, 30, 32);                                 // vierter Boden
      b.block(10, 29);     b.ball(6, 30);    b.stars(3, 28, 3);
      b.block(23, 29);     b.cone(27, 30);   b.heart(30, 28);

      // 5 – kleine Planken, dazwischen Tauben
      b.plat(20, 27, 2);   b.star(20.5, 25);
      b.plat(25, 24, 2);   b.star(25.5, 22);
      b.plat(20, 21, 2);   b.star(20.5, 19);
      b.plat(15, 18, 2);   b.star(15.5, 16);
      b.plat(9, 15, 3);    b.star(10, 13);
      b.bird(27, 19, 2);
      b.bird(8, 20, 3);

      b.plat(14, 12, 18);                                 // die oberste Planke – bis an den rechten Rand
      b.arc(16, 10, 4);
      b.goal(24, 12);
    },
  },

  {
    name: 'Gala bei Nacht',
    theme: 'nacht',
    width: 270,
    par: 110,
    build(b) {
      b.ground(0, 14);
      b.stars(5, 13, 3);
      b.cone(10, 15);
      b.arc(14, 12, 4);

      b.ground(18, 24, 14);
      b.ball(22, 14);
      b.arc(24, 11, 4);

      b.ground(28, 34, 13);
      b.cone(31, 13);
      b.bird(31, 8, 2.5);
      b.arc(34, 12, 5);

      b.ground(39, 60);
      b.block(43, 14);
      b.ball(46, 15);
      b.ball(50, 15);
      b.block(54, 14);
      b.cone(57, 15);
      b.plat(45, 11, 3);
      b.stars(45, 10, 3);
      b.plat(50, 9, 3);
      b.heart(51, 8);

      b.plat(64, 13, 2);
      b.star(64.5, 11);
      b.plat(68, 11, 2);
      b.star(68.5, 9);
      b.plat(72, 9, 2);
      b.star(72.5, 7);

      b.ground(76, 95, 11);
      b.flag(78, 11);
      b.cone(82, 11);
      b.block(85, 10);
      b.ball(89, 11);
      b.bird(90, 6, 3);
      b.stars(87, 9, 4);
      b.arc(95, 10, 5);

      b.ground(100, 120);
      b.block(102, 14);
      b.ball(105, 15);
      b.ball(109, 15);
      b.ball(113, 15);
      b.block(116, 14);
      b.plat(105, 11, 8);
      b.stars(106, 10, 6);
      b.bird(109, 7, 3);
      b.arc(120, 13, 5);

      b.ground(125, 129, 14);
      b.star(127, 12);
      b.ground(133, 137, 13);
      b.cone(135, 13);
      b.ground(141, 145, 12);
      b.star(143, 10);
      b.bird(147.5, 9, 2);
      b.arc(145, 11, 5);

      b.ground(150, 175);
      b.flag(152, 15);
      b.cone(157, 15);
      b.bird(160, 11, 3);
      b.ball(164, 15);
      b.block(167, 14);
      b.block(168, 13, 1, 2);
      b.cone(172, 15);
      b.plat(158, 11, 4);
      b.heart(159.5, 10);

      b.ground(179, 183, 13);
      b.star(181, 11);
      b.bird(185.5, 9, 2);
      b.plat(187, 12, 3);
      b.star(188, 10);
      b.plat(192, 10, 3);
      b.stars(192, 8, 3);

      b.ground(197, 269);
      b.flag(199, 15);
      b.block(202, 14);
      b.ball(205, 15);
      b.cone(208, 15);
      b.ball(212, 15);
      b.block(216, 14);
      b.plat(206, 11, 5);
      b.stars(206, 10, 5);
      b.block(221, 14);
      b.block(222, 13, 1, 2);
      b.block(223, 12, 1, 3);
      b.bird(218.5, 10, 2);

      // Das Ziel: die Rollsportanlage am Tannenhof. Hinter dem Zielbogen am Eingang beginnt der Abspann –
      // die Läuferin rollt von selbst vor das Wertungsgericht und verbeugt sich. Die Halle bleibt deshalb leer.
      b.arena(226, 266, 15);
      b.sign(224.5, 15, 'Die Rollsportanlage am Tannenhof – das Wertungsgericht wartet schon!');
      b.goal(228, 15);
    },
  },
];
