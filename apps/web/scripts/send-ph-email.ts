/**
 * One-time script: Send Product Hunt launch email to all Straude users.
 *
 * Usage: cd apps/web && bun --env-file=.env.local run scripts/send-ph-email.ts
 *
 * Requires RESEND_API_KEY in .env.local
 */

import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
if (!RESEND_API_KEY) {
  console.error("Missing RESEND_API_KEY. Run from apps/web with .env.local loaded.");
  process.exit(1);
}

const resend = new Resend(RESEND_API_KEY);

const FROM = "Straude <team@straude.com>";
const REPLY_TO = "oscar.hong2015@gmail.com";
const SUBJECT = "Support Straude on Product Hunt 🎉";

const HTML_BODY = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111;">
  <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.5;">Hey there,</p>
  <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.5;">Straude launched on Product Hunt today — and we cracked the top 10!</p>
  <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.5;">If you have a minute, we'd really appreciate your upvote:</p>
  <ol style="margin: 0 0 16px; padding-left: 20px; font-size: 16px; line-height: 1.8;">
    <li>Head to <strong>producthunt.com</strong> and sign in</li>
    <li>Scroll down to <strong>"Top Products Launching Today"</strong></li>
    <li>Find us at <strong>#10</strong> (just below Google, Cursor, and ChatGPT — casual company)</li>
    <li>Hit that upvote button</li>
  </ol>
  <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.5;">That's it. Takes 30 seconds and means the world to us.</p>
  <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.5;">Help us spread the word today with a <a href="https://x.com/oscrhong/status/2040069857534951429" style="color: #df561f; text-decoration: underline;">RT/comment on X</a>, or share Straude with a friend.</p>
  <p style="margin: 0 0 4px; font-size: 16px; line-height: 1.5;">Thanks for being part of Straude. We're building this for you.</p>
  <p style="margin: 0; font-size: 16px; line-height: 1.5;">— Oscar</p>
</div>
`.trim();

const TEXT_BODY = `Hey there,

Straude launched on Product Hunt today — and we cracked the top 10!

If you have a minute, we'd really appreciate your upvote:

1. Head to producthunt.com and sign in
2. Scroll down to "Top Products Launching Today"
3. Find us at #10 (just below Google, Cursor, and ChatGPT — casual company)
4. Hit that upvote button

That's it. Takes 30 seconds and means the world to us.

Help us spread the word today with a RT/comment on X (https://x.com/oscrhong/status/2040069857534951429), or share Straude with a friend.

Thanks for being part of Straude. We're building this for you.

— Oscar`;

// 262 real user emails (excluded seed/test/mailinator accounts)
const EMAILS = [
  "oscar.hong2015@gmail.com",
  "markmorgan.dev@gmail.com",
  "fahmimodelo@gmail.com",
  "gooduru.vineeth@smallcase.com",
  "r3xed@outlook.es",
  "vkk1008k@gmail.com",
  "jbyoung12@gmail.com",
  "prerakgada07@gmail.com",
  "alliejones42@gmail.com",
  "itay.maman+github@gmail.com",
  "bodhimindflow@gmail.com",
  "gat@gray-os.com",
  "matvey.ezhov@gmail.com",
  "theo@theolinnemann.com",
  "naveenmukkatt@gmail.com",
  "dimitry.foures@gmail.com",
  "hi@rachitarora.com",
  "ketanjayagrawal@gmail.com",
  "github@apps.mhmd.us",
  "im@omarcruz.dev",
  "developers@tinypixel.dev",
  "alex@gikken.co",
  "nikhil@vryse.co",
  "sotgiu.paolo@gmail.com",
  "travis.brimhall@gmail.com",
  "andreas@andreasiversen.xyz",
  "fer@fer.xyz",
  "andreas@veveve.dk",
  "github@robertovillegas.com",
  "p4ul.sincl4ir@gmail.com",
  "mike@skalnik.com",
  "radu@popescu.xyz",
  "thaqib.mo@gmail.com",
  "isobowldev@gmail.com",
  "sedwards@gmail.com",
  "mike.wirth@gmail.com",
  "browntd12155@gmail.com",
  "gabe.l.cohen@gmail.com",
  "jgourneau@guardanthealth.com",
  "v0idmatr1x.0@gmail.com",
  "lk.list.acc@gmail.com",
  "arjungupta2908@gmail.com",
  "arri@arri.io",
  "marcosloic@gmail.com",
  "spence.burleigh@gmail.com",
  "d@derekr.net",
  "mariusdima@msn.com",
  "juliantosun@gmail.com",
  "jayzalowitz@gmail.com",
  "bostonia@gmail.com",
  "traceur@gmail.com",
  "lokillo_aguayo@hotmail.com",
  "andrew@bugle.agency",
  "fivetaku@naver.com",
  "uniquate@gmail.com",
  "xogus998@naver.com",
  "hudan@mamiteam.com",
  "manan@outlook.com",
  "haroopceo@gmail.com",
  "ialexwwang@gmail.com",
  "ted.j.mullen@gmail.com",
  "gilbok@mamiteam.com",
  "indo.gilbok@gmail.com",
  "meawoppl@gmail.com",
  "hjorden@gmail.com",
  "straude@epasts.app",
  "kyle.woodward@gmail.com",
  "ka2n@pobox.com",
  "alex.esprit@gmail.com",
  "mahendrakalkura+straude@gmail.com",
  "yang92sw@gmail.com",
  "medounesibygeorgesbalde@gmail.com",
  "nickknissen@gmail.com",
  "frantuma@yahoo.com",
  "wschenk@gmail.com",
  "alexislours@protonmail.com",
  "wittman.mark@gmail.com",
  "amanda@unseen.inc",
  "hi@javokhir.com",
  "juani@neuronstudio.ai",
  "morrisisaacl@gmail.com",
  "tkhwang@gmail.com",
  "desita_gsheko@hotmail.com",
  "i@rudnkh.me",
  "github@buhidma.net",
  "victor.wu.mail@gmail.com",
  "exhaust-inks5s@icloud.com",
  "consensusmechanism@gmail.com",
  "securedbot@gmail.com",
  "santiagocarranc2@gmail.com",
  "tiodematias@gmail.com",
  "jdavmo75@gmail.com",
  "xavier@neodelta.eu",
  "basile.d.santos@gmail.com",
  "ctjj55vvqv@privaterelay.appleid.com",
  "jose.quevedo2011@gmail.com",
  "alexis.chambron@gmail.com",
  "fmemije00@gmail.com",
  "tristan.hubert@gmail.com",
  "6666alvaro666@gmail.com",
  "raulzarza.dev@gmail.com",
  "nihal.nihalani@gmail.com",
  "adamlinssen@gmail.com",
  "taliherzka@gmail.com",
  "jeg0330@gmail.com",
  "ineel@live.fr",
  "luisdavmora@gmail.com",
  "fedegonzalez@afal.mx",
  "fabricio@umbertoluce.com",
  "kevin.astuhuaman@berkeley.edu",
  "gonzalez@christiangr.me",
  "anaghk.dos@gmail.com",
  "jm@is4.ai",
  "anvithnreddy@gmail.com",
  "dav@akuaku.org",
  "nigam.akaash@gmail.com",
  "cyberpsych12@gmail.com",
  "nizam@regainapp.ai",
  "jaseemthayal@gmail.com",
  "gg@mf.me",
  "swayamg20@iitk.ac.in",
  "ilblackdragon@gmail.com",
  "harshaljaincs@gmail.com",
  "aditya30103@gmail.com",
  "luis.antonioarce@hotmail.com",
  "ahmetdedelerr@gmail.com",
  "dharan.codin@gmail.com",
  "roidersp@gmail.com",
  "laurentiu.cocanu@uipath.com",
  "solauris@gmail.com",
  "manas.nilorout@uipath.com",
  "manas.nilorout@cloud-elements.com",
  "lyang@wesleyan.edu",
  "xueeyoo@gmail.com",
  "julianrichey@gmail.com",
  "batch2022.018@gmail.com",
  "kwk236@gmail.com",
  "nickitakhy@gmail.com",
  "rosekamallove@gmail.com",
  "sohail21400@gmail.com",
  "ninoandres542@gmail.com",
  "administrador@novatiocreations.com",
  "m.ryoppippi@gmail.com",
  "jama117@hotmail.com",
  "superman121@yopmail.com",
  "aacs85@gmail.com",
  "ksmuthu@gmail.com",
  "hola@juancguerrero.com",
  "nypakun@gmail.com",
  "get.aniketg25@gmail.com",
  "thomasboser@gmail.com",
  "jean@reducto.ai",
  "jawad@milkstraw.ai",
  "aditabrm@gmail.com",
  "siddhant.pagariya@gmail.com",
  "mbrown87@gmail.com",
  "piotr@reducto.ai",
  "y.lemaout+straude@gmail.com",
  "nategraymachine@gmail.com",
  "vivienperrelle@gmail.com",
  "rene@getkobe.ai",
  "ianalin123@gmail.com",
  "carlos@junod.cl",
  "josh@joshuasnider.com",
  "jsseoih@gmail.com",
  "alexandergerrese@gmail.com",
  "jl@gladia.io",
  "isalafont@gmail.com",
  "mathieu.moullec@gmail.com",
  "florian@bruniaux.com",
  "mcouzinet@gmail.com",
  "thomas.gonzalez284@gmail.com",
  "thomasgonzalez284@gmail.com",
  "ethan@smadja.biz",
  "zhijun.yin@rakuten.com",
  "daxtor92@gmail.com",
  "maximeantoine1997@gmail.com",
  "etienne@bourdon.com",
  "josemanuelpr23@gmail.com",
  "bleleve@gmail.com",
  "quentinoudot@icloud.com",
  "sannymanichi@gmail.com",
  "ktanmaykumar@gmail.com",
  "panglarry0@gmail.com",
  "jason@predexon.com",
  "juungbae@gmail.com",
  "thecryptonative.official@gmail.com",
  "sherynliao@gmail.com",
  "ankshah.mail@gmail.com",
  "jtsato@stanford.edu",
  "spruik.au@gmail.com",
  "audelgado@gmail.com",
  "mohamedzibras2015@gmail.com",
  "mailsurajzso7@gmail.com",
  "florian@reech.com",
  "seanlockedin430@gmail.com",
  "luciengeorge95@gmail.com",
  "juans.gaitan@gmail.com",
  "andyrogers2@gmail.com",
  "atramontin@berkeley.edu",
  "gonzalo.vasquez@berkeley.edu",
  "hello@jonathanrobic.fr",
  "haseebarshad992@gmail.com",
  "ramighanem101@gmail.com",
  "grobinson@evernest.co",
  "grobinson@gmail.com",
  "kiran@nebula.haus",
  "hashimea@outlook.com",
  "stivenrosales01@gmail.com",
  "yahya.s.alhinai@gmail.com",
  "sebastian.urizar@gmail.com",
  "elliotjspadfield@gmail.com",
  "francejoshuar1@gmail.com",
  "sayakmaity11@gmail.com",
  "jcgaribayr@gmail.com",
  "nicolas.dgiuseppe@skello.io",
  "joeross7878@gmail.com",
  "kchelikavada@gmail.com",
  "syllab.contact@gmail.com",
  "eesaban@correo.url.edu.gt",
  "pablo.pineda@galileo.edu",
  "arnaudjeannin@outlook.com",
  "nandolrneto@gmail.com",
  "kyosuke.yoshimura@swandive.co.jp",
  "esus.dev@gmail.com",
  "ghfrancon@protonmail.com",
  "paul@bulldozer-collective.com",
  "faiz@torre.ai",
  "dylandersen@gmail.com",
  "bryan.bischof@gmail.com",
  "tokemlist@rxdiscard.com",
  "jinbinxu.1991@gmail.com",
  "864053411@qq.com",
  "straude@boazsobrado.com",
  "nathanbaseball49@gmail.com",
  "jaime.diazbeltran@gmail.com",
  "scanneruca@gmail.com",
  "wongshennan@gmail.com",
  "skb.rsvp@gmail.com",
  "shryukgrandhi@gmail.com",
  "spam.erased633@passmail.com",
  "jezrrelguerrero@gmail.com",
  "jaconwell@proton.me",
  "ankitsprasad007@gmail.com",
  "jjmileyjr@gmail.com",
  "berkino2099@gmail.com",
  "neev.jain0218@gmail.com",
  "samuell.patro@gmail.com",
  "ayush@adaline.ai",
  "me@manasranjan.dev",
  "melvin.chen@makenotion.com",
  "perez.jg22@gmail.com",
  "nadeem@ohmyweb.in",
  "baguskto@gmail.com",
  "abohoda3031@gmail.com",
  "faizp.dev@gmail.com",
  "easyexploreapp@gmail.com",
  "sandro@munda.me",
  "jason@jslabs.xyz",
  "rodrigotorresterrones@gmail.com",
  "freeclub@gmail.com",
  "kunalarora1729@gmail.com",
];

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function main() {
  console.log(`Sending to ${EMAILS.length} users...`);

  const batches = chunk(EMAILS, 100);
  let sent = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`Sending batch ${i + 1}/${batches.length} (${batch.length} emails)...`);

    const { error } = await resend.batch.send(
      batch.map((to) => ({
        from: FROM,
        replyTo: REPLY_TO,
        to,
        subject: SUBJECT,
        html: HTML_BODY,
        text: TEXT_BODY,
        tags: [{ name: "type", value: "product-hunt-launch" }],
      }))
    );

    if (error) {
      console.error(`Batch ${i + 1} failed:`, error);
      continue;
    }

    sent += batch.length;
    console.log(`Batch ${i + 1} sent. (${sent}/${EMAILS.length} total)`);
  }

  console.log(`Done. Sent ${sent} emails.`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
