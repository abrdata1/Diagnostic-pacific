// exposure-lecz-data.js
// Part de la population vivant sous 10 m d'altitude (Low Elevation Coastal
// Zone, seuil standard en recherche sur les risques côtiers), par pays.
//
// Source : export Pacific Data Hub / .Stat Explorer, indicateur "Population
// living in low elevation coastal zones (0-10m and 0-20m above sea level)".
// Valeurs les plus récentes disponibles par pays (années de recensement
// variables selon les pays, entre 2017 et 2023).
//
// Deux réserves à connaître :
//  - Papouasie-Nouvelle-Guinée est marquée "valeur manquante" (Observation
//    Status) dans la source malgré la présence d'un chiffre — à vérifier.
//  - Tokelau n'a aucune valeur dans cet export (marqué "O.." partout). La
//    valeur ci-dessous (99%) est estimée par analogie avec les 3 autres
//    nations-atolls pures du jeu de données (Tuvalu, Kiribati, Îles
//    Marshall), cohérent avec Andrew et al. 2019 (PLOS ONE) qui classe ces
//    4 pays ensemble comme "100% de la population à moins d'1 km de la
//    côte" — ce n'est PAS une valeur mesurée comme les autres.
const EXPOSURE_LECZ_DATA = {
  "Fidji": 28,
  "Nouvelle-Calédonie": 31,
  "Papouasie-Nouvelle-Guinée": 10,
  "Îles Salomon": 33,
  "Vanuatu": 12,
  "Guam": 4,
  "Kiribati": 74,
  "Îles Marshall": 96,
  "États Fédérés De Micronésie": 40,
  "Nauru": 76,
  "Îles Mariannes Du Nord": 28,
  "Palaos": 17,
  "Samoa Américaines": 25,
  "Îles Cook": 31,
  "Polynésie Française": 55,
  "Niue": 1,
  "Samoa": 13,
  "Tokelau": 99,
  "Tonga": 27,
  "Tuvalu": 99,
  "Wallis Et Futuna": 38
};
