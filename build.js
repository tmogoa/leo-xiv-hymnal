const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const Handlebars = require('handlebars');

// ─── Directories ─────────────────────────────────────────────
const hymnsDir     = path.join(__dirname, 'hymns');
const distDir      = path.join(__dirname, 'dist');
const distHymnsDir = path.join(distDir, 'hymns');
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
  const langFiles = fs.readdirSync(hymnPath).filter(f => f.endsWith('.yaml'));

  if (langFiles.length === 0) continue;

  hymns[hymnId] = {};

  for (const langFile of langFiles) {
    const lang = path.basename(langFile, '.yaml');
    const raw  = fs.readFileSync(path.join(hymnPath, langFile), 'utf8');
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
  const langs   = Object.keys(translations);
  const primary = translations[langs[0]];

  const sectionTypes = primary.body.map((s, i) => ({
    type: s.type, number: s.number, index: i
  }));

  const sections = sectionTypes.map(({ type, number, index }) => {
    const maxLines = Math.max(...langs.map(lang => {
      const section = translations[lang].body[index];
      return section ? section.lines.length : 0;
    }));

    const rows = Array.from({ length: maxLines }, (_, i) => ({
      translations: langs.map(lang => {
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
    primaryTitle:        primary.title,
    primaryLang:         langs[0],
    firstTranslationLang: langs[1] || null,
    translations: langs.map(lang => ({
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
    const langs = Object.keys(translations);
    return {
      id,
      primaryTitle: translations[langs[0]].title,
      langs: langs.join(', ')
    };
  })
};

fs.writeFileSync(path.join(distDir, 'index.html'), indexTemplate(indexContext));
console.log('✓ Built index.html\n\nBuild complete.');