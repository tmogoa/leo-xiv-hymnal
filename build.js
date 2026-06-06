const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const Handlebars = require("handlebars");

const hymnsDir = path.join(__dirname, "hymns");
const distDir = path.join(__dirname, "dist");
const distHymnsDir = path.join(distDir, "hymns");

fs.mkdirSync(distHymnsDir, { recursive: true });
// Copy assets
const distAssetsDir = path.join(distDir, 'assets');
fs.mkdirSync(distAssetsDir, { recursive: true });
fs.copyFileSync('src/assets/style.css', path.join(distAssetsDir, 'style.css'));

const isDir = (f) => {
  return fs.statSync(path.join(hymnsDir, f)).isDirectory();
};

const hymnFolders = fs.readdirSync(hymnsDir).filter(isDir);

const hymns = {};

for (const hymnId of hymnFolders) {
  const hymnPath = path.join(hymnsDir, hymnId);
  const langFiles = fs.readdirSync(hymnPath).filter((f) => f.endsWith(".yaml"));

  if (langFiles.length === 0) continue;

  hymns[hymnId] = {};

  for (const langFile of langFiles) {
    const lang = path.basename(langFile, ".yaml");
    const raw = fs.readFileSync(path.join(hymnPath, langFile), "utf8");
    const parsed = yaml.load(raw);
    hymns[hymnId][lang] = { ...parsed, lang };
  }
}

const hymnTemplate = Handlebars.compile(
  fs.readFileSync("src/templates/hymn.hbs", "utf8"),
);

const indexTemplate = Handlebars.compile(
  fs.readFileSync("src/templates/index.hbs", "utf8"),
);

for (const [id, translations] of Object.entries(hymns)) {
  const langs = Object.keys(translations);
  const primary = translations[langs[0]];

  const sectionTypes = primary.body.map((s, i) => ({
    type: s.type,
    number: s.number,
    index: i,
  }));

  // For each section, gather lines from all translations
  const sections = sectionTypes.map(({ type, number, index }) => ({
    type,
    number,
    lines: langs
      .map((lang) => {
        const section = translations[lang].body[index];
        if (!section) return null;
        return { lang, text: section.lines };
      })
      .filter(Boolean),
  }));

  const context = {
    id,
    primaryTitle: primary.title,
    translations: langs.map((lang) => ({
      lang,
      title: translations[lang].title,
    })),
    sections,
  };

  const html = hymnTemplate(context);
  fs.writeFileSync(path.join(distHymnsDir, `${id}.html`), html);
  console.log(`✓ Built hymns/${id}.html`);
}

const indexContext = {
  hymns: Object.entries(hymns).map(([id, translations]) => {
    const langs = Object.keys(translations);
    return {
      id,
      primaryTitle: translations[langs[0]].title,
      langs: langs.join(", "),
    };
  }),
};

const indexHtml = indexTemplate(indexContext);
fs.writeFileSync(path.join(distDir, 'index.html'), indexHtml);
console.log('✓ Built index.html');

console.log("\nBuild complete.");
