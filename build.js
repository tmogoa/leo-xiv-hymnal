const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const Handlebars = require('handlebars');

// ─── Directories ─────────────────────────────────────────────
const hymnsDir      = path.join(__dirname, 'hymns');
const distDir       = path.join(__dirname, 'dist');
const distHymnsDir  = path.join(distDir, 'hymns');
const distAssetsDir = path.join(distDir, 'assets');

fs.mkdirSync(distHymnsDir,  { recursive: true });
fs.mkdirSync(distAssetsDir, { recursive: true });

// Copy assets
fs.copyFileSync('src/assets/style.css', path.join(distAssetsDir, 'style.css'));

// ─── Scan hymn folders ───────────────────────────────────────
const hymnFolders = fs.readdirSync(hymnsDir).filter(f =>
  fs.statSync(path.join(hymnsDir, f)).isDirectory()
);

// ─── Parse YAML files ────────────────────────────────────────
const hymns = {};

for (const hymnId of hymnFolders) {
  const hymnPath = path.join(hymnsDir, hymnId);
  const langFiles = fs.readdirSync(hymnPath).filter(f =>
    f.endsWith('.yaml') && f !== 'meta.yaml'
  );

  if (langFiles.length === 0) continue;

  // Load meta.yaml if it exists
  const metaPath = path.join(hymnPath, 'meta.yaml');
  const meta = fs.existsSync(metaPath)
    ? yaml.load(fs.readFileSync(metaPath, 'utf8'))
    : {};

  hymns[hymnId] = { _meta: meta };

  for (const langFile of langFiles) {
    const lang   = path.basename(langFile, '.yaml');
    const raw    = fs.readFileSync(path.join(hymnPath, langFile), 'utf8');
    const parsed = yaml.load(raw);
    hymns[hymnId][lang] = { ...parsed, lang };
  }
}

// ─── Load templates ──────────────────────────────────────────
const hymnTemplate = Handlebars.compile(
  fs.readFileSync('src/templates/hymn.hbs', 'utf8')
);
const indexTemplate = Handlebars.compile(
  fs.readFileSync('src/templates/index.hbs', 'utf8')
);

// ─── Build hymn pages ─────────────────────────────────────────
for (const [id, translations] of Object.entries(hymns)) {
  const meta  = translations._meta || {};
  const langs = Object.keys(translations).filter(k => k !== '_meta');

  // Determine primary language
  const primaryLang = meta.original_lang && langs.includes(meta.original_lang)
    ? meta.original_lang
    : langs[0];

  // Order languages: primary first, rest after
  const orderedLangs = [
    primaryLang,
    ...langs.filter(l => l !== primaryLang)
  ];

  const primary             = translations[primaryLang];
  const firstTranslationLang = orderedLangs[1] || null;

  // Use primary language body as the section structure
  const sectionTypes = primary.body.map((s, i) => ({
    type: s.type, number: s.number, index: i
  }));

  const sections = sectionTypes.map(({ type, number, index }) => {
    const maxLines = Math.max(...orderedLangs.map(lang => {
      const section = translations[lang].body[index];
      return section ? section.lines.length : 0;
    }));

    const rows = Array.from({ length: maxLines }, (_, i) => ({
      translations: orderedLangs.map(lang => {
        const section = translations[lang].body[index];
        return {
          lang,
          text: section && section.lines[i] ? section.lines[i] : ''
        };
      })
    }));

    return { type, number, rows };
  });

  const context = {
    id,
    primaryTitle:         primary.title,
    primaryLang,
    firstTranslationLang,
    translations: orderedLangs.map(lang => ({
      lang,
      title: translations[lang].title
    })),
    sections
  };

  const html = hymnTemplate(context);
  fs.writeFileSync(path.join(distHymnsDir, `${id}.html`), html);
  console.log(`✓ Built hymns/${id}.html`);
}

// ─── Build index page ─────────────────────────────────────────
const indexContext = {
  hymns: Object.entries(hymns).map(([id, translations]) => {
    const meta  = translations._meta || {};
    const langs = Object.keys(translations).filter(k => k !== '_meta');

    const primaryLang = meta.original_lang && langs.includes(meta.original_lang)
      ? meta.original_lang
      : langs[0];

    const orderedLangs = [
      primaryLang,
      ...langs.filter(l => l !== primaryLang)
    ];

    return {
      id,
      primaryTitle: translations[primaryLang].title,
      langs: orderedLangs.join(', ')
    };
  })
};

fs.writeFileSync(path.join(distDir, 'index.html'), indexTemplate(indexContext));
console.log('✓ Built index.html\n\nBuild complete.');