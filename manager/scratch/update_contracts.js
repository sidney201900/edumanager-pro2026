import fs from 'fs';
const file = 'manager/components/Contracts.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Injetar estados
if (!content.includes('dbContracts')) {
  content = content.replace(
    "const [activeTab, setActiveTab] = useState<'contracts' | 'templates'>('contracts');",
    `const [dbContracts, setDbContracts] = useState<Contract[]>([]);
  const [dbTemplates, setDbTemplates] = useState<any[]>([]);

  const loadData = async () => {
    try {
      const [resC, resT] = await Promise.all([
        fetch('/api/contratos'),
        fetch('/api/modelos-contrato')
      ]);
      if (resC.ok) {
        const json = await resC.json();
        setDbContracts(json.contratos || []);
      }
      if (resT.ok) {
        const json = await resT.json();
        setDbTemplates(json.modelos || []);
      }
    } catch(e) { console.error(e); }
  };

  useEffect(() => { loadData(); }, []);

  const [activeTab, setActiveTab] = useState<'contracts' | 'templates'>('contracts');`
  );
}

// 2. Mudar filteredContracts e filteredTemplates para usar as vars do BD
content = content.replace(/data\.contracts\.filter/g, 'dbContracts.filter');
content = content.replace(/data\.contracts/g, 'dbContracts');
content = content.replace(/\(data\.contractTemplates \|\| \[\]\)/g, 'dbTemplates');
content = content.replace(/data\.contractTemplates/g, 'dbTemplates');

// 3. Modificar handleSubmit (Criar contrato)
content = content.replace(
  "updateData({ contracts: [...data.contracts, newContract] });\n    closeModal();",
  `fetch('/api/contratos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newContract)
    }).then(() => loadData());
    updateData({ contracts: [...dbContracts, newContract] });
    closeModal();`
);

// 4. Modificar handleTemplateSubmit
content = content.replace(
  "updateData({ contractTemplates: updatedTemplates });\n    closeTemplateModal();",
  `if (templateFormData.id) {
      fetch('/api/modelos-contrato/' + templateFormData.id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateFormData)
      }).then(() => loadData());
    } else {
      fetch('/api/modelos-contrato', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...templateFormData, id: updatedTemplates.find(t=>t.name===templateFormData.name)?.id || crypto.randomUUID() })
      }).then(() => loadData());
    }
    updateData({ contractTemplates: updatedTemplates });
    closeTemplateModal();`
);

// 5. Modificar handleDelete e handleDeleteTemplate
content = content.replace(
  "updateData({ contracts: data.contracts.filter(c => c.id !== id) });",
  `fetch('/api/contratos/' + id, { method: 'DELETE' }).then(() => loadData());
        updateData({ contracts: dbContracts.filter(c => c.id !== id) });`
);

content = content.replace(
  "updateData({ contractTemplates: (data.contractTemplates || []).filter(t => t.id !== id) });",
  `fetch('/api/modelos-contrato/' + id, { method: 'DELETE' }).then(() => loadData());
        updateData({ contractTemplates: dbTemplates.filter(t => t.id !== id) });`
);

fs.writeFileSync(file, content, 'utf8');
console.log('Script aplicado ao Contracts.tsx');
