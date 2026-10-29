import webpush from 'web-push';
import {writeFileSync} from 'node:fs';
const keys=webpush.generateVAPIDKeys();
writeFileSync('.env.vapid.local','VAPID_PUBLIC_KEY='+keys.publicKey+'\nVAPID_PRIVATE_KEY='+keys.privateKey+'\nVAPID_SUBJECT=mailto:mentora.officiel@gmail.com\n',{flag:'wx',mode:0o600});
console.log('Clés générées dans .env.vapid.local, privé et exclu de Git.');
