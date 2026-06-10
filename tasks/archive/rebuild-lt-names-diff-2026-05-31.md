# lt-names.json rebuild — diff report

**Date:** 2026-05-31
**Tool:** scripts/diff-lt-names.mjs
**Old:** /Users/kestutissmigelskis/lapasid/data/lt-names.json
**New:** /Users/kestutissmigelskis/lapasid/data/lt-names.json.NEW

## Summary

### Genus dict
- Total old: 1641
- Total new: 1673
- Removed: 813
- Added: 845
- Kept: 828
  - Changed ltName: 433
  - Changed synonyms only: 131
  - Fully unchanged: 264

### Species dict
- Total old: 4438
- Total new: 4696
- Removed: 9
- Added: 267
- Changed: 1

---

## Removed genera (813)

Genera that existed in old DB but NOT in new. Likely causes:
- Multi-word LT name → rejected by classifier (data goes to species channel)
- Cross-genus pollution → ltName was canonical for different genus
- All source candidates were garbage

<details><summary>Show all 813 removed</summary>

| Latin genus | Old LT name | Old synonyms | Old sources |
|---|---|---|---|
| `Acalypha` | Akolifa | — | gaspadorius |
| `Acantholimon` | — | — |  |
| `Aciphylla` | — | — |  |
| `Acis` | — | — |  |
| `Acokanthera` | — | — |  |
| `Acradenia` | — | — |  |
| `Adenocarpus` | — | — |  |
| `Adlumia` | — | — |  |
| `Adromischus` | — | — |  |
| `Agapetes` | — | — |  |
| `Agathosma` | — | — |  |
| `Agon` | — | — |  |
| `Alangium` | — | — |  |
| `Albuca` | — | — |  |
| `All` | — | — | inat |
| `Aloinopsis` | — | — |  |
| `Aloysia` | — | — |  |
| `Alyssoides` | — | — |  |
| `Amaranth` | — | — | inat |
| `Amsonia` | Dirktai | — | sodospalvos |
| `Anemonella` | — | — |  |
| `Anemopaegma` | — | — |  |
| `Anigozanthos` | Kengūros letena | — | gaspadorius |
| `Anisodontea` | — | — |  |
| `Anomatheca` | — | — |  |
| `Anopterus` | — | — |  |
| `Anredera` | — | — |  |
| `Antigonon` | — | — |  |
| `Aphyllanthes` | — | — |  |
| `Aponogeton` | — | — |  |
| `Aporocactus` | — | — |  |
| `Aptenia` | — | — |  |
| `Araujia` | — | — |  |
| `Archontophoenix` | Dygfinikis | — | sodospalvos |
| `Ardisia` | Ardizija | — | gaspadorius |
| `Argyreia` | — | — |  |
| `Argyroderma` | — | — |  |
| `Aria` | — | — |  |
| `Arisarum` | — | — |  |
| `Aristea` | — | — |  |
| `Aristotelia` | — | — |  |
| `Arnebia` | — | — |  |
| `Arthropodium` | — | — |  |
| `Asarina` | Skiauteručiai | — | sodospalvos |
| `Asimina` | — | — |  |
| `Asphodeline` | — | — |  |
| `Astelia` | — | — |  |
| `Asteranthera` | — | — |  |
| `Astilboides` | — | — |  |
| `Atherosperma` | — | — |  |
| `Athrotaxis` | — | — |  |
| `Austrocedrus` | — | — |  |
| `Azara` | — | — |  |
| `Azorina` | — | — |  |
| `Banksia` | — | — |  |
| `Baptisia` | — | — |  |
| `Barba` | — | — | inat |
| `Barleria` | — | — |  |
| `Bauera` | — | — |  |
| `Bauhinia` | — | — |  |
| `Beaumontia` | — | — |  |
| `Belamcanda` | Vilkdalgis | — | inat |
| `Bellevalia` | — | — |  |
| `Berberidopsis` | — | — |  |
| `Berkheya` | — | — |  |
| `Bertolonia` | — | — |  |
| `Berzelia` | — | — |  |
| `Bessera` | — | — |  |
| `Biarum` | — | — |  |
| `Bignonia` | — | — |  |
| `Billardiera` | — | — |  |
| `Bloomeria` | — | — |  |
| `Bocactus` | — | — |  |
| `Boenninghausenia` | — | — |  |
| `Bolax` | — | — |  |
| `Bomarea` | — | — |  |
| `Boronia` | — | — |  |
| `Bouvardia` | — | — |  |
| `Bowiea` | — | — |  |
| `Boykin` | — | — |  |
| `Brachychiton` | — | — |  |
| `Brachyscome` | — | — |  |
| `Briggsia` | — | — |  |
| `Brimeura` | — | — |  |
| `Brodiaea` | — | — |  |
| `Brunsvigia` | — | — |  |
| `Buddleja` | Budlėja | — | gaspadorius, inat |
| `Buphthalmum` | Jautakė | — | inat |
| `Cabomba` | Kabombos | — | inat |
| `Calliandra` | — | — |  |
| `Callianthemum` | — | — |  |
| `Callicarpa` | Vaisuolė | — | inat |
| `Callistemon` | Kalistemonai | Kalisfemonas gelsvasis | sodospalvos |
| `Callistephus` | Ratilis | — | inat |
| `Calochone` | — | — |  |
| `Calochortus` | — | — |  |
| `Calodendrum` | — | — |  |
| `Calomeria` | — | — |  |
| `Caloscordum` | — | — |  |
| `Calothamnus` | — | — |  |
| ... | ... | ... | (713 more) |

</details>

---

## Added genera (845)

| Latin genus | New LT name | Sources | Confidence |
|---|---|---|---|
| `Abies` | Kėnis | plants-genus, plants-species-inferred | mid |
| `Abietinella` | Keniūtė | plants-genus, plants-species-inferred | mid |
| `Abrus` | Abras | plants-genus, plants-species-inferred | mid |
| `Acanthocereus` | Akantocereusas | plants-genus, plants-species-inferred | mid |
| `Acanthopanax` | Dyglys | plants-genus, plants-species-inferred | mid |
| `Acanthophyllum` | Dyglys | plants-genus, plants-species-inferred | mid |
| `Aceras` | Ėdras | plants-genus | low |
| `Acroptilon` | Šerpetė | plants-genus, plants-species-inferred | mid |
| `Actinidium` | Liebholdmiškai | plants-genus, plants-species-inferred | mid |
| `Adenostyles` | Adenostilis | plants-genus, plants-species-inferred | mid |
| `Adoxa` | Neižvaizdis | plants-genus, plants-species-inferred | mid |
| `Aegilops` | Kietinis | plants-genus, plants-species-inferred | mid |
| `Aegle` | Belhaumas | plants-genus, plants-species-inferred | mid |
| `Aegopodium` | Garšva | plants-genus, plants-species-inferred | mid |
| `Aesculus` | Kaštonas | plants-genus, plants-species-inferred | mid |
| `Agathis` | Agatis | plants-genus, plants-species-inferred | mid |
| `Ageratum` | Žydrūnis | plants-genus, plants-species-inferred | mid |
| `Agrimonia` | Dirvuolė | plants-genus, plants-species-inferred | mid |
| `Agriophyllum` | Kumarinis | plants-genus | low |
| `Agropyron` | Valkšnas | plants-genus, plants-species-inferred | mid |
| `Agrostis` | Smilga | plants-genus, plants-species-inferred | mid |
| `Aira` | Smiltinė | plants-genus, plants-species-inferred | mid |
| `Ajuga` | Vaisginė | plants-genus, plants-species-inferred | mid |
| `Aldrovanda` | Aldrūnė | plants-genus, plants-species-inferred | mid |
| `Alectrolophus` | Barškutis | plants-genus | low |
| `Alkanna` | Alkanė | plants-genus, plants-species-inferred | mid |
| `Alliaria` | Česnakas | plants-genus, plants-species-inferred | mid |
| `Alopecurus` | Pašiūrelis | plants-genus, plants-species-inferred | mid |
| `Alsophila` | Alsofilė | plants-genus | low |
| `Althaea` | Svilarožė | plants-genus, plants-species-inferred | mid |
| `Amblystegium` | Bukasilpė | plants-genus, plants-species-inferred | mid |
| `Ambrosia` | Ambrozija | plants-genus, plants-species-inferred | mid |
| `Ammi` | Žiemis | plants-genus, plants-species-inferred | mid |
| `Ammobium` | Smėliasagis | plants-genus, plants-species-inferred | mid |
| `Ammodendron` | Smėlis | plants-genus, plants-species-inferred | mid |
| `Ammophila` | Smiltlendrė | plants-genus, plants-species-inferred | mid |
| `Amphora` | Amfora | plants-genus, plants-species-inferred | mid |
| `Amygdalus` | Migdolas | plants-genus, plants-species-inferred | mid |
| `Anabaena` | Vandenkrėtis | plants-genus, plants-species-inferred | mid |
| `Anabasis` | Anabasis | plants-genus, plants-species-inferred | mid |
| `Anacardium` | Anakardis | plants-genus, plants-species-inferred | mid |
| `Anamirta` | Anamirta | plants-genus, plants-species-inferred | mid |
| `Andropogon` | Barzdis | plants-genus | low |
| `Anethum` | Krapai | plants-genus, plants-species-inferred | mid |
| `Aneura` | Aneura | plants-genus | low |
| `Angelica` | Skudutis | plants-genus | low |
| `Ankistrodesmus` | Ankistrodesmas | plants-genus, plants-species-inferred | mid |
| `Anomodon` | Dantis | plants-genus | low |
| `Anthoceros` | Žiedas | plants-genus | low |
| `Aphanes` | Muiltikė | plants-genus, plants-species-inferred | mid |
| ... | ... | ... | (795 more) |

---

## Changed ltName (433)

PAGRINDINIO LT VARDO PAKEITIMAS — KRITIŠKAS, peržiūrėk kiekvieną:

| Latin | Old → New | Old src → New src |
|---|---|---|
| `Acaena` | "Acenos" → "Dyglius" | derlingas,sodospalvos → plants-genus,plants-species-inferred,derlingas |
| `Acanthus` | "Akantas" → "Dyglis" | wiki → plants-genus,plants-species-inferred,wiki |
| `Acca` | "null" → "Akka" | ? → plants-species-inferred |
| `Acer` | "Acer" → "Klevas" | wiki → plants-genus,plants-species-inferred,wiki |
| `Achillea` | "kraujažolė" → "Kraujažolė" | wiki,plants,derlingas,sodospalvos,inat → plants-genus,plants-species-inferred,wiki,derlingas |
| `Acorus` | "AJERAS" → "Ajeras" | sodospalvos,inat → plants-species-inferred,wiki |
| `Adenium` | "tinūtras" → "Tinūtras" | derlingas → derlingas |
| `Adenophora` | "liaukutė" → "Varpūtė" | plants → plants-genus,plants-species-inferred |
| `Adonis` | "ADONIS" → "Adonis" | wiki,plants,sodospalvos → plants-genus,plants-species-inferred,wiki |
| `Aeonium` | "ramdis" → "Ramdis" | derlingas → derlingas |
| `Aethionema` | "neraprastas" → "Neraprastas" | plants → plants-genus,plants-species-inferred |
| `Agave` | "agava" → "Agava" | wiki,plants,derlingas → plants-genus,plants-species-inferred,wiki,derlingas |
| `Agrostemma` | "Raugė" → "Kūkalis" | wiki,inat → plants-genus,plants-species-inferred,wiki |
| `Albizia` | "albizija" → "Albizija" | plants → plants-genus,plants-species-inferred |
| `Alocasia` | "Alokazija" → "Alokasija" | wiki,gaspadorius → plants-genus,plants-species-inferred,gaspadorius,wiki |
| `Alstroemeria` | "Alstremerija" → "Alstromerija" | derlingas,inat → plants-genus,plants-species-inferred,derlingas |
| `Alternanthera` | "Alstė" → "Alternantera" | wiki → plants-genus,plants-species-inferred,wiki |
| `Amaryllis` | "amarilis" → "Amarilė" | plants → plants-genus,plants-species-inferred |
| `Ampelopsis` | "Vytenis (augalas)" → "Vynmedis" | wiki → plants-genus,plants-species-inferred,wiki |
| `Anacyclus` | "Seilius (augalas)" → "Anaciklis" | wiki → plants-genus,plants-species-inferred,wiki |
| `Anagallis` | "Progailis" → "Pelėjūdė" | wiki → plants-genus,wiki |
| `Anaphalis` | "Šlamainis" → "Anžalis" | wiki → plants-genus,plants-species-inferred,wiki |
| `Anchusa` | "Godas" → "Godulis" | wiki → plants-genus,plants-species-inferred,wiki |
| `Anemonopsis` | "plukmenė" → "Plukmenė" | plants → plants-genus,plants-species-inferred |
| `Anthericum` | "Šiaudeniai" → "Šiaudinys" | sodospalvos → plants-species-inferred |
| `Anthurium` | "Anturis" → "Antūris" | wiki,sodospalvos,gaspadorius,inat → plants-species-inferred,gaspadorius,wiki |
| `Anthyllis` | "Perluotis" → "Perliukas" | wiki,inat → plants-genus,plants-species-inferred,wiki |
| `Antirrhinum` | "Žioveinis" → "Žiovėnis" | wiki,inat → plants-species-inferred,wiki |
| `Aphelandra` | "Afelandra" → "Alefandra" | sodospalvos → gaspadorius |
| `Arabis` | "Vaistutis" → "Vaistinis" | wiki,derlingas,inat → plants-species-inferred,wiki,derlingas |
| `Arbutus` | "null" → "Arbūtas" | ? → plants-species-inferred |
| `Arctostaphylos` | "Meškauogė" → "Meška" | wiki → plants-genus,wiki |
| `Argemone` | "vienos aguonų rūšies" → "Argemonė" | plants → plants-species-inferred |
| `Armeria` | "Gvaizdė" → "Gvazdinė" | wiki,sodospalvos,inat → plants-genus,plants-species-inferred,wiki |
| `Arnica` | "Arnika" → "Šmilė" | wiki,inat → plants-genus,plants-species-inferred,wiki |
| `Arum` | "ARONAS" → "Aronas" | wiki,plants,sodospalvos,inat → plants-genus,plants-species-inferred,wiki |
| `Aruncus` | "aronkojis" → "Aronkojis" | plants → plants-genus,plants-species-inferred |
| `Asclepias` | "klemalė" → "Klemalis" | plants → plants-genus,plants-species-inferred |
| `Asparagus` | "Smidras" → "Šparagas" | gaspadorius,inat → plants-genus,plants-species-inferred,gaspadorius |
| `Asperula` | "Krunė" → "Krūmė" | wiki → plants-genus,wiki |
| `Asphodelus` | "asfodelas" → "Asfodelas" | plants → plants-genus,plants-species-inferred |
| `Aspidistra` | "aspidistra" → "Aspidistra" | plants → plants-genus,plants-species-inferred |
| `Astilbe` | "lempa" → "Astilbė" | plants → plants-genus,plants-species-inferred,derlingas |
| `Athyrium` | "Paprastasis blužniapapartis" → "Papartis" | wiki → plants-genus,plants-species-inferred |
| `Atriplex` | "Balandūnė" → "Balanda" | wiki,inat → plants-genus,plants-species-inferred,wiki |
| `Aubrieta` | "Aubretė" → "Aubrietė" | wiki,sodospalvos,inat → plants-genus,plants-species-inferred,wiki |
| `Aucuba` | "japoninė aukuba" → "Aukuba" | plants → plants-species-inferred |
| `Aurinia` | "Auriniauinia" → "Aurinija" | plants → plants-species-inferred |
| `Azolla` | "azolė" → "Azolė" | plants → plants-genus,plants-species-inferred |
| `Baldellia` | "Šilininkas" → "Baldellia" | wiki → plants-genus,wiki |
| `Ballota` | "paskleisi" → "Paskleisi" | plants → plants-genus |
| `Berchemia` | "berchemija" → "Berchemija" | plants → plants-genus,plants-species-inferred |
| `Bidens` | "Lakišius" → "Laksinys" | wiki,inat → plants-genus,wiki |
| `Brassica` | "Rapsas" → "Bastutis" | wiki → plants-genus,plants-species-inferred,wiki |
| `Broussonetia` | "popiermedis" → "Popiermedis" | plants → plants-genus,plants-species-inferred |
| `Browningia` | "brauningija" → "Brauningija" | wiki,derlingas → wiki,derlingas |
| `Bulbocodium` | "svogūnas" → "Svogūnas" | plants → plants-genus,plants-species-inferred |
| `Butomus` | "Skėtinis bėžis" → "Bėžis" | wiki → plants-genus,plants-species-inferred |
| `Caladium` | "Kaladis" → "Kaldis" | wiki,gaspadorius → plants-genus,plants-species-inferred,gaspadorius,wiki |
| `Calathea` | "Kalatėja" → "Kalatėją" | plants,derlingas,gaspadorius → plants-genus,gaspadorius,derlingas |
| `Calceolaria` | "klumpaitės" → "Kalceolarija" | plants → plants-genus,plants-species-inferred |
| `Calla` | "Pelkinis žinginys" → "Gluosnė" | wiki → plants-genus,plants-species-inferred |
| `Caltha` | "Puriena" → "Purienos" | wiki,plants → plants-genus,plants-species-inferred,wiki |
| `Calycanthus` | "taurėžiedis" → "Taurėžiedis" | plants → plants-genus,plants-species-inferred |
| `Campanula` | "KATILĖLIS" → "Katilėlis" | wiki,plants,sodospalvos,inat → plants-genus,plants-species-inferred,gaspadorius,wiki |
| `Campsis` | "Ląstūnė" → "Lipikas" | wiki → plants-species-inferred,wiki |
| `Canna` | "Kana" → "Kanā" | derlingas,sodospalvos,inat → plants-genus,plants-species-inferred,wiki,derlingas |
| `Caragana` | "Karagana" → "Karaganas" | wiki → plants-genus,plants-species-inferred,wiki |
| `Cardamine` | "Kartenė" → "Kartenis" | wiki,inat → plants-genus,plants-species-inferred,wiki |
| `Carnegiea` | "Didžioji karnegija" → "Karnegija" | wiki → derlingas |
| `Carya` | "riešutas" → "Riešutas" | plants → plants-genus,plants-species-inferred |
| `Cassia` | "kasija" → "Kasija" | plants,inat → plants-genus,plants-species-inferred |
| `Ceanothus` | "ceanotas" → "Ceanotas" | plants → plants-genus,plants-species-inferred |
| `Cephalaria` | "cefalarija" → "Cefalarija" | plants → plants-genus,plants-species-inferred |
| `Cephalocereus` | "žvakidis" → "Žvakidis" | wiki,derlingas → wiki,derlingas |
| `Cerastium` | "Glažutė" → "Glaistelis" | wiki,inat → plants-genus,plants-species-inferred,wiki |
| `Ceratostigma` | "ceratostigma" → "Ceratostigma" | plants → plants-genus,plants-species-inferred |
| `Cercidiphyllum` | "Puošmedis" → "Pošmedis" | wiki → plants-genus,plants-species-inferred,wiki |
| `Cercis` | "cercis" → "Cercis" | plants → plants-genus,plants-species-inferred |
| `Cereus` | "stulpenis" → "Cereus" | wiki,derlingas,inat → plants-genus,plants-species-inferred,wiki,derlingas |
| `Cerinthe` | "bičių žiunė" → "Cerintė" | plants → plants-species-inferred |
| `Chamaecytisus` | "kytisas" → "Kytisas" | plants → plants-genus,plants-species-inferred |
| `Chamaerops` | "chamerops" → "Chamerops" | plants → plants-genus,plants-species-inferred |
| `Chionodoxa` | "Sniegdryžė" → "Snieginė" | wiki → plants-genus,plants-species-inferred,wiki |
| `Choisya` | "čiozenė" → "Čiozenija" | plants → plants-genus,plants-species-inferred |
| `Cichorium` | "Trūkažolė" → "Trūkžolė" | wiki,plants → plants-genus,plants-species-inferred,wiki |
| `Cinnamomum` | "Cinamonas" → "Cinamamis" | wiki → plants-species-inferred,wiki |
| `Cissus` | "lapfistas" → "Lapfistas" | plants → plants-genus,plants-species-inferred,gaspadorius |
| `Cistus` | "šio augalo vardas" → "Švitrūnas" | plants → plants-species-inferred |
| `Clarkia` | "klarkija" → "Klarkija" | plants → plants-genus,plants-species-inferred |
| `Clematis` | "Raganė" → "Raganis" | wiki,sodospalvos,inat → plants-genus,plants-species-inferred,wiki |
| `Clerodendrum` | "klerodendras" → "Klerodendras" | plants → plants-genus,gaspadorius |
| `Codonopsis` | "skambelis" → "Skambelis" | plants → plants-genus,plants-species-inferred |
| `Colletia` | "kolėtija" → "Kolėtija" | plants → plants-genus |
| `Collinsia` | "kolinsija" → "Kolinsija" | plants → plants-genus,plants-species-inferred |
| `Colutea` | "Pūslius" → "Pūslenis" | wiki → plants-genus,plants-species-inferred,wiki |
| `Consolida` | "Raguolis" → "Raguliškis" | wiki → plants-genus,plants-species-inferred,wiki |
| `Convolvulus` | "Vijoklis (gentis)" → "Vijoklis" | wiki → plants-genus,plants-species-inferred,wiki |
| `Cordyline` | "kordilinė" → "Kordilinė" | plants → plants-genus,plants-species-inferred |
| `Cornus` | "sedula" → "Sedula" | plants,inat → plants-genus,plants-species-inferred,wiki |
| ... | ... | (333 more) |

---

## Changed synonyms (131)

Sinonimų pakeitimai (ltName toks pats, bet ltSynonyms array pasikeitė):

| Latin | Name | Removed synonyms | Added synonyms |
|---|---|---|---|
| `Aconitum` | Kurpelė | — | Kurpelės |
| `Actaea` | Juodžolė | augalo vandas | — |
| `Actinidia` | Aktinidija | — | Aktinidijos |
| `Adansonia` | Baobabas | baobabai | Baobabai |
| `Aeschynanthus` | Eschinantas | Aiškenis, Eschinanatas | — |
| `Allium` | Česnakas | Svogūnai valgomieji, Svogūnai laiškiniai | — |
| `Aloe` | Alavijas | alijošiumi, alijošius | Alijošius, Alijošiumi |
| `Alyssum` | Laibenis | tauralinis laibšiūnis | — |
| `Ananas` | Ananasas | Ananasai | — |
| `Antennaria` | Katpėdė | antena | Antena |
| `Aquilegia` | Sinavadas | vanduo, Sinavadai | Vanduo |
| `Arenaria` | Smiltė | Akmenės | — |
| `Aristolochia` | Kartuolė | Kartuolė (augalas) | — |
| `Artemisia` | Kietis | Kiečiai | — |
| `Asarum` | Pipirlapė | Ppipirlapės | — |
| `Aster` | Astras | Astrai | — |
| `Astrophytum` | Žvaigždinas | esantys kaktusai žvaigžinas | — |
| `Betula` | Beržas | Beržai | — |
| `Billbergia` | Bilbergija | Bilbergija svyrančioji | — |
| `Blechnum` | Unksmenė | — | Nukimėlė |
| `Camellia` | Kamelija | rožes primenančios kamelijos | — |
| `Chamaedaphne` | Bereinis | Bereinis durpyninis | — |
| `Chrysanthemum` | Chrizantema | Chrizantema indinė | — |
| `Chrysosplenium` | Blužnutė | auksažiedė | Auksažiedė |
| `Cimicifuga` | Juodžolė | Blakėžudės | — |
| `Colocasia` | Kolokazija | — | Kolokazijos |
| `Convallaria` | Pakalnutė | Paprastoji pakalnutė | — |
| `Corydalis` | Rūtenis | — | Rūtenius |
| `Crocus` | Krokas | savaičių pasirodo krokai | — |
| `Delphinium` | Pentinius | Pentiniai | — |
| `Dianthus` | Gvazdikas | gvazdikų, Gvazdikai | Gvazdikų |
| `Echinacea` | Ežiuolė | Ežiuolė rasvažiedė | — |
| `Eranthis` | Erantis | ERANČIAI | — |
| `Euonymus` | Ožekšnis | Ožekšnis japoninis | — |
| `Filipendula` | Vingiorykštė | Vingiorykštė pelkinė | — |
| `Fuchsia` | Fuksija | Grakščioji fuksija | — |
| `Gaillardia` | Gailiardija | GAILARDIJA | — |
| `Galega` | Ožiarūtis | pienas | Pienas |
| `Gladiolus` | Kardelis | Kardelis paprastasis | Kardeliai |
| `Gymnocalycium` | Nuogulis | dyglius turi nuogulis | — |
| `Hatiora` | Hatiora | kaktusai yra hatiora | — |
| `Hedera` | Gebenė | šliaužiantis vijoklis Gebenė | — |
| `Helenium` | Saulainė | Rudeninisaulainė | — |
| `Helleborus` | Eleboras | Heleborai | — |
| `Hemerocallis` | Viendienė | — | Viendienės |
| `Hyacinthus` | Hiacintas | Hiacintai | — |
| `Hydrangea` | Hortenzija | Hortenzija didžialapė | — |
| `Inula` | Debesylas | Debesylai | — |
| `Juglans` | Riešutmedis | riešutas | — |
| `Kalanchoe` | Kalankė | Kalankė raudonžiedė | — |
| `Knautia` | Buožainė | vokiečių medikas | — |
| `Kniphofia` | Knipofija | išvaizdos augalas Knipofija | — |
| `Lamium` | Notrelė | plėsdys | Plėsdys |
| `Liatris` | Liatris | Lijatris | — |
| `Lilium` | Lelija | irytietiškos lelijos | — |
| `Linum` | Linas | Linai | — |
| `Liriodendron` | Tulpmedis | tulpinis | Tulpinis |
| `Lonicera` | Sausmedis | Sausmedžiai | — |
| `Lotus` | Garždenis | — | Lotus |
| `Lupinus` | Lubinas | Lubinai | — |
| `Lychnis` | Gaisrena | GAISRENA, GAISRA, Naktižiedė | — |
| `Magnolia` | Magnolija | prabangius žiedus magnolija | — |
| `Mahonia` | Mahonija | Raugerškis | — |
| `Malva` | Dedešva | priskirta gėlė dedešva, Dedešva miškinė | — |
| `Matteuccia` | Jonpapartis | strausvinisparninis | — |
| `Mespilus` | Šliandra | Gudobelė | — |
| `Monstera` | Monstera | Monstera nuostabioji | — |
| `Morus` | Šilkmedis | Šilkmedžiai | — |
| `Muscari` | Žydrė | pavadinimu yra žydrės | — |
| `Myriophyllum` | Plunksnalapė | daugylė | Daugylė |
| `Nicandra` | Nikandra | Dumplūninė nikandra | — |
| `Nuphar` | Lūgnė | melsvai bliduokė, Lūgnė paprastoji | — |
| `Penstemon` | Penstemonas | Penstemonai | — |
| `Petunia` | Petunija | reklamą Darželinė petunija | — |
| `Phacelia` | Facelija | kūlelis | Kūlelis |
| `Philodendron` | Filodendras | Filodendrai | — |
| `Phytolacca` | Fitolaka | augalas | — |
| `Pilosocereus` | Plaukuotis | pūkuoti yra plaukuotis | — |
| `Pinus` | Pušis | Pušys | — |
| `Pisonia` | Ratiklė | Ratiklė skėtinė | — |
| `Pistacia` | Pistacija | šio augalo vardas | — |
| `Plumeria` | Jostras | Jostrai | — |
| `Potentilla` | Sidabražolė | galingas, Sidabražolė žąsinė | Galingas |
| `Primula` | Raktažolė | o pavasarinės raktažolės | Raktažoles |
| `Pulsatilla` | Šilagėlė | skambintis | Skambintis, Šilagėles |
| `Pyrola` | Kriaušlapė | kriaušė | — |
| `Ranunculus` | Vėdrynas | Vėdrynai | — |
| `Rheum` | Rabarbaras | Rabarbarai | — |
| `Rhododendron` | Rododendras | rožinis medis, Azalijos, Azalija rododendras | — |
| `Rosa` | Erškėtis | rožė, Poliantinės rožės, Rožė kininė...(4) | Rožė |
| `Rudbeckia` | Rudbekija | saulėspinduliai Rudbekijos | — |
| `Ruta` | Rūta | Rūta žalioji | — |
| `Salix` | Gluosnis | Karklai, gluosniai | — |
| `Salvia` | Šalavijas | šalavijų, Šalavijai | Šalavijų |
| `Sansevieria` | Sansevjera | Sansevjera trijuostė | — |
| `Saponaria` | Putoklis | muilinisapūnis | — |
| `Schlumbergera` | Plokštenis | dauginti kalėdinį kaktusą, Kaktusas kalėdinis | — |
| `Sedum` | Šilokas | — | Šilokų |
| `Selenicereus` | Naktenis | naktinis cereus | — |
| `Senecio` | Žilė | Žilė cinenarija | — |
| ... | ... | ... | (31 more) |

---

## Species changes

### Removed species (9)

<details><summary>Show 9 samples</summary>

- `begonia x hybrida` → "Voss begonija"
- `beta cicla` → "Beta vulgaris subsp. vulgaris convar. cicla"
- `beta maritima` → "Beta vulgaris subsp. vulgaris convar. maritima"
- `celosia argentea cristata` → "Skiaurėtoji celiozija"
- `eranthis hyemalis` → "Žiemkenčio pavasaris"
- `eraphila verna` → "L."
- `haemanthus katherinae` → "Puošnusis raidminas"
- `nodularia spumigena` → "Penejantis Borneto ir Flahaultino"
- `strelitzia reginae` → "Prašmatnioji strelicija"

</details>

### Added species (267)

<details><summary>Show 50 samples</summary>

- `begonia x` → "Voss begonija"
- `gloxinia sylvatica` → "Achimenė"
- `leptospermum scoparium` → "Arbatmedis australiškasis"
- `dipladenia sanderi` → "Dipladenija"
- `aeschynanthus speciosus` → "Eschinanatas"
- `hypocyrta glabra` → "Hypocirta"
- `jacobinia carnea` → "Jakobinija"
- `calceolaria crenatiflora` → "Kalceoliarija"
- `clusia rosea` → "Kluzija"
- `pandanus veitchii` → "Pandanas"
- `impatiens nolitangere` → "Sprigė"
- `acorus gramineus` → "Ajeras viksvinis"
- `ardisia crenata` → "Ardizija"
- `tolmiea menziesii` → "Bambukas"
- `begonia elatior` → "Begonija aukštoji"
- `buddleja indica` → "Budlėja"
- `ceropegia woodii` → "Ceropegija"
- `chloropliytum comosun` → "Chlorofitas"
- `cyrtomium falcatum` → "Cirtomis pjautuviškasis"
- `dendrobium densiflorum` → "Dendrobis"
- `soleirolia soleirolii` → "Elksinė"
- `eranthemum pulchellum` → "Erantema"
- `fittonia verschaffeltii` → "Fitonija"
- `lotus berthelotii` → "Garždenis"
- `globba winitii` → "Globa"
- `grevillea robusta` → "Grevilėja didžioji"
- `jatropha podagrica` → "Jatrofa"
- `callistemon citrinus` → "Kalisfemonas gelsvasis"
- `aspleinium nidus` → "Kalnarūtė lizdinė"
- `rhoicissus capensis` → "Kaplamstis"
- `catharanthus roseus` → "Rausvoji žiemė"
- `campanula poscharskyana` → "Katilėlis smulkiažiedis"
- `anigozanthos flavidus` → "Kengūros letena"
- `hibicus rosa-sinensis` → "Kinrožė"
- `cupressus macrocarpa` → "Kiparisas"
- `oxalis adenophylla` → "Kiškiakopūstis"
- `codonanthe erassifolia` → "Kodonantė"
- `crossandra infundibuliformis` → "Krosandra"
- `xanthosoma lindenii` → "Ksontosoma Lindeno"
- `microlepia speluncae` → "Mikrolepija"
- `nedera granadensis` → "Nedera granadinė"
- `microcoelum weddeliamun` → "Orchidėja masdevallia militaris"
- `euonymus japonicus` → "Ožekšnis japoninis"
- `pachira macrocarpa` → "Pachira"
- `cytisus x` → "Palėpštis"
- `chamaedorea elegans` → "Palmė grakščioji chamedorėja"
- `caryota mitis` → "Palmė karijota"
- `cocos nucifera` → "Palmė riešutinė kokospalmė"
- `phlebodium aureum` → "Papartis auksuotasis flebodis"
- `nephropelis exallata` → "Papartis ilgalapis inkstpapartis"

</details>

### Changed species LT (1)

| Binomial | Old | New |
|---|---|---|
| `erophila verna` | "Pavasarinė pavasaris" | "Pavasarinei ankstyvei" |

---

## How to apply

If review looks good:
```bash
mv data/lt-names.json.NEW data/lt-names.json
mv data/species-lt-names.json.NEW data/species-lt-names.json
# Verify nothing breaks:
npm run build
# Smoke test search (Sansevieria zeylanica, Streptocarpus, etc.)
```

If something is wrong, just delete .NEW files — production untouched:
```bash
rm data/lt-names.json.NEW data/species-lt-names.json.NEW
```
