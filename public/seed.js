(() => {
  const KEY = 'geliu-db-v5';
  const raw = localStorage.getItem(KEY);
  if (!raw) { console.error('No data in localStorage'); return; }
  const data = JSON.parse(raw);
  const mkid = () => Math.random().toString(36).slice(2,10);

  data.plants.forEach(p => { p.timeline = []; p.status = 'healthy'; });

  const plant = data.plants.find(p => p.kategorija === 'auginama');
  if (!plant) { console.error('No auginama plants found'); return; }

  plant.status = 'healthy';
  plant.timeline = [
    { id: mkid(), type: 'statusChange', date: '2026-04-14', fromStatus: 'quarantine', toStatus: 'healthy' },
    { id: mkid(), type: 'treatment',    date: '2026-04-07', preparatas: 'Neem aliejus', tikslas: 'Erkuciu naikinimas', metodas: 'Purskimas', note: '3-ias kartas' },
    { id: mkid(), type: 'treatment',    date: '2026-04-01', preparatas: 'Neem aliejus', tikslas: 'Erkuciu naikinimas', metodas: 'Purskimas', note: '2-as kartas' },
    { id: mkid(), type: 'statusChange', date: '2026-03-28', fromStatus: 'sick', toStatus: 'quarantine', disease: 'Voratinklines erkutes', isolated: true },
    { id: mkid(), type: 'treatment',    date: '2026-03-22', preparatas: 'Neem aliejus', tikslas: 'Erkuciu naikinimas', metodas: 'Lapu nusluostymas', note: '1-as kartas' },
    { id: mkid(), type: 'watering',     date: '2026-03-18' },
    { id: mkid(), type: 'statusChange', date: '2026-03-15', fromStatus: 'healthy', toStatus: 'sick', issue: 'Demes ant lapu, kenkejai pastebeti' },
    { id: mkid(), type: 'watering',     date: '2026-03-03' },
    { id: mkid(), type: 'watering',     date: '2026-02-17' },
    { id: mkid(), type: 'watering',     date: '2026-02-03' },
    { id: mkid(), type: 'fertilizing',  date: '2026-01-20', fertilizer: 'Universalios skystosios trasos' },
    { id: mkid(), type: 'watering',     date: '2026-01-08' },
    { id: mkid(), type: 'watering',     date: '2025-12-28' },
    { id: mkid(), type: 'repotting',    date: '2025-12-15', potSize: '18cm', note: 'Persodintas i didesni vazona' },
    { id: mkid(), type: 'watering',     date: '2025-12-10' },
    { id: mkid(), type: 'watering',     date: '2025-11-26' },
    { id: mkid(), type: 'fertilizing',  date: '2025-11-05', fertilizer: 'Universalios skystosios trasos' },
    { id: mkid(), type: 'watering',     date: '2025-10-28' },
    { id: mkid(), type: 'watering',     date: '2025-10-14' },
  ];

  localStorage.setItem(KEY, JSON.stringify(data));
  console.log('Done: ' + plant.lotyniskas + ', events: ' + plant.timeline.length + '. Reload the page.');
})();
