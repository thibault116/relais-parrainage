import {readFile,writeFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {createCipheriv,randomBytes} from 'node:crypto';
import {brotliCompressSync} from 'node:zlib';
const [input,keyFile,output]=process.argv.slice(2);
if(!input||!keyFile||!output)throw Error('Usage: node scripts/package-member-guides.mjs DOSSIER FICHIER_CLE SORTIE');
const key=Buffer.from((await readFile(keyFile,'utf8')).trim(),'base64');if(key.length!==32)throw Error('Clé de chiffrement invalide.');
const files={};for(const name of await readdir(input)){if(!/^[a-zA-Z0-9_.-]+\.(html|pdf|jpg|png|webp)$/i.test(name))continue;files[name]=(await readFile(join(input,name))).toString('base64');}
const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv),data=Buffer.concat([cipher.update(brotliCompressSync(Buffer.from(JSON.stringify(files)))),cipher.final()]);await writeFile(output,Buffer.concat([Buffer.from('MG01'),iv,cipher.getAuthTag(),data]));console.log(`Guides chiffrés : ${Object.keys(files).length} fichiers.`);
