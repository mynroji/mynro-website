import {createHash, createHmac, timingSafeEqual} from 'node:crypto';
import {readFile} from 'node:fs/promises';

export const config = {path: ['/studio', '/studio/*']};

const baseHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"
};
const assets = {
  '/studio': ['index.html', 'text/html'],
  '/studio/': ['index.html', 'text/html'],
  '/studio/app.js': ['app.js', 'text/javascript'],
  '/studio/style.css': ['style.css', 'text/css']
};
const cookieName = '__Secure-mynro-studio';
const duration = 8 * 60 * 60;
const login = '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>MYNRO Studio sign-in</title><style>body{background:#0b0b0d;color:#fff;font:16px Arial;max-width:440px;margin:12vh auto;padding:24px}h1{font-size:40px}input,button{box-sizing:border-box;width:100%;padding:12px;margin-top:10px;border-radius:4px;border:1px solid #65555a;font:inherit}input{background:#171417;color:white}button{background:#ed263a;color:white;border:0;font-weight:bold;cursor:pointer}a{color:#ddd}</style><main><h1>MYNRO Studio</h1><p>Private workspace for the owner.</p><form method="post" action="/studio/login"><label>Studio access key<input name="key" type="password" required maxlength="256" autocomplete="current-password"></label><button type="submit">Sign in</button></form><p><a href="/">Back to MYNRO</a></p></main></html>';

const digest = value => createHash('sha256').update(value).digest();
const sign = (key, expires) => createHmac('sha256', key).update('mynro-studio:'+expires).digest('base64url');
const now = () => Math.floor(Date.now()/1000);

function validSession(cookie, key) {
  const entry = (cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(cookieName+'='));
  const match = entry?.slice(cookieName.length+1).match(/^(\d{10})\.([A-Za-z0-9_-]{43})$/);
  return !!match && Number(match[1]) > now() && timingSafeEqual(Buffer.from(match[2]), Buffer.from(sign(key, match[1])));
}

function response(body, status = 200, type = 'text/plain', headers = {}) {
  return new Response(body,{status,headers:{...baseHeaders,'Content-Type':type+'; charset=utf-8',...headers}});
}

function redirect(location, token, maxAge) {
  return response(null,303,'text/plain',{
    Location: location,
    'Set-Cookie': cookieName+'='+token+'; Path=/studio; Secure; HttpOnly; SameSite=Strict; Max-Age='+maxAge
  });
}

export default async function studio(req) {
  const {pathname, origin} = new URL(req.url);
  const key = process.env.MYNRO_STUDIO_KEY;
  if (!key || !/^[A-Za-z0-9_-]{32,128}$/.test(key)) return response('Not found',404);

  if (req.method === 'POST') {
    const sameOrigin = req.headers.get('origin') === origin || req.headers.get('sec-fetch-site') === 'same-origin';
    if (!sameOrigin) return response('Forbidden',403);
    if (pathname === '/studio/logout') return redirect('/studio','',0);
    if (pathname !== '/studio/login') return response('Not found',404);
    if (!req.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) return response('Invalid sign-in request',400);
    const supplied = new URLSearchParams(await req.text()).get('key') || '';
    if (supplied.length > 256 || !timingSafeEqual(digest(supplied),digest(key))) {
      return response(login.replace('<p>Private workspace for the owner.</p>','<p role="alert">Invalid access key. Please try again.</p>'),401,'text/html');
    }
    const expires = now()+duration;
    return redirect('/studio',expires+'.'+sign(key,expires),duration);
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') return response('Method not allowed',405);
  if (pathname === '/studio/login') return response(null,303,'text/plain',{Location:'/studio'});
  if (!Object.hasOwn(assets,pathname)) return response('Not found',404);
  const [file,type] = assets[pathname];
  if (!validSession(req.headers.get('cookie'),key)) {
    return file === 'index.html' ? response(req.method==='HEAD'?null:login,200,'text/html') : response('Unauthorized',401);
  }
  const body = req.method==='HEAD' ? null : await readFile(new URL('./studio-assets/'+file, import.meta.url));
  return response(body,200,type);
}
