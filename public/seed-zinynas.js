(() => {
  const KEY = 'geliu-db-v5';
  const raw = localStorage.getItem(KEY);
  if (!raw) { console.error('No data in localStorage'); return; }
  const data = JSON.parse(raw);
  const mkid = () => Math.random().toString(36).slice(2, 10);

  const entries = [
    {
      text: 'NPK traszos: N (azotas) skatina lapu augima, P (fosforas) stiprina saknis ir ziedima, K (kalis) gerina atsparuma ligoms ir sausrai. Vasara naudokite didesni N kiekio trase (pvz. 20-10-10), rudeni ir ziema pereikite prie mazesnio N arba is viso nenaudokite.',
      source: 'manual', plantId: null, plantName: null,
    },
    {
      text: 'Voratinklines erkutes atpazinimas: smulkus pilki arba rudi taskeliai lapu apaciau, plona voratinklio plevelele tarp lapu ar stiebo. Puiki profilaktika - reguliarus purskimas vandeniu, nes erkutes nemegsta dregmes. Gydymui - Neem aliejus 3 kartus kas savyte arba Aktellik sisteminis preparatas.',
      source: 'manual', plantId: null, plantName: null,
    },
    {
      text: 'Laistymo taisykle "pirssto metodas": ismesk pirsta i zeme 2-3 cm. Jei sausa - laistyk. Jei dregna - palauk. Geriau per mazai nei per daug - dauguma kambariu augalu zusta nuo perpylimo, ne nuo issausejimo. Vandeni naudok kambario temperaturos, ne salta tiesiai is ciapo.',
      source: 'manual', plantId: null, plantName: null,
    },
    {
      text: 'Kada persodinti: pagrindinis zenklas - saknys lenda pro drenazines skyles arba matosi virs zemes. Geriausia persodinti pavasari pries augimo sezona (kovas-balandis). Nauja vazonas - tik 2-3 cm didesnis nei ankstesnis. Per didelis vazonas sukelia perdregnima ir saknu puvinima.',
      source: 'manual', plantId: null, plantName: null,
    },
    {
      text: 'Sviesos lygiai: tiesiogine saule (pietinis langas) - kaktusai, sukulentai. Ryskia netiesioginė (rytinis/vakarine langas) - Monstera, Pothos, Ficus. Menka sviesa (tolokai nuo lango) - Zamioculcas, Sansevieria, Aspidistra. Augalas, kuriam per mazai sviesos: ilgi liekni stiebai, isblukusios spalvos, mazas augimas.',
      source: 'manual', plantId: null, plantName: null,
    },
    {
      text: 'Oro dregme namuose: ziema sildymo sezona dregme krienta iki 20-30%, augalams reikia 50-70%. Sprendimai: akmenukais su vandeniu padeklas po vazonu, dregnintuvai, augalai grupuojami kartu. Purskimas tik ryté, ne vakare - vakaro dregme skatina grybelius. Orchidejoms ir paparciams reikia daugiausiai.',
      source: 'manual', plantId: null, plantName: null,
    },
    {
      text: 'Substratas: universalus durpiu substratas tinka daugumai augalu. Sukulentams/kaktusams - pridek 50% smelo ar perlito. Orchidejoms - specialus orchideju substratas is zieveciu. Zmogaus augalams - sunkesne, labiau molis turinti zeme. Perlitas gerina drenaza, kokoso pluostas - dregmes issaugojima.',
      source: 'manual', plantId: null, plantName: null,
    },
    {
      text: 'Grybeliniai susirgimai: dazniausiai pasireiskia per didelio dregnumo ir prasto vedinimo salygomis. Pilkasis puvinys (Botrytis) - pilki pusniai ant lapu. Miltine rasa - baltas miltinis apnasal ant lapu. Gydymas: paskinis zigringa skystis (1 valgomasis saukstelis sodos 1l vandens) arba varinis fungicidas. Profilaktika - geras vedinimas.',
      source: 'manual', plantId: null, plantName: null,
    },
    {
      text: 'Ziemojimas: daugumai kambariu augalu ziema reikia maziau laistymo (kas 3-4 sav.) ir jokiu trasu. Temperatura ideali 15-18C, toli nuo radiatoriaus. Neperkelk augalo - ryte ir vekare sviesos kiekio pokytis ju stresina. Jei augalas meta lapus ziema - normalus procesas, ne liga.',
      source: 'manual', plantId: null, plantName: null,
    },
    {
      text: 'Dirvozemi pH: dauguma augalu miegsta nezymiai rugsti pH 6.0-6.5. Zalieji augalai (Rhododendron, Azalea, Blueberry) nori rugstesnes pH 4.5-5.5. Jei lapai geltonuoja bet gyslos zalia - chloroze del per auksto pH (mazeja gelezies itempimas). Sprendimas: raugstintas durpiu substratas, arba laistymas su mazai acto (1 valgomasis saukstelis 1l vandens kartais).',
      source: 'manual', plantId: null, plantName: null,
    },
  ];

  const today = new Date().toISOString().slice(0, 10);
  if (!data.zinynas) data.zinynas = [];
  entries.forEach(e => {
    data.zinynas.push({ id: mkid(), date: today, ...e });
  });

  localStorage.setItem(KEY, JSON.stringify(data));
  console.log('Zinynas: prideta ' + entries.length + ' irasu. Perkrauk puslapi.');
})();
