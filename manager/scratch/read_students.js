import fs from 'fs';
const content = fs.readFileSync('manager/components/Students.tsx', 'utf8');

const matchDelete = content.match(/const handleDelete.*?};/s);
if (matchDelete) console.log("--- DELETE ---", matchDelete[0]);

const matchSubmit = content.match(/const handleSubmit.*?};/s);
if (matchSubmit) console.log("--- SUBMIT ---", matchSubmit[0]);

const matchStatus = content.match(/const handleToggleStatus.*?};/s);
if (matchStatus) console.log("--- STATUS ---", matchStatus[0]);
