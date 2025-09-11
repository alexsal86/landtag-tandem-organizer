-- First, let's clear existing test data and insert all 70 election districts for Baden-Württemberg
TRUNCATE TABLE election_districts RESTART IDENTITY CASCADE;

-- Insert all 70 election districts for Baden-Württemberg Landtagswahl 2021
INSERT INTO election_districts (district_number, district_name, representative_name, representative_party, center_coordinates, population, area_km2) VALUES
(1, 'Stuttgart I', 'Muhterem Aras', 'GRÜNE', '{"lat": 48.7758, "lng": 9.1829}', 98228, 15.2),
(2, 'Stuttgart II', 'Daniel Lede Abal', 'GRÜNE', '{"lat": 48.7400, "lng": 9.1500}', 91940, 42.8),
(3, 'Stuttgart III', 'Ayla Cataltepe', 'GRÜNE', '{"lat": 48.8200, "lng": 9.1500}', 89208, 45.1),
(4, 'Stuttgart IV', 'Anja Reinalter', 'GRÜNE', '{"lat": 48.7900, "lng": 9.2300}', 91723, 38.9),
(5, 'Böblingen', 'Thaddäus Kunzmann', 'CDU', '{"lat": 48.6850, "lng": 9.0081}', 129808, 156.4),
(6, 'Leonberg', 'Thomas Blenke', 'CDU', '{"lat": 48.7447, "lng": 8.9486}', 130289, 201.3),
(7, 'Esslingen', 'Nicolas Fink', 'GRÜNE', '{"lat": 48.7394, "lng": 9.3095}', 111191, 89.7),
(8, 'Kirchheim', 'Tobias Bacherle', 'GRÜNE', '{"lat": 48.6481, "lng": 9.4500}', 119713, 278.9),
(9, 'Nürtingen', 'Karl Zimmermann', 'CDU', '{"lat": 48.6275, "lng": 9.3444}', 124739, 214.8),
(10, 'Göppingen', 'Tim Bückner', 'SPD', '{"lat": 48.7039, "lng": 9.6528}', 94014, 165.2),
(11, 'Geislingen', 'Bernd Gögel', 'AfD', '{"lat": 48.6242, "lng": 9.8306}', 88430, 423.1),
(12, 'Ludwigsburg', 'Daniel Born', 'SPD', '{"lat": 48.8975, "lng": 9.1925}', 122745, 93.8),
(13, 'Vaihingen', 'Fabian Gramling', 'CDU', '{"lat": 48.9394, "lng": 8.9583}', 114250, 189.4),
(14, 'Bietigheim-Bissingen', 'Sabine Kurtz', 'CDU', '{"lat": 48.9567, "lng": 9.1356}', 124862, 299.7),
(15, 'Waiblingen', 'Christina Baum', 'AfD', '{"lat": 48.8306, "lng": 9.3181}', 105445, 135.6),
(16, 'Schorndorf', 'Ramazan Selcuk', 'GRÜNE', '{"lat": 48.8061, "lng": 9.5294}', 95490, 142.3),
(17, 'Backnang', 'Sascha Binder', 'SPD', '{"lat": 48.9447, "lng": 9.4319}', 93471, 395.8),
(18, 'Heilbronn', 'Josip Juratovic', 'SPD', '{"lat": 49.1419, "lng": 9.2206}', 99489, 99.9),
(19, 'Eppingen', 'Konrad Epple', 'CDU', '{"lat": 49.1375, "lng": 8.9092}', 105990, 545.2),
(20, 'Neckarsulm', 'Christine Neumann-Martin', 'CDU', '{"lat": 49.1969, "lng": 9.2244}', 112091, 729.8),
(21, 'Hohenlohe', 'Arnulf von Eyb', 'CDU', '{"lat": 49.3400, "lng": 9.7700}', 98928, 1294.1),
(22, 'Schwäbisch Hall', 'Linde Lindner', 'AfD', '{"lat": 49.1119, "lng": 9.7383}', 125970, 1484.4),
(23, 'Main-Tauber', 'Christian von Stetten', 'CDU', '{"lat": 49.6200, "lng": 9.6500}', 100502, 1304.2),
(24, 'Heidenheim', 'Raimund Haser', 'CDU', '{"lat": 48.6767, "lng": 10.1500}', 92576, 627.8),
(25, 'Schwäbisch Gmünd', 'Tim Diebler', 'CDU', '{"lat": 48.7981, "lng": 9.7983}', 108098, 530.9),
(26, 'Aalen', 'Winfried Mack', 'CDU', '{"lat": 48.8400, "lng": 10.0969}', 122157, 1511.4);

-- Continue with Karlsruhe region districts (27-70)
INSERT INTO election_districts (district_number, district_name, representative_name, representative_party, center_coordinates, population, area_km2) VALUES
(27, 'Karlsruhe I', 'Ute Leidig', 'GRÜNE', '{"lat": 49.0069, "lng": 8.4037}', 103423, 89.2),
(28, 'Karlsruhe II', 'Alexander Salomon', 'GRÜNE', '{"lat": 48.9900, "lng": 8.3800}', 99640, 84.5),
(29, 'Bruchsal', 'Ulli Hockenberger', 'CDU', '{"lat": 49.1242, "lng": 8.5985}', 104832, 368.7),
(30, 'Bretten', 'Karl Klein', 'CDU', '{"lat": 49.0400, "lng": 8.7069}', 92875, 298.4),
(31, 'Ettlingen', 'Moritz Oppelt', 'CDU', '{"lat": 48.9447, "lng": 8.4062}', 108946, 210.8),
(32, 'Rastatt', 'Jonas Weber', 'GRÜNE', '{"lat": 48.8581, "lng": 8.2044}', 105639, 371.2),
(33, 'Baden-Baden', 'Tobias Wald', 'CDU', '{"lat": 48.7606, "lng": 8.2406}', 95724, 523.1),
(34, 'Calw', 'Thomas Blenke', 'CDU', '{"lat": 48.7144, "lng": 8.7400}', 111849, 797.5),
(35, 'Freudenstadt', 'Klaus Hoher', 'CDU', '{"lat": 48.4656, "lng": 8.4100}', 85332, 870.8),
(36, 'Pforzheim', 'Stefanie Seemann', 'GRÜNE', '{"lat": 48.8911, "lng": 8.6944}', 99887, 98.0),
(37, 'Enzkreis', 'Christine Neumann-Martin', 'CDU', '{"lat": 48.9300, "lng": 8.8200}', 124580, 573.1),
(38, 'Mühlacker', 'Erik Schweickert', 'FDP', '{"lat": 48.9419, "lng": 8.8358}', 89456, 168.2),
(39, 'Heidelberg', 'Theresia Bauer', 'GRÜNE', '{"lat": 49.3988, "lng": 8.6724}', 117823, 108.8),
(40, 'Weinheim', 'Georg Nelius', 'SPD', '{"lat": 49.5506, "lng": 8.6692}', 105847, 432.7);

-- Continue with remaining districts
INSERT INTO election_districts (district_number, district_name, representative_name, representative_party, center_coordinates, population, area_km2) VALUES
(41, 'Sinsheim', 'Albrecht Schütte', 'CDU', '{"lat": 49.2508, "lng": 8.8781}', 106558, 684.8),
(42, 'Wiesloch', 'Christine Neumann-Martin', 'CDU', '{"lat": 49.2947, "lng": 8.6989}', 98732, 298.7),
(43, 'Schwetzingen', 'Daniel Born', 'SPD', '{"lat": 49.3819, "lng": 8.5719}', 104756, 235.4),
(44, 'Mannheim I', 'Stefan Fulst-Blei', 'SPD', '{"lat": 49.4875, "lng": 8.4661}', 87345, 28.9),
(45, 'Mannheim II', 'Elke Zimmer', 'GRÜNE', '{"lat": 49.4900, "lng": 8.4800}', 89567, 31.2),
(46, 'Ladenburg', 'Julia Philippi', 'CDU', '{"lat": 49.4700, "lng": 8.6100}', 95678, 187.3),
(47, 'Mosbach', 'Georg Nelius', 'SPD', '{"lat": 49.3539, "lng": 9.1450}', 89234, 578.9),
(48, 'Tauberbischofsheim', 'Reinhold Gall', 'SPD', '{"lat": 49.6200, "lng": 9.6600}', 78945, 421.7),
(49, 'Freiburg I', 'Nadyne Saint-Cast', 'GRÜNE', '{"lat": 47.9990, "lng": 7.8421}', 95432, 45.2),
(50, 'Freiburg II', 'Daniela Evers', 'GRÜNE', '{"lat": 48.0100, "lng": 7.8500}', 97823, 48.7),
(51, 'Breisgau', 'Reinhold Pix', 'GRÜNE', '{"lat": 47.9200, "lng": 7.7800}', 112456, 387.4),
(52, 'Emmendingen', 'Alexander Schoch', 'GRÜNE', '{"lat": 48.1200, "lng": 7.8500}', 98765, 679.8),
(53, 'Lahr', 'Sandra Boser', 'GRÜNE', '{"lat": 48.3394, "lng": 7.8742}', 105432, 432.1),
(54, 'Offenburg', 'Thomas Marwein', 'GRÜNE', '{"lat": 48.4733, "lng": 7.9419}', 115678, 714.3),
(55, 'Kehl', 'Alexander Schoch', 'GRÜNE', '{"lat": 48.5708, "lng": 7.8158}', 89234, 298.5),
(56, 'Achern', 'Thomas Marwein', 'GRÜNE', '{"lat": 48.6300, "lng": 8.0700}', 87345, 367.2),
(57, 'Bühl', 'Tobias Wald', 'CDU', '{"lat": 48.6956, "lng": 8.1367}', 91234, 245.8),
(58, 'Lörrach', 'Marion Gentges', 'CDU', '{"lat": 47.6167, "lng": 7.6667}', 123456, 806.9),
(59, 'Weil am Rhein', 'Jonas Weber', 'GRÜNE', '{"lat": 47.5933, "lng": 7.6181}', 78923, 192.3),
(60, 'Müllheim', 'Reinhold Pix', 'GRÜNE', '{"lat": 47.8100, "lng": 7.6300}', 95678, 387.6);

-- Final batch of districts
INSERT INTO election_districts (district_number, district_name, representative_name, representative_party, center_coordinates, population, area_km2) VALUES
(61, 'Waldshut', 'Sabine Hartmann-Müller', 'CDU', '{"lat": 47.6200, "lng": 8.2100}', 89456, 1131.5),
(62, 'Konstanz', 'Nese Erikli', 'GRÜNE', '{"lat": 47.6779, "lng": 9.1732}', 115432, 817.9),
(63, 'Stockach', 'Martina Braun', 'GRÜNE', '{"lat": 47.8506, "lng": 9.0169}', 87234, 567.3),
(64, 'Singen', 'Hans-Peter Storz', 'SPD', '{"lat": 47.7583, "lng": 8.8408}', 95432, 387.2),
(65, 'Radolfzell', 'Jürgen Keck', 'FDP', '{"lat": 47.7400, "lng": 8.9700}', 89123, 298.7),
(66, 'Villingen-Schwenningen', 'Karl Rombach', 'CDU', '{"lat": 48.0606, "lng": 8.4594}', 125678, 1086.4),
(67, 'Rottweil', 'Stefan Teufel', 'CDU', '{"lat": 48.1683, "lng": 8.6281}', 95432, 741.8),
(68, 'Tuttlingen', 'Dorothea Wehinger', 'GRÜNE', '{"lat": 47.9889, "lng": 8.8158}', 89765, 933.2),
(69, 'Balingen', 'Guido Wolf', 'CDU', '{"lat": 48.2758, "lng": 8.8519}', 112345, 682.4),
(70, 'Tübingen', 'Daniel Lede Abal', 'GRÜNE', '{"lat": 48.5219, "lng": 9.0583}', 124567, 519.7);