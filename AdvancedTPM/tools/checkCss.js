const fs = require('fs');
const path = 'AdvancedTPM/src/UI/components/ToolbarButton.css';
try {
  const s = fs.readFileSync(path, 'utf8');
  console.log('---FILE START---');
  console.log(s);
  console.log('---FILE END---');
  console.log(JSON.stringify(s));
  console.log('Open:' + (s.match(/{/g) || []).length + ' Close:' + (s.match(/}/g) || []).length);
} catch (e) {
  console.error('ERROR', e.message);
  process.exit(1);
}
