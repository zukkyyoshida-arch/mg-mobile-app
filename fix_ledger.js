import fs from 'fs';

let content = fs.readFileSync('src/components/CashLedger.jsx', 'utf8');

// 1. Add groupId and custom names to risk card transactions
content = content.replace(
  /if \(riskAction === 'retire_worker'\) \{([\s\S]*?)else if \(riskAction === 'strike'\) \{([\s\S]*?)\}/,
  (match) => {
    return `if (riskAction === 'retire_worker') {
          newTransactions.push({ id: Date.now().toString() + "-resw", groupId: tsGroup, category: "退職", workersResigned: 1, salesmenResigned: 0, amount: 0, quantity: 1, price: 0, timestamp, customName: "ワーカー退職", customShortName: "退職" });
          newTransactions.push({ id: Date.now().toString() + "-reswp", groupId: tsGroup, category: "ソ", amount: 5, quantity: 1, price: 5, timestamp: new Date(Date.now() + 1).toISOString(), customName: "退職違約金 (ワーカー)", customShortName: "退職" });
        } else if (riskAction === 'retire_salesman') {
          newTransactions.push({ id: Date.now().toString() + "-ress", groupId: tsGroup, category: "退職", workersResigned: 0, salesmenResigned: 1, amount: 0, quantity: 1, price: 0, timestamp, customName: "セールスマン退職", customShortName: "退職" });
          newTransactions.push({ id: Date.now().toString() + "-ressp", groupId: tsGroup, category: "ソ", amount: 5, quantity: 1, price: 5, timestamp: new Date(Date.now() + 1).toISOString(), customName: "退職違約金 (セールスマン)", customShortName: "退職" });
        } else if (riskAction === 'claim') {
          newTransactions.push({ id: Date.now().toString() + "-claim", category: "セ", amount: 5, quantity: 1, price: 5, timestamp });
        } else if (riskAction === 'machine_break' || riskAction === 'design_trouble') {
          newTransactions.push({ id: Date.now().toString() + "-trouble", category: "ス", amount: 5, quantity: 1, price: 5, timestamp });
        } else if (riskAction === 'rd_fail') {
          newTransactions.push({ id: Date.now().toString() + "-rdfail", category: "研究開発失敗", amount: 0, quantity: 1, price: 0, timestamp });
        } else if (riskAction === 'theft') {
          newTransactions.push({ id: Date.now().toString() + "-theft", category: "盗難", quantity: 1, amount: 0, price: 0, timestamp });
        } else if (riskAction === 'miss') {
          newTransactions.push({ id: Date.now().toString() + "-miss", category: "製造ミス", quantity: 1, amount: 0, price: 0, timestamp });
        } else if (riskAction === 'fire') {
          newTransactions.push({ id: Date.now().toString() + "-fire", category: "火災", quantity: 1, amount: 0, price: 0, timestamp });
        } else if (riskAction === 'strike') {
          newTransactions.push({ id: Date.now().toString() + "-strk", category: "タ", amount: 15, quantity: 1, price: 15, timestamp });
        }`;
  }
);

content = content.replace(
  `const timestamp = new Date().toISOString();`,
  `const timestamp = new Date().toISOString();\n      const tsGroup = Date.now().toString();`
);

// 2. Fix handleDeleteTransaction to use groupId
content = content.replace(
  `  const handleDeleteTransaction = (id) => {
    if (confirm("この取引を削除しますか？")) {
      const newLedger = ledger.filter(t => t.id !== id);
      onUpdateLedger(newLedger);
    }
  };`,
  `  const handleDeleteTransaction = (id) => {
    const entryToDelete = ledger.find(t => t.id === id);
    if (!entryToDelete) return;
    
    if (confirm("この取引を削除しますか？")) {
      let newLedger;
      if (entryToDelete.groupId) {
        newLedger = ledger.filter(t => t.groupId !== entryToDelete.groupId);
      } else {
        newLedger = ledger.filter(t => t.id !== id);
      }
      onUpdateLedger(newLedger);
    }
  };`
);

// 3. Fix the rendering logic
content = content.replace(
  `          [...ledger].reverse().map((entry) => {
            const catMeta = CATEGORIES[entry.category] || { label: '未定義', color: 'pink' };
            const badgeClass = \`badge badge-\${catMeta.color}\`;
            
            return (
              <div key={entry.id} className="glass-card" style={{ margin: '8px 16px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderLeft: \`4px solid var(--mg-\${catMeta.color})\` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className={badgeClass} style={{ width: '32px', height: '32px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '800' }}>
                    {entry.category}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.88rem', fontWeight: '700' }}>{catMeta.label}</span>`,
  `          [...ledger].reverse().map((entry) => {
            const catMeta = CATEGORIES[entry.category] || { label: '未定義', color: 'pink', shortName: '不明', actionName: '不明' };
            const badgeClass = \`badge badge-\${catMeta.color}\`;
            const iconText = entry.customShortName || catMeta.shortName || entry.category;
            const labelText = entry.customName || catMeta.actionName || catMeta.label;
            
            return (
              <div key={entry.id} className="glass-card" style={{ margin: '8px 16px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderLeft: \`4px solid var(--mg-\${catMeta.color})\` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className={badgeClass} style={{ width: '32px', height: '32px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {iconText}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.88rem', fontWeight: '700' }}>{labelText}</span>`
);

fs.writeFileSync('src/components/CashLedger.jsx', content);
