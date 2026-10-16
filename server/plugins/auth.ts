import { createAuthPlugin } from "@agent-native/core/server";
import { signInJourneyInlineScript } from "@agent-native/core/shared";
import { and, eq } from "drizzle-orm";

import { getDb, schema } from "../db.js";

const signupGate = {
  id: "aprc-account-admission",
  hooks: {
    before: [
      {
        matcher: (context: { path: string }) =>
          context.path === "/sign-up/email",
        handler: async (context: {
          body?: { email?: unknown; password?: unknown };
          context?: { session?: { user?: { email?: string } } | null };
        }) => {
          const db = getDb();
          const [manager] = await db
            .select({ email: schema.projectUsers.email })
            .from(schema.projectUsers)
            .where(eq(schema.projectUsers.role, "Site Manager"))
            .limit(1);

          if (!manager) {
            const email = context.body?.email;
            if (
              typeof email === "string" &&
              /^[a-zA-Z0-9._-]{3,32}@aprc\.invalid$/i.test(email)
            )
              return;
          } else {
            const email = context.context?.session?.user?.email;
            if (email) {
              const [user] = await db
                .select({
                  role: schema.projectUsers.role,
                  active: schema.projectUsers.active,
                })
                .from(schema.projectUsers)
                .where(
                  and(
                    eq(schema.projectUsers.email, email),
                    eq(schema.projectUsers.active, true),
                  ),
                )
                .limit(1);
              if (user?.role === "Site Manager") return;
            }
          }

          return new Response(
            JSON.stringify({
              error:
                "Account creation is restricted to the initial setup or a Site Manager.",
            }),
            {
              status: 403,
              headers: { "content-type": "application/json" },
            },
          );
        },
      },
    ],
  },
};

const loginHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sign in · APRC FAFS</title>
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f3f6f8;color:#192c3b;font:14px Inter,Arial,sans-serif}.shell{width:min(420px,calc(100% - 32px));background:#fff;border:1px solid #dce4e9;border-radius:16px;padding:30px;box-shadow:0 16px 50px #142b3c12}.brand{display:flex;align-items:center;gap:11px;margin-bottom:30px}.mark{display:grid;place-items:center;width:42px;height:42px;border-radius:12px;background:#f5ae24;color:#142b3c;font-weight:900}.brand strong{display:block;letter-spacing:.12em;font-size:14px}.brand small{display:block;margin-top:3px;color:#7b8a95;font-size:10px;letter-spacing:.12em;text-transform:uppercase}h1{font-size:22px;letter-spacing:-.03em;margin:0 0 7px}p{margin:0 0 23px;color:#71808a;font-size:12px;line-height:1.6}label{display:block;margin:14px 0 6px;color:#536572;font-size:11px;font-weight:700}input{width:100%;height:42px;border:1px solid #d6dfe5;border-radius:8px;padding:0 12px;font:inherit;outline:none}input:focus{border-color:#68889d;box-shadow:0 0 0 3px #dbe7ed}button{width:100%;height:42px;margin-top:19px;border:0;border-radius:8px;background:#142b3c;color:white;font-size:12px;font-weight:700;cursor:pointer}button:hover{background:#203d51}button:disabled{opacity:.55;cursor:wait}.link{display:block;width:max-content;margin:18px auto 0;border:0;background:none;color:#416078;font-size:11px;text-decoration:underline;cursor:pointer}.error{min-height:18px;margin-top:12px;color:#b42318;font-size:11px}.setup{display:none;margin:0 0 18px;padding:12px;border:1px solid #f2d18a;border-radius:9px;background:#fff9e9;color:#705319;font-size:11px;line-height:1.6}.setup b{display:block;margin-bottom:3px}.hidden{display:none}
.status-actions{margin-top:18px}.status-actions button{margin-top:0}.loading{color:#71808a;font-size:12px;margin:0 0 23px}.hidden{display:none!important}
</style>
</head>
<body>
<main class="shell"><div class="brand"><div class="mark">A</div><div><strong>APRC</strong><small>Project Control · FAFS</small></div></div>
<p id="loadingStatus" class="loading">Checking setup status…</p>
<section id="statusError" class="hidden"><h1>Setup status unavailable</h1><p>We couldn't check whether this workspace needs its first Site Manager. Check your connection and try again.</p><div class="status-actions"><button id="retryStatus" type="button">Retry</button></div></section>
<section id="signin" class="hidden"><h1>Welcome back</h1><p>Sign in to view fire alarm system implementation progress.</p><form id="login"><label for="username">Username</label><input id="username" name="username" autocomplete="username" required><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required><button id="loginButton">Sign in</button></form></section>
<div id="message" class="error" role="status"></div></main>
<script>${signInJourneyInlineScript()}</script>
<script>
(function(){
  var signin=document.getElementById('signin'), statusError=document.getElementById('statusError'), loading=document.getElementById('loadingStatus'), message=document.getElementById('message'), journey=__anCreateSignInJourney('', '/'), resumeHref=journey.journeyForLocation(window.location).resumeHref;
  function setBusy(button,busy,label){button.disabled=busy;if(busy)button.textContent=label;}
  function post(path,body,expectOk){return fetch(path,{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify(body)}).then(function(response){return response.json().catch(function(){return null;}).then(function(data){if(!response.ok||!data||(expectOk!==false&&!data.ok))throw new Error('Request failed');return data;});});}
  function loadSetupStatus(){loading.classList.remove('hidden');signin.classList.add('hidden');statusError.classList.add('hidden');message.textContent='';fetch('/setup-status',{credentials:'include'}).then(function(response){if(!response.ok)throw new Error();return response.json();}).then(function(data){if(typeof data.needsSetup!=='boolean')throw new Error();if(data.needsSetup){window.location.replace('/');return;}loading.classList.add('hidden');signin.classList.remove('hidden');}).catch(function(){loading.classList.add('hidden');statusError.classList.remove('hidden');});}
  loadSetupStatus();
  document.getElementById('retryStatus').addEventListener('click',loadSetupStatus);
  document.getElementById('login').addEventListener('submit',function(event){event.preventDefault();var button=document.getElementById('loginButton'),username=document.getElementById('username').value.trim(),password=document.getElementById('password').value;setBusy(button,true,'Signing in…');message.textContent='';post('/_agent-native/auth/login',{email:username+'@aprc.invalid',password:password},true).then(function(){window.location.replace(resumeHref);}).catch(function(){message.textContent='Sign-in failed. Check your username and password and try again.';button.disabled=false;button.textContent='Sign in';});});
})();
</script></body></html>`;

export default createAuthPlugin({
  rootAuth: false,
  publicPaths: ["/setup-status"],
  workspaceAppPublicPaths: ["/"],
  loginHtml,
  betterAuth: { plugins: [signupGate as never] },
});
