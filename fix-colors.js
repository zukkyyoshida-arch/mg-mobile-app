const fs = require('fs');
const file = 'src/components/CashLedger.jsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/rgba\(255,255,255,0\.1\)/g, 'rgba(0,0,0,0.05)');
content = content.replace(/rgba\(255,255,255,0\.05\)/g, 'rgba(0,0,0,0.02)');
content = content.replace(/rgba\(255,255,255,0\.15\)/g, 'rgba(0,0,0,0.05)');
content = content.replace(/rgba\(255,255,255,0\.3\)/g, 'rgba(0,0,0,0.1)');
content = content.replace(/rgba\(0,0,0,0\.2\)/g, 'rgba(0,0,0,0.04)');
content = content.replace(/rgba\(0,0,0,0\.3\)/g, 'rgba(0,0,0,0.06)');
content = content.replace(/var\(--mg-green\)', color: 'var\(--text-primary\)'/g, "var(--mg-green)', color: 'white'");
content = content.replace(/background: 'linear-gradient\(135deg, #9c27b0, #673ab7\)', color: 'var\(--text-primary\)'/g, "background: 'linear-gradient(135deg, #9c27b0, #673ab7)', color: 'white'");

fs.writeFileSync(file, content);
