const DATA_URL = { cities: 'data/cities.json', boundaries: 'data/boundaries.geojson', heraldry: 'data/heraldry.json', heraldryBe: 'data/heraldry.be.json' };
const HERALDRY_BASE = 'data/images/arms/';
const CATEGORY_LABELS = {
  animals:   { ru: 'Животные',   be: 'Жывёлы' },
  plants:    { ru: 'Растения',   be: 'Расліны' },
  water:     { ru: 'Водные объекты', be: 'Водныя аб\'екты' },
  economy:   { ru: 'Хозяйство',  be: 'Гаспадарка' },
  relief:    { ru: 'Рельеф',     be: 'Рэльеф' },
  geography: { ru: 'География',  be: 'Геаграфія' },
  minerals:  { ru: 'Ископаемые', be: 'Карысныя выкапні' }
};

// символы категорий
const SYMBOL_FONT = '"Segoe UI Symbol","Noto Sans Symbols","Noto Sans Symbols2","DejaVu Sans","Arial Unicode MS","Apple Symbols",Arial,sans-serif';
const SYMBOL_CANDIDATES = {
  animals:   ['♞', '♠', '►'],
  plants:    ['✿', '♣', '◄'],
  water:     ['≈', '▼'],
  economy:   ['⚙', '♦', '■'],
  relief:    ['▲', '▲'],
  geography: ['✦', '☼', '◊'],
  minerals:  ['◆', '●']
};
const SYMBOLS_FORCE_TEXT = new Set(['⚙', '♠', '♣', '♦']);
const symbolText = ch => SYMBOLS_FORCE_TEXT.has(ch) ? ch + '\uFE0E' : ch;

function glyphUsable(ch) {
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 48;
    const x = c.getContext('2d');
    if (!x || !x.getImageData) return true;
    const draw = str => {
      x.clearRect(0, 0, 48, 48);
      x.fillStyle = '#000';
      x.font = '700 32px ' + SYMBOL_FONT;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText(str, 24, 26);
      return x.getImageData(0, 0, 48, 48).data;
    };
    const d = draw(symbolText(ch));
    let ink = 0, color = false;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 40) {
        ink++;
        if (Math.abs(d[i] - d[i + 1]) > 30 || Math.abs(d[i + 1] - d[i + 2]) > 30) color = true;
      }
    }
    if (ink < 12 || color) return false;
    const tofu = draw('\uFFFF');
    let tink = 0, same = 0;
    for (let i = 3; i < d.length; i += 4) {
      if (tofu[i] > 40) tink++;
      if ((d[i] > 40) === (tofu[i] > 40)) same++;
    }
    return !(tink > 12 && same === d.length / 4);
  } catch (e) {
    return true;
  }
}

function resolveCategorySymbols() {
  const out = {}, used = new Set();
  for (const k of Object.keys(SYMBOL_CANDIDATES)) {
    const list = SYMBOL_CANDIDATES[k];
    let pick = list[list.length - 1];
    for (const ch of list) {
      if (!used.has(ch) && glyphUsable(ch)) { pick = ch; break; }
    }
    used.add(pick);
    out[k] = symbolText(pick);
  }
  return out;
}

const CATEGORY_SYMBOLS = resolveCategorySymbols();
document.documentElement.style.setProperty('--sym-font', SYMBOL_FONT);

const MARKER_COLORS = {
  animals: '#2a5dbf', plants: '#2f7a3a', water: '#0ea5e9',
  economy: '#a65a1e', relief: '#7c3aed', geography: '#d97706',
  minerals: '#475569', _fallback: '#9ca3af'
};

const MAP_HOME = { center: [53.7, 27.9], zoom: 7 };
const BELARUS_BOUNDS = L.latLngBounds([50.4, 21.8], [56.6, 33.8]);
const BELARUS_BOUNDS_WIDE = L.latLngBounds([49.3334, 19.8], [57.5, 35.8]);
const BELARUS_COUNTRY_BBOX = L.latLngBounds([51.1, 23.0], [56.3, 32.9]);
const MARKER_PADDING = 0.3;
const MAP_MOVE_DEBOUNCE = 150;
const SEARCH_DEBOUNCE = 200;
const MARKER_REMOVE_DELAY = 250;
const FOCUS_MIN_ZOOM = 10;
const FOCUS_MAX_ZOOM = 11;
const FLY_DURATION = 0.9;

const BE_CITY_NAMES = { 'Антополь': 'Антопаль', 'Барановичи': 'Баранавічы', 'Белоозерск': 'Белаазёрск', 'Береза': 'Бяроза', 'Брест': 'Брэст', 'Высокое': 'Высокае', 'Ганцевичи': 'Ганцавічы', 'Городище': 'Гарадзішча', 'Давид-Городок': 'Давыд-Гарадок', 'Домачево': 'Дамачава', 'Дрогичин': 'Драгічын', 'Жабинка': 'Жабінка', 'Иваново': 'Іванава', 'Ивацевичи': 'Івацэвічы', 'Каменец': 'Каменец', 'Кобрин': 'Кобрын', 'Коссово': 'Косава', 'Лунинец': 'Лунінец', 'Ляховичи': 'Ляхавічы', 'Малорита': 'Маларыта', 'Микашевичи': 'Мікашэвічы', 'Пинск': 'Пінск', 'Пружаны': 'Пружаны', 'Столин': 'Столін', 'Барань': 'Барань', 'Бегомль': 'Бягомль', 'Бешенковичи': 'Бешанковічы', 'Богушевск': 'Багушэўск', 'Браслав': 'Браслаў', 'Верхнедвинск': 'Верхнядзвінск', 'Ветрино': 'Ветрына', 'Видзы': 'Відзы', 'Витебск': 'Віцебск', 'Воропаево': 'Варапаева', 'Глубокое': 'Глыбокае', 'Городок': 'Гарадок', 'Дисна': 'Дзісна', 'Докшицы': 'Докшыцы', 'Друя': 'Друя', 'Дубровно': 'Дуброўна', 'Езерище': 'Езярышча', 'Лепель': 'Лепель', 'Лиозно': 'Лёзна', 'Миоры': 'Мёры', 'Новолукомль': 'Навалукомль', 'Новополоцк': 'Наваполацк', 'Орша': 'Орша', 'Полоцк': 'Полацк', 'Поставы': 'Паставы', 'Россоны': 'Расоны', 'Сенно': 'Сянно', 'Толочин': 'Талачын', 'Ушачи': 'Ушачы', 'Чашники': 'Чашнікі', 'Шарковщина': 'Шаркаўшчына', 'Шумилино': 'Шуміліна', 'Белицк': 'Беліцк', 'Большевик': 'Бальшавік', 'Брагин': 'Брагін', 'Буда-Кошелево': 'Буда-Кашалёва', 'Василевичи': 'Васілевічы', 'Васильевка': 'Васільеўка', 'Ветка': 'Ветка', 'Гомель': 'Гомель', 'Добруш': 'Добруш', 'Ельск': 'Ельск', 'Житковичи': 'Жыткавічы', 'Жлобин': 'Жлобін', 'Калинковичи': 'Калінкавічы', 'Корма': 'Карма', 'Лельчицы': 'Лельчыцы', 'Лоев': 'Лоеў', 'Мозырь': 'Мазыр', 'Наровля': 'Нароўля', 'Октябрьский': 'Акцябрскі', 'Петриков': 'Петрыкаў', 'Речица': 'Рэчыца', 'Рогачев': 'Рагачоў', 'Светлогорск': 'Светлагорск', 'Туров': 'Тураў', 'Хойники': 'Хойнікі', 'Чечерск': 'Чачэрск', 'Берёзовка': 'Бярозаўка', 'Большая Берестовица': 'Вялікая Бераставіца', 'Волковыск': 'Ваўкавыск', 'Вороново': 'Воранава', 'Гродно': 'Гродна', 'Дятлово': 'Дзятлава', 'Желудок': 'Жалудок', 'Зельва': 'Зэльва', 'Ивье': 'Іўе', 'Козловщина': 'Казлоўшчына', 'Кореличи': 'Карэлічы', 'Лида': 'Ліда', 'Мосты': 'Масты', 'Новогрудок': 'Навагрудак', 'Островец': 'Астравец', 'Ошмяны': 'Ашмяны', 'Свислочь': 'Свіслач', 'Скидель': 'Скідзель', 'Слоним': 'Слонім', 'Сморгонь': 'Смаргонь', 'Щучин': 'Шчучын', 'Березино': 'Бярэзіна', 'Бобр': 'Бобр', 'Борисов': 'Барысаў', 'Вилейка': 'Вілейка', 'Воложин': 'Валожын', 'Городея': 'Гарадзея', 'Дзержинск': 'Дзяржынск', 'Жодино': 'Жодзіна', 'Заславль': 'Заслаўе', 'Зеленый Бор': 'Зялёны Бор', 'Ивенец': 'Івянец', 'Клецк': 'Клецк', 'Копыль': 'Капыль', 'Крупки': 'Крупкі', 'Логойск': 'Лагойск', 'Любань': 'Любань', 'Марьина горка': 'Мар’іна Горка', 'Минск': 'Мінск', 'Молодечно': 'Маладзечна', 'Мядель': 'Мядзел', 'Несвиж': 'Нясвіж', 'Пуховичи': 'Пухавічы', 'Раков': 'Ракаў', 'Руденск': 'Рудзенск', 'Слуцк': 'Слуцк', 'Смолевичи': 'Смалявічы', 'Солигорск': 'Салігорск', 'Старые дороги': 'Старыя Дарогі', 'Столбцы': 'Стоўбцы', 'Узда': 'Узда', 'Фаниполь': 'Фаніпаль', 'Червень': 'Чэрвень', 'Белыничи': 'Бялынічы', 'Бобруйск': 'Бабруйск', 'Быхов': 'Быхаў', 'Глуск': 'Глуск', 'Глуша': 'Глуша', 'Горки': 'Горкі', 'Гродзянка': 'Градзянка', 'Елизово': 'Елізава', 'Дрибин': 'Дрыбін', 'Кировск': 'Кіраўск', 'Климовичи': 'Клімавічы', 'Кличев': 'Клічаў', 'Костюковичи': 'Касцюковічы', 'Краснополье': 'Краснаполле', 'Кричев': 'Крычаў', 'Круглое': 'Круглае', 'Могилев': 'Магілёў', 'Мстиславль': 'Мсціслаў', 'Осиповичи': 'Асіповічы', 'Славгород': 'Слаўгарад', 'Хотимск': 'Хоцімск', 'Чаусы': 'Чаусы', 'Чериков': 'Чэрыкаў', 'Шклов': 'Шклоў' };
const BE_REGION_NAMES = { 'Брестская обл.': 'Брэсцкая вобл.', 'Витебская обл.': 'Віцебская вобл.', 'Гомельская обл.': 'Гомельская вобл.', 'Гродненская обл.': 'Гродзенская вобл.', 'Минская обл.': 'Мінская вобл.', 'Могилевская обл.': 'Магілёўская вобл.' };

const I18N = {
  ru: {
    boundaries: 'Показать границы районов', categories: 'Категории:',
    cat_animals: 'Животные', cat_plants: 'Растения', cat_water: 'Вода',
    cat_economy: 'Хозяйство', cat_relief: 'Рельеф', cat_geography: 'География', cat_minerals: 'Ископаемые',
    no_info: 'Без информации о гербе', searchPlaceholder: 'Поиск города...',
    searchLabel: 'Поиск города', suggestions: 'Подсказки', noResults: 'Ничего не найдено',
    noInfo: 'Информация о гербе пока не добавлена.', imageMissing: 'Изображение герба недоступно',
    loading: 'Загрузка данных…', loadError: 'Не удалось загрузить данные. Проверьте консоль.',
    resetView: 'Сбросить вид', boundariesNA: 'Границы недоступны',
    legend: 'Легенда', legendMulti: 'Несколько категорий', langGroup: 'Язык',
    filters: 'Фильтры', filtersTitle: 'Что показать на карте',
    done: 'Готово', close: 'Закрыть', clearSearch: 'Очистить поиск'
  },
  be: {
    boundaries: 'Паказаць межы раёнаў', categories: 'Катэгорыі:',
    cat_animals: 'Жывёлы', cat_plants: 'Расліны', cat_water: 'Вада',
    cat_economy: 'Гаспадарка', cat_relief: 'Рэльеф', cat_geography: 'Геаграфія', cat_minerals: 'Карысныя выкапні',
    no_info: 'Без інфармацыі пра герб', searchPlaceholder: 'Пошук горада...',
    searchLabel: 'Пошук горада', suggestions: 'Падказкі', noResults: 'Нічога не знойдзена',
    noInfo: 'Інфармацыя пра герб пакуль не дададзена.', imageMissing: 'Выява герба недаступная',
    loading: 'Загрузка даных…', loadError: 'Не ўдалося загрузіць даныя. Праверце кансоль.',
    resetView: 'Скінуць выгляд', boundariesNA: 'Межы недаступныя',
    legend: 'Легенда', legendMulti: 'Некалькі катэгорый', langGroup: 'Мова',
    filters: 'Фільтры', filtersTitle: 'Што паказаць на карце',
    done: 'Гатова', close: 'Закрыць', clearSearch: 'Ачысціць пошук'
  }
};

const DISTRICT_NAMES = {
  ru: { 'Zhlobin': 'Жлобин', 'Vitebsk': 'Витебск', 'Grodno': 'Гродно', 'Brest': 'Брест', 'Bykhaw': 'Быхов', 'Dzyarzhynsk': 'Дзержинск', 'Minsk City': 'Минск', 'Minsk': 'Минский район', 'Astravyets': 'Островец', 'Smarhon': 'Сморгонь', 'Ashmyany': 'Ошмяны', 'Voranava': 'Вороново', 'Iwye': 'Ивье', 'Karelichy': 'Кореличи', 'Novogrudok': 'Новогрудок', 'Lida': 'Лида', 'Dzyatlava': 'Дятлово', 'Slonim': 'Слоним', "Zel'va": 'Зельва', 'Svislach': 'Свислочь', 'Vawkavysk': 'Волковыск', 'Byerastavitsa': 'Берестовица', 'Masty': 'Мосты', 'Shchuchyn': 'Щучин', 'Lyelchytsy': 'Лельчицы', 'Zhytkavichy': 'Житковичи', 'Akciabrski': 'Октябрьский', 'Pyetrykaw': 'Петриков', 'Vietka': 'Ветка', 'Dobrush': 'Добруш', 'Gomel': 'Гомель', 'Chachersk': 'Чечерск', 'Karma': 'Корма', 'Rahachow': 'Рогачёв', 'Buda-Kashalyova': 'Буда-Кошелёво', 'Naroulia': 'Наровля', 'Mazyr': 'Мозырь', 'Rechytsa': 'Речица', 'Svietlahorsk': 'Светлогорск', 'Brahin': 'Брагин', 'Yelʹsk': 'Ельск', 'Kalinkavichy': 'Калинковичи', 'Khoiniki': 'Хойники', 'Loyew': 'Лоев', 'Stolin': 'Столин', 'Luninets': 'Лунинец', 'Pinsk': 'Пинск', 'Hantsavichy': 'Ганцевичи', 'Baranovichy': 'Барановичи', 'Byaroza': 'Берёза', 'Drahichyn': 'Дрогичин', 'Ivanava': 'Иваново', 'Ivatsevichy': 'Ивацевичи', 'Kamenets': 'Каменец', 'Kobryn': 'Кобрин', 'Lyakhavichy': 'Ляховичи', 'Malaryta': 'Малорита', 'Pruzhany': 'Пружаны', 'Zhabinka': 'Жабинка', 'Khotsimsk': 'Хотимск', 'Kastsyukovichy': 'Костюковичи', 'Krasnapolle': 'Краснополье', 'Klimavichy': 'Климовичи', 'Krychaw': 'Кричев', 'Cherykaw': 'Чериков', 'Mstsislaw': 'Мстиславль', 'Slawharad': 'Славгород', 'Horki': 'Горки', 'Shklow': 'Шклов', 'Kruhlaye': 'Круглое', 'Chavusy': 'Чаусы', 'Mogilev': 'Могилёв', 'Byalynichy': 'Белыничи', 'Hlusk': 'Глуск', 'Babruysk': 'Бобруйск', 'Asipovichy': 'Осиповичи', 'Kirawsk': 'Кировск', 'Klichaw': 'Кличев', 'Beshankovichy': 'Бешенковичи', 'Braslaw': 'Браслав', 'Chashniki': 'Чашники', 'Dokshytsy': 'Докшицы', 'Dubrowna': 'Дубровно', 'Haradok': 'Городок', 'Hlybokaye': 'Глубокое', 'Lyepyel': 'Лепель', 'Liozna': 'Лиозно', 'Miory': 'Миоры', 'Myadzyel': 'Мядель', 'Pastavy': 'Поставы', 'Polotsk': 'Полоцк', 'Rasony': 'Россоны', 'Sharkawshchyna': 'Шарковщина', 'Shumilina': 'Шумилино', 'Syanno': 'Сенно', 'Talachyn': 'Толочин', 'Ushachy': 'Ушачи', 'Vyerkhnyadzvinsk': 'Верхнедвинск', 'Vileyka': 'Вилейка', 'Valozhyn': 'Воложин', 'Maladzyechna': 'Молодечно', 'Barysaw': 'Борисов', 'Byerazino': 'Березино', 'Chervyen': 'Червень', 'Kapyl': 'Копыль', 'Kletsk': 'Клецк', 'Krupki': 'Крупки', 'Lahoysk': 'Логойск', 'Lyuban': 'Любань', 'Nyasvizh': 'Несвиж', 'Puchavičy': 'Пуховичи', 'Slutsk': 'Слуцк', 'Salihorsk': 'Солигорск', 'Smalyavichy': 'Смолевичи', 'Staryya Darohi': 'Старые Дороги', 'Stowbtsy': 'Столбцы', 'Uzda': 'Узда' },
  be: { 'Zhlobin': 'Жлобін', 'Vitebsk': 'Віцебск', 'Grodno': 'Гродна', 'Brest': 'Брэст', 'Bykhaw': 'Быхаў', 'Dzyarzhynsk': 'Дзяржынск', 'Minsk City': 'Мінск', 'Minsk': 'Мінскі раён', 'Astravyets': 'Астравец', 'Smarhon': 'Смаргонь', 'Ashmyany': 'Ашмяны', 'Voranava': 'Воранава', 'Iwye': 'Іўе', 'Karelichy': 'Карэлічы', 'Novogrudok': 'Навагрудак', 'Lida': 'Ліда', 'Dzyatlava': 'Дзятлава', 'Slonim': 'Слонім', "Zel'va": 'Зэльва', 'Svislach': 'Свіслач', 'Vawkavysk': 'Ваўкавыск', 'Byerastavitsa': 'Бераставіца', 'Masty': 'Масты', 'Shchuchyn': 'Шчучын', 'Lyelchytsy': 'Лельчыцы', 'Zhytkavichy': 'Жыткавічы', 'Akciabrski': 'Акцябрскі', 'Pyetrykaw': 'Петрыкаў', 'Vietka': 'Ветка', 'Dobrush': 'Добруш', 'Gomel': 'Гомель', 'Chachersk': 'Чачэрск', 'Karma': 'Карма', 'Rahachow': 'Рагачоў', 'Buda-Kashalyova': 'Буда-Кашалёва', 'Naroulia': 'Нароўля', 'Mazyr': 'Мазыр', 'Rechytsa': 'Рэчыца', 'Svietlahorsk': 'Светлагорск', 'Brahin': 'Брагін', 'Yelʹsk': 'Ельск', 'Kalinkavichy': 'Калінкавічы', 'Khoiniki': 'Хойнікі', 'Loyew': 'Лоеў', 'Stolin': 'Столін', 'Luninets': 'Лунінец', 'Pinsk': 'Пінск', 'Hantsavichy': 'Ганцавічы', 'Baranovichy': 'Баранавічы', 'Byaroza': 'Бяроза', 'Drahichyn': 'Драгічын', 'Ivanava': 'Іванава', 'Ivatsevichy': 'Івацэвічы', 'Kamenets': 'Каменец', 'Kobryn': 'Кобрын', 'Lyakhavichy': 'Ляхавічы', 'Malaryta': 'Маларыта', 'Pruzhany': 'Пружаны', 'Zhabinka': 'Жабінка', 'Khotsimsk': 'Хоцімск', 'Kastsyukovichy': 'Касцюковічы', 'Krasnapolle': 'Краснаполле', 'Klimavichy': 'Клімавічы', 'Krychaw': 'Крычаў', 'Cherykaw': 'Чэрыкаў', 'Mstsislaw': 'Мсціслаў', 'Slawharad': 'Слаўгарад', 'Horki': 'Горкі', 'Shklow': 'Шклоў', 'Kruhlaye': 'Круглае', 'Chavusy': 'Чаусы', 'Mogilev': 'Магілёў', 'Byalynichy': 'Бялынічы', 'Hlusk': 'Глуск', 'Babruysk': 'Бабруйск', 'Asipovichy': 'Асіповічы', 'Kirawsk': 'Кіраўск', 'Klichaw': 'Клічаў', 'Beshankovichy': 'Бешанковічы', 'Braslaw': 'Браслаў', 'Chashniki': 'Чашнікі', 'Dokshytsy': 'Докшыцы', 'Dubrowna': 'Дуброўна', 'Haradok': 'Гарадок', 'Hlybokaye': 'Глыбокае', 'Lyepyel': 'Лепель', 'Liozna': 'Лёзна', 'Miory': 'Мёры', 'Myadzyel': 'Мядзел', 'Pastavy': 'Паставы', 'Polotsk': 'Полацк', 'Rasony': 'Расоны', 'Sharkawshchyna': 'Шаркаўшчына', 'Shumilina': 'Шуміліна', 'Syanno': 'Сянно', 'Talachyn': 'Талачын', 'Ushachy': 'Ушачы', 'Vyerkhnyadzvinsk': 'Верхнядзвінск', 'Vileyka': 'Вілейка', 'Valozhyn': 'Валожын', 'Maladzyechna': 'Маладзечна', 'Barysaw': 'Барысаў', 'Byerazino': 'Бярэзіна', 'Chervyen': 'Чэрвень', 'Kapyl': 'Капыль', 'Kletsk': 'Клецк', 'Krupki': 'Крупкі', 'Lahoysk': 'Лагойск', 'Lyuban': 'Любань', 'Nyasvizh': 'Нясвіж', 'Puchavičy': 'Пухавічы', 'Slutsk': 'Слуцк', 'Salihorsk': 'Салігорск', 'Smalyavichy': 'Смалявічы', 'Staryya Darohi': 'Старыя Дарогі', 'Stowbtsy': 'Стоўбцы', 'Uzda': 'Узда' }
};

const storageGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
const storageSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

let currentLang = storageGet('lang', 'ru');
if (currentLang !== 'ru' && currentLang !== 'be') currentLang = 'ru';

function throttle(fn, ms) {
  let last = 0, timer = null;
  return function (...a) {
    const wait = ms - (Date.now() - last);
    if (wait <= 0) { last = Date.now(); fn.apply(this, a); }
    else if (!timer) {
      timer = setTimeout(() => { timer = null; last = Date.now(); fn.apply(this, a); }, wait);
    }
  };
}

function debounce(fn, ms) {
  let t;
  const d = function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); };
  d.cancel = () => clearTimeout(t);
  return d;
}

const idle = cb => typeof window !== 'undefined' && window.requestIdleCallback ? window.requestIdleCallback(cb, { timeout: 2000 }) : setTimeout(cb, 1);
const t = k => (I18N[currentLang] && I18N[currentLang][k]) || I18N.ru[k] || k;
const districtName = sn => {
  if (!sn) return '';
  const ru = DISTRICT_NAMES.ru[sn], be = DISTRICT_NAMES.be[sn];
  return currentLang === 'be' ? (be || ru || sn) : (ru || sn);
};
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const imageUrl = p => {
  if (!p) return '';
  if (/^https?:\/\//i.test(p)) return p;
  const n = String(p).split('/').filter(Boolean).pop() || String(p);
  return encodeURI(HERALDRY_BASE + n);
};
const cityDisplayName = c => !c ? '' : (currentLang === 'be' ? BE_CITY_NAMES[c.name] || c.name : c.name);
const regionDisplayName = c => !c ? '' : (currentLang === 'be' ? BE_REGION_NAMES[c.region] || c.region : c.region);
const getDescription = h => {
  if (!h || !h.description) return '';
  if (typeof h.description === 'string') return h.description;
  return h.description[currentLang] || h.description.ru || '';
};

const TRANSLIT = { 'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya' };
const slug = s => String(s).toLowerCase().split('').map(c => TRANSLIT[c] !== undefined ? TRANSLIT[c] : c).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const cityId = (c, r) => slug(c.name) + '_' + slug(r);
const normalize = s => String(s).toLowerCase().replace(/ё/g, 'е');

const map = L.map('map', {
  center: MAP_HOME.center, zoom: MAP_HOME.zoom, minZoom: 7, maxZoom: 14,
  maxBounds: BELARUS_BOUNDS, maxBoundsViscosity: 0.8,
  worldCopyJump: false, zoomSnap: 1
});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 14, noWrap: true, updateWhenIdle: true, keepBuffer: 2
}).addTo(map);
const markersLayer = L.layerGroup().addTo(map);
map.attributionControl.setPrefix(false);

let cities = [], citiesById = new Map(), sortedCities = [], heraldry = {}, markers = {},
    boundariesLayer = null, currentDistrictLayer = null, currentCity = null,
    currentPopup = null, currentDistrictShape = '', cityToDistrict = new Map(),
    districtToCities = new Map(), districtByShape = new Map(), pendingCity = null,
    programmaticMove = false, loadAbort = null, beDataLoaded = false,
    beDataPromise = null, isMoving = false;
let activeCategories = new Set(Object.keys(CATEGORY_LABELS));
let activeNoInfo = true;
const sheet = { state: 'closed', peekH: 120 };
const iconCache = new Map();

const els = {
  search: document.getElementById('search'),
  suggestions: document.getElementById('suggestions'),
  toggleBoundaries: document.getElementById('toggleBoundaries'),
  toggleNoInfo: document.getElementById('toggleNoInfo'),
  resetView: document.getElementById('resetView'),
  overlay: document.getElementById('overlay'),
  legend: document.getElementById('legend'),
  panel: document.querySelector('.panel'),
  catList: document.getElementById('catList'),
  langButtons: document.querySelectorAll('.lang-switch button')
};
Object.assign(els, {
  openFilters: document.getElementById('openFilters'),
  filtersBadge: document.getElementById('filtersBadge'),
  filters: document.getElementById('filters'),
  filtersClose: document.getElementById('filtersClose'),
  filtersDone: document.getElementById('filtersDone'),
  sheetBackdrop: document.getElementById('sheetBackdrop'),
  citySheet: document.getElementById('citySheet'),
  sheetTop: document.getElementById('sheetTop'),
  sheetHead: document.getElementById('sheetHead'),
  sheetBody: document.getElementById('sheetBody'),
  sheetClose: document.getElementById('sheetClose'),
  searchClear: document.getElementById('searchClear'),
  legendNote: document.getElementById('legendNote')
});

const showOverlay = (txt, err) => {
  if (!els.overlay) return;
  els.overlay.textContent = txt;
  els.overlay.classList.toggle('error', !!err);
  els.overlay.classList.add('open');
};
const hideOverlay = () => { if (els.overlay) els.overlay.classList.remove('open'); };

async function fetchJson(url, signal, required) {
  const r = await fetch(url, { signal });
  if (!r.ok) {
    if (required) throw new Error(url + ': ' + r.status);
    return null;
  }
  return r.json();
}

// загрузка данных
async function loadAll() {
  if (loadAbort) loadAbort.abort();
  loadAbort = new AbortController();
  const signal = loadAbort.signal;
  showOverlay(t('loading'));

  let rawCities, rawHeraldry;
  try {
    rawCities = await fetchJson(DATA_URL.cities, signal, true);
    rawHeraldry = await fetchJson(DATA_URL.heraldry, signal, false).catch(() => ({}));
  } catch (err) {
    if (err && err.name === 'AbortError') return;
    console.error('[load] fetch failed', err);
    showOverlay(t('loadError'), true);
    return;
  }

  try { processRawCities(rawCities); } catch (err) { console.error('[load] cities failed', err); }
  heraldry = rawHeraldry || {};
  applyHeraldryToCities();
  rebuildNorms();
  buildSearchIndex();
  updateVisibleMarkers();
  try { renderUI(); } catch (e) { console.error('[load] renderUI failed', e); }
  hideOverlay();
  loadBoundaries(signal);
  if (currentLang === 'be') loadBeData().then(() => refreshOpenPopup());
  idle(() => { try { validateHeraldry(); } catch (e) { console.error('[load] validate failed', e); } });
}

function processRawCities(raw) {
  cities = [];
  citiesById = new Map();
  raw.forEach(country => {
    (country.regions || []).forEach(region => {
      (region.cities || []).forEach(city => {
        if (city.lat == null || city.lng == null) return;
        const c = { ...city, region: region.name, id: cityId(city, region.name), _norm: '' };
        cities.push(c);
        citiesById.set(c.id, c);
      });
    });
  });
}

function applyHeraldryToCities() {
  for (const c of cities) c._cats = getCategories(heraldry[c.id]).filter(k => MARKER_COLORS[k]);
}

function buildCityNorm(city, sn) {
  const ruName = city.name || '', beName = BE_CITY_NAMES[ruName] || '';
  const ruReg = city.region || '', beReg = BE_REGION_NAMES[ruReg] || '';
  const s = sn || '', ruD = s ? (DISTRICT_NAMES.ru[s] || '') : '', beD = s ? (DISTRICT_NAMES.be[s] || '') : '';
  return normalize([ruName, beName, ruReg, beReg, s, ruD, beD].join(' '));
}

function rebuildNorms() { for (const c of cities) c._norm = buildCityNorm(c, cityToDistrict.get(c.id) || null); }

function buildSearchIndex() {
  sortedCities = cities.slice().sort((a, b) => {
    const na = a._norm || '', nb = b._norm || '';
    return na < nb ? -1 : na > nb ? 1 : 0;
  });
}

function mergeHeraldryBe(beMap) {
  if (!beMap || typeof beMap !== 'object') return;
  for (const [id, beDesc] of Object.entries(beMap)) {
    const entry = heraldry[id];
    if (!entry) continue;
    if (typeof entry.description === 'string') entry.description = { ru: entry.description };
    else if (!entry.description || typeof entry.description !== 'object') entry.description = {};
    if (beDesc != null && beDesc !== '') entry.description.be = beDesc;
  }
}

// границы районов
async function loadBoundaries(signal) {
  try {
    const geo = await fetchJson(DATA_URL.boundaries, signal, false);
    if (!geo || geo.type !== 'FeatureCollection' || !Array.isArray(geo.features)) throw new Error('bad geojson');
    geo.features.forEach(f => { f._bbox = computeBbox(f); });
    buildDistrictIndexes(geo.features);
    rebuildNorms();
    buildSearchIndex();
    boundariesLayer = L.geoJSON(geo, {
      renderer: L.canvas({ padding: 0.5 }),
      style: boundariesStyle(),
      onEachFeature: (feature, layer) => {
        const n = feature.properties?.shapeName || '';
        layer._shapeName = n;
        layer.bindTooltip(esc(districtName(n)), { sticky: true });
      }
    });
    if (els.toggleBoundaries && els.toggleBoundaries.checked) boundariesLayer.addTo(map);
    if (els.toggleBoundaries) {
      els.toggleBoundaries.disabled = false;
      if (els.toggleBoundaries.parentElement) els.toggleBoundaries.parentElement.removeAttribute('title');
    }
    if (currentCity) {
      const sn = highlightDistrict(currentCity);
      currentDistrictShape = sn || currentDistrictShape;
    }
  } catch (err) {
    if (err && err.name === 'AbortError') return;
    console.error('[load] boundaries failed', err);
    boundariesLayer = null;
    districtByShape = new Map();
    if (els.toggleBoundaries) {
      els.toggleBoundaries.disabled = true;
      els.toggleBoundaries.checked = false;
      if (els.toggleBoundaries.parentElement) els.toggleBoundaries.parentElement.title = t('boundariesNA');
    }
  }
}

// белорусские описания подгружаются отдельно
async function loadBeData() {
  if (beDataLoaded) return beDataPromise || Promise.resolve();
  if (beDataPromise) return beDataPromise;
  beDataPromise = (async () => {
    try {
      const hb = await fetchJson(DATA_URL.heraldryBe, undefined, false).catch(() => ({}));
      mergeHeraldryBe(hb);
      beDataLoaded = true;
      applyLang();
    } catch (err) {
      console.warn('[be] load failed', err);
      beDataLoaded = true;
    }
  })();
  return beDataPromise;
}

const boundariesStyle = () => ({ color: '#2a5dbf', weight: 1, fillColor: '#2a5dbf', fillOpacity: 0.03 });

function computeBbox(feature) {
  const geom = feature.geometry;
  if (!geom || !geom.coordinates) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const rings = geom.type === 'Polygon' ? geom.coordinates : geom.type === 'MultiPolygon' ? geom.coordinates.flat() : [];
  for (const ring of rings) for (let i = 0; i < ring.length; i++) {
    const x = ring[i][0], y = ring[i][1];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

// сетка районов, чтобы не проверять turf по всем полигонам
const GRID_CELL = 0.5;
let districtGrid = null;

function buildDistrictGrid(features) {
  const grid = new Map();
  for (const f of features) {
    if (!f._bbox) continue;
    const [minX, minY, maxX, maxY] = f._bbox;
    const cx0 = Math.floor(minX / GRID_CELL), cx1 = Math.floor(maxX / GRID_CELL);
    const cy0 = Math.floor(minY / GRID_CELL), cy1 = Math.floor(maxY / GRID_CELL);
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cy = cy0; cy <= cy1; cy++) {
        const key = cx * 10000 + cy;
        let arr = grid.get(key);
        if (!arr) grid.set(key, arr = []);
        arr.push(f);
      }
    }
  }
  return grid;
}

function queryDistrictGrid(lng, lat) {
  if (!districtGrid) return null;
  if (typeof turf === 'undefined' || !turf || typeof turf.point !== 'function' || typeof turf.booleanPointInPolygon !== 'function') return null;
  const cx = Math.floor(lng / GRID_CELL), cy = Math.floor(lat / GRID_CELL);
  const arr = districtGrid.get(cx * 10000 + cy);
  if (!arr) return null;
  const pt = turf.point([lng, lat]);
  for (let i = 0; i < arr.length; i++) {
    const f = arr[i], b = f._bbox;
    if (!b) continue;
    if (lng < b[0] || lng > b[2] || lat < b[1] || lat > b[3]) continue;
    try { if (turf.booleanPointInPolygon(pt, f)) return f; } catch (e) {}
  }
  return null;
}

function buildDistrictIndexes(features) {
  districtGrid = buildDistrictGrid(features);
  districtByShape = new Map();
  for (const f of features) {
    const sn = f.properties?.shapeName;
    if (sn) districtByShape.set(sn, f);
  }
  cityToDistrict = new Map();
  districtToCities = new Map();
  for (const city of cities) {
    const f = queryDistrictGrid(city.lng, city.lat);
    if (!f) continue;
    const sn = f.properties.shapeName;
    cityToDistrict.set(city.id, sn);
    let arr = districtToCities.get(sn);
    if (!arr) districtToCities.set(sn, arr = []);
    arr.push(city.id);
  }
}

function validateHeraldry() {
  const ids = new Set(cities.map(c => c.id));
  const orphans = Object.keys(heraldry).filter(id => !ids.has(id));
  if (orphans.length) console.warn('[heraldry] без города:', orphans.length, orphans);
}

function getCategories(entry) {
  if (!entry) return [];
  if (Array.isArray(entry.category)) return entry.category;
  if (entry.category) return [entry.category];
  return [];
}

function markerIcon(categories) {
  const valid = (categories || []).filter(c => MARKER_COLORS[c]);
  let bg, symbol;
  if (valid.length === 0) {
    bg = MARKER_COLORS._fallback;
    symbol = '?';
  } else if (valid.length === 1) {
    bg = MARKER_COLORS[valid[0]];
    symbol = CATEGORY_SYMBOLS[valid[0]] || '';
  } else {
    const n = valid.length;
    const stops = valid.map((c, i) => `${MARKER_COLORS[c]} ${(i * 360 / n).toFixed(2)}deg ${((i + 1) * 360 / n).toFixed(2)}deg`).join(', ');
    bg = `conic-gradient(${stops})`;
    symbol = '*';
  }
  return L.divIcon({
    className: 'custom-marker',
    html: `<div class="custom-marker-hit"><div class="custom-marker-dot" aria-hidden="true" style="background:${esc(bg)};">${esc(symbol)}</div></div>`,
    iconSize: [44, 44], iconAnchor: [22, 22], popupAnchor: [0, -18]
  });
}

function getMarkerIcon(cats) {
  const valid = (cats || []).filter(c => MARKER_COLORS[c]).slice().sort();
  const key = valid.length === 0 ? '_' : valid.join(',');
  let icon = iconCache.get(key);
  if (icon) return icon;
  icon = markerIcon(valid);
  iconCache.set(key, icon);
  return icon;
}

function shouldShowCity(city) {
  const cats = city._cats;
  if (!cats || cats.length === 0) return activeNoInfo;
  for (const c of cats) if (activeCategories.has(c)) return true;
  return false;
}

function createMarker(city) {
  const icon = getMarkerIcon(city._cats);
  const m = L.marker([city.lat, city.lng], { icon, keyboard: true, title: cityDisplayName(city) });
  m._cityId = city.id;
  markerStats.created++;
  m.on('click', () => {
    if (map.getZoom() < FOCUS_MIN_ZOOM) {
      pendingCity = city;
      programmaticMove = true;
      map.flyTo(cityFocusCenter(city, FOCUS_MIN_ZOOM), FOCUS_MIN_ZOOM, { duration: FLY_DURATION });
    } else selectCity(city);
  });
  markers[city.id] = m;
  return m;
}

// плавное появление и исчезновение меток
const markerStats = { created: 0, added: 0, removed: 0 };
window.__markerStats = markerStats;
const categoryLabel = k => (CATEGORY_LABELS[k] && (CATEGORY_LABELS[k][currentLang] || CATEGORY_LABELS[k].ru)) || k;

function markerLabel(city) {
  const cats = (city._cats || []).filter(c => MARKER_COLORS[c]).map(categoryLabel);
  return cats.length ? `${cityDisplayName(city)} — ${cats.join(', ')}` : cityDisplayName(city);
}

function decorateMarker(m) {
  const city = citiesById.get(m._cityId), el = m.getElement && m.getElement();
  if (city && el) el.setAttribute('aria-label', markerLabel(city));
}

let revealQueue = [], revealScheduled = false;
function queueReveal(m) {
  revealQueue.push(m);
  if (revealScheduled) return;
  revealScheduled = true;
  requestAnimationFrame(() => {
    void document.documentElement.offsetWidth; // форсируем стартовый стиль, иначе transition не сработает
    for (const mk of revealQueue) {
      if (mk._removeTimer) continue;
      const el = mk.getElement && mk.getElement(), hit = el && el.querySelector('.custom-marker-hit');
      if (hit) hit.classList.add('visible');
    }
    revealQueue = [];
    revealScheduled = false;
  });
}

function scheduleMarkerRemoval(m) {
  if (m._removeTimer) return;
  const el = m.getElement && m.getElement();
  if (el) {
    el.classList.add('is-leaving');
    const hit = el.querySelector('.custom-marker-hit');
    if (hit) hit.classList.remove('visible');
  }
  m._removeTimer = setTimeout(() => {
    m._removeTimer = null;
    markersLayer.removeLayer(m);
    markerStats.removed++;
  }, MARKER_REMOVE_DELAY);
}

function cancelMarkerRemoval(m) {
  if (!m._removeTimer) return;
  clearTimeout(m._removeTimer);
  m._removeTimer = null;
  const el = m.getElement && m.getElement();
  if (el) {
    el.classList.remove('is-leaving');
    const hit = el.querySelector('.custom-marker-hit');
    if (hit) hit.classList.add('visible');
  }
}

// обновление меток в видимой области
function updateVisibleMarkers(force) {
  if (isMoving && !force) return;
  const bounds = map.getBounds().pad(MARKER_PADDING);
  const want = new Set();
  for (const city of cities) {
    if (!bounds.contains(L.latLng(city.lat, city.lng))) continue;
    if (!shouldShowCity(city)) continue;
    want.add(city.id);
  }
  if (currentCity) want.add(currentCity.id);
  markersLayer.eachLayer(l => {
    if (!l._cityId) return;
    if (want.has(l._cityId)) cancelMarkerRemoval(l);
    else scheduleMarkerRemoval(l);
  });
  want.forEach(id => {
    let m = markers[id];
    if (!m) {
      const city = citiesById.get(id);
      if (!city) return;
      m = createMarker(city);
    }
    if (!markersLayer.hasLayer(m)) {
      markersLayer.addLayer(m);
      markerStats.added++;
      decorateMarker(m);
      queueReveal(m);
    }
  });
  if (currentCity && sheet.state !== 'closed') markSelectedMarker(currentCity);
}
const scheduleVisibleMarkersUpdate = debounce(updateVisibleMarkers, MAP_MOVE_DEBOUNCE);

function highlightDistrict(city) {
  clearDistrictHighlight();
  if (!cityToDistrict.size || !boundariesLayer) return '';
  const sn = cityToDistrict.get(city.id);
  if (!sn) return '';
  let target = null;
  boundariesLayer.eachLayer(l => { if (l._shapeName === sn) target = l; });
  if (!target) return '';
  currentDistrictLayer = target;
  target.setStyle({ color: '#d97706', weight: 3, fillColor: '#fbbf24', fillOpacity: 0.15, dashArray: '5,5' });
  if (typeof target.bringToFront === 'function') target.bringToFront();
  return sn;
}

function clearDistrictHighlight() {
  if (currentDistrictLayer) {
    currentDistrictLayer.setStyle(boundariesStyle());
    currentDistrictLayer = null;
  }
}

function buildPopupHtml(city, ds) {
  const h = heraldry[city.id];
  let html = `<div class="popup-heraldry"><h3>${esc(cityDisplayName(city))}</h3><div class="region">${esc(regionDisplayName(city))}${ds ? ` · ${esc(districtName(ds))}` : ''}</div>`;
  if (h) {
    const cats = getCategories(h);
    if (cats.length) {
      html += `<div class="badges">` + cats.map(c => {
        const label = (CATEGORY_LABELS[c] && (CATEGORY_LABELS[c][currentLang] || CATEGORY_LABELS[c].ru)) || c;
        return `<span class="badge">${esc(label)}</span>`;
      }).join('') + `</div>`;
    }
    if (h.image) {
      const url = imageUrl(h.image);
      html += `<div class="arm-wrap"><img src="${esc(url)}" alt="${esc(cityDisplayName(city))}" title="${esc(h.image)}" data-fallback="1" /><div class="arm-missing">${esc(t('imageMissing'))}</div></div>`;
    }
    html += `<div class="description">${esc(getDescription(h) || t('noInfo'))}</div>`;
  } else {
    html += `<div class="description">${esc(t('noInfo'))}</div>`;
  }
  html += `</div>`;
  return html;
}

function getPanPadding() {
  const tl = [16, 16], br = [16, 16];
  if (els.panel) {
    const r = els.panel.getBoundingClientRect();
    tl[0] = Math.max(tl[0], r.right + 12);
    tl[1] = Math.max(tl[1], r.bottom + 12);
  }
  if (els.legend) {
    const r = els.legend.getBoundingClientRect();
    tl[0] = Math.max(tl[0], r.right + 12);
    br[1] = Math.max(br[1], window.innerHeight - r.top + 12);
  }
  tl[0] = Math.min(tl[0], window.innerWidth * 0.55);
  tl[1] = Math.min(tl[1], window.innerHeight * 0.55);
  br[1] = Math.min(br[1], window.innerHeight * 0.55);
  return { tl, br };
}

function selectCity(city) {
  if (currentPopup) { map.closePopup(currentPopup); currentPopup = null; }
  const ds = highlightDistrict(city) || cityToDistrict.get(city.id) || '';
  currentDistrictShape = ds;
  if (isMobile()) {
    currentCity = city;
    openSheet(city, ds);
    setTimeout(redrawBoundaries, 80);
    return;
  }
  currentPopup = L.popup({ maxWidth: 300, autoPan: false })
    .setLatLng([city.lat, city.lng])
    .setContent(buildPopupHtml(city, ds));
  map.once('popupopen', () => {
    positionPopup();
    setTimeout(() => {
      if (boundariesLayer) boundariesLayer.eachLayer(l => { if (l.redraw) l.redraw(); });
      positionPopup();
    }, 80);
    const img = currentPopup.getElement()?.querySelector('img');
    if (img && !img.complete) img.addEventListener('load', positionPopup, { once: true });
  });
  currentPopup.openOn(map);
  currentCity = city;
}

function refreshOpenPopup() {
  if (currentCity && sheet.state !== 'closed') { renderSheet(currentCity, currentDistrictShape); return; }
  if (!currentCity || !currentPopup || !map.hasLayer(currentPopup)) return;
  currentPopup.setContent(buildPopupHtml(currentCity, currentDistrictShape));
  setTimeout(positionPopup, 0);
}

// мобильный интерфейс
const MOBILE_MQ = window.matchMedia(window.MOBILE_QUERY || '(max-width: 640px)');
const isMobile = () => MOBILE_MQ.matches && !!els.citySheet && !!els.sheetBody;

function redrawBoundaries() { if (boundariesLayer) boundariesLayer.eachLayer(l => { if (l.redraw) l.redraw(); }); }

function buildCardParts(city, ds) {
  const h = heraldry[city.id];
  const name = esc(cityDisplayName(city));
  const sub = esc(regionDisplayName(city)) + (ds ? ` · ${esc(districtName(ds))}` : '');
  let arm = '';
  if (h && h.image) arm = `<div class="card-arm"><img src="${esc(imageUrl(h.image))}" alt="${name}" data-fallback="1" /><div class="arm-missing">${esc(t('imageMissing'))}</div></div>`;
  const head = `${arm}<div class="card-titles"><h2 id="sheetTitle">${name}</h2><div class="card-sub">${sub}</div></div>`;
  let body = '';
  if (h) {
    const cats = getCategories(h);
    if (cats.length) {
      body += `<div class="sheet-badges">` + cats.map(c => {
        const label = (CATEGORY_LABELS[c] && (CATEGORY_LABELS[c][currentLang] || CATEGORY_LABELS[c].ru)) || c;
        return `<span class="card-badge" style="--c:${esc(MARKER_COLORS[c] || '#2a5dbf')}">${esc(label)}</span>`;
      }).join('') + `</div>`;
    }
    body += `<div class="sheet-desc">${esc(getDescription(h) || t('noInfo'))}</div>`;
  } else {
    body += `<div class="sheet-desc">${esc(t('noInfo'))}</div>`;
  }
  return { head, body };
}

function measureSheet() {
  sheet.peekH = Math.ceil(els.sheetTop.getBoundingClientRect().height);
  els.citySheet.style.setProperty('--peek-h', sheet.peekH + 'px');
  syncSheetInset();
}

function syncSheetInset() {
  const h = sheet.state === 'open' ? els.citySheet.offsetHeight : sheet.state === 'peek' ? sheet.peekH : 0;
  document.documentElement.style.setProperty('--sheet-h', h + 'px');
  const room = window.innerHeight - h - (els.panel ? els.panel.getBoundingClientRect().bottom : 60);
  document.documentElement.classList.toggle('map-btns-hidden', room < 230);
}

function renderSheet(city, ds) {
  const p = buildCardParts(city, ds);
  els.sheetHead.innerHTML = p.head;
  els.sheetBody.innerHTML = p.body;
  els.sheetBody.scrollTop = 0;
  measureSheet();
  const img = els.sheetHead.querySelector('img');
  if (img && !img.complete) img.addEventListener('load', measureSheet, { once: true });
}

function setSheetState(st) {
  sheet.state = st;
  els.citySheet.classList.toggle('is-open', st === 'open');
  els.citySheet.classList.toggle('is-peek', st === 'peek');
  els.citySheet.setAttribute('aria-hidden', st === 'closed' ? 'true' : 'false');
  syncSheetInset();
}

function openSheet(city, ds) {
  renderSheet(city, ds);
  setSheetState('open');
  markSelectedMarker(city);
  setTimeout(() => ensureCityVisible(city), 60);
}

function hideSheet() { if (sheet.state !== 'closed') setSheetState('closed'); }

function closeCard() {
  if (currentPopup && map.hasLayer(currentPopup)) { map.closePopup(currentPopup); return; }
  if (sheet.state === 'closed') return;
  hideSheet();
  clearDistrictHighlight();
  unmarkSelectedMarker();
  currentCity = null;
  currentDistrictShape = '';
}

let selectedMarkerId = null;
function markSelectedMarker(city) {
  unmarkSelectedMarker();
  const m = markers[city.id];
  if (!m) return;
  const el = m.getElement && m.getElement();
  if (el) el.classList.add('is-selected');
  if (m.setZIndexOffset) m.setZIndexOffset(1000);
  selectedMarkerId = city.id;
}

function unmarkSelectedMarker() {
  if (selectedMarkerId == null) return;
  const m = markers[selectedMarkerId];
  selectedMarkerId = null;
  if (!m) return;
  const el = m.getElement && m.getElement();
  if (el) el.classList.remove('is-selected');
  if (m.setZIndexOffset) m.setZIndexOffset(0);
}

function mobileInsets() {
  const top = els.panel ? Math.ceil(els.panel.getBoundingClientRect().bottom) + 8 : 72;
  let bottom = 0;
  if (sheet.state === 'open') bottom = els.citySheet.offsetHeight;
  else if (sheet.state === 'peek') bottom = sheet.peekH;
  return { top, bottom };
}

function cityFocusCenter(city, zoom) {
  const ll = L.latLng(city.lat, city.lng);
  if (!isMobile()) return ll;
  const ins = mobileInsets();
  const bottom = sheet.state === 'closed' ? Math.min(window.innerHeight * 0.5, 360) : ins.bottom;
  const dy = (bottom - ins.top) / 2;
  return map.unproject(map.project(ll, zoom).add([0, dy]), zoom);
}

function ensureCityVisible(city) {
  if (!isMobile() || sheet.state === 'closed') return;
  const size = map.getSize(), ins = mobileInsets(), pad = 36;
  const minY = ins.top + pad, maxY = size.y - ins.bottom - pad;
  if (maxY <= minY) return;
  const p = map.latLngToContainerPoint([city.lat, city.lng]);
  let dx = 0, dy = 0;
  if (p.y < minY || p.y > maxY) dy = p.y - (minY + maxY) / 2;
  if (p.x < pad || p.x > size.x - pad) dx = p.x - size.x / 2;
  if (dx || dy) map.panBy([dx, dy], { animate: true, duration: 0.35 });
}

function openFilters() {
  if (!els.filters) return;
  els.filters.classList.add('is-open');
  if (els.sheetBackdrop) els.sheetBackdrop.classList.add('is-open');
  if (els.openFilters) els.openFilters.setAttribute('aria-expanded', 'true');
}

function closeFilters() {
  if (!els.filters) return;
  els.filters.classList.remove('is-open');
  if (els.sheetBackdrop) els.sheetBackdrop.classList.remove('is-open');
  if (els.openFilters) els.openFilters.setAttribute('aria-expanded', 'false');
}

function updateFilterBadge() {
  if (!els.filtersBadge) return;
  let n = Object.keys(CATEGORY_LABELS).filter(k => !activeCategories.has(k)).length;
  if (!activeNoInfo) n++;
  if (els.toggleBoundaries && !els.toggleBoundaries.disabled && !els.toggleBoundaries.checked) n++;
  els.filtersBadge.hidden = n === 0;
  els.filtersBadge.textContent = String(n);
}

function syncSearchClear() {
  if (els.search && els.search.parentElement) els.search.parentElement.classList.toggle('has-value', !!els.search.value);
}

function syncZoomControl() {
  if (map.zoomControl && map.zoomControl.setPosition) map.zoomControl.setPosition(isMobile() ? 'bottomright' : 'topleft');
}

// жесты шторки
function initSheetGestures() {
  const el = els.citySheet, top = els.sheetTop;
  let drag = null;
  top.addEventListener('pointerdown', e => {
    if (e.target.closest('.sheet-close')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag = {
      id: e.pointerId, y0: e.clientY,
      base: sheet.state === 'peek' ? Math.max(0, el.offsetHeight - sheet.peekH) : 0,
      moved: false, off: null
    };
    try { top.setPointerCapture(e.pointerId); } catch (_) {}
  });
  top.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dy = e.clientY - drag.y0;
    if (!drag.moved && Math.abs(dy) < 6) return;
    drag.moved = true;
    el.classList.add('is-dragging');
    drag.off = Math.min(el.offsetHeight, Math.max(0, drag.base + dy));
    el.style.transform = `translateY(${drag.off}px)`;
  });
  const end = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    el.classList.remove('is-dragging');
    el.style.transform = '';
    try { top.releasePointerCapture(e.pointerId); } catch (_) {}
    if (!d.moved) { setSheetState(sheet.state === 'open' ? 'peek' : 'open'); return; }
    const h = el.offsetHeight, peekOff = Math.max(0, h - sheet.peekH), off = d.off == null ? d.base : d.off;
    if (off > peekOff + Math.max(40, (h - peekOff) * 0.4)) closeCard();
    else if (d.base === 0) setSheetState(off > peekOff * 0.25 ? 'peek' : 'open');
    else setSheetState(off < peekOff * 0.75 ? 'open' : 'peek');
  };
  top.addEventListener('pointerup', end);
  top.addEventListener('pointercancel', end);
}

function onModeChange() {
  document.documentElement.classList.toggle('is-mobile', isMobile());
  syncZoomControl();
  updateMapLimits();
  closeFilters();
  const c = currentCity;
  if (!c) return;
  if (currentPopup) { map.closePopup(currentPopup); currentPopup = null; }
  hideSheet();
  setTimeout(() => { map.invalidateSize(); selectCity(c); }, 0);
}

// инициализация мобильного интерфейса
function initMobileUI() {
  document.documentElement.classList.toggle('is-mobile', isMobile());
  syncZoomControl();
  updateFilterBadge();
  if (!els.citySheet || !els.sheetBody) return;
  if (els.openFilters) els.openFilters.addEventListener('click', openFilters);
  [els.filtersClose, els.filtersDone, els.sheetBackdrop].forEach(b => { if (b) b.addEventListener('click', closeFilters); });
  if (els.sheetClose) els.sheetClose.addEventListener('click', closeCard);
  if (els.searchClear) els.searchClear.addEventListener('click', () => {
    els.search.value = '';
    syncSearchClear();
    hideSuggestions();
    els.search.focus();
  });
  if (els.search) els.search.addEventListener('input', syncSearchClear);
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (els.filters && els.filters.classList.contains('is-open')) closeFilters();
    else if (sheet.state !== 'closed') closeCard();
  });
  initSheetGestures();
  if (MOBILE_MQ.addEventListener) MOBILE_MQ.addEventListener('change', onModeChange);
  else if (MOBILE_MQ.addListener) MOBILE_MQ.addListener(onModeChange);
}

// лимиты карты
function fitWholeCountryZoom() {
  const size = map.getSize(), edge = 15;
  const top = (isMobile() && els.panel) ? Math.ceil(els.panel.getBoundingClientRect().bottom) + edge : edge;
  const w = size.x - edge * 2, h = size.y - top - edge;
  if (w <= 0 || h <= 0) return MAP_HOME.zoom;
  const nw = map.project(BELARUS_COUNTRY_BBOX.getNorthWest(), 0);
  const se = map.project(BELARUS_COUNTRY_BBOX.getSouthEast(), 0);
  return Math.log(Math.min(w / (se.x - nw.x), h / (se.y - nw.y))) / Math.LN2;
}

function updateMapLimits() {
  const minZ = Math.max(3, Math.min(MAP_HOME.zoom, Math.floor(fitWholeCountryZoom() * 100) / 100));
  if (Math.abs(map.getMinZoom() - minZ) < 0.005) return;
  if (map.getZoom() < minZ) map.setZoom(minZ, { animate: false });
  map.setMinZoom(minZ);
}

function syncBoundsViscosity() { map.options.maxBoundsViscosity = map.getZoom() < 9 ? 0.4 : 0.8; }

function initMapLimits() {
  map.setMaxBounds(BELARUS_BOUNDS_WIDE);
  updateMapLimits();
  syncBoundsViscosity();
  map.on('zoomend', syncBoundsViscosity);
  map.on('resize', debounce(updateMapLimits, 150));
  window.addEventListener('orientationchange', () => setTimeout(() => {
    map.invalidateSize({ animate: false });
    updateMapLimits();
  }, 300));
}

const POPUP_EDGE = 10;
const POPUP_GAP = 10;
const POPUP_REACH = 21;
const POPUP_MIN_H = 140;
const POPUP_TAIL_PAD = 18;

function rectOverlap(a, b) {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return w > 0 && h > 0 ? w * h : 0;
}

// расстановка попапа
function planPopup({ ax, ay, w, h, left0, view, obstacles }) {
  const E = POPUP_EDGE, G = POPUP_GAP, TP = POPUP_TAIL_PAD;
  const edge = { left: view.left + E, top: view.top + E, right: view.right - E, bottom: view.bottom - E };

  if (ax < view.left || ax > view.right || ay < view.top || ay > view.bottom) {
    return { dir: ay < view.top ? 'down' : 'up', shrink: 0, shiftX: 0, shiftY: 0, tailX: w / 2 };
  }

  const left = Math.max(edge.left, Math.min(left0, edge.right - w));
  const score = (dir, hh) => {
    const top = dir === 'up' ? ay - POPUP_REACH - hh : ay + POPUP_REACH;
    const rc = { left, right: left + w, top, bottom: top + hh };
    const out = Math.max(0, edge.top - top) + Math.max(0, rc.bottom - edge.bottom);
    let hit = 0;
    for (const ob of obstacles) hit += rectOverlap(rc, ob);
    return { dir, rc, out, hit };
  };

  const up = score('up', h), down = score('down', h);
  let best = (up.out !== down.out ? up.out < down.out : up.hit <= down.hit) ? up : down;

  let hh = h;
  if (best.out > 0) {
    hh = Math.min(h, Math.max(POPUP_MIN_H, h - best.out));
    best = score(best.dir, hh);
  }
  let shiftY = 0;
  if (best.rc.top < edge.top) shiftY = edge.top - best.rc.top;
  else if (best.rc.bottom > edge.bottom) shiftY = edge.bottom - best.rc.bottom;

  const top = best.rc.top + shiftY, bottom = best.rc.bottom + shiftY;
  const midX = (view.left + view.right) / 2;
  let padL = edge.left, padR = edge.right;
  for (const ob of obstacles) {
    if (top >= ob.bottom + G || bottom <= ob.top - G) continue;
    if ((ob.left + ob.right) / 2 < midX) padL = Math.max(padL, ob.right + G);
    else padR = Math.min(padR, ob.left - G);
  }
  let finalLeft = padR - padL >= w ? Math.max(padL, Math.min(left0, padR - w)) : left;
  const BTN = 40;
  for (let pass = 0; pass < 2; pass++) {
    for (const ob of obstacles) {
      const bl = finalLeft + w - BTN;
      if (finalLeft + w <= ob.left || bl >= ob.right || top + BTN <= ob.top || top >= ob.bottom) continue;
      if ((ob.left + ob.right) / 2 < midX) finalLeft = Math.min(finalLeft + (ob.right + G - bl), edge.right - w);
      else finalLeft = Math.max(finalLeft - (finalLeft + w - (ob.left - G)), edge.left);
    }
  }
  const tailX = Math.max(TP, Math.min(ax - finalLeft, w - TP));

  return { dir: best.dir, shrink: h - hh, shiftX: finalLeft - left0, shiftY, tailX };
}

function placePopup(target) {
  if (!currentPopup || !currentPopup.isOpen()) return;
  const el = currentPopup.getElement();
  if (!el) return;
  const wrap = el.querySelector('.leaflet-popup-content-wrapper');
  if (!wrap) return;
  const content = wrap.querySelector('.popup-heraldry');

  const closeBtn = el.querySelector('.leaflet-popup-close-button');
  if (closeBtn) {
    if (closeBtn.parentNode !== wrap) wrap.appendChild(closeBtn);
    closeBtn.setAttribute('aria-label', t('close'));
  }

  el.classList.remove('popup-dir-up', 'popup-dir-down', 'popup-dir-left', 'popup-dir-right');
  wrap.style.transform = '';
  wrap.style.removeProperty('--tail-x');
  if (content) content.style.maxHeight = '';

  const mr = map.getContainer().getBoundingClientRect();
  const cur = map.latLngToContainerPoint(currentPopup.getLatLng());
  const pt = target || cur;
  const r0 = wrap.getBoundingClientRect();
  const ax = mr.left + pt.x, ay = mr.top + pt.y;
  const curX = mr.left + cur.x, curY = mr.top + cur.y;

  const obstacles = [els.panel, els.legend].filter(Boolean)
    .map(n => n.getBoundingClientRect())
    .filter(r => r.width > 0 && r.height > 0);
  const view = {
    left: Math.max(mr.left, 0), top: Math.max(mr.top, 0),
    right: Math.min(mr.right, window.innerWidth), bottom: Math.min(mr.bottom, window.innerHeight)
  };

  const plan = planPopup({ ax, ay, w: r0.width, h: r0.height, left0: ax + (r0.left - curX), view, obstacles });

  el.classList.add('popup-dir-' + plan.dir);
  if (plan.shrink > 0 && content) {
    const ch = content.getBoundingClientRect().height;
    content.style.maxHeight = Math.max(60, ch - plan.shrink) + 'px';
  }
  const r1 = wrap.getBoundingClientRect();
  const natural = plan.dir === 'up' ? r1.bottom - curY : r1.top - curY;
  const wanted = plan.dir === 'up' ? -POPUP_REACH : POPUP_REACH;
  const dy = Math.round(wanted - natural + plan.shiftY);
  const dx = Math.round(plan.shiftX);
  wrap.style.setProperty('--tail-x', Math.round(plan.tailX) + 'px');
  if (dx || dy) wrap.style.transform = `translate(${dx}px, ${dy}px)`;
}

function positionPopup() { placePopup(null); }

map.on('popupclose', () => {
  clearDistrictHighlight();
  currentCity = null;
  currentPopup = null;
  currentDistrictShape = '';
});
map.on('click', () => { if (sheet.state !== 'closed') closeCard(); });

document.addEventListener('error', e => {
  const img = e.target;
  if (img && img.tagName === 'IMG' && img.hasAttribute('data-fallback')) {
    img.style.display = 'none';
    const m = img.parentElement && img.parentElement.querySelector('.arm-missing');
    if (m) m.style.display = 'flex';
    setTimeout(() => {
      positionPopup();
      if (sheet.state !== 'closed') measureSheet();
    }, 0);
  }
}, true);

map.on('movestart', () => { isMoving = true; });
map.on('moveend', () => {
  isMoving = false;
  programmaticMove = false;
  const pc = pendingCity;
  pendingCity = null;
  if (pc) selectCity(pc);
  updateVisibleMarkers();
  setTimeout(positionPopup, 80);
});
map.on('zoomend', () => { setTimeout(positionPopup, 120); });
map.on('resize', () => { setTimeout(() => { positionPopup(); if (sheet.state !== 'closed') measureSheet(); }, 120); });
map.on('dragstart', () => { if (pendingCity) pendingCity = null; });
map.on('drag', throttle(() => updateVisibleMarkers(true), 200));
map.on('zoomstart', () => { if (!programmaticMove && pendingCity) pendingCity = null; });

map.on('zoomanim', e => {
  if (!currentPopup || !currentPopup.isOpen()) return;
  const p = map.project(currentPopup.getLatLng(), e.zoom)
    .subtract(map.project(e.center, e.zoom))
    .add(map.getSize().divideBy(2));
  placePopup(p);
});

function renderCategories() {
  if (!els.catList) return;
  els.catList.innerHTML = Object.keys(CATEGORY_LABELS).map(k => {
    const label = CATEGORY_LABELS[k][currentLang] || CATEGORY_LABELS[k].ru;
    const color = MARKER_COLORS[k];
    const checked = activeCategories.has(k) ? 'checked' : '';
    return `<label><input type="checkbox" class="cat" value="${k}" ${checked} /><span class="cat-color" data-sym="${esc(CATEGORY_SYMBOLS[k] || '')}" style="background:${esc(color)}"></span><span>${esc(label)}</span></label>`;
  }).join('');
  els.catList.querySelectorAll('.cat').forEach(inp => inp.addEventListener('change', () => {
    if (inp.checked) activeCategories.add(inp.value);
    else activeCategories.delete(inp.value);
    storageSet('cats', JSON.stringify([...activeCategories]));
    updateVisibleMarkers();
    updateFilterBadge();
  }));
  updateFilterBadge();
}

function renderLegend() {
  if (!els.legend) return;
  const items = Object.keys(CATEGORY_LABELS).map(cat => {
    const label = CATEGORY_LABELS[cat][currentLang] || CATEGORY_LABELS[cat].ru;
    const color = MARKER_COLORS[cat], sym = CATEGORY_SYMBOLS[cat] || '';
    return `<div class="legend-item"><span class="legend-dot" aria-hidden="true" style="background:${esc(color)}">${esc(sym)}</span><span>${esc(label)}</span></div>`;
  }).join('');
  const palette = Object.keys(CATEGORY_LABELS).map(k => MARKER_COLORS[k]);
  const n = palette.length;
  const grad = palette.map((c, i) => `${c} ${(i * 360 / n).toFixed(0)}deg ${((i + 1) * 360 / n).toFixed(0)}deg`).join(', ');
  const multi = `<div class="legend-item"><span class="legend-dot" aria-hidden="true" style="background:conic-gradient(${grad})">*</span><span>${esc(t('legendMulti'))}</span></div>`;
  els.legend.setAttribute('aria-label', t('legend'));
  els.legend.innerHTML = `<div class="legend-title">${esc(t('legend'))}</div>${items}${multi}`;
  if (els.legendNote) els.legendNote.innerHTML = multi;
}

function updateLangButtons() {
  els.langButtons.forEach(btn => {
    const isActive = btn.dataset.lang === currentLang;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
  });
}

function renderUI() {
  if (els.resetView) {
    els.resetView.textContent = '↺';
    els.resetView.setAttribute('aria-label', t('resetView'));
    els.resetView.title = t('resetView');
  }
  if (document.querySelector('.lang-switch')) document.querySelector('.lang-switch').setAttribute('aria-label', t('langGroup'));
  updateLangButtons();
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const v = t(el.getAttribute('data-i18n'));
    if (v) el.textContent = v;
  });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => {
    el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
  });
  if (els.search) {
    els.search.placeholder = t('searchPlaceholder');
    els.search.setAttribute('aria-label', t('searchLabel'));
  }
  if (els.suggestions) els.suggestions.setAttribute('aria-label', t('suggestions'));
  renderCategories();
  renderLegend();
}

function applyLang() {
  document.documentElement.lang = currentLang;
  renderUI();
  if (boundariesLayer) boundariesLayer.eachLayer(l => {
    const n = districtName(l._shapeName);
    if (n && l.getTooltip()) l.setTooltipContent(esc(n));
  });
  for (const id in markers) {
    const mk = markers[id];
    if (!mk || !mk.options) continue;
    const c = citiesById.get(id);
    if (!c) continue;
    mk.options.title = cityDisplayName(c);
    const el = mk.getElement && mk.getElement();
    if (el) {
      el.title = cityDisplayName(c);
      el.setAttribute('aria-label', markerLabel(c));
    }
  }
  if (currentCity) refreshOpenPopup();
}

let suggestionIndex = -1, suggestionResults = [];

function performSearch(query, showEmpty) {
  if (!sortedCities.length) return;
  const q = normalize(String(query || '').trim());
  if (!q) { hideSuggestions(); return; }
  const results = [];
  for (let i = 0; i < sortedCities.length && results.length < 20; i++) {
    const c = sortedCities[i];
    if (c._norm && c._norm.indexOf(q) !== -1) results.push(c);
  }
  renderSuggestions(results, showEmpty);
}

function renderSuggestions(results, showEmpty) {
  suggestionResults = results;
  suggestionIndex = -1;
  if (!els.suggestions || !els.search) return;
  if (!results.length) {
    if (showEmpty) {
      els.suggestions.innerHTML = `<div class="suggestion-empty">${esc(t('noResults'))}</div>`;
      els.suggestions.classList.add('open');
      els.search.setAttribute('aria-expanded', 'true');
    } else hideSuggestions();
    return;
  }
  els.suggestions.innerHTML = results.map((c, i) => {
    const name = cityDisplayName(c), reg = regionDisplayName(c);
    return `<div class="suggestion-item" role="option" data-idx="${i}" id="sugg-${i}"><span class="sugg-name">${esc(name)}</span><span class="region">${esc(reg)}</span></div>`;
  }).join('');
  els.suggestions.classList.add('open');
  els.search.setAttribute('aria-expanded', 'true');
}

function hideSuggestions() {
  if (!els.suggestions) return;
  els.suggestions.classList.remove('open');
  els.suggestions.innerHTML = '';
  if (els.search) {
    els.search.setAttribute('aria-expanded', 'false');
    els.search.removeAttribute('aria-activedescendant');
  }
  suggestionIndex = -1;
  suggestionResults = [];
}

function setActiveSuggestion(idx) {
  if (!els.suggestions || !els.search) return;
  const items = els.suggestions.querySelectorAll('.suggestion-item');
  items.forEach(it => it.classList.remove('active'));
  if (idx < 0 || idx >= items.length) {
    suggestionIndex = -1;
    els.search.removeAttribute('aria-activedescendant');
    return;
  }
  suggestionIndex = idx;
  const el = items[idx];
  el.classList.add('active');
  el.scrollIntoView({ block: 'nearest' });
  els.search.setAttribute('aria-activedescendant', el.id);
}

function chooseSuggestion(idx) {
  const city = suggestionResults[idx];
  if (!city) return;
  hideSuggestions();
  if (els.search) {
    els.search.value = cityDisplayName(city);
    syncSearchClear();
    if (isMobile()) els.search.blur();
  }
  const targetZ = Math.max(FOCUS_MIN_ZOOM, Math.min(FOCUS_MAX_ZOOM, map.getZoom()));
  const target = cityFocusCenter(city, targetZ);
  const c = map.getCenter();
  const same = Math.abs(c.lat - target.lat) < 1e-6 && Math.abs(c.lng - target.lng) < 1e-6 && map.getZoom() === targetZ;
  if (same) { selectCity(city); return; }
  pendingCity = city;
  programmaticMove = true;
  map.flyTo(target, targetZ, { duration: FLY_DURATION });
}

// поиск
if (els.search) {
  els.search.addEventListener('input', debounce(() => { performSearch(els.search.value, false); }, SEARCH_DEBOUNCE));
  els.search.addEventListener('focus', () => { if (els.search.value.trim()) performSearch(els.search.value, false); });
  els.search.addEventListener('keydown', e => {
    const open = els.suggestions && els.suggestions.classList.contains('open');
    if (e.key === 'ArrowDown') {
      if (!open) { performSearch(els.search.value, false); return; }
      e.preventDefault();
      if (suggestionIndex + 1 < suggestionResults.length) setActiveSuggestion(suggestionIndex + 1);
    } else if (e.key === 'ArrowUp') {
      if (!open) return;
      e.preventDefault();
      setActiveSuggestion(suggestionIndex - 1);
    } else if (e.key === 'Enter') {
      if (open && suggestionResults.length) {
        e.preventDefault();
        chooseSuggestion(suggestionIndex >= 0 ? suggestionIndex : 0);
      } else if (els.search.value.trim()) {
        performSearch(els.search.value, true);
        if (suggestionResults.length) chooseSuggestion(0);
      }
    } else if (e.key === 'Escape') hideSuggestions();
  });
}

if (els.suggestions) {
  els.suggestions.addEventListener('click', e => {
    const item = e.target.closest('.suggestion-item');
    if (!item) return;
    const idx = Number(item.dataset.idx);
    if (Number.isFinite(idx)) chooseSuggestion(idx);
  });
  els.suggestions.addEventListener('mouseover', e => {
    const item = e.target.closest('.suggestion-item');
    if (!item) return;
    const idx = Number(item.dataset.idx);
    if (Number.isFinite(idx) && idx !== suggestionIndex) setActiveSuggestion(idx);
  });
}

document.addEventListener('click', e => {
  if (!els.search || !els.suggestions) return;
  if (e.target === els.search || els.suggestions.contains(e.target)) return;
  hideSuggestions();
});

els.langButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const lang = btn.dataset.lang;
    if (!lang || lang === currentLang) return;
    currentLang = lang;
    storageSet('lang', lang);
    if (lang === 'be') loadBeData();
    applyLang();
  });
});

if (els.toggleBoundaries) {
  els.toggleBoundaries.addEventListener('change', () => {
    if (!boundariesLayer) return;
    if (els.toggleBoundaries.checked) boundariesLayer.addTo(map);
    else map.removeLayer(boundariesLayer);
    storageSet('showBoundaries', els.toggleBoundaries.checked ? '1' : '0');
    updateFilterBadge();
  });
}

if (els.toggleNoInfo) {
  els.toggleNoInfo.addEventListener('change', () => {
    activeNoInfo = els.toggleNoInfo.checked;
    storageSet('showNoInfo', activeNoInfo ? '1' : '0');
    updateVisibleMarkers();
    updateFilterBadge();
  });
}

if (els.resetView) {
  els.resetView.addEventListener('click', () => {
    pendingCity = null;
    programmaticMove = true;
    map.flyTo(MAP_HOME.center, MAP_HOME.zoom, { duration: FLY_DURATION });
  });
}

// восстановление состояния из localStorage
(function restoreState() {
  if (els.toggleBoundaries) els.toggleBoundaries.checked = storageGet('showBoundaries', '1') === '1';
  activeNoInfo = storageGet('showNoInfo', '1') === '1';
  if (els.toggleNoInfo) els.toggleNoInfo.checked = activeNoInfo;
  const cats = storageGet('cats', null);
  if (cats) {
    try {
      const arr = JSON.parse(cats);
      if (Array.isArray(arr) && arr.length) activeCategories = new Set(arr);
    } catch (e) {}
  }
})();

initMobileUI();
initMapLimits();
loadAll();